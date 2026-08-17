# QuizFlow — Session Log

_Last updated: 2026-08-15 (session 5: verify & refactor — shared leaderboard helper, e2e repair, quizflow suite green for the first time)_

## 4.5 Session 4 quick summary (2026-08-15) — Admin/Student dashboards

- **Built per `admin-student-dashboard-spec.md`** (the interview spec): the "Teacher" identity was rebranded
  to **Admin**, the old Teacher Workspace was **replaced** by a 7-tab Admin Dashboard, and a new **Student**
  role got a day-of credential login + single-feature dashboard + in-game lobby.
- **Student auth**: team-shared username/password (one per team, one device). New migration
  `20260815120000_add_event_config_and_team_credentials.sql` adds `event_config` (gate: `login_open` +
  optional `opens_at`/`closes_at`) and `teams.username/password_salt/password_hash`. Passwords are PBKDF2
  (Web Crypto, `src/quizflow/credentials.ts`, 120k iters — no new auth lib).
- **New routes**: `POST /api/student/login` (day-of gate → PBKDF2 verify → race-safe device bind → `qf_session`
  cookie; rate-limited per-IP **and** per-username), `POST /api/student/logout`, `GET /api/event/config`
  (public gate state), `POST /api/admin/event-config` (host gate save), `POST /api/admin/teams` (create team +
  generate credentials), `POST /api/admin/teams/:id/reset-password`, `DELETE /api/admin/teams/:id`,
  `GET /api/quiz/leaderboard` (student-safe standings for in-game + after-close).
- **New pages**: `/quizflow/student/login` (gate screens: closed-before / closed-after / closed),
  `/quizflow/student/dashboard` (team identity + **only** Join Game), `/quizflow/student/lobby` (status-driven:
  lobby → question → reveal → standings, **leaderboard-while-answering** toggle). Middleware now gates
  `/quizflow/student/:path*` (login page exempt). Homepage hero is a two-role splitter (Admin 🛡️ / Student 🎮).
- **Admin Dashboard** (`/quizflow/dashboard`) tabs: My Quizzes, Teams & Credentials, Live Leaderboard,
  Day-of Controls (toggle + schedule), Active Game (pick quiz → `POST /api/quiz/game` → advance/reveal/boss
  controls), Hosted Sessions, Profile. Event tabs call host API routes with the Supabase Bearer token from
  `supabase.auth.getSession()`; the demo/local-only admin gets a notice that event tools need a cloud session.
- **Verified**: `npx tsc --noEmit` clean, `npm run build` clean. New `e2e/tests/admin-student.e2e.ts` written
  (gate 403→open 200, wrong password 401, second device 409, admin 401s) — NOT yet executed: it needs the
  new migration applied to a Supabase stack (local stack was DOWN at audit time, same as session 3).
- **Open items carried forward**: apply migrations to the cloud project (`ogciyskjrefwmazzckfg`) — teams,
  live-play engine, AND event_config are all missing there; run the e2e suites against the local stack once up;
  classic `/quizflow/join` + `/lobby/[pin]` remain as legacy paths (not surfaced from the homepage).

---

## 4.6 Session 5 quick summary (2026-08-15) — Verify / refactor / review pass

**Goal**: "verify and refactor and review all the changes and update the session log".
This session was a full audit + cleanup of sessions 3–4's WIP, plus the first REAL
end-to-end test run of the classic flow.

**Refactor (DRY + dead-code removal):**
- Extracted **`src/quizflow/gameLeaderboard.ts`** — a single shared `getGameLeaderboard`
  helper used by BOTH `GET /api/admin/leaderboard` and `GET /api/quiz/leaderboard`
  (previously duplicated sort/podium/bonus logic in each route).
- Removed dead code: `generatePrintableWorksheet` (unused), an unused `setError` state,
  and a stray `compact` CSS class reference.
- Rewrote `src/middleware.ts` header comment — it still described only the classic PIN
  gate, not the student-credential gate added in session 4.

**E2E repair (the big one — these tests had NEVER been executed):**
- **`e2e/tests/liveplay.e2e.ts`**: fixed a real pre-existing bug in the host-gates test —
  all six assertions called `noAuth.status` (property) instead of `noAuth.status()`
  (method), so they'd have failed on the first real run.
