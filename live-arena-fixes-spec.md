# Live Arena Fixes — Specification

> **Date:** August 22, 2026  
> **Priority Order:** Issue #4 (cheating) → #1 (leaderboard sync) → #3 (freeze) → #5 (auto-advance) → #2 (timer sync)

---

## Issue #1: Host Leaderboard Sync is Fake

### Problem
Both the **🏆 Live Leaderboard tab** and the **🎮 Active Game tab** in the host dashboard show stale/wrong data. Students see correct real-time scores on their own screens, but the host screen does not reflect actual game state.

### Root Cause Analysis
1. **Leaderboard tab** polls `/api/admin/leaderboard?game_id=...` every 2 seconds. The `fetchGameLeaderboard()` in `gameLeaderboard.ts` reads from `quiz_sessions` directly. This data is correct at read time, but the polling interval (2s) means the host screen lags behind student views.
2. **Active Game tab** polls `/api/quiz/game?game_id=...` every 1.5 seconds. The `teams_status` array is built from `quiz_sessions` ordered by `points desc`. This also lags.
3. The real issue: **the host dashboard is NOT subscribing to Supabase Realtime** for instant push updates. Students use Supabase Realtime broadcasts (`qf_room_${pin}` channel) for <50ms push, but the host only polls at 1.5–2s intervals.
4. Additionally, the `gameLeaderboard.ts` query does NOT include `roster` in the select, and does NOT filter out phantom/zero-score sessions the way the Active Game tab does.

### Solution

#### A. Add Realtime push to host dashboard
- In `dashboard/page.tsx`, subscribe to the same `qf_room_${gameId}` Supabase Realtime channel that students use.
- On `state_sync` broadcast event, immediately re-fetch the leaderboard and teams_status (or merge the broadcast payload directly).
- Keep the existing poll as a fallback (in case Realtime misses messages), but reduce poll interval from 2s → 3s since Realtime handles the fast path.

#### B. Fix `fetchGameLeaderboard()` to match Active Game tab filtering
- Filter out sessions with 0 points AND 0 total_answered AND 0 coins (phantom sessions from unclaimed teams).
- Include `roster` from the joined `teams` table.
- Order by: `points desc → max_streak desc → total_response_time_ms asc` (already correct).

#### C. Add `roster` field to `LeaderboardRow` interface
```ts
export interface LeaderboardRow {
  // ... existing fields ...
  roster: string[] | null  // NEW
}
```

### Files to Modify
- `src/app/quizflow/dashboard/page.tsx` — Add Supabase Realtime subscription for instant host updates
- `src/quizflow/gameLeaderboard.ts` — Fix filtering, add roster to select
- `src/app/api/admin/leaderboard/route.ts` — No change needed (already uses shared helper)

---

## Issue #2: 1–2 Second Timer Delay Between Players

### Problem
Students see a 1–2 second difference in their countdown timers. The client computes `remaining = questionEndsAt - Date.now()`, but `Date.now()` varies across devices due to clock skew.

### Solution: Server Time Synchronization

#### A. Compute persistent clock offset
- On page load (and periodically), fetch `/api/quiz/game/state` and note the `server_time` field.
- Compute `offset = server_time - Date.now()` at fetch time.
- Store this offset in a ref; apply it to all local timer computations: `adjustedNow = Date.now() + clockOffset`.

#### B. Periodic re-sync every 10 seconds
- Re-fetch `/api/quiz/game/state` or a lightweight `/api/time` endpoint every 10 seconds.
- Recalculate `clockOffset` using a weighted moving average to smooth jitter.
- The offset should be bounded (reject if > 5000ms to avoid wild jumps).

#### C. Apply offset in play page timer
In `src/app/quizflow/play/page.tsx`, the local timer tick currently does:
```ts
const remaining = gameState.questionEndsAt - Date.now()
```
Change to:
```ts
const remaining = gameState.questionEndsAt - (Date.now() + clockOffset)
```

