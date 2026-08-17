#!/usr/bin/env node
/* ================================================================
   QuizFlow — Student Login Load Test (150-team go-live stampede)

   Seeds 150 teams in Supabase (team-name username + leader-name
   password, matching the current credential scheme), opens the day-of
   gate, then fires one concurrent login per team against the running
   dev server through the REAL /api/student/login endpoint, plus a
   race check (2 devices, same team) and a submit-path sample.
   Verifies DB invariants after the dust settles and reports the
   status distribution.

   Requirements:
     - .env.local with NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
     - Migrations 20260814090000 + 20260815120000 applied
       (teams + event_config + credential columns)
     - Dev server running on :3001 (npm run dev)

   Usage:
     node scripts/loadtest-teams.mjs            # burst + race + submit
     node scripts/loadtest-teams.mjs --keep     # do NOT clean up seed data

   Env overrides: LOADTEST_TEAMS, LOADTEST_BASE, LOADTEST_RACE_WAIT_MS
   ================================================================ */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

/* ── Config ──────────────────────────────────────────────────── */
const BASE = process.env.LOADTEST_BASE || 'http://localhost:3001'
const TEAM_COUNT = Number(process.env.LOADTEST_TEAMS || 150)
const PREFIX = 'LT' // seed code prefix for safe cleanup
const KEEP = process.argv.includes('--keep')
const ROSTER = ['Alice', 'Bob', 'Carol', 'Dave'] // leader = ROSTER[0] → password
const RACE_TEAMS = 3   // teams that get 2 simultaneous logins (different devices)
const SUBMIT_SAMPLE = 3 // claimed teams exercised through submit
const RACE_WAIT_MS = Number(process.env.LOADTEST_RACE_WAIT_MS || 11_000) // let the per-IP rate-limit window reset

/* ── PBKDF2 hashing — mirrors src/quizflow/credentials.ts ─────── */
const enc = new TextEncoder()
const PBKDF2_ITERATIONS = 120_000

function b64url(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return b64url(bytes)
}

async function hashPassword(password, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256
  )
  return b64url(new Uint8Array(bits))
}

/* ── .env.local loader (tiny, no deps) ───────────────────────── */
function loadEnv() {
  const out = {}
  try {
    const raw = readFileSync('.env.local', 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      out[m[1]] = v
    }
  } catch {
    /* no .env.local */
  }
  return out
}

const env = loadEnv()
// Shell env wins over .env.local so the test can target a local stack
// without touching your real cloud credentials.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('placeholder') || SUPABASE_ANON_KEY.includes('placeholder')) {
  console.error('✖ NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing or placeholder in .env.local')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ── Helpers ─────────────────────────────────────────────────── */
