import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/* ================================================================
   Live-Play Game Engine E2E Tests
   Requires migrations 20260814090000 + 20260815090000 applied and
   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY set.
   Skips gracefully when Supabase is not configured.

   Game setup uses the SECURITY DEFINER RPCs directly (the host UI
   isn't built yet); team actions go through the real HTTP endpoints
   with locally-signed session tokens (mirrors authToken.ts).
   ================================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_ANON_KEY.includes('placeholder')
);
const SESSION_SECRET = process.env.QUIZFLOW_SESSION_SECRET || 'qf-dev-insecure-secret-change-me';

function db() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ── Local JWT signing (mirrors src/quizflow/authToken.ts) ─────── */
const enc = new TextEncoder();
function b64url(bytes: Uint8Array) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function signToken(teamId: string, memberName: string, deviceId: string) {
  const now = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', enc.encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = b64url(enc.encode(JSON.stringify({ team_id: teamId, member_name: memberName, device_id: deviceId, iat: now, exp: now + 3600 })));
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

/* ── Fixtures ─────────────────────────────────────────────────── */
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
  freeze_duration_ms: { freeze_player: 6000, freeze_all: 4000 },
  boss_mode: {
    question_count: 10,
    duration_seconds: 60,
    per_question_cap_ms: 8000,
    advance_when_pct_answered: 0.6,
    points_per_correct: 200
  },
  rank_bonus: [500, 300, 200, 100]
};

const QUIZ = {
  title: 'E2E Live Quiz',
  description: 'live-play e2e fixture',
  language: 'en',
  questions: [
    { prompt: 'Q1 correct = 0 (easy)', choices: ['A', 'B', 'C', 'D'], correct_index: 0, difficulty: 'easy', time_limit_ms: 20000 },
    { prompt: 'Q2 correct = 2 (medium)', choices: ['A', 'B', 'C', 'D'], correct_index: 2, difficulty: 'medium', time_limit_ms: 20000 },
    { prompt: 'Q3 correct = 3 (hard)', choices: ['A', 'B', 'C', 'D'], correct_index: 3, difficulty: 'hard', time_limit_ms: 20000 }
  ]
};

let cleanup: (() => Promise<void>) | null = null;

test.beforeEach(() => { cleanup = null; });
test.afterEach(async () => {
  if (cleanup) await cleanup();
});

interface Seed {
  gameId: string;
  alphaId: string;
  betaId: string;
  tokenAlpha: string;
  tokenBeta: string;
}

/** Seed two teams + a game; return ids and signed tokens. */
async function seedGame(): Promise<Seed> {
  const gameId = 'E2E' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();

  const { data: teams } = await db()
    .from('teams')
    .insert([
      { name: 'E2E Alpha', code: 'EA' + Math.random().toString(36).slice(2, 6).toUpperCase(), roster: ['Alice', 'Bob'], status: 'waiting' },
      { name: 'E2E Beta', code: 'EB' + Math.random().toString(36).slice(2, 6).toUpperCase(), roster: ['Carol', 'Dave'], status: 'waiting' }
    ])
    .select();
  const [alpha, beta] = teams || [];
  if (!alpha || !beta) throw new Error('Team seed failed');

  const sanitized = { ...QUIZ, questions: QUIZ.questions.map(({ correct_index, ...q }) => q) };
  const keys = QUIZ.questions.map(q => q.correct_index);
  const { error } = await db().rpc('qf_create_game', {
    p_game_id: gameId,
    p_quiz: sanitized,
    p_keys: keys,
    p_mode: 'classic',
    p_config: CONFIG
  });
  if (error) throw new Error('qf_create_game failed: ' + error.message);

  cleanup = async () => {
    await db().from('quiz_sessions').delete().eq('game_id', gameId);
    await db().from('games').delete().eq('id', gameId);
    await db().from('teams').delete().in('id', [alpha.id, beta.id]);
  };

  return {
    gameId,
    alphaId: alpha.id,
    betaId: beta.id,
    tokenAlpha: await signToken(alpha.id, 'Alice', 'dev-alpha'),
    tokenBeta: await signToken(beta.id, 'Carol', 'dev-beta')
  };
}

async function sessionIdOf(gameId: string, teamId: string): Promise<string> {
  const { data } = await db()
    .from('quiz_sessions')
    .select('id')
    .eq('game_id', gameId)
    .eq('team_id', teamId)
    .maybeSingle();
  if (!data) throw new Error('session not found for team ' + teamId);
  return data.id;
}

async function post(request: import('@playwright/test').APIRequestContext, path: string, token: string, body?: any) {
  return request.post(path, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, data: body });
}

