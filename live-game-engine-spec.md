# QuizFlow — Server-Authoritative Live-Play Game Engine Spec

**Status:** Draft for review (numbers are proposed defaults, not final balance)
**Companion to:** `quizflow-agent-prompt.md` (team login/claim backend), `plan.md`, `context.md`, `session-log.md`
**Scope:** Scoring, coin economy, power-up shop, boss-mode finale, anti-cheat, and 100–150 concurrent-team scale. **No code changes yet — this is the specification.**

---

## 0. Non-negotiable principles

1. **The server is the only source of truth** for correctness and scoring. The client never knows a correct answer, never computes a score, never applies a power-up effect to itself. It only sends intent ("I picked option B", "I want to buy Freeze") and renders what the server confirms.
2. **Every client message is untrusted input.** No `score`, `points`, `coins`, `correct_index`, or `client_elapsed_ms` value from the client is ever used for scoring math. The client's elapsed time is log/UX data only; scoring time is recomputed from a server-stored question-start timestamp.
3. **No endpoint returns a correct answer before the reveal phase.** This is manually audited (see §7), not just agent-reported.

---

## 1. Decisions log (from stakeholder interview, 2026-08-14)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Player unit | **Team = the player unit.** One member answers on the shared device; points/coins credit the team. Teams register under their team name. One `quiz_sessions` row per team is the full player record. |
| 2 | Flow overlap | Keep the classic PIN flow (`sessionStore.ts` + `/api/room/[pin]` relay) working untouched; the new DB-backed endpoints serve the **team-login event flow** and become the scoring authority for it. (Chosen by judgment — "whichever is best.") |
| 3 | Constants scope | `scoring.ts` is the single source of truth for the new engine. `coinShop.ts` derives its prices from it (UI prices = server costs). The classic relay's points formula is **deferred** — not migrated in this pass. |
| 4 | Boss pacing | **Global shared question (class-wide).** Server streams one shared question; it advances when a majority of connected teams have answered OR a short per-question cap expires, whichever comes first. Each team's correct count is recorded independently. |
| 5 | Boss bonus | **Per-correct points + rank bonus.** Teams keep earning frenzy points per correct answer (existing 200/correct, made a named constant) AND top performers get a rank bonus from a named curve in `scoring.ts`. |
| 6 | Bid multiplier | Applies to the **next question** the team answers; consumed by exactly one answer. A bid bought mid-question never applies to the in-flight question. |
| 7 | Freeze scope | `freeze_player` freezes the **selected team**; `freeze_all` freezes all **other** teams (buyer excluded, as today). Freeze works during boss mode too (existing UI already checks `frozenUntil` in frenzy). |
| 8 | Anti-cheat mode | **Soft** — violations are logged and visible to the host; answers are never blocked. Flag threshold stays **3** violations; flagged teams face **no** rank-bonus penalty. (Chosen by judgment for the delegated item.) |
| 9 | Answer secrecy | **Strict everywhere in the new flow.** `correct_index` is stripped from every payload a student client receives (BroadcastChannel, polling, WebSocket, API). The student UI never computes correctness — popups render only server-confirmed values. |
| 10 | State home | **DB-backed per answer.** Each answer is one atomic single-row `UPDATE` on `quiz_sessions`. Question-start timestamps are stored server-side when the question is served. Graceful 503 when Supabase is unconfigured (same pattern as `/api/quiz/submit`). |
| 11 | Wrong answers | **Keep −5 boss damage.** Wrong answers in boss_raid/boss mode deduct 5 points, floored at 0. Correct-only in normal rounds. |
| 12 | Boss questions | **Cycle the existing quiz** (`i % totalQ`), as the current `startBossFrenzy` does. No new content source. |
| 13 | Load test | **Both.** API-level Node script for the ~150-team stampede (mirrors `scripts/loadtest-teams.mjs`) + a small Playwright smoke test (3–5 teams) for the full UI flow. |
| 14 | Rate limits | **Per-team/session token**, not per-IP. A school-network stampede must not be throttled; abuse is bounded by the signed session. (Chosen by judgment.) |
| 15 | Points formula | **Flat difficulty points + bonuses** (100/200/300) with a ×1.5 fast-answer bonus on hard questions under the threshold, ×bid multiplier, + streak bonus. |
| 16 | Reveal phase | **Host-triggered reveal** (as today). Server flips status → `question_reveal` and only then includes the correct answer in the broadcast. |
| 17 | Boss trigger | **Host button** on the dashboard (as today). Once triggered, the server owns the 60s window, pacing, and close. |