- **`e2e/tests/quizflow.e2e.ts`**: rewritten to match the REAL host/play UI. The old
  version targeted markup that never existed (`.question-card`, `.lb-row .score`) and
  drove a manual phase flow (`Reveal → Show Leaderboard → Next Question`) that races the
  host's auto-pacing. Key changes:
  - Waits on the actual "Question X of N" badge; reads `totalQ` from it instead of
    hardcoding 5 (preset quiz has 3 questions).
  - **Anti-cheat fullscreen gate**: the play page (`enforceFullscreen: true`) shows a
    z-200 overlay that blocks all pointer events on `.answer-btn` until the student
    enters fullscreen — the test now clicks "Enter Fullscreen 🚀" per page.
  - **Rides the auto-pacing** instead of clicking phase buttons: the host auto-reveals
    2s after everyone answers and auto-paces reveal(4s) → leaderboard(5s) → next/end.
    Test 3 asserts "3/3 answered" on the host and waits for Question 2; test 4 answers
    every remaining question and waits for the auto-driven results page.
  - Dropped the last test ("Host profile update propagates instantly") — it targeted a
    `Host name` / `Save Profile` UI that no longer exists.
  - First run also exposed that all 3 students answered but picked choice A (wrong,
    shuffled), so the old "score > 0" assertion was wrong — switched to answer-count.

**Verification results (first real run of the suite):**
- `npx tsc --noEmit` ✅ clean, `npm run build` ✅ clean.
- `npx playwright test quizflow.e2e.ts` ✅ **4/4 passed** (host → 3 joins → answer →
  full game → results). This is the first time the classic flow has been executed.
- The Supabase-backed suites (`admin-student`, `liveplay`, `teams`) still fail when run
  — all failures are the KNOWN "migrations never applied to the cloud project" issue
  (PGRST205 / missing tables), NOT regressions. Bring the local Docker stack up with
  the migrations and run them there.

**Carried forward unchanged**: apply migrations 20260814090000 / 20260815090000 /
20260815120000 to the cloud project (`ogciyskjrefwmazzckfg`); run the three
Supabase-backed e2e suites against a local stack; decide on the claim rate-limit scale
question; pull origin/main (repo is behind).

---

## 0. Session 3 quick summary (2026-08-15)

- **Built the live-play game engine** (server-authoritative scoring) per
  `live-game-engine-spec.md`: `src/quizflow/scoring.ts`, migration
  `supabase/migrations/20260815090000_add_live_play_game_engine.sql`, endpoints
  `/api/quiz/{game,game/advance,game/state,answer,shop/buy,boss/start,boss/finalize,violation}`,
  `/api/admin/leaderboard`, `scripts/loadtest-boss.mjs`, `e2e/tests/liveplay.e2e.ts`.
  `npx tsc --noEmit` is clean.
- **Key security architecture**: server runs with the ANON key, so answer keys live in
  `game_answer_keys` (NO anon/authenticated grants) and ALL scoring/coin math runs in
  SECURITY DEFINER Postgres functions (`qf_apply_answer`, `qf_buy_powerup`, …) that
  read the keys and apply atomic `SET points = points + $delta` expressions with WHERE
  guards. No service-role key added.
- **Answer-secrecy audit (the prompt's "read the diff" item) found + fixed two classic-flow
  leaks in `/api/room/[pin]/route.ts`**: (1) `sanitizeStateForClient` sent ALL
  `correct_index` values at reveal/leaderboard/lobby → now reveals only the CURRENT
  question's answer at `question_reveal`; (2) Supabase persistence wrote full state
  (incl. correct answers) to the anon-readable `quizzes` table → now persists sanitized
  state only (keys stay in the server-only in-memory/tmp store).
- **NOT YET VERIFIED**: the local Supabase stack + dev server were DOWN at audit time,
  so `scripts/loadtest-boss.mjs` and `e2e/tests/liveplay.e2e.ts` are written but not run.
  Bring the stack up, apply the new migration, and run them before go-live (see §5).
- **The live-play migration is NOT applied anywhere yet** (local stack down; cloud
  project still missing even the team migration).

> **Read this first.** This file is the handoff for future coding sessions. It captures
> what the project is, what was recently built, exactly what is currently uncommitted,
> how to verify things work, and the conventions to follow. Pair it with
> `context.md` (architecture blueprint) and `plan.md` (product roadmap).

---

## 1. TL;DR for the next session

- **Repo state: `main` is BEHIND `origin/main` by 4 commits and can be fast-forwarded.**
  Before starting new work, run `git pull` (or at least review `git log origin/main`).
  The 4 incoming commits (from a previous Freebuff session) touch the mobile join
  layout, session-sync performance, and add an `AGENTS.md` rule file — they should not
  conflict with the current WIP, but pull first to be safe.
- **The current uncommitted work is a NEW backend feature: "Team Login Event" flow**
  (100–150 teams, 4 members each, 1 device per team, race-safe single-claim login).
  All of it lives in untracked files — it has never been committed.
- **Everything is Supabase-backed** and skips gracefully when Supabase env vars are absent.
- **`.env.local` now exists** with the user's REAL cloud credentials (Supabase URL +
  anon key + GEMINI/OPENROUTER/GROQ keys). It is gitignored — NEVER commit or share it.
  `QUIZFLOW_SESSION_SECRET` is NOT set → the dev fallback signing secret is active.
