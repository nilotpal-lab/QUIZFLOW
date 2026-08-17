#!/usr/bin/env node
/* ================================================================
   QuizFlow — Boss-Mode Answer Load Test (150-team stampede)

   The highest-risk write window in the system: ~150 teams answering
   near-simultaneously inside a server-timed boss finale. This test
   registers a game, buys bids for a few teams (shop closes during
   the boss window, so purchases happen BEFORE it opens), opens the
   boss window, fires ~150 concurrent answers through the REAL
   /api/quiz/answer route, then verifies DB invariants:
     * no lost/duplicated score updates (every team answered ≤ 1×)
     * frozen teams rejected (0 points, 0 answers recorded)
     * no negative coins
     * boss finalize is idempotent

   Session tokens are signed locally (mirrors authToken.ts) to
   bypass the claim rate-limit — claims are covered by
   loadtest-teams.mjs.

   Requirements:
     - .env.local with NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
     - Migrations 20260814090000 + 20260815090000 applied
     - Dev server running on :3001 (npm run dev)

   Usage:
     node scripts/loadtest-boss.mjs            # burst + verify + cleanup
     node scripts/loadtest-boss.mjs --keep     # retain seed data

   Env overrides: LOADTEST_TEAMS, LOADTEST_BASE, LOADTEST_GAME
   ================================================================ */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

/* ── Config ──────────────────────────────────────────────────── */
const BASE = process.env.LOADTEST_BASE || 'http://localhost:3001'
const TEAM_COUNT = Number(process.env.LOADTEST_TEAMS || 150)
const GAME_ID = (process.env.LOADTEST_GAME || 'LTBOSS01').toUpperCase()
const PREFIX = 'LTB' // seed code prefix for safe cleanup
const KEEP = process.argv.includes('--keep')
const ROSTER = ['Alice', 'Bob', 'Carol', 'Dave']
const WRONG_RATIO = 0.4   // ~40% wrong answers to exercise the 0 / -5 paths
const FROZEN_TEAMS = 5    // frozen before the burst — must be rejected
const BID_TEAMS = 3       // buy 2x bids BEFORE the boss window opens

/* Scoring mirrors (single source of truth is src/quizflow/scoring.ts —
   this is the snapshot that qf_create_game stores as games.config). */
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
    per_question_cap_ms: 20000,      // keep Q0 open for the stampede
    advance_when_pct_answered: 1.0,  // only advance when ALL teams answer
    points_per_correct: 200
  },
  rank_bonus: [500, 300, 200, 100]
}

/* The quiz: 3 questions, keys known to the test only. Q0 is easy. */
const QUIZ = {
  title: 'Load Test Boss Quiz',
  description: 'boss-mode stampede fixture',
  language: 'en',
  questions: [
    { prompt: 'LT Q1 — pick A (0)', choices: ['A1', 'B1', 'C1', 'D1'], correct_index: 0, difficulty: 'easy', time_limit_ms: 20000 },
    { prompt: 'LT Q2 — pick C (2)', choices: ['A2', 'B2', 'C2', 'D2'], correct_index: 2, difficulty: 'medium', time_limit_ms: 20000 },
    { prompt: 'LT Q3 — pick D (3)', choices: ['A3', 'B3', 'C3', 'D3'], correct_index: 3, difficulty: 'hard', time_limit_ms: 20000 }
  ]
}
const KEYS = QUIZ.questions.map(q => q.correct_index)

/* ── .env.local loader (same as loadtest-teams.mjs) ──────────── */
function loadEnv() {
  const out = {}
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      out[m[1]] = v
    }
  } catch { /* no .env.local */ }
  return out
}