---

## 2. Player/session model & schema

New migration `20260815090000_add_live_play_game_engine.sql` (already written):

```sql
-- Games: shared question pacing + server timing (one row per game/pin).
-- quiz is SANITIZED (correct_index stripped); keys go to game_answer_keys.
create table games (
  id text primary key, mode text, status text, quiz jsonb, config jsonb,
  current_question_index int default -1, question_started_at timestamptz,
  boss_question_index int default -1, boss_window_ends_at timestamptz,
  boss_bonus_awarded boolean default false, created_at timestamptz
);

-- Server-only answer keys: NO anon/authenticated grants (definer-only).
create table game_answer_keys (game_id, question_index, correct_index);

-- Per-team live state on quiz_sessions:
alter table quiz_sessions add column game_id text references games(id);
alter table quiz_sessions add column points int not null default 0;
alter table quiz_sessions add column coins int not null default 0;
alter table quiz_sessions add column streak int not null default 0;
alter table quiz_sessions add column max_streak int not null default 0;
alter table quiz_sessions add column total_correct int not null default 0;
alter table quiz_sessions add column total_answered int not null default 0;
alter table quiz_sessions add column total_response_time_ms bigint not null default 0;
alter table quiz_sessions add column last_answered_question_index int not null default -1;  -- answer-once guard
nalter table quiz_sessions add column frozen_until timestamptz;                      -- freeze enforcement
alter table quiz_sessions add column bid_multiplier int not null default 1;         -- 2/3/4, consumed by one answer
alter table quiz_sessions add column bid_question_index int not null default -1;    -- question index at purchase time
alter table quiz_sessions add column frenzy_correct_count int not null default 0;   -- correct answers in boss window
alter table quiz_sessions add column frenzy_response_time_ms bigint not null default 0; -- boss tie-break speed
alter table quiz_sessions add column violation_count int not null default 0;        -- soft-mode counter (NOTE: `violations jsonb` already exists; named violation_count to avoid collision)
```

**Implemented security model** (the key architectural decision): the server runs with the **anon key**, so anything it can do, a client could too. Therefore correct answers are kept out of every anon-readable table: `game_answer_keys` has no grants, and all scoring/coin math runs inside `SECURITY DEFINER` Postgres functions (`qf_apply_answer`, `qf_buy_powerup`, …) that read the keys and apply atomic `SET points = points + $delta` expressions with WHERE guards. `supabase-js` cannot express those update expressions, so the RPC functions are the atomicity + trust boundary — no service-role key was added.

Rules:
- **Points and coins are never cross-mutated.** Points only increase from correct/fast answers and boss performance (minus the −5 boss damage floor-0 rule). Coins only change via answer rewards (correct answers) and shop purchases.
- **The client can never set `points` or `coins` directly** on any endpoint. Both are server-computed deltas applied via `/api/quiz/answer` and `/api/quiz/shop/buy` only.
- When Supabase env vars are absent, the new endpoints return `503 { error: 'Supabase is not configured.' }` exactly like `/api/quiz/submit`. The classic no-cloud fallback (in-memory relay) remains the classic flow's domain.

---

## 3. `src/quizflow/scoring.ts` — single source of truth

All constants in one file, exported, named — **never inline magic numbers in route handlers**. Flag the file for team balance review before launch; numbers are proposals.