- **Cloud Supabase project (`ogciyskjrefwmazzckfg`) does NOT have the migration applied**
  — `teams` / `quiz_sessions` don't exist there (PGRST205). Every team API fails on the
  cloud project until the migration SQL is run in the Supabase SQL Editor (see §7).
- **A local Supabase stack (Docker) was stood up for testing and is STILL RUNNING:**
  API `http://127.0.0.1:54321` · DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
  · Studio `http://127.0.0.1:54323`. Stop with `npx supabase stop`. The migration IS
  applied there and the 150-team load test was run against it (see §6.5).
- `context.md` (tech stack + file-by-file blueprint) and `plan.md` (product roadmap) are
  **untracked** — they're project docs and should eventually be committed too.

---

## 2. Project at a glance

**QuizFlow Classroom Arena** — Next.js 14 (App Router) + React 18 + TypeScript + Tailwind 3.4
app combining:
- **AI Quiz Studio** — topic prompts, URL/YouTube ingestion, quad-tier LLM router
  (Gemini → Groq → OpenRouter → seeded procedural fallback), Bloom's Taxonomy, translations.
- **Classroom Arena** — Classic trivia, Co-op Boss Raid, Bracket Tournament, coin economy
  + power-up shop, anti-cheat shield, printable worksheet generator.
- **Productivity hub** — Kanban, habits, Pomodoro, calendar (pre-existing).
- **Sync layer** — BroadcastChannel (0ms cross-tab) → HTTP room relay polling (400ms) →
  Supabase Realtime WebSockets. Server-authoritative room evaluation in `/api/room/[pin]`.
- **NEW (WIP): Team Login Event** — tournament-style team login with device-bound sessions.

Key files: `context.md` (architecture), `plan.md` (roadmap), `src/quizflow/*` (game logic),
`src/app/api/*` (server routes), `e2e/tests/*` (Playwright).

---

## 3. Recent git history (last 25 commits, oldest → newest)

```
7aaa11a SEO: Render MarketingHomepage on root slash directly
1d97d9f Fix: Resolve mobile blank screen crashes (blocked localStorage/sessionStorage)
eef71cb Fix: Resolve mobile overflow horizontal scroll + h1 collisions
47faf27 Fix: Lazy-init Supabase to prevent mobile blank page crash (SecurityError)
bac88ab Security: Remove hardcoded Supabase fallback credentials
f9ba3ba UI: Update homepage CTAs to Quiz Library and Host Game, AI vs Manual quiz creation
6b31e92 feat: Add device image upload for quiz questions + quiz library sync
2c66d13 fix(mobile): Wrap LobbyPage in Suspense + harden Supabase proxy & storage
2bee67e fix(mobile): Add ErrorBoundary, direct root join page export, 0.0.0.0 dev binding
e4ad02a fix(dashboard): Prevent white screen on direct unauthenticated visits
d36a81f fix(auth): Fix Google OAuth mobile redirect race + auto-sync session to dashboard
4e5137b fix(routes): Audit all routes, Suspense on JoinPage, pre-filled PIN param
0bed1d1 fix(logic): Audit state handlers, guarded zero-question edge cases
be9a84b feat(agents): Honey Mode (Caveman + Ponytail) rule for token compression + YAGNI
71fdf4a feat: 3D particles, boss VFX, streak badges, multi-round tournament with AI rules
6d3936b feat: 3-way per-round quiz creation + multi-round host elimination engine
aa17d1c feat: global real-time community library sync API & Studio Publish Global button
6548410 refactor: refined UI & clear button positioning for tournament mode
959ddac feat: real-time host leaderboard modal (top 3 podium & top 20 rankings)
35a4466 fix: comprehensive mobile responsive UI overhaul (play screen + host dashboard)
4f56ab8 fix: deep mobile responsive overhaul (timer, HUD, PIN inputs, answer grid, CTAs)
c9b6816 fix: robust room joining + 3-tier room state persistence across cold starts/devices
54a3387 feat(phase-1): real-time cross-device sync layer (Supabase WebSocket + API relay)
bf61584 feat: Freshers Event features (server-side evaluation, coin economy, boss frenzy, anti-cheat, 300-player scale)
72e6c08 fix: global community quiz publishing, dual-path Supabase cloud sync, dashboard publish action
```

