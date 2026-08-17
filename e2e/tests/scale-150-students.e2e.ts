import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/* ================================================================
   QuizFlow — 150 Real-Student-Browser Scale Test

   Launches STUDENT_COUNT real headless Chromium contexts. Each one
   goes through the ACTUAL student flow in the browser:
     login  → /quizflow/student/login (username + password submit)
     join   → /quizflow/student/dashboard → "Join Game" → lobby
     play   → answer the live question through the real UI
   The host then starts the game and every browser answers; the test
   verifies DB integrity: exactly one recorded answer per session,
   correct scoring, no lost/duplicated updates.

   Requires migrations 20260814090000 + 20260815120000 +
   20260815090000 applied and NEXT_PUBLIC_SUPABASE_URL / ANON_KEY set.
   Skips gracefully when Supabase is not configured.

   Env overrides:
     SCALE_STUDENTS  — how many browsers to launch (default 150)
     SCALE_WAVE_SIZE — logins per wave to stay under the per-IP
                       rate limiter (100 req / 10s) (default 25)
   ================================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_ANON_KEY.includes('placeholder')
);
const STUDENT_COUNT = Number(process.env.SCALE_STUDENTS || 150);
const WAVE_SIZE = Number(process.env.SCALE_WAVE_SIZE || 25);
const ROSTER = ['Alice', 'Bob', 'Carol', 'Dave']; // leader = ROSTER[0] → password
const PREFIX = 'SC'; // seed code prefix for safe cleanup
const LEADER = ROSTER[0];

function db() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ── PBKDF2 hashing — mirrors src/quizflow/credentials.ts ─────── */
const enc = new TextEncoder();
function b64url(bytes: Uint8Array) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}
async function hashPassword(password: string, salt: string) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 120_000 },
    keyMaterial,
    256
  );
  return b64url(new Uint8Array(bits));
}

/* ── Fixture quiz (single question; classic mode never auto-advances) ── */
const QUIZ = {
  title: 'Scale Test Quiz',
  description: '150-student browser stampede fixture',
  language: 'en',
  questions: [
    { prompt: 'SC Q1 — pick A (0)', choices: ['A1', 'B1', 'C1', 'D1'], correct_index: 0, difficulty: 'easy', time_limit_ms: 60000 }
  ]
};
const CONFIG = {
  difficulty_points: { easy: 100, medium: 200, hard: 300 },
  difficulty_coins: { easy: 5, medium: 10, hard: 20 },
  fast_threshold_ms: 5000,
  fast_multiplier: 1.5,
  streak_step: 0.1,
  streak_cap: 0.5,
  boss_wrong_points: 5,
  min_response_ms: 100,
  powerup_costs: { freeze_player: 15, freeze_all: 30, bid_2x: 20, bid_3x: 35, bid_4x: 50 },
  freeze_duration_ms: { freeze_player: 6000, freeze_all: 4000 }
};

/* ── Fixtures / cleanup ───────────────────────────────────────── */
let cleanup: (() => Promise<void>) | null = null;

test.beforeEach(() => { cleanup = null; });
test.afterEach(async () => {
  if (cleanup) await cleanup();
});

interface Seed {
  gameId: string;
  teams: { id: string; name: string; code: string }[];
  prevGateOpen: boolean;
}

/** Seed teams + a game, force the day-of gate open; return ids. */
async function seedGame(): Promise<Seed> {
  const gameId = 'SC' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();

  // Seed teams with the CURRENT credential scheme: username = team name,
  // password = leader name (first roster member).
  const rows = [];
  for (let i = 1; i <= STUDENT_COUNT; i++) {
    const code = `${PREFIX}${String(i).padStart(4, '0')}`;
    const name = `Team ${code}`;
    const salt = randomSalt();
    rows.push({
      name,
      code,
      username: name,
      password_salt: salt,
      password_hash: await hashPassword(LEADER, salt),
      roster: ROSTER,
      status: 'waiting'
    });
  }
  const { data: teams, error: seedError } = await db().from('teams').insert(rows).select();
  if (seedError || !teams || teams.length !== STUDENT_COUNT) {
    throw new Error('Team seed failed: ' + (seedError?.message || 'row count mismatch'));
  }

  // Open the day-of gate so the real login endpoint accepts requests.
  const { data: cfg } = await db().from('event_config').select('login_open').eq('id', 1).maybeSingle();
  const prevGateOpen = Boolean(cfg?.login_open);
  await db().from('event_config').update({ login_open: true, updated_at: new Date().toISOString() }).eq('id', 1);

  // Register the game (registers a quiz_sessions row for EVERY team in
  // the DB — including non-seed teams — so cleanup deletes by game_id).
  const sanitized = { ...QUIZ, questions: QUIZ.questions.map(({ correct_index, ...q }) => q) };
  const { error } = await db().rpc('qf_create_game', {
    p_game_id: gameId,
    p_quiz: sanitized,
    p_keys: QUIZ.questions.map(q => q.correct_index),
    p_mode: 'classic',
    p_config: CONFIG
  });
  if (error) throw new Error('qf_create_game failed: ' + error.message);

  cleanup = async () => {
    // FK order: sessions (by game_id AND team ids) → game → teams.
    await db().from('quiz_sessions').delete().eq('game_id', gameId);
    await db().from('quiz_sessions').delete().in('team_id', teams.map(t => t.id));
    await db().from('games').delete().eq('id', gameId);
    await db().from('teams').delete().in('id', teams.map(t => t.id));
    await db().from('event_config').update({ login_open: prevGateOpen, updated_at: new Date().toISOString() }).eq('id', 1);
  };

  return { gameId, teams, prevGateOpen };
}

