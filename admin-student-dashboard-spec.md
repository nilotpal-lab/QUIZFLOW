# QuizFlow — Admin & Student Dashboard Spec

**Status:** Draft for implementation (interviewed 2026-08-15)
**Companion to:** `context.md`, `plan.md`, `live-game-engine-spec.md`, `session-log.md`
**Scope:** Role-based dashboards for the competition event — an **Admin** dashboard (rebrand of the current "Teacher" workspace, extended with event-management tabs) and a **Student** dashboard (login on the day of the competition, single "Join Game" feature). Same visual design as the rest of the site. **No code changes yet — this is the specification.**

---

## 1. Product context & goal

QuizFlow currently serves two personas through one gate: a "Teacher" (host/creator) and a classic PIN+nickname "student" join. For the competition event (100–150 teams), we are splitting the product into two **strictly separate** roles:

- **Admin** — the competition organizer. Logs in with the existing host account (Supabase Auth). Has **all** features: quiz creation (AI Studio), hosting, session history, community library, plus new event-management sections.
- **Student** — a contestant on the day of the competition. Logs in with **team-shared credentials** (one username/password per team, one device per team) handed out by the admin. The student tab has **exactly one feature: Join Game**.

"The teacher was a mistake" → the entire "Teacher" identity is rebranded to **Admin** (labels, dashboard titles, nav, auth page).

---

## 2. Decisions log (from stakeholder interview, 2026-08-15)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Admin identity | **Rebrand Teacher → Admin.** The existing Supabase Auth host account becomes the Admin account. No new auth system. |
| 2 | Existing dashboard | **Replace** `/quizflow/dashboard` (Teacher Workspace) with the Admin Dashboard. Old tabs (My Quizzes, Hosted Sessions, Profile) move in as-is. No separate "teacher" page remains. |
| 3 | Role separation | **Strictly separate.** An admin account can never act as a student contestant in this flow. |
| 4 | Student auth | **Individual credentials, one per team.** Each team gets one shared username + password (roster of ~4 members, one device per team). Replaces the team-code claim flow as the way students play. |
| 5 | Credential management | **In-app form** on the Admin Dashboard: create teams, generate usernames/passwords, view/reset them. No CSV or SQL-only. |
| 6 | Entry point | **Two CTAs on the homepage** — "Admin" and "Student" — each linking to its own login. |
| 7 | Day-of login | **Admin toggle + optional time window.** Before open → "Login opens at <time>" screen. After close → leaderboard-only screen. |
| 8 | Join mechanics | **Click → lobby.** A logged-in student clicks "Join Game" and lands in the lobby of the active game. **No PIN needed.** |
| 9 | Classic PIN flow | **Replaced.** Contestant credential login becomes the only way to play (the classic public PIN+nickname join is no longer the primary path). |
| 10 | Naming | **Admin / Student** everywhere in the UI (buttons, tabs, titles). |
| 11 | Leaderboard | Students can see the **leaderboard while answering** (in-game standings view). |
| 12 | Admin sections | Existing: My Quizzes, Hosted Sessions, Profile. **New:** Teams & Credentials, Live Leaderboard, Day-of Controls, Active Game Control. |

---

## 3. Roles & terminology

| Term | Meaning |
| :--- | :--- |
| **Admin** | Competition organizer. `getAuthenticatedHost`-style Supabase Auth (Bearer token → `supabase.auth.getUser`). |
| **Student** | A team contestant. Authenticated by the new team-credential login; session = `qf_session` httpOnly JWT (existing `authToken.ts` infra). |
| **Team** | A unit of ~4 students sharing one device and one credential. One `teams` row. |
| **Game** | A DB-backed live game (`games` table, sanitized quiz, server-only answer keys) created by the admin via `POST /api/quiz/game`. |

UI copy to change (grep-and-replace during implementation):

- "Teacher Login" → "Admin Login"
- "Teacher Sign In" → "Admin Sign In"
- "Teacher Workspace" → "Admin Dashboard"
- "Teacher Dashboard" / `TeacherDashboard` → "Admin Dashboard" / `AdminDashboard`
- "Host / Teacher Display Name" → "Admin Display Name"
- Footer links: "Teacher Workspace & Dashboard" → "Admin Dashboard", "Teacher Sign In" → "Admin Login"

---

## 4. Information architecture & routes