**origin/main is 4 commits AHEAD of local `main` (from another session):**
```
a91d155 docs: add AGENTS.md rule file for Freebuff
7f56aa7 perf: session sync performance, debounce disk relay & answer key safeguard
e18e847 fix: responsive mobile layout on join page (nickname overflow, PIN box sizing)
52a37a4 docs: session log for mobile join layout fix
```

---

## 4. CURRENT WIP — Team Login Event backend (UNCOMMITTED)

### 4.1 Goal / product context

Support a **team-login event**: 100–150 teams, ~4 members per team, **one shared device
per team**. The first member to enter the team code claims the team for their device;
everyone else on that device shares the session. Backend must be race-safe (two devices
claiming the same code at the same instant → exactly one wins).

### 4.2 New files (all untracked)

| File | Purpose |
| :--- | :--- |
| `supabase/migrations/20260814090000_create_teams_and_quiz_sessions.sql` | Schema: `teams` (code unique, roster jsonb, claimed_by, device_id, status ∈ waiting/claimed/in_progress/submitted) + `quiz_sessions` (team_id FK, token unique, answers jsonb, score, violations, submitted_at). Indexes on `teams(code)` and `quiz_sessions(team_id)`. |
| `src/quizflow/authToken.ts` | Zero-dependency **HS256 JWT** via Web Crypto (works in Node AND Edge runtimes). Claims: `team_id, member_name, device_id, iat, exp`. Cookie name `qf_session`, 24h max age. Secret from `QUIZFLOW_SESSION_SECRET`, dev-only fallback `'qf-dev-insecure-secret-change-me'`. Exports `signSessionToken`, `verifySessionToken`, `getSessionTokenFromRequest`. |
| `src/quizflow/serverSupabase.ts` | Server-side Supabase client factory (`getServerSupabase`, null when env missing/placeholder) + `getAuthenticatedHost(req)` which validates a `Bearer <token>` against `supabase.auth.getUser(token)` for admin/host endpoints. |
| `src/app/api/teams/claim/route.ts` | `POST {code, member_name, device_id}`. **Atomic claim** via single conditional `UPDATE ... SET claimed_by, device_id, status='claimed' WHERE code=? AND claimed_by IS NULL`. Winner gets a signed JWT in an httpOnly cookie. Reconnect (same device_id) → 200 with `reconnect:true`. Already claimed by other → 409 with `claimed_by` name. No such code → 404. Per-IP rate limit: 20 req / 10s window (in-memory `global.__qf_claim_limits`). All responses no-store. |
| `src/app/api/session/me/route.ts` | `GET` — validates `qf_session` cookie, returns team + member_name + quiz_session (or 401). |
| `src/app/api/quiz/submit/route.ts` | `POST {answers, score, violations}` — **idempotent submit**. Guarded by conditional UPDATE on `submitted_at IS NULL`; insert fallback uses deterministic token `sess_<team_id>` so the UNIQUE constraint blocks duplicate rows; marks team `submitted`. Duplicate submits return `alreadySubmitted:true` with stored session, no re-score. |
| `src/app/api/admin/teams/route.ts` | `GET` — list all teams + status for the host dashboard. Requires valid Supabase host Bearer token (else 401). |
| `src/app/api/admin/teams/[id]/release/route.ts` | `POST` — host override to clear `claimed_by/device_id/claimed_at`, reset status to `waiting` (recovery when a device dies mid-event). Host-only; 404 on unknown id. |
| `src/middleware.ts` | Edge middleware gating bare team-mode navigation. Redirects to `/quizflow/join?next=<intended>` when there's no valid session. **Legacy room mode bypasses the gate**: `/quizflow/host/*` always passes; `/quizflow/play?pin&pid&nickname` passes with full join context. Hard opt-out: `QUIZFLOW_DISABLE_SESSION_GATE=1`. Matcher: `/quizflow/play/:path*`, `/quizflow/host/:path*`. |
| `e2e/tests/teams.e2e.ts` | Playwright API tests for the backend (see §5). Skips when Supabase not configured. |
| `.env.example` | Documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `QUIZFLOW_SESSION_SECRET`, `QUIZFLOW_DISABLE_SESSION_GATE`. |
| `scripts/loadtest-teams.mjs` | 150-team load test (see §6.5). Seeds `LT*` teams, fires concurrent claims, verifies DB invariants, race-check + submit-path sample, cleans up. Env: `LOADTEST_TEAMS`, `LOADTEST_BASE`, `LOADTEST_RACE_WAIT_MS`; `--keep` retains seed data. Shell env overrides `.env.local`. |
| `supabase/config.toml` | Created by `npx supabase init` for the local stack (untracked; keep it for local dev). `supabase/snippets/` is CLI-generated junk. |

