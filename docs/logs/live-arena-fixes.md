# Live Arena Fixes — Implementation Log

## 1. User Request
Fix 5 critical issues in the live quiz arena:
1. Host leaderboard sync is fake (stale data on both Leaderboard and Active Game tabs)
2. 1-2 second timer delay between players
3. Freeze opponent targets random player instead of chosen target
4. Split-screen mobile cheating bypasses anti-cheat
5. Questions should auto-advance at 30s + 3s break

## 2. Implementation Plan

### Issue #4 — Anti-Cheat Enhancements (highest priority)
- Added 4 new violation types: `viewport_too_small`, `orientation_change`, `iframe_detected`, `webview_detected`
- Added viewport resize listener (threshold: 400px — detects mobile split-screen)
- Added screen orientation change detection
- Added periodic iframe detection (every 3s)
- Added WebView/in-app browser detection (Instagram, TikTok, WeChat, etc.)
- Updated play page warning modal with contextual messages for each new violation type

### Issue #1 — Host Leaderboard Real-Time Sync
- Added Supabase Realtime subscription to host dashboard for both Leaderboard and Active Game tabs
- Reduced poll intervals (2s→3s for leaderboard, 1.5s→2s for active game) as Realtime handles fast path
- `gameLeaderboard.ts`: Added `roster` to select, filtered out phantom sessions (0 points, 0 answered, 0 coins)

### Issue #3 — Freeze Target Modal
- Replaced inline dropdown with full modal picker overlay
- Modal shows all other players sorted by score with avatar, name, rank, and points
- Buy button on freeze_player now opens the modal instead of requiring pre-selection

### Issue #5 — Auto-Advance Always On (30s + 3s)
- Removed `autoTimer` toggle — auto-advance is now unconditional
- 30s question → 3s answer reveal break → next question
- Added reveal countdown banner on student play screen during break phase
- Host dashboard shows static "Auto-Pacing: ON (30s + 3s)" indicator

### Issue #2 — Timer Clock Sync (<500ms target)
- Added server clock sync mechanism: fetches server time, computes median offset from last 5 samples
- Applied offset to student play page timer: `remaining = questionEndsAt - (Date.now() + clockOffset)`
- Applied offset to host dashboard timer: `sec = ((Date.now() + clockOffset) - started) / 1000`
- Re-syncs every 10 seconds, rejects wild jumps (>5s)

## 3. Changes Made

| File | Changes |
|------|---------|
| `src/quizflow/antiCheat.ts` | Added 4 new violation types, resize/orientation/iframe/webview detection, cleanup in stop() |
| `src/quizflow/gameLeaderboard.ts` | Added `roster` field, filtered phantom sessions |
| `src/app/quizflow/play/page.tsx` | Freeze target modal, reveal countdown, clock sync, new violation messages |
| `src/app/quizflow/dashboard/page.tsx` | Supabase Realtime subscriptions, auto-advance unconditional, clock sync, removed autoTimer |

## 4. Verification
- `npx tsc --noEmit` — ✅ Pass (0 errors)
- `npm run build` — ✅ Pass (all routes built successfully)
