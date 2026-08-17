#!/usr/bin/env node
/* ================================================================
   QuizFlow — Team Login Load Test (150-team go-live stampede)

   Seeds 150 teams in Supabase, then fires one concurrent claim per
   team against the running dev server, plus a small race check and
   a submit-path sample. Verifies DB invariants after the dust
   settles and reports the status distribution.

   Requirements:
     - .env.local with NEXT_PUBLIC_SUPABASE_URL + ANON_KEY
     - Migration 20260814090000 applied to that project
     - Dev server running on :3001 (npm run dev)

   Usage:
     node scripts/loadtest-teams.mjs            # burst + race + submit
     node scripts/loadtest-teams.mjs --keep     # do NOT clean up seed data
   ================================================================ */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

/* ── Config ──────────────────────────────────────────────────── */
const BASE = process.env.LOADTEST_BASE || 'http://localhost:3001'
const TEAM_COUNT = Number(process.env.LOADTEST_TEAMS || 150)
const PREFIX = 'LT' // seed code prefix for safe cleanup
const KEEP = process.argv.includes('--keep')
const ROSTER = ['Alice', 'Bob', 'Carol', 'Dave']
const RACE_TEAMS = 3   // teams that get 2 simultaneous claims
const SUBMIT_SAMPLE = 3 // claimed teams exercised through submit
const RACE_WAIT_MS = Number(process.env.LOADTEST_RACE_WAIT_MS || 11_000) // let the 20/10s rate-limit window reset

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
  for (let i = 1; i <= TEAM_COUNT; i++) {
    const code = `${PREFIX}${String(i).padStart(4, '0')}`
    rows.push({ name: `Team ${code}`, code, roster: ROSTER, status: 'waiting' })
  }
  const { data, error } = await db.from('teams').insert(rows).select()
  if (error) {
    console.error(`✖ Seed failed: ${error.message}`)
    process.exit(1)
  }
  console.log(`🌱 Seeded ${data.length} teams (codes ${PREFIX}0001–${PREFIX}${String(TEAM_COUNT).padStart(4, '0')})`)
  return data
}

/* ── The stampede ────────────────────────────────────────────── */
async function claim(code, memberName, deviceId) {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE}/api/teams/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, member_name: memberName, device_id: deviceId })
    })
    let body = null
    try { body = await res.json() } catch { /* empty */ }
    const setCookie = res.headers.getSetCookie?.()?.[0] || null
    return { status: res.status, body, setCookie, ms: Date.now() - start }
  } catch (err) {
    return { status: 0, body: { error: String(err) }, setCookie: null, ms: Date.now() - start }
  }
}

async function burst(teams) {
  console.log(`\n🔥 Firing ${teams.length} claims CONCURRENTLY (one per team)…`)
  const started = Date.now()
  const results = await Promise.all(teams.map(t => {
    const member = ROSTER[Math.floor(Math.random() * ROSTER.length)]
    return claim(t.code, member, `dev-${t.code}`)
  }))
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
async function verifyDb(teams, results, byStatus) {
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
  console.log(`   quiz_sessions created by claims: ${sessCount?.length ?? 0} (expected 0) ${sessCount?.length ? '❌' : '✅'}`)
}

/* ── Race check: 2 devices, same code, same instant ─────────── */
async function raceCheck() {
  console.log(`\n── Race check: ${RACE_TEAMS} UNCLAIMED teams get 2 simultaneous claims (different devices) ──`)
  // Pick teams that the burst left untouched — a true first-come race.
  const { data: waitingTeams } = await db
    .from('teams')
    .select('*')
    .like('code', `${PREFIX}%`)
    .eq('status', 'waiting')
    .limit(RACE_TEAMS)
  for (const team of (waitingTeams || []).slice(0, RACE_TEAMS)) {
    const [a, b] = await Promise.all([
      claim(team.code, 'Alice', `race-A-${team.code}`),
      claim(team.code, 'Bob', `race-B-${team.code}`)
    ])
    const statuses = [a.status, b.status].sort((x, y) => x - y)
    const winner = a.status === 200 ? a : b
    const loser = a.status === 409 ? a : b
    const ok = statuses.join(',') === '200,409' && loser.body?.claimed_by === winner.body?.team?.claimed_by
    console.log(`   ${team.code}: ${statuses.join(' / ')} → ${ok ? '✅ one winner, 409 names the winner' : '❌ ' + JSON.stringify(statuses)}`)
    if (loser.body) console.log(`      409 body claims: ${loser.body.claimed_by} · winner row: ${winner.body?.team?.claimed_by} (${winner.body?.team?.device_id})`)
  }
}

/* ── Submit path sample on winning teams ─────────────────────── */
async function submitSample() {
  console.log(`\n── Submit-path sample (${SUBMIT_SAMPLE} claimed teams, cookie-driven) ──`)
  const { data: claimed } = await db.from('teams').select('*').like('code', `${PREFIX}%`).eq('status', 'claimed').limit(SUBMIT_SAMPLE)
  for (const team of claimed.slice(0, SUBMIT_SAMPLE)) {
    const login = await claim(team.code, team.claimed_by, team.device_id) // reconnect → same cookie
    const cookie = login.setCookie
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
  console.log(`=== QuizFlow Team Login Load Test (${TEAM_COUNT} teams, burst) ===`)
  await checkMigration()
  await cleanupOldSeeds()
  const teams = await seedTeams()

  // Pre-empt the rate-limit window: fire a tiny probe to warm up? No —
  // claims are the point. Start the burst immediately.
  const { results, byStatus } = await burst(teams)
  await verifyDb(teams, results, byStatus)

  // The race check + submit sample issue more claims — wait out the
  // per-IP rate-limit window first so they reach the DB instead of 429.
  console.log(`\n⏳ Waiting ${RACE_WAIT_MS / 1000}s for the rate-limit window to reset…`)
  await new Promise(r => setTimeout(r, RACE_WAIT_MS))

  await raceCheck()
  await submitSample()

  const rateLimited = byStatus[429] || 0
  const ok = byStatus[200] || 0
  console.log(`\n══ SUMMARY ══`)
  console.log(`   200: ${ok} · 429 (rate-limited): ${rateLimited} · other: ${JSON.stringify({ ...byStatus, 200: undefined, 429: undefined })}`)
  if (rateLimited > 0) {
    console.log(`\n⚠  RATE-LIMIT FINDING: ${rateLimited}/${TEAM_COUNT} claims were throttled (20 req / 10s per IP).`)
    console.log(`   At a real event where 150 teams share one network IP, only ~20 teams per 10s can claim.`)
    console.log(`   Consider raising RATE_MAX, keying the limit per-team-code, or removing it for trusted networks.`)
  }
  console.log(`\nTotal wall time: ${stamp()} — ${KEEP ? 'seed data KEPT (--keep)' : 'seed data will be cleaned up now'}…`)

  if (!KEEP) {
    await db.from('quiz_sessions').delete().in('team_id', teams.map(t => t.id))
    const { error } = await db.from('teams').delete().in('id', teams.map(t => t.id))
    console.log(error ? `⚠ cleanup error: ${error.message}` : `🧹 Cleaned up all ${TEAM_COUNT} seed teams`)
  }
}

main().catch(err => { console.error('✖ Fatal:', err); process.exit(1) })