```ts
export const DIFFICULTY_POINTS = { easy: 100, medium: 200, hard: 300 };
export const DIFFICULTY_COINS  = { easy: 5,   medium: 10,  hard: 20  };

export const FAST_ANSWER_THRESHOLD_MS = 5000;
export const FAST_ANSWER_BONUS_MULTIPLIER = 1.5;   // points only, hard questions under threshold

export const STREAK_MULTIPLIER_PER_STEP = 0.1;      // +10% per consecutive correct
export const STREAK_MULTIPLIER_CAP      = 0.5;      // capped at +50% (matches existing convention)

export const BOSS_DAMAGE_WRONG_POINTS = -5;         // boss_raid/boss mode only, floor at 0

export const POWERUP_COSTS = {
  freeze_player: 15,
  freeze_all: 30,
  bid_2x: 20,
  bid_3x: 35,
  bid_4x: 50,
};

export const FREEZE_DURATION_MS = { freeze_player: 6000, freeze_all: 4000 };

export const BOSS_MODE = {
  question_count: 10,
  duration_seconds: 60,
  per_question_cap_ms: 8000,          // shared-question advance fallback
  advance_when_pct_answered: 0.6,     // advance when ≥60% of connected teams answered
  points_per_correct: 200,            // per-correct frenzy award (existing behavior, now named)
};

export const BOSS_RANK_BONUS = [500, 300, 200, 100]; // top 4 at window close; index = rank-1

export const MIN_RESPONSE_MS = 100;   // sub-threshold answers are flagged suspicious-bot (0 pts, logged)
```

`coinShop.ts` must derive prices from this file (e.g. `SHOP_ITEMS` built from `POWERUP_COSTS`) so the shop UI can never drift from the server. **Note:** this changes the classic flow's displayed prices (freeze_all 25→30, bid_2x 10→20, bid_3x 20→35, bid_4x 35→50) — flagged for balance review.

---

## 4. Endpoints

All new routes: `dynamic = 'force-dynamic'`, `no-store` cache headers (reuse the existing `noCacheHeaders` pattern), and auth via the `qf_session` httpOnly JWT cookie (`getSessionTokenFromRequest` + `verifySessionToken`).

### 4.1 `POST /api/quiz/answer` — server-authoritative scoring

Request:
```json
{ "question_id": "q3", "selected_option": 2, "client_elapsed_ms": 8200 }
```

Server processing, in this exact order:
1. Validate session token → resolve `team_id` + `quiz_sessions` row + `game_id`. 401 on bad/absent token; 404 if no session row.
2. **Server-side answer key lookup only** — via the SECURITY DEFINER `qf_apply_answer` RPC reading `game_answer_keys` (no anon grants). The active question index comes from the `games` row, never the client. Never trust a client-supplied correct-answer id.
3. **Recompute elapsed time** from `games.question_started_at` (server-stamped when the question was served). `client_elapsed_ms` is stored for logs/UX only.
4. Enforcement gates, all inside the same atomic UPDATE (see below):
   - `now() < frozen_until` → reject (frozen).
   - `last_answered_question_index = current_question_index` → reject (already answered this question; no double-credit).
   - `status`/window checks: question must be active for this session (reject if answered outside the active window or after the boss window ended).
5. Compute deltas via `scoring.ts` (see §5). Apply active `bid_multiplier` if `bid_question_index < current_question_index` (i.e. bid was purchased before this question started), then reset `bid_multiplier = 1`, `bid_question_index = -1`.
6. **Atomic persist** — single-row conditional UPDATE so concurrency can't lose or double-apply:

```sql
update quiz_sessions
set points = points + $points_delta,
    coins  = coins  + $coin_delta,
    last_answered_question_index = $qidx,
    bid_multiplier = case when $consume_bid then 1 else bid_multiplier end,
    bid_question_index = case when $consume_bid then -1 else bid_question_index end,
    frenzy_correct_count = frenzy_correct_count + $frenzy_delta
where id = $session_id
  and (frozen_until is null or frozen_until < now())
  and last_answered_question_index <> $qidx
returning points, coins, frenzy_correct_count;
```

   `0 rows affected` → respond with the specific rejection reason (frozen / already answered), **no** score mutation.