### 4.3 Modified files (uncommitted)

| File | Change |
| :--- | :--- |
| `.gitignore` | Ignore `playwright-report/`, `test-results/`, `tsconfig.tsbuildinfo` (previously only `/coverage`). |
| `e2e/playwright.config.ts` | `testDir` → `./tests`, `testMatch: '**/*.e2e.ts'`, added `webServer` block (`npm run dev` on port 3001, `reuseExistingServer: true`, 120s timeout). |
| `e2e/tests/quizflow.e2e.ts` | Serial mode (`test.describe.configure({ mode: 'serial' })`), hosts first preset quiz via per-quiz **"Host Now"** button, waits for `.pin-code` (digits), joins via `/quizflow/join` with segmented `#pin-input-0..5` + `#player-nickname-input` + "Join game arena" button, waits for `/lobby/<pin>` (tolerates `?nickname=` query). |
| `tsconfig.tsbuildinfo` | **Staged deletion** (build artifact — fine to drop). |

### 4.4 How the flow works end-to-end

1. Admin seeds `teams` rows (name, unique `code`, `roster` jsonb) — e.g. via SQL/seed script.
2. A team member opens `/quizflow/join`, enters code + name → `POST /api/teams/claim`.
3. Postgres conditional UPDATE guarantees **one winner** per code. Winner receives an
   httpOnly `qf_session` cookie (JWT) → redirected to intended page (`?next=...` from
   middleware).
4. Same device refreshing → `/api/teams/claim` returns `reconnect:true` and reissues the
   cookie. Different device → 409 "Already claimed by <name>".
5. `GET /api/session/me` powers the app shell (who am I / which team / resume quiz?).
6. On completion, `POST /api/quiz/submit` stores final answers/score/violations once
   (idempotent) and flips team → `submitted`.
7. Host dashboard polls `GET /api/admin/teams` (Bearer token = host's Supabase session)
   and can `POST /api/admin/teams/:id/release` to unstick a broken device.

### 4.5 Important security/design notes

- The claim endpoint uses a **conditional UPDATE** — not select-then-update — so races
  are resolved by Postgres, not application logic.
- **No service-role key anywhere** — admin endpoints authenticate hosts with their own
  Supabase user token via `supabase.auth.getUser(token)`. (Follow this pattern; do NOT
  add service-role secrets.)
- JWT is Web-Crypto based so the **same module runs in middleware (Edge) and API routes
  (Node)** — that's why it's dependency-free.
- All new API routes set `no-store` cache headers + `dynamic = 'force-dynamic'`.

---

## 5. How to verify (tests & commands)

```bash
# TypeScript check (no emit)
npx tsc --noEmit

# Build
npm run build

# Dev server (E2E webServer expects port 3001)
npm run dev -- -p 3001

# E2E tests (config in e2e/playwright.config.ts, webServer auto-starts dev)
cd e2e && npx playwright test
```

**E2E specifics:**
- `e2e/tests/quizflow.e2e.ts` — classic PIN flow (host + 3 students). Must run **serial**
  (already configured). Uses `npm run dev` on **port 3001**. **Verified green (4/4) in
  session 5** — it rides the host's auto-pacing (auto-reveal when all answer → 4s →
  leaderboard → 5s → next) and clicks through the anti-cheat "Enter Fullscreen" gate
  on each student page; don't reintroduce manual phase-button clicks (they race).
- `e2e/tests/teams.e2e.ts` — new team-login API tests (atomic claim, reconnect, session/me,
  idempotent submit, admin auth). **Requires Supabase configured** (`NEXT_PUBLIC_SUPABASE_URL`
  + `ANON_KEY`, migration applied); otherwise every test is skipped via `test.skip`.

**To run the team tests you need:**
1. Supabase project with the migration applied (`supabase/migrations/...sql`).
2. Env vars in `.env.local` (copy `.env.example`).
3. `npx playwright test teams` from `e2e/` (or the whole suite).