#### D. Apply offset in host dashboard timer
In `dashboard/page.tsx`, the `hostElapsedSec` computation:
```ts
const sec = Math.max(0, Math.floor((Date.now() - started) / 1000))
```
Change to:
```ts
const sec = Math.max(0, Math.floor(((Date.now() + clockOffset) - started) / 1000))
```

### Files to Modify
- `src/app/quizflow/play/page.tsx` — Add clock offset computation, apply to timer
- `src/app/quizflow/dashboard/page.tsx` — Apply clock offset to host timer
- `src/app/quizflow/student/lobby/page.tsx` — Apply clock offset if timer shown

---

## Issue #3: Freeze Opponent Shows Random Target

### Problem
When a player buys `freeze_player` from the coin shop, it freezes a random team instead of the one they selected. The existing dropdown in the shop drawer is not properly passing `target_team_id` to the API.

### Solution

#### A. Replace dropdown with Modal Picker Overlay
When the player clicks **Buy** on `freeze_player`, instead of immediately purchasing:
1. Open a modal overlay showing ALL other players in the game (name, avatar, current rank, score).
2. Player taps/clicks a player to select them as the freeze target.
3. On selection, call `buyPowerUp(pin, playerId, 'freeze_player', targetTeamId)`.
4. Close the modal on success.

#### B. UI Design
```
┌──────────────────────────────────────┐
│  ❄️ CHOOSE WHO TO FREEZE             │
│                                      │
│  ┌────┐ Team Alpha     #2  1200pts  │
│  │ 👤 │                                   
│  └────┘                                   
│  ┌────┐ Team Bravo     #3  1100pts  │
│  │ 👤 │                                   
│  └────┘                                   
│  ┌────┐ Team Charlie   #4  900pts   │
│  │ 👤 │                                   
│  └────┘                                    │
│                                      │
│  [Cancel]                            │
└──────────────────────────────────────┘
```

#### C. Remove inline dropdown from shop drawer
The existing `<select>` element inside the shop item row for `freeze_player` should be removed. The Buy button triggers the modal instead.

#### D. Server already handles correctly
The `qf_buy_powerup` function correctly applies freeze to `p_target_session_id`. The `freeze_player` duration is already 6000ms (6 seconds) in `FREEZE_DURATION_MS`. No server changes needed.

### Files to Modify
- `src/app/quizflow/play/page.tsx` — Add freeze target modal, remove inline dropdown, wire up target selection
- No server changes needed (API already works correctly)

---

## Issue #4: Split-Screen Mobile Cheating (Biggest Priority)

### Problem
Students open the quiz site in a browser alongside another browser/tab to look up answers. The current anti-cheat has fullscreen enforcement + tab-switch detection + copy-paste blocking, but split-screen on mobile bypasses all of these because the browser window stays focused and fullscreen may not apply.

### Solution: Multi-Layer Mobile Detection

#### A. Viewport Resize Detection
Add to `AntiCheatShield` in `src/quizflow/antiCheat.ts`:
```ts
private handleResize = () => {
  // Mobile split-screen typically halves the viewport height or width
  const minThreshold = 400  // minimum pixels for a "full" phone screen
  if (window.innerHeight < minThreshold || window.innerWidth < minThreshold) {
    this.recordViolation('viewport_too_small')
  }
}

// Add listener in start():
window.addEventListener('resize', this.handleResize)

// Remove in stop():
window.removeEventListener('resize', this.handleResize)
```

#### B. Orientation Change Detection
```ts
private handleOrientationChange = () => {
  // Orientation change during active question = suspicious
  if (this.options.enabled) {
    this.recordViolation('orientation_change')
  }
}

// Add in start():
screen.orientation?.addEventListener('change', this.handleOrientationChange)

// Remove in stop():
screen.orientation?.removeEventListener('change', this.handleOrientationChange)
```

#### C. Iframe Detection
```ts
private checkIframe = () => {
  if (window.self !== window.top) {
    this.recordViolation('iframe_detected')
  }
}

// Check on start and periodically:
this.checkIframe()
this.iframeInterval = setInterval(this.checkIframe, 3000)
```

