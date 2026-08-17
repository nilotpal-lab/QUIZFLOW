import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/* ================================================================
   Team Login E2E Tests
   Requires the Supabase migration (teams + quiz_sessions) applied
   and NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY set.
   Skips gracefully when Supabase is not configured.
   ================================================================ */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_CONFIGURED = Boolean(
  SUPABASE_URL &&
  SUPABASE_ANON_KEY &&
  !SUPABASE_URL.includes('placeholder') &&
  !SUPABASE_ANON_KEY.includes('placeholder')
);

function db() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

let seedCode: string | null = null;

async function seedTeam(overrides: Record<string, unknown> = {}) {
  const code = 'T' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  seedCode = code;
  const { data, error } = await db()
    .from('teams')
    .insert({
      name: 'Team ' + code,
      code,
      roster: ['Alice', 'Bob', 'Carol', 'Dave'],
      ...overrides
    })
    .select()
    .single();
  if (error) throw new Error('Seed failed: ' + error.message);
  return data;
}

async function cleanupSeed() {
  if (seedCode) {
    try {
      await db().from('teams').delete().eq('code', seedCode);
    } catch {
      // best-effort cleanup
    }
    seedCode = null;
  }
}

test.afterEach(async () => {
  await cleanupSeed();
});

test.describe('Team login backend', () => {
  test.skip(!SUPABASE_CONFIGURED, 'Supabase not configured — apply the migration and set env vars to run.');

  test('atomic claim: concurrent claims for the same code — exactly one wins', async ({ request }) => {
    const team = await seedTeam();

    const bodyA = { code: team.code, member_name: 'Alice', device_id: 'device-A' };
    const bodyB = { code: team.code, member_name: 'Bob', device_id: 'device-B' };

    const [resA, resB] = await Promise.all([
      request.post('/api/teams/claim', { data: bodyA }),
      request.post('/api/teams/claim', { data: bodyB })
    ]);

    const statuses = [resA.status(), resB.status()].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]); // exactly one success, one conflict

    const winner = resA.status() === 200 ? resA : resB;
    const loser = resA.status() === 409 ? resA : resB;

    const winBody = await winner.json();
    const loseBody = await loser.json();

    expect(winBody.success).toBe(true);
    expect(typeof winBody.token).toBe('string');
    expect(winBody.token.length).toBeGreaterThan(10);
    expect(winBody.team.claimed_by).toBe(winBody.team.claimed_by);

    expect(loseBody.success).toBe(false);
    expect(loseBody.claimed_by).toBeTruthy();
    // The 409 must name the member who actually won.
    expect(loseBody.claimed_by).toBe(winBody.team.claimed_by);
    expect([bodyA.member_name, bodyB.member_name]).toContain(loseBody.claimed_by);

    // DB invariants: single team row, claimed by the winner only.
    const { data: rows, error } = await db()
      .from('teams')
      .select('*')
      .eq('code', team.code);
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].claimed_by).toBe(winBody.team.claimed_by);
    expect(rows![0].device_id).toBe(winBody.team.claimed_by === bodyA.member_name ? 'device-A' : 'device-B');
    expect(rows![0].status).toBe('claimed');

    // Claiming must not create quiz_session rows.
    const { data: sessions, error: sessErr } = await db()
      .from('quiz_sessions')
      .select('id')
      .eq('team_id', team.id);
    expect(sessErr).toBeNull();
    expect(sessions).toHaveLength(0);
  });

  test('reconnect: the claiming device can refresh and resume', async ({ request }) => {
    const team = await seedTeam();
    const ctx = await request.newContext();

    const first = await ctx.post('/api/teams/claim', {
      data: { code: team.code, member_name: 'Carol', device_id: 'device-C' }
    });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.reconnect).toBe(false);

    // Same device, refresh → resume.
    const again = await ctx.post('/api/teams/claim', {
      data: { code: team.code, member_name: 'Carol', device_id: 'device-C' }
    });
    expect(again.status()).toBe(200);
    const againBody = await again.json();
    expect(againBody.reconnect).toBe(true);
    expect(againBody.team.claimed_by).toBe('Carol');

    // Different device → rejected.
    const other = await ctx.post('/api/teams/claim', {
      data: { code: team.code, member_name: 'Dave', device_id: 'device-D' }
    });
    expect(other.status()).toBe(409);
    const otherBody = await other.json();
    expect(otherBody.claimed_by).toBe('Carol');

    await ctx.dispose();
  });

  test('GET /api/session/me returns the team for the cookie holder, 401 without', async ({ request }) => {
    const team = await seedTeam();
    const ctx = await request.newContext();

    const claim = await ctx.post('/api/teams/claim', {
      data: { code: team.code, member_name: 'Alice', device_id: 'device-A' }
    });
    expect(claim.status()).toBe(200);

    const me = await ctx.get('/api/session/me');
    expect(me.status()).toBe(200);
    const meBody = await me.json();
    expect(meBody.success).toBe(true);
    expect(meBody.team.code).toBe(team.code);
    expect(meBody.team.claimed_by).toBe('Alice');
    expect(meBody.member_name).toBe('Alice');

    // No cookie → 401.
    const anonCtx = await request.newContext();
    const anon = await anonCtx.get('/api/session/me');
    expect(anon.status()).toBe(401);
    await anonCtx.dispose();
    await ctx.dispose();
  });

  test('POST /api/quiz/submit is idempotent and marks the team submitted', async ({ request }) => {
    const team = await seedTeam();
    const ctx = await request.newContext();

    const claim = await ctx.post('/api/teams/claim', {
      data: { code: team.code, member_name: 'Bob', device_id: 'device-B' }
    });
    expect(claim.status()).toBe(200);

    const payload = {
      answers: [{ q: 0, selected: 1 }, { q: 1, selected: 0 }],
      score: 750,
      violations: [{ type: 'blur' }]
    };

    const first = await ctx.post('/api/quiz/submit', { data: payload });
    expect(first.status()).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.success).toBe(true);
    expect(firstBody.alreadySubmitted).toBe(false);
    expect(firstBody.session.score).toBe(750);
    expect(firstBody.session.submitted_at).toBeTruthy();

    // Duplicate submit must not re-score.
    const second = await ctx.post('/api/quiz/submit', {
      data: { answers: [{ q: 0, selected: 3 }], score: 9999 }
    });
    expect(second.status()).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.success).toBe(true);
    expect(secondBody.alreadySubmitted).toBe(true);
    expect(secondBody.session.score).toBe(750);

    // DB invariants: exactly one session row, team submitted.
    const { data: sessions } = await db()
      .from('quiz_sessions')
      .select('*')
      .eq('team_id', team.id);
    expect(sessions).toHaveLength(1);
    expect(sessions![0].score).toBe(750);

    const { data: teamRow } = await db()
      .from('teams')
      .select('status')
      .eq('id', team.id)
      .single();
    expect(teamRow!.status).toBe('submitted');

    await ctx.dispose();
  });

  test('admin endpoints reject requests without a valid host session', async ({ request }) => {
    const team = await seedTeam();

    // No auth header.
    const noAuth = await request.get('/api/admin/teams');
    expect(noAuth.status()).toBe(401);

    // Garbage bearer token.
    const badAuth = await request.get('/api/admin/teams', {
      headers: { Authorization: 'Bearer not-a-real-token' }
    });
    expect(badAuth.status()).toBe(401);

    // Release without auth.
    const release = await request.post(`/api/admin/teams/${team.id}/release`);
    expect(release.status()).toBe(401);

    // Team must be untouched after the rejected release.
    const { data: teamRow } = await db()
      .from('teams')
      .select('claimed_by, status')
      .eq('id', team.id)
      .single();
    expect(teamRow!.claimed_by).toBeNull();
    expect(teamRow!.status).toBe('waiting');
  });
});