test.describe('Live-play game engine', () => {
  test.skip(!SUPABASE_CONFIGURED, 'Supabase not configured — apply the migrations and set env vars to run.');

  test('answer scoring: correct awards points+coins, wrong awards 0, duplicate rejected, no answer leak', async ({ request }) => {
    const { gameId, alphaId, tokenAlpha } = await seedGame();
    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'start' }); // Q1 (easy, key 0)

    const correct = await post(request, '/api/quiz/answer', tokenAlpha, { selected_option: 0, client_elapsed_ms: 1500 });
    const correctBody = await correct.json();
    expect(correct.status).toBe(200);
    expect(correctBody.success).toBe(true);
    expect(correctBody.correct).toBe(true);
    expect(correctBody.points_earned).toBe(100); // easy
    expect(correctBody.coins_earned).toBe(5);
    expect('correct_index' in correctBody).toBe(false); // never leaks the answer id

    // Duplicate answer for the same question → rejected, no double-credit.
    const dup = await post(request, '/api/quiz/answer', tokenAlpha, { selected_option: 0 });
    const dupBody = await dup.json();
    expect(dup.status).toBe(200);
    expect(dupBody.success).toBe(false);
    expect(dupBody.reason).toBe('already_answered');

    // Wrong answer on Q2 → 0 points, 0 coins.
    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'next' });
    const wrong = await post(request, '/api/quiz/answer', tokenAlpha, { selected_option: 1 });
    const wrongBody = await wrong.json();
    expect(wrongBody.correct).toBe(false);
    expect(wrongBody.points_earned).toBe(0);
    expect(wrongBody.coins_earned).toBe(0);

    const { data: row } = await db().from('quiz_sessions').select('points, coins, total_answered').eq('id', await sessionIdOf(gameId, alphaId)).single();
    expect(row!.points).toBe(100);
    expect(row!.coins).toBe(5);
    expect(row!.total_answered).toBe(2);
  });

  test('game state: correct answer only present at reveal, never during question_active', async ({ request }) => {
    const { gameId, tokenAlpha } = await seedGame();
    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'start' });

    const active = await request.get('/api/quiz/game/state', { headers: { Authorization: `Bearer ${tokenAlpha}` } });
    const activeBody = await active.json();
    expect(activeBody.success).toBe(true);
    expect(activeBody.game.status).toBe('question_active');
    expect(activeBody.game.active_question.correct_index).toBeUndefined();

    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'reveal' });
    const revealed = await request.get('/api/quiz/game/state', { headers: { Authorization: `Bearer ${tokenAlpha}` } });
    const revealedBody = await revealed.json();
    expect(revealedBody.game.status).toBe('question_reveal');
    expect(revealedBody.game.active_question.correct_index).toBe(0); // reveal-phase only
  });

  test('power-up shop: atomic purchase, insufficient funds → 402, bid applies to NEXT question', async ({ request }) => {
    const { gameId, betaId, tokenAlpha, tokenBeta } = await seedGame();

    // Credit both teams some coins (server-side — the shop deducts atomically).
    const { data: both } = await db().from('quiz_sessions').select('id').eq('game_id', gameId);
    for (const s of both || []) {
      await db().from('quiz_sessions').update({ coins: 50 }).eq('id', s.id);
    }

    // Alpha spends all 50 on bid_4x (cost 50) → exactly 0 left.
    const spend = await post(request, '/api/quiz/shop/buy', tokenAlpha, { item: 'bid_4x' });
    expect(spend.status).toBe(200);
    expect((await spend.json()).coins_remaining).toBe(0);

    // Alpha cannot afford anything now → 402.
    const poor = await post(request, '/api/quiz/shop/buy', tokenAlpha, { item: 'bid_2x' });
    expect(poor.status).toBe(402);

    // Q1 active.
    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'start' });

    // Beta buys bid_2x DURING Q1 (50 - 20 = 30). The bid is bound to
    // the question live at purchase (Q1), so it cannot apply to Q1 —
    // it applies to the NEXT question (Q2).
    const buy = await post(request, '/api/quiz/shop/buy', tokenBeta, { item: 'bid_2x' });
    const buyBody = await buy.json();
    expect(buy.status).toBe(200);
    expect(buyBody.success).toBe(true);
    expect(buyBody.coins_remaining).toBe(30);

    // Q1 answer: no bid → easy 100.
    const q1 = await post(request, '/api/quiz/answer', tokenBeta, { selected_option: 0 });
    expect((await q1.json()).points_earned).toBe(100);

    // Q2: bid applies → medium 200 × 2 = 400, then consumed.
    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'next' });
    const q2 = await post(request, '/api/quiz/answer', tokenBeta, { selected_option: 2 });
    expect((await q2.json()).points_earned).toBe(400);

    const { data: betaRow } = await db().from('quiz_sessions').select('bid_multiplier').eq('id', await sessionIdOf(gameId, betaId)).single();
    expect(betaRow!.bid_multiplier).toBe(1); // consumed
  });

  test('freeze enforcement: frozen team answers are rejected server-side', async ({ request }) => {
    const { gameId, alphaId, betaId, tokenAlpha, tokenBeta } = await seedGame();
    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'start' });

    // Credit Alpha, then Alpha freezes Beta via the shop.
    await db().from('quiz_sessions').update({ coins: 50 }).eq('id', await sessionIdOf(gameId, alphaId));
    const buy = await post(request, '/api/quiz/shop/buy', tokenAlpha, { item: 'freeze_player', target_team_id: betaId });
    expect(buy.status).toBe(200);

    // Beta answers while frozen → rejected, nothing recorded.
    const frozen = await post(request, '/api/quiz/answer', tokenBeta, { selected_option: 0 });
    const frozenBody = await frozen.json();
    expect(frozen.status).toBe(200);
    expect(frozenBody.success).toBe(false);
    expect(frozenBody.reason).toBe('frozen');
    expect(frozenBody.points_earned).toBe(0);

    const { data: betaRow } = await db().from('quiz_sessions').select('points, coins, total_answered').eq('id', await sessionIdOf(gameId, betaId)).single();
    expect(betaRow!.points).toBe(0);
    expect(betaRow!.total_answered).toBe(0);
  });

  test('boss mode: server-timed window, frenzy counts, rank bonus awarded once', async ({ request }) => {
    const { gameId, alphaId, betaId, tokenAlpha, tokenBeta } = await seedGame();
    await db().rpc('qf_advance_game', { p_game_id: gameId, p_action: 'start' });
    await db().rpc('qf_start_boss', { p_game_id: gameId });

    const state = await request.get('/api/quiz/game/state', { headers: { Authorization: `Bearer ${tokenAlpha}` } });
    const stateBody = await state.json();
    expect(stateBody.game.status).toBe('boss_frenzy');
    expect(stateBody.game.boss_window_ends_at).toBeTruthy();
    expect(stateBody.game.active_question.correct_index).toBeUndefined();

    // Both teams answer boss Q0 correctly (key 0).
    const a = await post(request, '/api/quiz/answer', tokenAlpha, { selected_option: 0 });
    const b = await post(request, '/api/quiz/answer', tokenBeta, { selected_option: 0 });
    expect((await a.json()).success).toBe(true);
    expect((await b.json()).success).toBe(true);

    // During the window: frenzy counts but per-correct points are NOT
    // awarded yet (they come at finalize — no double-award).
    const { data: rows } = await db().from('quiz_sessions').select('frenzy_correct_count, points').eq('game_id', gameId);
    for (const r of rows || []) {
      expect(r.frenzy_correct_count).toBe(1);
      expect(r.points).toBe(0);
    }

    // Finalize (host action → RPC): 200/correct + rank bonus; idempotent.
    const finRpc = await db().rpc('qf_finalize_boss', { p_game_id: gameId });
    expect(finRpc.error).toBeNull();

    const { data: after } = await db().from('quiz_sessions').select('points, frenzy_correct_count').eq('game_id', gameId);
    // Both teams have 1 correct → ranks 0 and 1 get 200+500 and 200+300.
    const pointsSet = new Set((after || []).map(r => r.points));
    expect(pointsSet.has(200 + 500)).toBe(true);
    expect(pointsSet.has(200 + 300)).toBe(true);

    const fin2 = await db().rpc('qf_finalize_boss', { p_game_id: gameId });
    const fin2Result = Array.isArray(fin2.data) ? fin2.data[0] : fin2.data;
    expect(fin2Result.ok).toBe(false);
    expect(fin2Result.reason).toBe('already_finalized');

    void alphaId;
    void betaId;
  });

  test('host-only gates: game, advance, boss/start, leaderboard require a host session', async ({ request }) => {
    const noAuth = await request.post('/api/quiz/game', { data: { game_id: 'X', quiz: QUIZ } });
    expect(noAuth.status()).toBe(401);

    const noAuthAdvance = await request.post('/api/quiz/game/advance', { data: { game_id: 'X', action: 'start' } });
    expect(noAuthAdvance.status()).toBe(401);

    const noAuthBoss = await request.post('/api/quiz/boss/start', { data: { game_id: 'X' } });
    expect(noAuthBoss.status()).toBe(401);

    const noAuthFinalize = await request.post('/api/quiz/boss/finalize', { data: { game_id: 'X' } });
    expect(noAuthFinalize.status()).toBe(401);

    const noAuthLeaderboard = await request.get('/api/admin/leaderboard?game_id=X');
    expect(noAuthLeaderboard.status()).toBe(401);

    const badAuth = await request.post('/api/quiz/game', {
      headers: { Authorization: 'Bearer not-a-real-token' },
      data: { game_id: 'X', quiz: QUIZ }
    });
    expect(badAuth.status()).toBe(401);
  });
});
