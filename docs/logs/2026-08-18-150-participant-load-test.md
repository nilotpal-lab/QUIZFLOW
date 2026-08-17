# Session Log: 150-Participant Load Test (Login + Boss Answer Stampede)
**Date**: 2026-08-18

---

## 1. User Request
"Can the database and server handle 150 participants?" — the user wanted to verify
capacity for the event and asked how to test it.

## 2. Implementation Plan
1. Audit the existing load-test tooling (`scripts/loadtest-teams.mjs`,
   `scripts/loadtest-boss.mjs`, `loadtest.yml`).
2. Discover that `loadtest-teams.mjs` still targeted the **legacy** `/api/teams/claim`
   endpoint, while the real event flow now uses `/api/student/login` (team-name
   username + leader-name password, day-of gate, per-IP/per-user rate limits).
3. Rewrite `loadtest-teams.mjs` to exercise the current flow: seed teams with PBKDF2
   credential hashes, force the day-of gate open, fire 150 concurrent logins, retry
   rate-limited teams after the window resets, race-check (2 devices / same team),
   and sample the submit path. Verify DB invariants and clean up afterward.
4. Fix the stale dev server (documented `.next` chunk bug → API 500s): kill PID 9360,
   wipe `.next`, restart `npm run dev -- -p 3001`.
5. Run both load tests against the running dev server pointed at the **cloud** Supabase
   project (`ogciyskjrefwmazzckfg`) per user choice. Local Supabase stack was not
   available (Docker daemon not running).
6. Verify cleanup (no leftover `LT*` teams, no `LTBOSS01` game, gate restored).

## 3. Changes Made
- **Modified**: `scripts/loadtest-teams.mjs` — rewritten to hit `POST /api/student/login`
  with `{ username (team name), password (leader name), device_id }`:
  - Seeds 150+3 teams with `username` = team name, `password_salt`/`password_hash` =
    PBKDF2(leader name) mirroring `src/quizflow/credentials.ts` (120k iterations,
    Web Crypto, base64url).
  - Opens the day-of gate (`event_config.login_open = true`) before the burst and
    restores it to `false` in a `finally` (even with `--keep`).
  - Wave 1 = 150 concurrent logins; Wave 2 = retry of the per-IP-rate-limited 429s
    after the 10s window resets; combined DB invariant verification.
  - Race check now asserts `200 / 409` (the 409 body is the device-binding message,
    not a `claimed_by` echo — the new endpoint doesn't return one).
  - Header docs updated to the current endpoint + migration requirements.

## 4. Verification — Load Test Results (cloud project, real DB)

### Test A — Student Login Stampede (`node scripts/loadtest-teams.mjs`)
- Wave 1 (150 concurrent): **100× 200, 50× 429** (per-IP limiter 100 req/10s), wall 2.5s,
  200-latency p50 2267ms / p95 2426ms.
- Wave 2 (retry the 50): **50× 200**, wall 1.3s, p50 1230ms.
- DB invariants: claimed 150/150 == HTTP 200s ✅ · full claim fields 150/150 ✅ ·
  device bound to own team 150/150 ✅ · 0 unexpected 409s ✅ · 0 quiz_sessions ✅.
- Race check (3 unclaimed teams, 2 devices): **200/409 × 3** ✅ one winner, loser 409.
- Submit path: `/session/me` 200 + idempotent `/quiz/submit` (no re-score) ✅ ×3.
- **Summary: 150/150 logged in, 0 network errors — capacity OK.** Finding: 50/150
  were throttled by the 100 req/10s per-IP limiter in wave 1; they all succeeded on
  retry. At a real event, 150 teams on one network IP need ~2 waves (~10s apart) to
  log in, or the admin can raise `RATE_MAX_PER_IP` in
  `src/app/api/student/login/route.ts`.

### Test B — Boss Answer Stampede (`node scripts/loadtest-boss.mjs`)
- 150 concurrent answers at boss Q0 (5 frozen, 3 bid-holders): **150× HTTP 200**, wall
  2.1s, p50 2026ms / p95 2095ms.
- DB invariants: answered exactly once 145/145 ✅ · frozen rejected ✅ · 0 negative
  coins ✅ · bid_2x intact ✅ · Σ coins 445 == expected ✅ · finalize ranked 152 ✅ ·
  idempotent ✅ · Σ points after finalize 18900 == expected ✅.
- **Summary: stampede integrity OK — no lost/duplicated score updates, 0 errors.**

### Cleanup verification
- Leftover `LT*`/`LTB*` teams: **0** · leftover `LTBOSS01` game: **0** ·
  `event_config.login_open`: **false** ✅

### Environment note
- Dev server was restarted to fix stale `.next` chunks (API routes were 500ing with
  `Cannot find module './8948.js'`); after restart `/api/event/config` → 200 and
  `POST /api/student/login` returns proper 400 validation.
- Type check: `npx tsc --noEmit` clean (unchanged code, script is `.mjs`).