7. Response — **never echoes the correct answer id**:
```json
{ "correct": true, "points_earned": 300, "coins_earned": 20 }
```
   The correct-answer reveal is delivered only by the reveal-phase mechanism (§6). `correct: false` for wrong/frozen/already-answered, with `points_earned: 0, coins_earned: 0` for frozen/duplicate.
8. Suspicious-bot: recomputed elapsed < `MIN_RESPONSE_MS` → award 0 points, log to violations (soft mode).

### 4.2 `POST /api/quiz/shop/buy` — power-up shop

Request:
```json
{ "item": "freeze_player" | "freeze_all" | "bid_2x" | "bid_3x" | "bid_4x", "target_team_id"?: "..." }
```

1. Validate session → resolve team + session row.
2. Validate `item` ∈ `POWERUP_COSTS`; `freeze_player` requires `target_team_id` (must be a different, joined team).
3. **Atomic deduct + purchase guard** (handles two purchases racing):

```sql
update quiz_sessions set coins = coins - $cost
where id = $player_id and coins >= $cost
returning coins;
```

   `0 rows` → **402-style** `{ error: 'Insufficient funds' }` (no effect applied).
4. Apply the effect server-side, same transaction:
   - `freeze_player` → `update quiz_sessions set frozen_until = now() + interval '6 seconds' where id = $target`.
   - `freeze_all` → same for every team except the buyer, `interval '4 seconds'`.
   - `bid_2x/3x/4x` → `update quiz_sessions set bid_multiplier = $mult, bid_question_index = $current_q_index where id = $buyer`. Because the multiplier applies only when `bid_question_index < current_question_index` (§4.1 step 5), a mid-question purchase can never amplify the in-flight question.
5. Broadcast the effect on the existing realtime channel — **implemented**: `POST /api/quiz/shop/buy` emits a `powerup_effect` event on `qf_room_<game_id>` (Supabase Realtime) with `target_team_ids` so clients can show "You've been frozen!". **Presentation only**; enforcement is the `frozen_until` WHERE clause in §4.1.
6. Response: `{ success: true, coins_remaining: $coins }`.

### 4.3 `POST /api/quiz/boss/start` — server-owned finale

Host-only (Supabase Bearer host auth, `getAuthenticatedHost` — same as `/api/admin/teams`). Triggered by the host button; must be the final segment of a game (not opt-in mid-quiz).

1. Validate the game is at the end of its regular questions (or host override to start early — out of scope, see Open questions).
2. Server stamps `boss_window_ends_at = now() + 60s` on every session row, resets `frenzy_correct_count = 0`, builds the 10-question index cycle (`i % totalQ`).
3. Server owns all pacing: question N+1 is served when ≥`advance_when_pct_answered` of connected teams answered N **or** `per_question_cap_ms` elapses, whichever first. Clients only render a countdown the server tells them; no client-authoritative timer.
4. At window close (timer expiry or all 10 questions), the server:
   - Ranks teams by `frenzy_correct_count` desc; **ties broken by speed** — cumulative recomputed response time within the window (matches the existing tie-break convention of `totalResponseTimeMs` asc after score/streak).
   - Awards `BOSS_RANK_BONUS` points to the top 4 (atomic per-team UPDATE), on top of the per-correct `BOSS_MODE.points_per_correct` already credited during the window.
   - Flips game status → `ended` and broadcasts final standings.

### 4.4 Reveal phase (existing mechanism, reused)