const env = loadEnv()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('placeholder') || SUPABASE_ANON_KEY.includes('placeholder')) {
  console.error('✖ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing or placeholder in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const t0 = Date.now()
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

/* ── Local session-token signing (mirrors src/quizflow/authToken.ts) ── */
const SECRET = process.env.QUIZFLOW_SESSION_SECRET || env.QUIZFLOW_SESSION_SECRET || 'qf-dev-insecure-secret-change-me'
const enc = new TextEncoder()

function b64url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function importKey() {
  return crypto.subtle.importKey('raw', enc.encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}
async function signToken(teamId, memberName, deviceId) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = b64url(enc.encode(JSON.stringify({ team_id: teamId, member_name: memberName, device_id: deviceId, iat: now, exp: now + 3600 })))
  const sig = await crypto.subtle.sign('HMAC', await importKey(), enc.encode(`${header}.${payload}`))
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`
}

/* ── Seed / setup ────────────────────────────────────────────── */
async function checkMigration() {
  const { error } = await db.from('games').select('id').limit(1)
  if (error) {
    console.error(`✖ Cannot read "games" — is the live-play migration applied? (${error.message})`)
    process.exit(1)
  }
}

async function cleanupOldSeeds() {
  if (KEEP) return
  const { data: teams } = await db.from('teams').select('id, code').like('code', `${PREFIX}%`)
  if (teams?.length) {
    const ids = teams.map(t => t.id)
    await db.from('quiz_sessions').delete().in('team_id', ids)
    await db.from('teams').delete().in('id', ids)
    console.log(`🧹 Removed ${teams.length} stale ${PREFIX}* seed teams`)
  }
  await db.from('games').delete().eq('id', GAME_ID)
}

async function seedTeams() {
  const rows = []
  for (let i = 1; i <= TEAM_COUNT; i++) {
    const code = `${PREFIX}${String(i).padStart(4, '0')}`
    rows.push({ name: `Team ${code}`, code, roster: ROSTER, status: 'waiting' })
  }
  const { data, error } = await db.from('teams').insert(rows).select()
  if (error) { console.error(`✖ Seed failed: ${error.message}`); process.exit(1) }
  console.log(`🌱 Seeded ${data.length} teams (${PREFIX}0001–${PREFIX}${String(TEAM_COUNT).padStart(4, '0')})`)
  return data
}

async function registerGame() {
  const sanitized = { ...QUIZ, questions: QUIZ.questions.map(({ correct_index, ...q }) => q) }
  const { data, error } = await db.rpc('qf_create_game', {
    p_game_id: GAME_ID,
    p_quiz: sanitized,
    p_keys: KEYS,
    p_mode: 'boss_raid',
    p_config: CONFIG
  })
  if (error) { console.error(`✖ qf_create_game failed: ${error.message}`); process.exit(1) }
  console.log(`🎮 Game ${GAME_ID} registered (${data?.question_count ?? '?'} questions, keys server-only)`)

  // Q0 becomes active (server-stamped) — bids must be bought now,
  // because the shop closes once the boss window opens.
  await db.rpc('qf_advance_game', { p_game_id: GAME_ID, p_action: 'start' })
}

async function openBossWindow() {
  const boss = await db.rpc('qf_start_boss', { p_game_id: GAME_ID })
  if (boss.error) { console.error(`✖ qf_start_boss failed: ${boss.error.message}`); process.exit(1) }
  console.log(`👹 Boss window open (${CONFIG.boss_mode.duration_seconds}s, ${CONFIG.boss_mode.question_count} questions)`)
}

/* ── The stampede ────────────────────────────────────────────── */
async function answer(teamId, cookieToken, selected) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE}/api/quiz/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cookieToken}` },
      body: JSON.stringify({ question_id: 'q0', selected_option: selected, client_elapsed_ms: 1200 })
    })
    let body = null
    try { body = await res.json() } catch { /* empty */ }
    return { teamId, status: res.status, body, ms: Date.now() - start }
  } catch (err) {
    return { teamId, status: 0, body: { error: String(err) }, ms: Date.now() - start }
  }
}

async function burst(teams, tokens, frozenIds) {
  console.log(`\n🔥 Firing ${teams.length} answers CONCURRENTLY at boss Q0 (${frozenIds.size} frozen)…`)
  const started = Date.now()

  const results = await Promise.all(teams.map(async (t, i) => {
    const key = KEYS[0] // boss Q0 → quiz question 0 (easy)
    const wrong = (i % 10) / 10 < WRONG_RATIO
    const selected = wrong ? (key + 1 + (i % 3)) % 4 : key
    return answer(t.id, tokens.get(t.id), selected)
  }))

  const wall = Date.now() - started
  const byStatus = {}
  const byReason = {}
  let accepted = 0
  for (const r of results) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
    if (r.body?.success === true) accepted++
    if (r.body?.reason) byReason[r.body.reason] = (byReason[r.body.reason] || 0) + 1
  }

  console.log(`\n── Result distribution (wall time ${wall}ms) ──`)
  for (const [s, n] of Object.entries(byStatus).sort((a, b) => a[0] - b[0])) console.log(`   HTTP ${s === 0 ? 'ERR' : s}: ${n}`)
  console.log(`   accepted (success:true): ${accepted} · reasons: ${JSON.stringify(byReason)}`)

  const lats = results.filter(r => r.status === 200).map(r => r.ms).sort((a, b) => a - b)
  if (lats.length) {
    const pct = p => lats[Math.min(lats.length - 1, Math.floor((p / 100) * lats.length))]
    console.log(`   200-latency: min ${lats[0]}ms · p50 ${pct(50)}ms · p95 ${pct(95)}ms · max ${lats[lats.length - 1]}ms`)
  }
  return { accepted, byStatus, byReason }
}