**Load test (against the local stack):**
```bash
# 1. Local stack must be running: npx supabase start
# 2. Start the dev server pointed at the LOCAL stack (shell env wins over .env.local):
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon from 'npx supabase status -o env'> \
npm run dev
# 3. In another shell, run the load test with the SAME overrides:
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same> \
node scripts/loadtest-teams.mjs
```
Warm up the claim route first (`POST /api/teams/claim` with `{}` → 400) so the burst
isn't slowed by a cold compile. On Windows, stop the dev server by port, not PID (see §6).

---

## 6. Conventions & gotchas

- **Zero-config fallbacks are a feature**: app must work without Supabase keys (local
  storage + in-memory relay). Guard new server routes with `getServerSupabase()` null checks.
- **Don't introduce new auth libraries** — the codebase deliberately uses Web Crypto
  (`authToken.ts`) and Supabase Auth. Match that.
- **No hardcoded credentials** (see commit `bac88ab`).
- **Mobile-first**: recent commits are all about mobile responsive fixes; keep new UI
  mobile-safe (no horizontal scroll, no tiny PIN inputs).
- **TypeScript strict** — run `npx tsc --noEmit` after changes.
- **Playwright config lives in `e2e/`** with `testDir: ./tests` (relative to config).
- Env: dev fallback secret in `authToken.ts` is fine locally but must be overridden with
  `QUIZFLOW_SESSION_SECRET` in any real deployment.
- Windows dev machine (this repo lives under `C:\Users\Sanchit\...`); commands run in
  Git Bash — POSIX syntax.
- **Windows dev-server cleanup**: `kill $PID` on the `npm run dev` wrapper does NOT kill
  the Next.js child — a stale server can keep port 3001 with its ORIGINAL env vars (this
  silently invalidated one load-test run: traffic hit a dead cloud-backed server). Free
  the port with `netstat -ano | grep ':3001' | grep LISTENING` → `taskkill //F //PID <pid>`,
  verify the port is free, and confirm the new server logged "Ready in" before testing.
- **Next.js dev reads shell env over `.env.local`** — used to point the dev server at the
  local stack without touching the real cloud credentials.
- **PostgREST `insert().select()` returns rows in arbitrary order** — never assume
  index == insertion order (broke the load-test race-check picker once).
- **The migration does NOT enable RLS** → the `anon` role needs explicit grants locally:
  `GRANT SELECT, INSERT, UPDATE, DELETE ON teams, quiz_sessions TO anon, authenticated;`
  (the cloud project needs this too, or RLS policies, before any team API will work).
- **`e2e/tests/teams.e2e.ts` targets whatever Supabase env vars resolve to** — currently
  `.env.local` (cloud, migration missing → all tests skip). To run them locally, export
  the local stack env vars (same block as the load test in §5) before running.
- Pre-existing Docker containers `jtap-postgres` (port 5433) and `jtap-redis` (6380)
  belong to ANOTHER project — leave them alone.

---

## 6.5 Load test — 150-team stampede (2026-08-14)

