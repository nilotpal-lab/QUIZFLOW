import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/* ================================================================
   Admin/Student Dashboard E2E Tests
   Covers the student credential login (day-of gate, PBKDF2 verify,
   one-device-per-team binding) + session/me. The gate is flipped
   directly in the DB (an admin Bearer token isn't obtainable in
   the test runner), which exercises the same code path the admin
   toggle drives.

   Requires the 20260815120000 migration applied (event_config +
   teams.username/password_hash) and Supabase env vars set. Skips
   gracefully when Supabase is not configured.
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

const PBKDF2_ITERATIONS = 120_000;

/** Same PBKDF2-SHA256 + base64url (unpadded) format as src/quizflow/credentials.ts. */
async function pbkdf2Hash(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  );
  return Buffer.from(bits).toString('base64url');
}

let seedTeamId: string | null = null;
let seedUsername: string = '';

async function seedTeamWithCredentials(username: string, password: string) {
  seedUsername = username;
  const salt = 'test-salt-' + Date.now();
  const hash = await pbkdf2Hash(password, salt);
  const { data, error } = await db()
    .from('teams')
    .insert({
      name: 'E2E Team ' + username,
      code: 'E2E' + Date.now().toString(36).toUpperCase().slice(-6),
      username,
      password_salt: salt,
      password_hash: hash,
      roster: ['Alice', 'Bob', 'Carol', 'Dave'],
      status: 'waiting'
    })
    .select()
    .single();
  if (error) throw new Error('Seed failed: ' + error.message);
  seedTeamId = data.id;
  return data;
}

async function setGate(loginOpen: boolean) {
  const { error } = await db()
    .from('event_config')
    .upsert({ id: 1, login_open: loginOpen, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error('Gate set failed: ' + error.message);
}

async function cleanup() {
  try {
    if (seedTeamId) await db().from('teams').delete().eq('id', seedTeamId);
    await setGate(false);
  } catch {
    // best-effort cleanup
  }
  seedTeamId = null;
}

test.beforeEach(async () => {
  await setGate(false); // closed by default
});

test.afterEach(async () => {
  await cleanup();
});

test.describe('Student credential login', () => {
  test.skip(!SUPABASE_CONFIGURED, 'Supabase not configured — apply the migrations and set env vars to run.');

  test('gate rejects login when closed, accepts when open, and issues a session', async ({ request }) => {
    const username = 'e2e-gate-' + Date.now().toString(36);
    await seedTeamWithCredentials(username, 'Passw0rd!9');

    const body = { username, password: 'Passw0rd!9', device_id: 'device-1' };

    // Closed → 403 with gate state.
    const closed = await request.post('/api/student/login', { data: body });
    expect(closed.status()).toBe(403);
    const closedBody = await closed.json();
    expect(closedBody.gate_state).toBe('closed');

    // Open → 200 + cookie.
    await setGate(true);
    const ctx = await request.newContext();
    const ok = await ctx.post('/api/student/login', { data: body });
    expect(ok.status()).toBe(200);
    const okBody = await ok.json();
    expect(okBody.success).toBe(true);
    expect(okBody.team.username).toBe(username);
    expect(okBody.reconnect).toBe(false);

    // Session cookie works for /api/session/me.
    const me = await ctx.get('/api/session/me');
    expect(me.status()).toBe(200);
    const meBody = await me.json();
    expect(meBody.team.username).toBe(username);

    await ctx.dispose();
  });

  test('wrong password is rejected and a second device is blocked', async ({ request }) => {
    const username = 'e2e-device-' + Date.now().toString(36);
    const team = await seedTeamWithCredentials(username, 'CorrectPass9!');
    await setGate(true);

    // Wrong password.
    const wrong = await request.post('/api/student/login', {
      data: { username, password: 'wrong-password', device_id: 'device-A' }
    });
    expect(wrong.status()).toBe(401);

    // First device logs in.
    const ctxA = await request.newContext();
    const first = await ctxA.post('/api/student/login', {
      data: { username, password: 'CorrectPass9!', device_id: 'device-A' }
    });
    expect(first.status()).toBe(200);

    // Second device → 409.
    const ctxB = await request.newContext();
    const second = await ctxB.post('/api/student/login', {
      data: { username, password: 'CorrectPass9!', device_id: 'device-B' }
    });
    expect(second.status()).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.error).toContain('already logged in');

    // Same device refresh → reconnect:true.
    const again = await ctxA.post('/api/student/login', {
      data: { username, password: 'CorrectPass9!', device_id: 'device-A' }
    });
    expect(again.status()).toBe(200);
    const againBody = await again.json();
    expect(againBody.reconnect).toBe(true);

    // DB: device bound to the winner only.
    const { data: row } = await db().from('teams').select('device_id').eq('id', team.id).single();
    expect(row!.device_id).toBe('device-A');

    await ctxA.dispose();
    await ctxB.dispose();
  });

  test('student leaderboard is 401 without a session and admin team create is 401 without a host token', async ({ request }) => {
    const noSession = await request.get('/api/quiz/leaderboard?game_id=EVENT');
    expect(noSession.status()).toBe(401);

    const noAuth = await request.post('/api/admin/teams', {
      data: { name: 'Should Not Create', roster: ['A'] }
    });
    expect(noAuth.status()).toBe(401);
  });
});