/* ── DB verification ─────────────────────────────────────────── */
async function verifyDb(teams, frozenIds, bidIds) {
  console.log('\n── DB invariant check ──')
  const { data: sessions, error } = await db
    .from('quiz_sessions')
    .select('team_id, points, coins, total_answered, frenzy_correct_count, bid_multiplier')
    .in('team_id', teams.map(t => t.id))
  if (error) { console.error(`✖ read quiz_sessions: ${error.message}`); return null }

  const byTeam = Object.fromEntries(sessions.map(s => [s.team_id, s]))
  const nonFrozen = sessions.filter(s => !frozenIds.has(s.team_id))

  // 1. Every non-frozen team answered exactly once — no lost or
  //    duplicated updates under concurrency.
  const answeredOnce = nonFrozen.filter(s => s.total_answered === 1)
  console.log(`   answered exactly once (non-frozen): ${answeredOnce.length}/${nonFrozen.length} ${answeredOnce.length === nonFrozen.length ? '✅' : '❌'}`)

  // 2. Frozen teams were rejected — nothing recorded.
  let frozenOk = true
  for (const id of frozenIds) {
    const s = byTeam[id]
    if (!s || s.total_answered !== 0 || s.points !== 0 || s.frenzy_correct_count !== 0) frozenOk = false
  }
  console.log(`   frozen teams rejected (0 answers/points): ${frozenOk ? '✅' : '❌'}`)

  // 3. No negative coins anywhere (bid teams: 20 seeded − 20 cost = 0).
  const negative = sessions.filter(s => s.coins < 0)
  console.log(`   negative coins: ${negative.length} ${negative.length ? '❌' : '✅'}`)

  // 4. Bids were purchased pre-boss and are NOT consumed during
  //    frenzy (frenzy counts corrects; points are awarded at close).
  let bidOk = true
  for (const id of bidIds) {
    const s = byTeam[id]
    if (!s || s.bid_multiplier !== 2) bidOk = false
  }
  console.log(`   bid_2x active through frenzy (not consumed): ${bidOk ? '✅' : '❌'}`)

  // 5. Points math during the window: corrects award 0 points (they
  //    COUNT via frenzy_correct_count), wrongs are boss damage −5
  //    floored at 0 — so everyone sits at 0 until finalize. Coins:
  //    +5 per correct (easy) awarded immediately.
  const correctCount = nonFrozen.filter(s => s.frenzy_correct_count === 1).length
  const wrongCount = nonFrozen.length - correctCount
  const duringPoints = nonFrozen.reduce((a, s) => a + s.points, 0)
  const expectedCoins = correctCount * 5
  const actualCoins = nonFrozen.reduce((a, s) => a + s.coins, 0)
  console.log(`   correct: ${correctCount} · wrong: ${wrongCount}`)
  console.log(`   Σ points DURING window: ${duringPoints} (expected 0 — awarded at close) ${duringPoints === 0 ? '✅' : '❌'}`)
  console.log(`   Σ coins ${actualCoins} vs expected ${expectedCoins}: ${actualCoins === expectedCoins ? '✅' : '❌'}`)

  // 6. Boss finalize: awards 200/correct + rank bonus, idempotent.
  const fin = await db.rpc('qf_finalize_boss', { p_game_id: GAME_ID })
  const finResult = Array.isArray(fin.data) ? fin.data[0] : fin.data
  console.log(`   qf_finalize_boss: ${finResult?.ok ? `✅ ranked ${finResult.ranked}` : `❌ ${fin.error?.message || finResult?.reason}`}`)
  const fin2 = await db.rpc('qf_finalize_boss', { p_game_id: GAME_ID })
  const fin2Result = Array.isArray(fin2.data) ? fin2.data[0] : fin2.data
  console.log(`   idempotent (2nd call): ${fin2Result?.ok === false && fin2Result?.reason === 'already_finalized' ? '✅' : '❌'}`)

  const { data: after } = await db
    .from('quiz_sessions')
    .select('points, frenzy_correct_count')
    .in('team_id', teams.map(t => t.id))
  const afterPoints = (after || []).reduce((a, s) => a + s.points, 0)
  // 200 × correct + rank bonus [500,300,200,100] (top-4, ties by speed)
  const expectedAfter = correctCount * 200 + (correctCount >= 4 ? 1100 : [500, 300, 200, 100].slice(0, correctCount).reduce((a, b) => a + b, 0))
  console.log(`   Σ points AFTER finalize ${afterPoints} vs expected ${expectedAfter}: ${afterPoints === expectedAfter ? '✅' : '❌'}`)

  return { correctCount, duringPoints, actualCoins, afterPoints, acceptedCount: nonFrozen.length }
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  console.log(`=== QuizFlow Boss-Mode Answer Load Test (${TEAM_COUNT} teams, game ${GAME_ID}) ===`)
  await checkMigration()
  await cleanupOldSeeds()
  const teams = await seedTeams()
  await registerGame()

  const tokens = new Map()
  for (const t of teams) tokens.set(t.id, await signToken(t.id, ROSTER[Math.floor(Math.random() * ROSTER.length)], `dev-${t.code}`))

  const frozenIds = new Set(teams.slice(0, FROZEN_TEAMS).map(t => t.id))
  const bidTeams = teams.slice(FROZEN_TEAMS, FROZEN_TEAMS + BID_TEAMS)
  const bidIds = new Set(bidTeams.map(t => t.id))

  // Freeze + buy bids BEFORE the boss window (shop closes in frenzy).
  const { data: sessions } = await db.from('quiz_sessions').select('id, team_id').in('team_id', [...frozenIds, ...bidIds])
  for (const s of sessions) {
    if (frozenIds.has(s.team_id)) {
      await db.from('quiz_sessions').update({ frozen_until: new Date(Date.now() + 60_000).toISOString() }).eq('id', s.id)
    }
    if (bidIds.has(s.team_id)) {
      // Seed exactly the cost so the atomic deduction is exercised
      // (coins can never go negative; 20 - 20 = 0).
      await db.from('quiz_sessions').update({ coins: 20 }).eq('id', s.id)
      const res = await fetch(`${BASE}/api/quiz/shop/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens.get(s.team_id)}` },
        body: JSON.stringify({ item: 'bid_2x' })
      })
      const body = await res.json()
      if (res.status !== 200 || !body.success || body.coins_remaining !== 0) {
        console.error(`✖ bid purchase failed for ${s.team_id}: ${res.status} ${JSON.stringify(body)}`)
      }
    }
  }
  console.log(`\n🧊 Frozen ${frozenIds.size} teams · ⚡ Bought 2x bids for ${bidIds.size} teams`)

  await openBossWindow()
  const { accepted, byStatus } = await burst(teams, tokens, frozenIds)
  const stats = await verifyDb(teams, frozenIds, bidIds)

  const errs = byStatus[0] || 0
  const integrityOk = stats && accepted === stats.acceptedCount && errs === 0
  console.log(`\n══ SUMMARY ══`)
  console.log(`   accepted: ${accepted} (expected ${stats?.acceptedCount ?? '?'}) · network errors: ${errs}`)
  console.log(`   stampede integrity (no lost/duplicated updates, frozen rejected): ${integrityOk ? '✅' : '❌'}`)
  console.log(`\nTotal wall time: ${stamp()} — ${KEEP ? 'seed data KEPT (--keep)' : 'seed data will be cleaned up now'}…`)

  if (!KEEP) {
    // qf_create_game registers a session for EVERY team in the DB, so
    // delete by game_id first (FK on quiz_sessions.game_id) — not just
    // the seed teams.
    await db.from('quiz_sessions').delete().eq('game_id', GAME_ID)
    await db.from('games').delete().eq('id', GAME_ID)
    const { error } = await db.from('teams').delete().in('id', teams.map(t => t.id))
    console.log(error ? `⚠ cleanup error: ${error.message}` : `🧹 Cleaned up all ${TEAM_COUNT} seed teams + game`)
  }
}

main().catch(err => { console.error('✖ Fatal:', err); process.exit(1) })