```
/quizflow                          Homepage — TWO role CTAs (Admin | Student)
├── /quizflow/auth                 Admin login (existing page, rebranded copy)
├── /quizflow/dashboard            Admin Dashboard (REPLACED content — 7 tabs)
├── /quizflow/student/login        Student login (team username + password)
├── /quizflow/student/dashboard    Student Dashboard (ONE feature: Join Game)
├── /quizflow/student/lobby        Student in-game screen (lobby → play → leaderboard)
└── /quizflow/host/*               Legacy host room flow — kept reachable FROM the
                                   admin "Active Game" tab only (see §7.7)
```

- Keep the existing AI Studio (`/quizflow/studio`), practice/library (`/quizflow/practice`), and results (`/quizflow/results`) pages — they are Admin features reached from the Admin Dashboard.
- The classic public join (`/quizflow/join`) and lobby (`/lobby/[pin]`) become legacy paths. Per decision #9 they are **not** the primary entry; do not surface them from the homepage nav/CTA grid. (Keep them working for backwards compatibility unless explicitly removed.)

**Middleware (`src/middleware.ts`):**
- Extend the matcher to include `/quizflow/student/:path*` so the student dashboard + lobby require a valid `qf_session` cookie (redirect to `/quizflow/student/login?next=…`).
- The student login page itself must be reachable without a session.
- Day-of gate is enforced server-side (see §8), **not** in middleware (middleware has no DB access).

---

## 5. Homepage entry (two CTAs)

`/quizflow` — replace the current hero CTA row (Join Game / Quiz Library / Host Game / Dashboard) with a prominent **role splitter**, keeping the marketing sections intact:

- **🛡️ Admin** (violet card, `hard` shadow) → `/quizflow/auth` — "Create quizzes, host the competition, manage teams."
- **🎮 Student** (sun/mint card, `hard` shadow) → `/quizflow/student/login` — "Play on competition day with your team code."

Nav changes:
- Replace the "Teacher Login" pill with **"Admin Login"** → `/quizflow/auth` (same logic: logged-in admin sees their avatar pill → `/quizflow/dashboard`).
- Add a second pill **"Student Login"** → `/quizflow/student/login` when no admin session is present.
- Footer links updated per §3.

---

## 6. Student dashboard

### 6.1 Login — `/quizflow/student/login`

Form fields:
- **Team username** (text)
- **Password** (password, show/hide toggle)

Behavior:
1. `POST /api/student/login` `{ username, password, device_id }`.
2. Day-of gate first (see §8): if closed-before → show "🔒 Login opens at `<opens_at>`" (locked card); if closed-after → show the leaderboard-only screen (see §8.3).
3. Success → httpOnly `qf_session` cookie set (reuse `signSessionToken`/`issueSession` pattern from `/api/teams/claim`) → redirect to `/quizflow/student/dashboard` (or `?next=` target).
4. Failure → inline error: `Invalid username or password`, `Already logged in on another device`, `Login is closed` (respecting the gate), rate-limit message.
5. Device binding: **first successful login binds the team's device** (`teams.device_id`). Same device re-login → `reconnect:true` resume. Different device → 409-style "This team is already logged in on another device" (matches the existing one-device-per-team rule). Admin can release via the Teams tab.

Reuse the existing per-IP rate limit pattern (in-memory `global.__qf_login_limits`, ~20 req / 10s) — and per the open question from the load test, key the limit by **username** in addition to IP so one school network can't throttle the whole event (§11).

### 6.2 Dashboard — `/quizflow/student/dashboard`

