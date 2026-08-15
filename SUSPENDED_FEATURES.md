# ⏸️ QuizFlow — Suspended Features Register

This document tracks all features that have been temporarily suspended / disabled from the live site for upcoming live events (e.g. Freshers Event) and can be re-enabled at any time.

---

## 📋 List of Currently Suspended Features

| Feature ID | Feature Name | Description | Status | Code Location | Re-enable Instruction |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `FEATURE_EMOJI_REACTIONS` | **Live Emoji Reaction Bar & Floating Emojis** | In-game emoji sending & floating particle animations during live questions | 🔴 **SUSPENDED** | `src/quizflow/FloatingReactions.tsx`, `src/app/quizflow/play/page.tsx` | Set `ENABLE_EMOJI_REACTIONS = true` |
| `FEATURE_AVATAR_SPINNING` | **Avatar Spinning & Randomizer Options** | Random avatar spinning options and automated random avatar animation buttons | 🔴 **SUSPENDED** | `src/app/quizflow/join/page.tsx` | Set `ENABLE_AVATAR_SPINNING = true` |
| `FEATURE_GLOBAL_PUBLISH` | **Global Community Publish & Heavy Sync** | Publishing quizzes to the global community library to minimize background DB writes during live room spikes | 🔴 **SUSPENDED** | `src/app/quizflow/dashboard/page.tsx` | Set `ENABLE_GLOBAL_PUBLISH = true` |
| `FEATURE_BOSS_FRENZY_SHOP` | **Power-Up Shop in Boss Frenzy Finale** | Coin shop actions during the 60s Boss Frenzy finale to keep the rapid-fire round pure speed and accuracy | 🔴 **SUSPENDED** | `src/app/quizflow/play/page.tsx` | Controlled automatically when `gameState.status === 'boss_frenzy'` |

---

## 🛠️ How to Re-Enable Suspended Features

When you want to turn these features back on in the future:
1. Open the code location listed in the table above.
2. Set the feature flag constant to `true` (or un-comment the corresponding UI trigger button).
3. Update this document to mark the status as 🟢 **ACTIVE**.