#### D. WebView Detection
```ts
private checkWebView = () => {
  const ua = navigator.userAgent || ''
  const isWebView = /Instagram|FBAN|FBAV|TikTok|Snapchat|Line|WeChat|MicroMessenger|Electron|Cordova|PhoneGap/i.test(ua)
  if (isWebView) {
    this.recordViolation('webview_detected')
  }
}

// Check once on start:
this.checkWebView()
```

#### E. Add new violation types to the type union
```ts
export type AntiCheatViolationReason =
  | 'tab_switch'
  | 'focus_loss'
  | 'copy_paste_attempt'
  | 'fullscreen_exit'
  | 'devtools_detected'
  | 'viewport_too_small'    // NEW
  | 'orientation_change'    // NEW
  | 'iframe_detected'       // NEW
  | 'webview_detected'      // NEW
```

#### F. Violation Policy — Admin-Driven
- Each violation is logged server-side via `qf_report_violation` (already works).
- The host dashboard **Active Game tab** shows `violation_count` per team (already present in `teams_status`).
- **No auto-kick**: The admin sees a real-time alert when a violation is detected and decides what action to take (warn, kick, disqualify).
- Add a visual "⚠️ Violation Alert" toast/notification on the host dashboard when a new violation is reported (via Supabase Realtime).

#### G. Add `DevTools` detection for mobile
The existing devtools size heuristic (`outerWidth - innerWidth > 160`) doesn't work on mobile. Add:
```ts
// Mobile devtools: console.log('debugger') detection
// Use a performance timing trap
private devtoolsOpen = false
private checkDevTools = () => {
  const start = performance.now()
  // debugger statement freezes execution if devtools is open
  // This is a lightweight heuristic
  const el = document.createElement('div')
  Object.defineProperty(el, 'id', {
    get: () => {
      this.devtoolsOpen = true
    }
  })
  console.log('%c', el)  // This triggers the getter if devtools is open
  // Cleanup
  if (performance.now() - start > 100) {
    this.recordViolation('devtools_detected')
  }
}
```

### Files to Modify
- `src/quizflow/antiCheat.ts` — Add 4 new violation types, resize/orientation/iframe/webview detection
- `src/app/quizflow/play/page.tsx` — Update `useAntiCheat` options, show new violation types in warning modal
- `src/app/quizflow/dashboard/page.tsx` — Add violation alert toast/notification for host

---

## Issue #5: Auto-Advance After 33 Seconds (30s Question + 3s Break)

### Problem
Questions should automatically advance after 33 seconds: 30 seconds for the question, then 3 seconds for the break (answer reveal + countdown to next question).

### Solution

#### A. Auto-advance is ALWAYS ON
- The host **cannot disable** auto-advance. Every question automatically cycles through: `question_active (30s)` → `question_reveal (3s)` → `leaderboard` → `next question`.
- The host can still **pause** the game at any time (freeze the timer).
- The host can still **manually advance** early (skip remaining time).

#### B. Server-Side Timing
The server already stamps `question_started_at` when advancing. The auto-advance logic lives in the host dashboard's polling effect:

```ts
// Question Active Phase (30s Countdown) — in dashboard/page.tsx
if (liveGame.status === 'question_active' && liveGame.question_started_at) {
  const tickActive = () => {
    const started = new Date(liveGame.question_started_at).getTime()
    const sec = Math.max(0, Math.floor((Date.now() - started) / 1000))
    setHostElapsedSec(sec)
    
    // AUTO-ADVANCE to reveal after 30s (ALWAYS, no toggle)
    if (sec >= 30) {
      const actionKey = `reveal_${liveGame.current_question_index}`
      if (autoActionFiredRef.current !== actionKey) {
        autoActionFiredRef.current = actionKey
        handleAdvance('reveal')
      }
    }
  }
  // ...
}

// Question Reveal Phase (3s Break) — in dashboard/page.tsx
if (liveGame.status === 'question_reveal') {
  const tickReveal = () => {
    const elapsedSinceReveal = Math.floor((Date.now() - (revealStartedAtRef.current || Date.now())) / 1000)
    const remaining = Math.max(0, 3 - elapsedSinceReveal)
    setRevealCountdown(remaining)

    // AUTO-ADVANCE to next question after 3s (ALWAYS)
    if (remaining <= 0) {
      const actionKey = `next_${liveGame.current_question_index}`
      if (autoActionFiredRef.current !== actionKey) {
        autoActionFiredRef.current = actionKey
        revealStartedAtRef.current = null
        handleAdvance('next')
      }
    }
  }
  // ...
}
```

