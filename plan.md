# QuizFlow Product Management & Feature Plan

This document outlines the product strategy, target personas, core feature sets, system constraints, roadmap milestones, and success metrics for the **QuizFlow Classroom Arena** platform.

---

## 1. Product Vision & Value Proposition

**QuizFlow** is a high-agency, interactive learning canvas that bridges classroom gamification and student productivity. It empowers teachers to transform any digital content (URLs, YouTube videos, topics) into high-fidelity, pedagogically sound quizzes at specific cognitive levels (Bloom's Taxonomy). Simultaneously, it keeps students highly engaged through competitive or collaborative play modes, a dynamic coin economy, real-time power-ups, and strict anti-cheat focus tracking.

---

## 2. Target User Personas

### 2.1 The Educator (Teacher / Host)
*   **Needs**: Fast, low-effort quiz creation tailored to their syllabus; ability to adapt questions for varying reading levels; reliable classroom engagement; detailed diagnostics on class accuracy; and tools to prevent student cheating in physical and digital environments.
*   **Key QuizFlow Utility**: AI Quiz Studio (multimodal url/video parsing), Bloom's Taxonomy selector, printable worksheet generator (randomized versions A/B/C/D), host dashboard with player summary history, and anti-cheat enforcement.

### 2.2 The Student (Learner / Participant)
*   **Needs**: An exciting, game-like interface that doesn't feel like a standard boring quiz; personalization; visual progression; and self-paced study opportunities.
*   **Key QuizFlow Utility**: Custom avatar seeds, realtime coin economy and power-up shop (e.g. freeze-player, score multipliers), collaborative "Boss Raid" mode, tournament-style brackets, and a self-paced practice hub.

---

## 3. Core Feature Specifications & Product Scope

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           QUIZFLOW APP SUITE                            │
├───────────────────┬──────────────────────────┬──────────────────────────┤
│    AI STUDIO      │      ARENA ENGINE        │    PRODUCTIVITY HUB      │
├───────────────────┼──────────────────────────┼──────────────────────────┤
│ 📄 Topic Prompt   │ 🚀 Classic Trivia Mode   │ 📋 Kanban & Tasks        │
│ 🌐 URL Ingestion  │ 👾 Co-op Boss Raid       │ ⏳ Pomodoro Focus Timer  │
│ 🎥 YouTube Ingest │ 🏆 Bracket Tournament    │ 🗓️ Calendar & Timeline   │
│ 🌍 Multilingual   │ 🛒 Power-up Coin Shop   │ 📊 Streaks & Habits      │
│ ⚙️ Diff Adaptation│ 🛡️ Anti-Cheat Shield     │ 📈 Countdown Milestones  │
└───────────────────┴──────────────────────────┴──────────────────────────┘
```

### 3.1 Multimodal AI Quiz Studio
*   **Topic Generation**: Generate custom quizzes from simple prompts.
*   **Content Ingestion**: Server-side parsing of text from educational articles/websites, and YouTube video oEmbed metadata to form custom prompt contexts.
*   **Pedagogical Alignment**: Supports generating questions aligned to Bloom's Taxonomy cognitive categories (`Recall`, `Comprehension`, `Application`, `Analysis`).
*   **One-Click Adaptation / Differentiation**:
    *   *Add Scenarios*: Rewrites plain questions to place them inside realistic professional/practical scenarios.
    *   *Simplify*: Rewrites complex vocabulary for younger/elementary student readers.
    *   *Harder Distractors*: Elevates the difficulty of wrong answers and attaches diagnostic explanation messages to guide students through errors.
    *   *Translate*: Instantly translates title, questions, answers, and explanations into 11 target languages.

### 3.2 Classroom Arena Game Modes
*   **Classic Mode**: Standard multiplayer trivia layout where players compete individually for score and streak milestones.
*   **Boss Raid Mode**: Cooperative class-wide mode where correct answers collectively chip away at a "Boss" health bar, culminating in a rapid-fire "Boss Frenzy" finale (10 questions in 60 seconds).
*   **Tournament Mode**: Multi-round bracket where configurable elimination rules (e.g. "eliminate bottom 30% by score") are enforced at the end of each round until a single champion remains.
*   **Coin Economy & Shop**: Students earn coins for accuracy, speed, and streaks, which can be spent during active gameplay on interactive items:
    *   *Freeze Player*: Stops a target opponent from submitting answers for 6 seconds.
    *   *Freeze All*: Briefly delays all opponents for 4 seconds.
    *   *Score Bids (2x/3x/4x)*: Multiplies points earned on the next question.

### 3.3 Focus & Security Suite
*   **Anti-Cheat Shield**: A client-side focus monitoring agent. If enabled, it prompts the student to enter fullscreen, blocking copy/paste, context menus, and tracking browser window blurs/tab switches. Violations are logged and reported to the host in real time.
*   **Server-Side Correct Index Sanitization**: The server strips correct answers from the active room state payload until the reveal phase is initiated, making inspector-based cheating impossible.

### 3.4 Print-Ready Worksheet Generator
*   **A/B/C/D Randomization**: Automatically shuffles questions and choice arrays using a deterministic seed based on the version letter.
*   **Print Layout**: Outputs a clean HTML stylesheet optimized for standard paper sizes using browser-native printing margins, with an optional Master Answer Key page.

### 3.5 Personal Productivity Toolkit
*   **Task Manager**: Bento-style productivity views including Inbox, Eisenhower quadrant matrix, tags filter, timeline, and Kanban board with drag-and-drop support.
*   **Habit Tracker**: Routine cards tracking daily completions and active streak badges.
*   **Pomodoro Engine**: Fully configurable focus, short break, and long break intervals.

---

## 4. System Constraints & Product Assumptions

*   **Browser Dependency**: Relies on browser-native APIs (e.g. `BroadcastChannel`, `SpeechSynthesis` for read-aloud features, and `AudioContext` for procedural sound generation). Requires modern browsers (Chrome, Edge, Safari, Firefox).
*   **Configuration Fallbacks**: The system must run smoothly without Supabase keys by falling back to local storage and HTTP Room Relay polling, ensuring zero-configuration deployments.
*   **Server Load Limit**: Extracted text from URLs is limited to 12,000 characters to prevent API token overflow and optimize serverless endpoint execution times.

---

## 5. Product Roadmap & Release Strategy

### Phase 1: Core AI Studio & Classic Arena (M1)
*   Deliver the core Next.js app layout, Tailwind configuration, and visual bento design system.
*   Implement topic-based AI generation using the Google Gemini / Groq router tier.
*   Launch Classic trivia mode with cross-tab BroadcastChannel synchronization.

### Phase 2: Gamification & Economy Expansion (M2)
*   Add Boss Raid and Bracket Tournament game modes.
*   Integrate the player Coin Shop and real-time power-ups (Freezing/Bidding).
*   Implement custom avatar styling components (adventurer, lorelei, pixel-art, fun-emoji).

### Phase 3: Security & Print Utilities (M3)
*   Implement the client-side `AntiCheatShield` focus manager.
*   Secure API payloads by sanitizing `correct_index` values.
*   Deliver the seeded A/B/C/D Printable Worksheet PDF generator.

### Phase 4: Persistence, History & Community (M4)
*   Connect the Supabase Cloud database client to persist user tables (`hosts`, `quizzes`, `session_history`).
*   Launch the Community Practice Hub allowing hosts to publish, rate, review, and clone community decks.
*   Enable real-time WebSocket sync channels via Supabase.

---

## 6. Product Success Metrics (KPIs)

1.  **AI Generation Latency**: Keep average quiz generation times under **5 seconds** for Tier 1 (Gemini) calls.
2.  **User Activation**: Percentage of registered hosts who launch their first live multiplayer arena game within 48 hours of signup (Target: **>65%**).
3.  **Real-Time Sync Performance**: Cross-device state synchronizations must complete in under **100ms** on WebSockets and under **500ms** on HTTP Polling fallback.
4.  **Student Engagement Intensity**: Average number of power-up coins earned and spent per student per game session (Target: **>8 coins**).
5.  **Offline Resiliency**: Percentage of game sessions completed successfully on local/fallback modes without database connections (Target: **100% success**).