Host clicks Reveal in the dashboard → server flips status to `question_reveal` and **only then** includes `correct_index` in the broadcast (via the relay's existing `sanitizeStateForClient` inverse). `/api/quiz/answer` never returns the correct id at any point.

### 4.5 Question serving & timestamps

When the host (or server) starts a question, `current_question_index` + `current_question_started_at = now()` are written to all team rows atomically (one statement per team, or a single `update ... where team_id in (...)`). This is the timestamp `/api/quiz/answer` recomputes elapsed from. The question payload served to clients is **stripped of `correct_index`** regardless of channel.

---

## 5. Scoring rules (from `scoring.ts`)

| Situation | Points | Coins |
|---|---|---|
| Correct, easy | 100 | 5 |
| Correct, medium | 200 | 10 |
| Correct, hard | 300 | 20 |
| Correct, hard, elapsed < 5000ms | ×1.5 fast bonus (450) | 20 |
| Streak bonus | +10% per consecutive correct, cap +50% | — |
| Bid multiplier (2×/3×/4×, next question only) | ×mult | — |
| Wrong, normal round | 0 | 0 |
| Wrong, boss mode / boss_raid | −5 (floor 0) | 0 |
| Suspicious-bot (<100ms server-elapsed) | 0 | 0 |

- Coins: **earned on correct answers only**, scaled by difficulty. The old +3 fast-coin bonus is dropped (existing `awardCoins` behavior) — flagged for review.
- Points formula is flat difficulty + bonuses (decision #15), replacing the relay's base-1000 speed formula **for the new flow only**.

---

## 6. Power-up semantics & race documentation

- **Multiplier ordering (documented, decided):** a bid must be purchased and its response received before the client submits an answer; the server additionally enforces `bid_question_index < current_question_index` so a bid can never apply to the question it was bought during. `bid_2x` bought during Q5 applies to Q6+. A second purchase overwrites (last-write-wins; coins deducted per purchase).
- **Freeze checks are a read before the answer write** — but enforcement is entirely inside the answer UPDATE's WHERE clause, so the buy-answer race is resolved by Postgres row locking, not app logic (same pattern as the team claim endpoint).
- **Freeze during boss mode:** applies (existing UI already renders it in frenzy).
- **Shop availability:** shop is open during normal rounds; behavior during boss mode — see Open questions (default: closed during the 60s window to keep the write path hot).

---

## 7. Fullscreen + anti-cheat (soft mode)

- **Fullscreen gate:** confirm `antiCheat.ts` already blocks play until `document.fullscreenElement` is truthy (the play screen has a "Fullscreen Required" overlay gating `question_active`). If the gate doesn't disable the answer buttons until fullscreen, add that. **Answer UI is disabled until fullscreen is entered.**
- **Soft enforcement:** on fullscreen exit during an active question → log a violation via the existing `reportViolation` path → host sees the flag. Threshold stays 3. No answer blocking (decision #8). Documented decision point; hard mode can be added later behind a config flag without schema changes.
- **Devtools/inspect protections** (context-menu block, F12/Ctrl+Shift+I interception) are **cosmetic-only** — they deter casual peeking, not the security boundary.
- **The real security boundary:** correct answers are never present in any payload sent to the client before reveal. Audit every question-serving path (relay GET, BroadcastChannel state, Supabase Realtime state, the new question-serving endpoint) to confirm `correct_index` is stripped in `question_active`/`boss_frenzy`. The student play screen must stop computing `isCorrect`/`calculatePoints` client-side — popups render the server's `{ correct, points_earned }` response only. **This item is manually re-verified by reading the diff, not agent-reported.**

---

## 8. Scale: 100–150 concurrent teams

- **Leaderboard broadcast storm:** answers never trigger a full leaderboard recompute+broadcast. The host/leaderboard reads are debounced: recompute and broadcast on a fixed 1–2s interval (server-side), not per answer. In the new flow the leaderboard is read from `quiz_sessions` (points desc → streak/timing tie-break) rather than pushed per answer.
- **DB write contention:** every answer/purchase is a single-row atomic UPDATE (§4.1, §4.2). Confirmed: no endpoint does a read-modify-write on points/coins.
- **Boss window is the highest-risk window** — 150 teams × 10 rapid-fire questions in 60s is the most concentrated write load. Covered by the load test (§9).
- **Rate limiting:** per-team/session token (e.g. ≤ 1 answer per question per team — already enforced by `last_answered_question_index`; optional burst cap per token), **no per-IP limit** on answer/shop. The claim route's 20/10s per-IP limit stays as-is (login burst is a separate concern).

---

## 9. Verification plan

```bash
npx tsc --noEmit          # after each section
npm run build
# e2e: cd e2e && npx playwright test (teams + new quizflow live-play smoke)
```

### 9.1 Unit/integration coverage
- Points/coins tracked separately, never cross-mutated (schema + endpoint tests).
- All scoring constants live in `scoring.ts`; route handlers contain zero magic numbers (lint/audit).
- Answer timing is recomputed from `current_question_started_at`; a client claiming 0.1s with a 10s server-elapsed gets the real-time score.
- Power-up purchases are atomic; concurrent double-buy yields exactly one deduction (0 rows → 402).
- Freeze/multiplier enforced server-side: frozen team's answer UPDATE returns 0 rows; bid bought mid-question never applies to that question.
- No endpoint returns `correct_index` before reveal — covered by the manual diff audit (§7).

### 9.2 Boss-mode load test (~150 concurrent teams)
- New `scripts/loadtest-boss.mjs` mirroring `loadtest-teams.mjs` conventions (env-overridable BASE/TEAM_COUNT, seeds `LT*` teams, `--keep` flag, cleanup, local-stack targeting via shell env).
- Flow: seed 150 teams → claim each → start a boss window → fire ~150 near-simultaneous `/api/quiz/answer` submissions (mixed correct/wrong, some frozen, some bid-enabled) → verify: no lost/duplicated score updates (sum of points deltas == DB points), no negative coins, frozen teams rejected, bids consumed once, no crash.
- Small Playwright smoke test (3–5 teams): full UI flow — join via team code, answer in normal round, buy + use a power-up, host triggers boss finale, results page.

---

## 10. Acceptance criteria (from the prompt, mapped)

- [ ] Points and coins are separate fields, never cross-mutated (§2).
- [ ] All scoring constants in one file, not inlined (§3).
- [ ] Answer timing computed server-side from a server-stored question-start timestamp (§4.1).
- [ ] Power-up purchases atomic; coins can't go negative under concurrent buys (§4.2).
- [ ] Freeze/multiplier enforced server-side, not just visually (§4.1–4.2).
- [ ] Boss mode window/questions server-timed; ranks by correct count; bonus per `scoring.ts` (§4.3).
- [ ] No endpoint returns the correct answer before reveal — manually audited (§7).
- [ ] Leaderboard updates debounced/batched, not broadcast per-answer (§8).
- [ ] Load test simulates ~150 concurrent answers during boss mode with no lost/duplicated updates (§9.2).

---

## 11. Open questions / flagged for review

- **Balance numbers** in `scoring.ts` are proposals, not locked — team review before launch (explicitly requested by the prompt).
- **Coin prices change** in the classic shop UI (freeze_all 25→30, bids 10/20/35→20/35/50) if `coinShop.ts` derives from `scoring.ts`. Confirm the classic flow should absorb this now, or gate it to the new flow only.
- **Boss rank bonus curve** `[500, 300, 200, 100]` — confirm top-4 vs top-3 (existing podium is top-3) and the amounts.
- **Boss advance threshold** `advance_when_pct_answered = 0.6` — confirm with the host flow (a slow class shouldn't stall; the per-question cap is the backstop).
- **Shop during boss mode** — default: closed during the 60s window. Confirm.
- **Host override to start boss early / skip** — decided as out of scope; confirm.
- **`violations` duplication** — new `violations int` column vs existing `violations jsonb` on `quiz_sessions`; keep both in sync (soft-mode count vs detailed log) or consolidate.
- **Classic-flow points formula migration** — deferred by decision #3; revisit after the new engine ships.
- **Apply migration + grants to the cloud project** (`ogciyskjrefwmazzckfg`) — still outstanding from the team-login session.
- **Verification pending**: `scripts/loadtest-boss.mjs` + `e2e/tests/liveplay.e2e.ts` are written and typecheck-clean, but the local Supabase stack and dev server were DOWN at audit time — they have not been executed yet. Bring the stack up (`npx supabase start`, apply the live-play migration) before go-live and run both.
- **Answer-secrecy audit already acted on**: reading the relay diff revealed the classic flow sent ALL `correct_index` values at reveal/leaderboard/lobby (next-question leak) and persisted full state to the anon-readable `quizzes` table — both fixed in `/api/room/[pin]/route.ts` (reveal-current-only + sanitized persistence).