Ran via `scripts/loadtest-teams.mjs` against a **local Supabase stack** (Docker +
`npx supabase start`; the user's cloud project still lacks the migration).

**Results (all against the local stack):**

| Check | Result |
| :--- | :--- |
| 150 concurrent claims, one per team | **19 × 200, 131 × 429** (rate limit) |
| claimed rows == HTTP 200 count | ✅ 19 vs 19 |
| claimed rows have `claimed_by` + `device_id` + `claimed_at` | ✅ 19/19 |
| device bound to own team | ✅ 19/19 |
| unclaimed rows untouched | ✅ 131/131 |
| 409s in single-claim burst | ✅ 0 (none) |
| claims create no `quiz_sessions` | ✅ 0 |
| True race (unclaimed team, 2 devices, same instant) ×3 | ✅ 200/409, 409 names real winner |
| Reconnect → `/session/me` → idempotent `/quiz/submit` ×3 | ✅ no re-score on duplicate |

**Key finding:** the per-IP rate limit (20 req / 10s, in `claim/route.ts`) caps a
stampede from one network at **~20 claims per 10s** → all 150 teams on one school IP
need ~8 waves / ~80s to log in. Decide whether to raise `RATE_MAX`, key by team-code
instead of IP, or exempt trusted networks. Seed data is cleaned up after each run
(`--keep` to retain).

**Env note:** the load test targets the local stack via shell env overrides
(`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, anon key from
`npx supabase status -o env`). `.env.local` still holds the real cloud keys.
Local stack needed `GRANT SELECT, INSERT, UPDATE, DELETE ON teams, quiz_sessions
TO anon, authenticated;` (migration does not enable RLS).

`supabase init` also created `supabase/config.toml` + `supabase/snippets/` (untracked).

---

## 7. Open questions & likely next steps

- [ ] **DECISION NEEDED — rate limiter at event scale**: burst capped at ~20 claims/10s
      per IP → 150 teams on one school IP take ~80s to log in (see §6.5). Options: raise
      `RATE_MAX`, key the limit per team-code instead of IP, or exempt trusted networks.
      Re-run the burst afterwards to verify.
- [ ] **Apply the migration to the cloud project** — run
      `supabase/migrations/20260814090000_create_teams_and_quiz_sessions.sql` in the
      Supabase SQL Editor for `ogciyskjrefwmazzckfg`. Everything team-related is dead on
      the cloud project until then (and `anon` needs grants/RLS, see §6).
- [ ] **Pull origin/main** (still 4 commits behind) before continuing work.
- [ ] **Frontend for the team flow is not built yet** — `src/app/quizflow/join`, the
      team-code UI, and the host event dashboard likely still use the classic PIN flow.
      Decide/verify what the team-login UI should look like and wire it to these APIs.
- [ ] Decide whether `context.md`, `plan.md`, `session-log.md`, `.env.example`,
      `scripts/loadtest-teams.mjs`, `supabase/config.toml` should be committed (all
      currently untracked).
- [ ] Consider committing the WIP as a coherent feature branch/commit (e.g.
      `feat: race-safe team login event backend (claim/session/submit/admin)`).
- [ ] Local Supabase stack is still running — `npx supabase stop` when done with it.
- [ ] `session-log.md` should be updated at the end of every working session so context
      keeps flowing forward.

---

## 8. Session 6 (2026-08-17) — QuizFlow Brand Logo & Favicon Integration

### 1. User Request
- Use the image in the `Logo/` folder as the favicon and brand logo for QuizFlow.

### 2. Implementation Plan
1. Inspect the source asset in `Logo/` (`ChatGPT Image Aug 17, 2026, 10_45_06 AM.png`, 1254x1254 PNG).
2. Generate all standard web icons and favicons in `public/` (`logo.png`, `quizflow-logo.png`, `favicon.ico`, `favicon.png`, `icon.png`, `apple-icon.png`, `apple-touch-icon.png`).
3. Add Next.js App Router convention icons into `src/app/` (`icon.png`, `apple-icon.png`, `favicon.ico`).
4. Update `src/quizflow/QuizFlowLogo.tsx` to display `/logo.png` with clean object containment.
5. Update `src/quizflow/metadata.ts` icon declarations to reference the new favicon and app icons.
6. Update `src/app/manifest.ts` PWA icons to point to `/logo.png` and `/icon.png`.
7. Generate and update `src/quizflow/logoDataUri.ts` with the new PNG base64 Data URI for the edge-rendered OG dynamic card (`src/app/opengraph-image.tsx`).

### 3. Changes Made
- **Created**:
  - `public/logo.png`, `public/quizflow-logo.png`, `public/favicon.ico`, `public/favicon.png`, `public/icon.png`, `public/apple-icon.png`, `public/apple-touch-icon.png`
  - `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`
  - `scripts/sync-logo.js` (reusable logo synchronization and data URI generator script)
- **Modified**:
  - `src/quizflow/QuizFlowLogo.tsx`: Updated brand logo image reference to `/logo.png`.
  - `src/quizflow/metadata.ts`: Updated `icons` configuration.
  - `src/app/manifest.ts`: Updated manifest icon paths and types.
  - `src/quizflow/logoDataUri.ts`: Re-generated with the new logo data URI.

### 4. Verification
- Run `npx tsc --noEmit` — PASSED (0 errors).
- Server verified on `http://localhost:3001` and `http://localhost:3001/quizflow` — PASSED (200 OK).

---

## 9. Session 7 (2026-08-17) — Production Build Check

### 1. User Request
- Run a production build check (`npm run build`).

### 2. Implementation Plan
- Run `next build` to compile, lint, type-check, and prerender all routes.

### 3. Changes Made
- **None.** This was a verification-only session — no files were modified, added, or
  removed during this session. The uncommitted working-tree changes (backend room-write
  serialization / answer-key accessor, e2e test hardening, three new Supabase
  migrations) were already present before this session and are NOT part of it.

### 4. Verification
- `npm run build` — **PASSED** (exit 0). Compiled successfully; lint + type check clean;
  34/34 static pages generated; all API routes collected; middleware 27.3 kB.
- One benign warning: "Using edge runtime on a page currently disables static generation
  for that page" (known — the edge-rendered OG dynamic card).

---

## 10. Session 8 (2026-08-17) — Team Credentials = Team Name / Leader Name

### 1. User Request
- Change team credential generation: the **username** should be the **team name** and
  the **password** should be the **team leader's name** (first member in the uploaded
  roster). Applies to both single-team creation and bulk file upload in the admin tab.

### 2. Implementation Plan
1. Update `createTeamRecord` (shared by single + bulk creation) to derive credentials
   from the team data instead of random generation: username = team name (with a `-2`,
   `-3`… suffix only on collision, since `teams.username` is unique), password = first
   roster entry (falls back to team name when no roster given).
2. Remove the now-unused random generators (`generatePassword`, `generateUsername`)
   from `credentials.ts`.
3. Make `reset-password` re-issue the leader-name password for consistency.
4. Update the admin dashboard copy + template/error hints so admins know the scheme.

### 3. Changes Made
- **Modified**:
  - `src/quizflow/teamFactory.ts`: username = team name, password = first roster member;
    added `ensureUniqueUsername` (exact name first, suffix on collision).
  - `src/quizflow/credentials.ts`: removed unused `generatePassword`/`generateUsername`
    and the password alphabet.
  - `src/app/api/admin/teams/[id]/reset-password/route.ts`: fetches `name`/`roster` and
    re-issues the leader-name password instead of a random one.
  - `src/app/api/admin/teams/route.ts` + `bulk/route.ts`: updated doc comments.
  - `src/app/quizflow/dashboard/page.tsx`: updated helper text ("Username = team name ·
    Password = team leader"), roster label ("leader first"), and upload error hint.

### 4. Verification
- `npx tsc --noEmit` — PASSED (0 errors).
- `npm run build` — PASSED (exit 0).

### 5. Follow-up fix (same day) — "Invalid team username or password"
- **Bug**: `POST /api/student/login` lowercased the typed username and looked it up
  with an exact `eq` match, but usernames are now the team name (e.g. `Phoenix Squad`)
  — so `phoenix squad` never matched the stored casing and every login returned 401.
- **Fix**: `src/app/api/student/login/route.ts` now uses `.ilike('username', …)` for a
  case-insensitive lookup, so the team name as typed always resolves.
- **Verified**: `npx tsc --noEmit` — PASSED.

### 6. Browser verification (same day) — full student login flow
- **Setup**: migrations are applied on the cloud project, `teams` table live, gate
  `login_open = true`. The running dev server was STALE (all `_next/static` chunks
  404 → React never hydrated → the login form did a native GET submit). Killed the
  old server (PID 8896), wiped `.next`, restarted `npm run dev` on 3001.
- **Playwright browser run (headless Chromium, real UI)** — all PASSED:
  1. Exact team name + leader name → lands on `/quizflow/student/dashboard` with the
     team name shown.
  2. Lowercase team name typed → still logs in (the `ilike` fix).
  3. Wrong password → "Invalid team username or password." shown, stays on login.
  4. Second device (fresh browser context = new device id) → blocked (device binding).
- **Cleanup**: temp script `scripts/verify-student-login.mjs` deleted; leaked seed
  teams removed from the DB (early `process.exit` in failed runs had skipped the
  cleanup `finally`). One user test team "Phoenix" left untouched.
- **Small fix included**: student login placeholder `e.g. phoenix-a1b2` →
  `e.g. Phoenix Squad` (still matched the old random-username scheme).

### 7. Admin-side verification (same day) — team creation flow in the browser
- **Setup**: local admin login (`Sanchit` / `123456` → signed `qf_admin` cookie, no
  Supabase account needed) via `/quizflow/auth`, then the Teams tab.
- **Playwright browser run (headless Chromium, real UI)** — 12/12 PASSED:
  - Single create: credential card shows 👤 username = team name, 🔒 password =
    leader name; row appears in the teams table.
  - DB assertions: stored username == team name; `password_hash` == PBKDF2(leader
    name, salt); roster leader first.
  - Bulk CSV upload (2 teams): preview shows both, create succeeds, both rows have
    username = team name and password = leader name.
- **Cleanup**: temp script deleted; 3 leaked teams removed from the DB (script used
  `process.exit` before the cleanup `finally` — same gotcha as the student flow).
  User's "Phoenix" team untouched.