Minimal, single-purpose. **The ONLY feature is Join Game** (decision #8/#9).

Content:
- Header (same `top-bar` / nav styling): QuizFlow logo, team identity chip (`badge`): "👥 Team Phoenix", "Logged in as Alex (captain)"; roster pill showing team members; Logout button.
- Hero card: "🎮 Ready to compete?" + one large **"Join Game"** button (`btn btn-primary`, violet, `hard` shadow) → `/quizflow/student/lobby`.
- Status strip (fetched from `GET /api/quiz/game/state` + gate): "⏳ Waiting for the admin to open the game…" / "🔒 Login opens at <time>" / "🏁 Competition over — view results".
- No quizzes, no history, no shop, no settings — anything beyond Join Game is out of scope (see §12).

Route protection: middleware requires `qf_session`; `GET /api/session/me` hydrates team identity (`teams` + `member_name`).

### 6.3 In-game screen — `/quizflow/student/lobby`

A single status-driven page (lobby → question_active → question_reveal → leaderboard → ended):

1. **Lobby** (game status `lobby`): "Waiting for the admin to start…" with pulsing dots; subscribes to the active game's state. When the admin starts, transitions to play automatically.
2. **Play** (`question_active`): renders the current sanitized question (from `GET /api/quiz/game/state` — **never includes `correct_index`**, enforced server-side), answers POST to `/api/quiz/answer`. Show live rank + score chip. **Leaderboard toggle button visible while answering** (decision #11) — opens the in-game standings overlay (reuse `RealtimeLeaderboardModal` styling) fed by the debounced leaderboard read.
3. **Reveal** (`question_reveal`): server-confirmed correct/incorrect + points from the `/api/quiz/answer` response only (client never computes correctness).
4. **Ended**: final standings card.

Data source: poll `GET /api/quiz/game/state` on a 1–2s interval and/or subscribe to the existing Supabase Realtime channel (`qf_room_<game_id>`); reuse the no-store cache headers convention. The active game id comes from the event config (see §8.1) or the student's `quiz_sessions.game_id`.

---

## 7. Admin dashboard — `/quizflow/dashboard`

Replace the current Teacher Workspace content. Keep the same shell (`page-wrapper memphis-bg`, `top-bar`, tab buttons, toast, `maxWidth 1280` container). Tabs (7):

### 7.1 My Quizzes (existing — unchanged)
Drafts + library-ready quizzes, Host / Publish Global / Edit Studio / Delete actions. Move in as-is.

### 7.2 Hosted Sessions (existing — unchanged)
Timeline + grouped-by-quiz history, full session report panel. Move in as-is.

### 7.3 Teams & Credentials (NEW)
- Table of all teams (`GET /api/admin/teams`): name, code, roster, username, status (`waiting/claimed/in_progress/submitted`), device binding, claimed_by, created_at.
- **Create team** form: team name, roster (up to 4 names, comma/enter separated). Server generates a unique `code` + unique `username` + random `password`; returns them for display/copy.
- **View credentials**: username + password shown per team (reveal-on-click; admin-only page, so plain display is acceptable).
- **Reset password** (new random), **release device** (`POST /api/admin/teams/:id/release` — existing endpoint), **delete team**.
- Optional: "copy all credentials" / print list for day-of handout.

### 7.4 Live Leaderboard (NEW)
- Poll `GET /api/admin/leaderboard?game_id=…` on a fixed 1–2s interval (existing debounced read — never per-answer broadcasts, §9).
- Ranked table: rank, team name, points, coins, streak, total_correct, frenzy_correct_count, violation_count.
- Top-3 podium reusing the results-page styling; filter/search box for 150 rows.

### 7.5 Day-of Controls (NEW)
- **Gate switch**: Open / Closed for student login (stored in `event_config`, see §8.1).
- **Schedule**: optional `opens_at` / `closes_at` date-time inputs (date-fns is already a dependency for formatting).
- **Status readout**: current gate state (Open / Closed-before / Closed-after), active game id, "X of Y teams logged in", "Z teams submitted".
- **Active game**: pick which game the competition runs on (see §7.7) — writes `event_config.active_game_id`.

### 7.6 Profile (existing — unchanged)
Rename "Host / Teacher Display Name" → "Admin Display Name" (§3); keep school field + email read-only.

### 7.7 Active Game Control (NEW — the host experience for the competition)
- **Pick a quiz**: list saved quizzes (reuse `getSavedQuizzes`) → select one → `POST /api/quiz/game` `{ game_id, quiz, mode }` (existing endpoint; sanitizes quiz + stores keys server-only).
- **Lobby view**: shows joined/connected teams (from `quiz_sessions` for this `game_id`), "Start Game" button (flips `games.status` → `question_active` via the existing `qf_*` RPC / `/api/quiz/game/advance`).
- **Live controls**: advance question, reveal answer, leaderboard, end game, boss-frenzy start/end — mirroring the current `/quizflow/host` dashboard controls but driven through the DB-backed engine endpoints (`/api/quiz/game/advance`, `/api/quiz/boss/start`, `/api/quiz/boss/finalize`, `/api/quiz/violation`).
- Students are already in the lobby (no PIN); the admin's "Start" is what pushes them into `question_active`.
- The legacy `/quizflow/host?pin=…` page stays reachable from here for the classic room flow, but the competition itself runs on the DB-backed game.

---

## 8. Day-of gate (login enforcement)

### 8.1 Storage — `event_config` (single-row settings table, new migration)

```sql
create table event_config (
  id int primary key default 1 check (id = 1),      -- single row
  login_open boolean not null default false,        -- admin toggle
  opens_at timestamptz,                             -- optional schedule
  closes_at timestamptz,
  active_game_id text,                              -- references games(id), nullable
  updated_at timestamptz default now()
);
```

- `active_game_id` may instead live on `games` if the engine already needs it there; the spec only requires **one anon-readable place** the student lobby can read the active game id. `game_answer_keys` stays server-only (no grants) — do not widen it.
- Gate is read with the anon key, so it must contain **no secrets** (it doesn't: just booleans/timestamps).

### 8.2 Gate state machine (evaluated in `POST /api/student/login`)

| State | Condition | Login behavior |
| :--- | :--- | :--- |
| **Closed-before** | `!login_open` AND (`opens_at` set AND `now() < opens_at`) | Reject: "🔒 Login opens at `<opens_at>`" |
| **Open** | `login_open = true` OR (`opens_at` set AND `now() >= opens_at` AND (`closes_at` null OR `now() < closes_at`)) | Accept |
| **Closed-after** | `!login_open` AND (`closes_at` set AND `now() >= closes_at`) — or explicit admin close after the event | Reject: "🏁 Competition complete" |

Rules:
- `login_open` is the manual **override**; `opens_at`/`closes_at` are the optional schedule. Override wins (admin can open early or keep open past schedule).
- The gate state is also returned by `GET /api/session/me` (or a small `GET /api/event/config`) so the student dashboard/lobby can render the right status strip.

### 8.3 Closed-after screen (leaderboard-only)

When the competition has ended, logged-in students (and the login page for gate reasons) see **final standings only**:
- Ranked table (reuse `/api/admin/leaderboard` shape — but for students serve the same ranked list; it contains no answer keys, so it is safe to share).
- No Join Game button, no answer submission. Answers endpoint already rejects when game status is `ended`; keep that enforcement as the backstop.

---

## 9. Security & conventions (must follow — mostly existing patterns)

1. **No service-role key.** Admin endpoints authenticate with `getAuthenticatedHost` (Bearer token); student endpoints verify the `qf_session` JWT. Never add a service-role secret.
2. **Server-authoritative correctness.** Students never receive `correct_index` before reveal (`sanitizeQuizForClient` + `game_answer_keys` no-grants + SECURITY DEFINER RPCs — existing live-play engine). `/api/quiz/answer` returns only `{ correct, points_earned, coins_earned }`.
3. **Passwords**: no new auth library. Hash with **Web Crypto PBKDF2** (server-side route only; the Edge middleware never needs the password). Store `password_salt` + `password_hash` (e.g. `pbkdf2-sha256:600000:<salt>:<hash>`). Generate random passwords (e.g. `Ab3$` + 6 chars) for admin-created teams.
4. **Atomic operations.** Login uses a conditional UPDATE for device binding (same pattern as `/api/teams/claim`). Credential create/reset use single-row upserts. Points/coins only change via the existing engine RPCs.
5. **Rate limiting.** Per-IP + per-username in-memory limiter on `/api/student/login` (§6.1, §11).
6. **No-store everywhere.** All new routes: `dynamic='force-dynamic'`, `revalidate=0`, `noCacheHeaders`.
7. **Secrecy hygiene.** Sanitized-only state in anon-readable tables; `event_config` contains no secrets; leaderboard payloads contain no answer keys.
8. **Supabase-unconfigured fallback.** New server routes return `503 { error: 'Supabase is not configured.' }` (same as existing routes). The student login/dashboard are DB-backed by nature; the classic in-memory room flow remains the legacy path.

---

## 10. Design system compliance

Reuse the existing QuizFlow visual language exactly (from `DESIGN.md`, `globals.css`, `tailwind.config.ts`) — **no new design tokens**:

- Surfaces: `--paper` (#FFFCF5) canvas, `--paper-2` cards, `memphis-bg` dot texture.
- Outlines: `3px solid var(--ink)` borders, `hard` offset shadows (`4px 4px 0 #10100F`, hover `7px 7px 0`).
- Palette: violet (primary student CTA), sun (highlights), mint (success), sky, cherry (danger).
- Type: Space Grotesk (`font-display`) heavy uppercase display; Inter (`font-body`) body.
- Components: `.card`, `.badge badge-*`, `.btn btn-*`, `.top-bar`, `.lb-row`, `.anim-scale-in`, `.btn-press` tactile press.
- **Mobile-first**: contestant screens are used on phones on the day — no horizontal scroll, segmented/PIN-size inputs only where needed, large touch targets. Recent commits are all mobile-responsive fixes; keep that bar.

---

## 11. Edge cases & open questions

- **Rate limiter at event scale** (carried from session-log §7): key the login limiter by **username + IP**, raise the per-IP budget for the login burst (~150 teams on one school network). Verify with a stampede test.
- **What if the admin restarts/changes the active game mid-event?** Spec: changing `active_game_id` drops students' lobby into the new game; in-progress `quiz_sessions` rows keep their old `game_id` (scoring continues against the old game until `ended`). Confirm at implementation.
- **Username uniqueness vs. team code**: keep `teams.code` (legacy claim flow) but add unique `teams.username`. Should the generated username equal the code or a slug of the team name? Default: `team-<slug>-<random4>`; confirm aesthetics.
- **Multiple simultaneous games** — out of scope; one active competition game at a time.
- **Student logout**: clears the `qf_session` cookie and releases nothing server-side (device stays bound until admin release) — or unbind on logout? Default: keep binding; only admin release unbinds (prevents credential sharing).
- **After-event data**: `closes_at` passes but admin wants to reopen for practice — allowed via the manual toggle.
- **Applying migrations to the cloud project** (`ogciyskjrefwmazzckfg`): still outstanding from the team-login session — the new `event_config` + `teams` column migration must be applied there before go-live.
- **`/api/teams/claim` fate**: superseded by `/api/student/login` in the UI; keep the endpoint (tests depend on it) but remove UI links.

---

## 12. Non-goals (out of scope for this feature)

- No new auth provider/library (Web Crypto + Supabase Auth only).
- No CSV import / bulk upload UI (decision #5 — in-app form only). (CSV *export* of credentials is optional sugar.)
- Student side: no quiz history, no coin shop, no settings, no avatar picker, no practice hub. Join Game is the only feature.
- No changes to the live-play scoring engine itself (only new admin/student surface wiring).
- No multi-game scheduling; one active competition game.

---

## 13. Backend work items (summary)

| Item | Detail |
| :--- | :--- |
| Migration | `event_config` table (single row) + `teams.username text unique` + `teams.password_salt text` + `teams.password_hash text` + `teams.password_updated_at`. |
| `POST /api/student/login` | Gate check → credential verify (PBKDF2) → device bind (conditional UPDATE) → issue `qf_session` cookie → team payload. |
| `GET /api/event/config` | Gate state + active game id (anon-readable, no secrets). |
| `GET/POST /api/admin/teams` | Extend existing: create team (generate code/username/password), list, reset password. |
| `POST /api/admin/teams/:id/release` | Existing; keep. |
| `POST /api/admin/event-config` | Save toggle + schedule + active game id (host auth). |
| Middleware | Add `/quizflow/student/:path*` to the matcher (cookie gate). |
| Rebrand | Teacher → Admin copy across homepage nav, footer, auth page, dashboard titles. |

## 14. Frontend work items (summary)

| Item | Detail |
| :--- | :--- |
| Homepage | Two-role CTA splitter; "Admin Login" + "Student Login" nav pills; footer copy. |
| `/quizflow/auth` | Rebranded copy only (existing auth logic unchanged). |
| `/quizflow/dashboard` | Replace with 7-tab Admin Dashboard (3 existing + 4 new per §7). |
| `/quizflow/student/login` | New login page with day-of gate screens. |
| `/quizflow/student/dashboard` | New single-feature dashboard (identity + Join Game + status strip). |
| `/quizflow/student/lobby` | New status-driven in-game screen (lobby/play/reveal/leaderboard/ended) with leaderboard-while-answering. |

## 15. Verification plan

```bash
npx tsc --noEmit          # after each section
npm run build
# e2e: cd e2e && npx playwright test   (teams + quizflow suites must still pass)
```

- Unit/integration: login accepts correct credentials and rejects wrong ones; gate rejects before `opens_at` and after `closes_at`; admin toggle overrides schedule; device binding is race-safe (two devices, one credential → one winner); password reset invalidates the old hash; leaderboard payload contains no answer keys.
- E2E (new `e2e/tests/admin-student.e2e.ts`, serial): admin creates team + credentials → student logs in → sees only Join Game → clicks → lands in lobby → admin starts → student answers → leaderboard visible while answering → game ends → standings.
- Load test: extend `scripts/loadtest-teams.mjs` (or add) for the login burst — ~150 teams logging in near-simultaneously from one IP; assert no 429 cascades after the limiter change and every login wins exactly its own team.
- Manual security check: inspect every payload the student client receives for `correct_index` (question_active / boss_frenzy) — none may appear pre-reveal.