/* ── One real student browser: login → dashboard → lobby ──────── */
async function studentToLobby(browser: Browser, team: { id: string; name: string; code: string }): Promise<{ context: BrowserContext; page: Page; team: typeof team }> {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // mobile — students use phones
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });
  const page = await context.newPage();

  try {
    // 1. Login through the real UI. Wait for hydration BEFORE touching
    //    the form: the "● Login is open" indicator only renders after the
    //    gate fetch in useEffect, so it proves React mounted (a click on
    //    the un-hydrated form would trigger a native GET submit instead
    //    of the real POST).
    await page.goto('/quizflow/student/login', { waitUntil: 'load', timeout: 30_000 });
    await page.waitForSelector('text=● Login is open', { timeout: 20_000 });
    await page.fill('#student-username', team.name, { timeout: 15_000 });
    await page.fill('#student-password', LEADER);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/quizflow/student/dashboard', { timeout: 30_000 });

    // 2. Join the game → lobby.
    await page.click('[aria-label="Join game"]', { timeout: 15_000 });
    await page.waitForURL('**/quizflow/student/lobby', { timeout: 30_000 });

    // 3. Reach the lobby (game exists, status lobby → "Waiting for the Admin").
    await page.waitForSelector('text=Waiting for the Admin', { timeout: 30_000 });

    return { context, page, team };
  } catch (err) {
    await context.close().catch(() => {});
    throw err;
  }
}

/* ── Host-side advance (direct RPC — host UI is not the point here) ── */
async function advance(gameId: string, action: string) {
  const { error } = await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: action });
  if (error) throw new Error(`qf_advance_game(${action}) failed: ` + error.message);
}

test.describe('150 real student browsers in a live game', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!SUPABASE_CONFIGURED, 'Supabase not configured — apply the migrations and set env vars to run.');

  test(`launch ${STUDENT_COUNT} browsers: login → lobby → answer, DB integrity`, async ({ browser }) => {
    // This test drives 150 real browser sessions; the default 60s timeout
    // is far too short. Give it a generous ceiling.
    test.setTimeout(15 * 60 * 1000);

    const { gameId, teams } = await seedGame();
    console.log(`🌱 Seeded ${teams.length} teams + game ${gameId} (gate forced open)`);

    // ── Phase 1: every student logs in and reaches the lobby ────────
    // Wave the logins so we stay under the per-IP login rate limiter
    // (100 req / 10s) — one login per wave per team, WAVE_SIZE at a time.
    const sessions: { context: BrowserContext; page: Page; team: typeof teams[number] }[] = [];
    for (let i = 0; i < teams.length; i += WAVE_SIZE) {
      const wave = teams.slice(i, i + WAVE_SIZE);
      const results = await Promise.all(wave.map(t => studentToLobby(browser, t)));
      sessions.push(...results);
      console.log(`👥 ${sessions.length}/${teams.length} browsers in the lobby`);
      if (i + WAVE_SIZE < teams.length) await new Promise(r => setTimeout(r, 500));
    }
    expect(sessions.length).toBe(STUDENT_COUNT);

    // ── Phase 2: host starts the game → question goes live ──────────
    await advance(gameId, 'start');
    console.log('🚀 Game started — Q1 live');

    // ── Phase 3: every student answers through the real UI ──────────
    // The lobby polls game state every 1s and resets the result chip on
    // every tick, so "Correct!" only flashes <1s. The PERSISTENT
    // confirmation is the answer button becoming disabled (answerLocked
    // survives polls). DB scoring is verified separately below.
    const answered = await Promise.all(sessions.map(async ({ page }) => {
      const firstBtn = page.locator('.answer-btn').first();
      await firstBtn.waitFor({ state: 'visible', timeout: 30_000 });
      await firstBtn.click();
      await page.waitForSelector('.answer-btn[disabled]', { timeout: 30_000 });
      return true;
    }));
    expect(answered.length).toBe(STUDENT_COUNT);
    console.log(`✅ All ${STUDENT_COUNT} browsers answered (server-confirmed)`);

    // ── Phase 4: DB integrity ───────────────────────────────────────
    const { data: sessionsRows } = await db()
      .from('quiz_sessions')
      .select('team_id, points, coins, total_answered, total_correct')
      .eq('game_id', gameId)
      .in('team_id', teams.map(t => t.id));

    const seedSessions = (sessionsRows || []).filter(s => teams.some(t => t.id === s.team_id));
    expect(seedSessions.length).toBe(STUDENT_COUNT);

    const answeredOnce = seedSessions.filter(s => s.total_answered === 1);
    expect(answeredOnce.length).toBe(STUDENT_COUNT); // no lost answers
    const correct = seedSessions.filter(s => s.total_correct === 1);
    expect(correct.length).toBe(STUDENT_COUNT); // everyone picked A (correct)
    const pointsOk = seedSessions.every(s => s.points === 100); // easy correct
    expect(pointsOk).toBe(true);
    const coinsOk = seedSessions.every(s => s.coins === 5);
    expect(coinsOk).toBe(true);

    console.log(`🗄️  DB: ${seedSessions.length}/${STUDENT_COUNT} sessions · answered 1× each · 100 pts · 5 coins ✅`);

    // ── Phase 5: close every browser context ────────────────────────
    await Promise.all(sessions.map(s => s.context.close().catch(() => {})));
  });
});