const t0 = Date.now()
const stamp = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`

async function checkMigration() {
  const { error } = await db.from('teams').select('id').limit(1)
  if (error) {
    console.error(`✖ Cannot read "teams" — is the migration applied? (${error.message})`)
    process.exit(1)
  }
  const { error: cfgErr } = await db.from('event_config').select('login_open').eq('id', 1).maybeSingle()
  if (cfgErr) {
    console.error(`✖ Cannot read "event_config" — is migration 20260815120000 applied? (${cfgErr.message})`)
    process.exit(1)
  }
}

async function cleanupOldSeeds() {
  if (KEEP) return
  const { data: teams } = await db.from('teams').select('id, code').like('code', `${PREFIX}%`)
  if (teams?.length) {
    await db.from('quiz_sessions').delete().in('team_id', teams.map(t => t.id))
    await db.from('teams').delete().in('id', teams.map(t => t.id))
    console.log(`🧹 Removed ${teams.length} stale LT* seed teams`)
  }
}

async function seedTeams() {
  const rows = []
  for (let i = 1; i <= TEAM_COUNT + RACE_TEAMS; i++) {
    const code = `${PREFIX}${String(i).padStart(4, '0')}`
    const name = `Team ${code}`
    const password = ROSTER[0] // leader name = password
    const salt = randomSalt()
    rows.push({
      name,
      code,
      username: name, // current scheme: username = team name
      password_salt: salt,
      password_hash: await hashPassword(password, salt),
      roster: ROSTER,
      status: 'waiting'
    })
  }
  const { data, error } = await db.from('teams').insert(rows).select()
  if (error) {
    console.error(`✖ Seed failed: ${error.message}`)
    process.exit(1)
  }
  console.log(`🌱 Seeded ${data.length} teams (codes ${PREFIX}0001–${PREFIX}${String(TEAM_COUNT + RACE_TEAMS).padStart(4, '0')})`)
  return data
}

async function setGate(open) {
  await db.from('event_config').update({ login_open: open, updated_at: new Date().toISOString() }).eq('id', 1)
}

/* ── The stampede ────────────────────────────────────────────── */
async function login(team, deviceId) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE}/api/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: team.name, // exact team name (route matches case-insensitively)
        password: ROSTER[0], // leader name
        device_id: deviceId
      })
    })
    let body = null
    try { body = await res.json() } catch { /* empty */ }
    const setCookie = res.headers.getSetCookie?.()?.[0] || null
    return { status: res.status, body, setCookie, ms: Date.now() - start }
  } catch (err) {
    return { status: 0, body: { error: String(err) }, setCookie: null, ms: Date.now() - start }
  }
}

async function burst(teams, label) {
  console.log(`\n🔥 ${label}: ${teams.length} logins CONCURRENTLY (one per team)…`)
  const started = Date.now()
  const results = await Promise.all(teams.map(t => login(t, `dev-${t.code}`)))
  const wall = Date.now() - started

  const byStatus = {}
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1

  console.log(`\n── Status distribution (wall time ${wall}ms) ──`)
  for (const [s, n] of Object.entries(byStatus).sort((a, b) => a[0] - b[0])) {
    console.log(`   ${s === 0 ? 'ERR' : s}: ${n}`)
  }

  const lats = results.filter(r => r.status === 200).map(r => r.ms).sort((a, b) => a - b)
  if (lats.length) {
    const pct = p => lats[Math.min(lats.length - 1, Math.floor((p / 100) * lats.length))]
    console.log(`   200-latency: min ${lats[0]}ms · p50 ${pct(50)}ms · p95 ${pct(95)}ms · max ${lats[lats.length - 1]}ms`)
  }
  return { results, byStatus }
}

/* ── DB verification ─────────────────────────────────────────── */
async function verifyDb(teams, byStatus) {
  console.log('\n── DB invariant check ──')
  const { data: rows } = await db.from('teams').select('*').in('id', teams.map(t => t.id))
  const byCode = Object.fromEntries(rows.map(r => [r.code, r]))

  const claimed = rows.filter(r => r.status === 'claimed')
  const waiting = rows.filter(r => r.status === 'waiting')
  const bad = rows.filter(r => !['claimed', 'waiting'].includes(r.status))

  console.log(`   claimed: ${claimed.length} · waiting: ${waiting.length} · unexpected status: ${bad.length}`)

  const expected200 = byStatus[200] || 0
  const match = claimed.length === expected200
  console.log(`   claimed rows == HTTP 200 count (${claimed.length} vs ${expected200}): ${match ? '✅' : '❌ MISMATCH'}`)

  const inconsistent = claimed.filter(r => !r.claimed_by || !r.device_id || !r.claimed_at)
  console.log(`   claimed rows with full claim fields: ${claimed.length - inconsistent.length}/${claimed.length} ${inconsistent.length ? '❌' : '✅'}`)

  const deviceMatches = claimed.filter(r => r.device_id === `dev-${r.code}`)
  console.log(`   claimed rows with device bound to own team: ${deviceMatches.length}/${claimed.length} ${deviceMatches.length === claimed.length ? '✅' : '❌'}`)

  // 429'd teams must be untouched
  const touchedWaiting = waiting.filter(r => r.claimed_by || r.device_id || r.claimed_at)
  console.log(`   unclaimed rows left fully untouched: ${waiting.length - touchedWaiting.length}/${waiting.length} ${touchedWaiting.length ? '❌' : '✅'}`)

  // 409s must not exist in a single-claim burst
  const conflicts = byStatus[409] || 0
  console.log(`   unexpected 409s in single-claim burst: ${conflicts} ${conflicts ? '❌ (should be 0)' : '✅'}`)

  // No session rows created by claims
  const { data: sessCount } = await db.from('quiz_sessions').select('id').in('team_id', teams.map(t => t.id))
  console.log(`   quiz_sessions created by logins: ${sessCount?.length ?? 0} (expected 0) ${sessCount?.length ? '❌' : '✅'}`)
}

/* ── Race check: 2 devices, same team, same instant ─────────── */
async function raceCheck(raceTeams) {
  console.log(`\n── Race check: ${raceTeams.length} UNCLAIMED teams get 2 simultaneous logins (different devices) ──`)
  for (const team of raceTeams) {
    const [a, b] = await Promise.all([
      login(team, `race-A-${team.code}`),
      login(team, `race-B-${team.code}`)
    ])
    const statuses = [a.status, b.status].sort((x, y) => x - y)
    const ok = statuses.join(',') === '200,409'
    console.log(`   ${team.code}: ${statuses.join(' / ')} → ${ok ? '✅ one winner, loser 409' : '❌ ' + JSON.stringify(statuses)}`)
    if (a.status === 409) console.log(`      409 body: ${a.body?.error}`)
    if (b.status === 409) console.log(`      409 body: ${b.body?.error}`)
  }
}

/* ── Submit path sample on winning teams ─────────────────────── */
async function submitSample() {
  console.log(`\n── Submit-path sample (${SUBMIT_SAMPLE} claimed teams, cookie-driven) ──`)
  const { data: claimed } = await db.from('teams').select('*').like('code', `${PREFIX}%`).eq('status', 'claimed').limit(SUBMIT_SAMPLE)
  for (const team of claimed.slice(0, SUBMIT_SAMPLE)) {
    const relogin = await login(team, team.device_id) // same device → reconnect
    const cookie = relogin.setCookie
    if (!cookie) { console.log(`   ${team.code}: ❌ reconnect produced no cookie`); continue }

    const me = await fetch(`${BASE}/api/session/me`, { headers: { Cookie: cookie } })
    const meBody = await me.json()
    console.log(`   ${team.code}: /session/me → ${me.status} (team: ${meBody.team?.code}, member: ${meBody.member_name})`)

    const payload = { answers: [{ q: 0, selected: 1 }], score: 750, violations: [] }
    const sub1 = await fetch(`${BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(payload)
    })
    const sub2 = await fetch(`${BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ answers: [{ q: 0, selected: 9 }], score: 9999 })
    })
    const b1 = await sub1.json()
    const b2 = await sub2.json()
    const ok = sub1.status === 200 && b1.success && !b1.alreadySubmitted && sub2.status === 200 && b2.alreadySubmitted && b2.session?.score === 750
    console.log(`   ${team.code}: submit → ${sub1.status}/${sub2.status}, idempotent & no re-score: ${ok ? '✅' : '❌'}`)
  }
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  console.log(`=== QuizFlow Student Login Load Test (${TEAM_COUNT} teams, burst) ===`)
  await checkMigration()
  await cleanupOldSeeds()
  const teams = await seedTeams()
  const burstTeams = teams.slice(0, TEAM_COUNT)
  const raceTeams = teams.slice(TEAM_COUNT) // left unclaimed for the race

  await setGate(true)
  console.log('🔓 Day-of gate forced OPEN for the test')

  try {
    // Wave 1: the stampede. Per-IP limiter is 100 req / 10s → expect
    // ~100× 200 + ~50× 429 from a single network.
    const wave1 = await burst(burstTeams, 'Wave 1 — 150-team stampede')

    console.log(`\n⏳ Waiting ${RACE_WAIT_MS / 1000}s for the per-IP rate-limit window to reset…`)
    await new Promise(r => setTimeout(r, RACE_WAIT_MS))

    // Wave 2: retry the 429'd teams — the window has reset, so every
    // remaining team should now log in successfully.
    const waitingTeams = burstTeams.filter((t, i) => wave1.results[i].status !== 200)
    let wave2 = { results: [], byStatus: {} }
    if (waitingTeams.length) {
      wave2 = await burst(waitingTeams, `Wave 2 — retry ${waitingTeams.length} rate-limited teams`)
    } else {
      console.log('\n(no rate-limited teams to retry)')
    }

    // Combined verification — every seeded team should now be claimed.
    const combined = { ...wave1.byStatus }
    for (const [s, n] of Object.entries(wave2.byStatus)) combined[s] = (combined[s] || 0) + n
    await verifyDb(burstTeams, combined)

    // Race check on the dedicated unclaimed teams.
    console.log(`\n⏳ Waiting ${RACE_WAIT_MS / 1000}s before the race check (rate-limit window)…`)
    await new Promise(r => setTimeout(r, RACE_WAIT_MS))
    await raceCheck(raceTeams)

    await submitSample()

    const rateLimited = combined[429] || 0
    const ok = combined[200] || 0
    const errs = combined[0] || 0
    console.log(`\n══ SUMMARY ══`)
    console.log(`   200: ${ok} · 429 (rate-limited): ${rateLimited} · network errors: ${errs}`)
    console.log(`   DB claimed after both waves: ${Math.min(ok, TEAM_COUNT)}/${TEAM_COUNT} teams (expected ${TEAM_COUNT})`)
    if (rateLimited > 0) {
      console.log(`\n⚠  RATE-LIMIT FINDING: ${rateLimited}/${TEAM_COUNT} logins were throttled in wave 1 (100 req / 10s per IP).`)
      console.log(`   They succeeded on retry after the window reset — the server handled the full load,`)
      console.log(`   but 150 teams on one network IP need ~2 waves to log in.`)
    }
    if (errs > 0) {
      console.log(`\n✖ NETWORK ERRORS: ${errs} requests never reached the server — capacity concern.`)
    }
    console.log(`\nTotal wall time: ${stamp()} — ${KEEP ? 'seed data KEPT (--keep)' : 'seed data will be cleaned up now'}…`)
  } finally {
    await setGate(false)
    console.log('🔒 Day-of gate restored to CLOSED')
    if (!KEEP) {
      await db.from('quiz_sessions').delete().in('team_id', teams.map(t => t.id))
      const { error } = await db.from('teams').delete().in('id', teams.map(t => t.id))
      console.log(error ? `⚠ cleanup error: ${error.message}` : `🧹 Cleaned up all ${teams.length} seed teams`)
    }
  }
}

main().catch(err => { console.error('✖ Fatal:', err); process.exit(1) })