#### C. Remove the autoTimer toggle
- Remove the `autoTimer` state variable from `dashboard/page.tsx`.
- Remove the "Auto Timer" toggle button from the UI.
- The auto-advance logic runs unconditionally (no `if (autoTimer)` guard).

#### D. During 3-second break, students see answer reveal + countdown
- The `question_reveal` status already shows the correct answer (via `correct_index` in game state).
- Add a visible countdown timer on the student play screen during reveal phase: "Next question in 3s…"
- This is already partially implemented in the host dashboard (`revealCountdown` state), but needs to be shown on the student side too.

#### E. Student-side break countdown
In `src/app/quizflow/play/page.tsx`, during `question_reveal` status, add a countdown bar:
```tsx
{gameState.status === 'question_reveal' && (
  <div className="break-countdown" style={{ /* Neo-Brutalist styling */ }}>
    <div style={{ fontSize: 16, fontFamily: 'Space Grotesk', fontWeight: 800 }}>
      Next question in {revealTimeLeft}s…
    </div>
    <div className="countdown-bar" style={{ /* animated bar */ }} />
  </div>
)}
```

The `revealTimeLeft` is computed client-side from a 3-second window starting when `status` changed to `question_reveal`.

#### F. Question time limit is always 30 seconds
- `DEFAULT_QUESTION_TIME_LIMIT_MS` in `scoring.ts` is already `30000`.
- All question creation paths (AI generator, Excel parser, Studio) should use this default.
- The 3-second break is server-enforced by the host auto-advance, not stored per-question.

### Files to Modify
- `src/app/quizflow/dashboard/page.tsx` — Remove `autoTimer` toggle, make auto-advance unconditional
- `src/app/quizflow/play/page.tsx` — Add reveal countdown display for students
- `src/app/quizflow/student/lobby/page.tsx` — Add reveal countdown if lobby shows during reveal
- `src/quizflow/scoring.ts` — Verify `DEFAULT_QUESTION_TIME_LIMIT_MS = 30000` (already correct)

---

## Implementation Order

| Step | Issue | Files | Estimated Complexity |
|------|-------|-------|---------------------|
| 1 | #4 — Split-screen anti-cheat | `antiCheat.ts`, `play/page.tsx`, `dashboard/page.tsx` | Medium |
| 2 | #1 — Host leaderboard sync | `dashboard/page.tsx`, `gameLeaderboard.ts` | Medium |
| 3 | #3 — Freeze target modal | `play/page.tsx` | Low |
| 4 | #5 — Auto-advance (always on) | `dashboard/page.tsx`, `play/page.tsx` | Low |
| 5 | #2 — Timer clock sync | `play/page.tsx`, `dashboard/page.tsx` | Medium |

---

## Verification Checklist

- [ ] Host leaderboard tab shows correct, real-time data matching student screens
- [ ] Host Active Game tab shows correct, real-time team standings
- [ ] Timer drift between devices is <500ms after clock sync implementation
- [ ] Freeze Player shows a modal picker with all other players listed
- [ ] Freeze Player correctly freezes the SELECTED player for 6 seconds
- [ ] Split-screen on mobile is detected and triggers a violation report
- [ ] Viewport resize below threshold triggers a violation
- [ ] Orientation change during active question triggers a violation
- [ ] Iframe embedding is detected
- [ ] WebView (in-app browser) is detected
- [ ] Admin receives real-time violation notifications on the dashboard
- [ ] Questions auto-advance at exactly 30 seconds (no toggle needed)
- [ ] 3-second break shows answer reveal + countdown to next question
- [ ] All 5 fixes work together without regressions
