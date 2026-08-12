# Graph Report - .  (2026-08-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 485 nodes · 972 edges · 37 communities (33 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0bed1d1f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- quizflow/play/page.tsx
- quizflow/practice/page.tsx
- authStore.ts
- sessionStore.ts
- devDependencies
- compilerOptions
- dependencies
- quizflow/studio/page.tsx
- useTaskStore
- useTaskStore.ts
- AntiCheatShield
- useAuthStore.ts
- generate-quiz/route.ts
- layout.tsx
- OmniModal.tsx
- CalendarView.tsx
- useHabitStore.ts
- usePomodoroStore.ts
- useCountdownStore.ts
- [pin]/route.ts
- quizflow/join/page.tsx
- opengraph-image.tsx
- EisenhowerView.tsx
- next.config.mjs
- next-env.d.ts
- tailwind.config.ts

## God Nodes (most connected - your core abstractions)
1. `useTaskStore` - 32 edges
2. `loadState()` - 21 edges
3. `saveState()` - 21 edges
4. `StudentPlayScreen()` - 18 edges
5. `TeacherHostDashboard()` - 17 edges
6. `compilerOptions` - 16 edges
7. `getHostUser()` - 15 edges
8. `subscribeToSession()` - 14 edges
9. `CommunityPracticeHub()` - 13 edges
10. `TeacherDashboard()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `CalendarView()` --calls--> `useTaskStore`  [EXTRACTED]
  src/components/views/CalendarView.tsx → src/store/useTaskStore.ts
- `EisenhowerTaskRow()` --calls--> `useTaskStore`  [EXTRACTED]
  src/components/views/EisenhowerView.tsx → src/store/useTaskStore.ts
- `DetailPanel()` --calls--> `useTaskStore`  [EXTRACTED]
  src/components/layout/DetailPanel.tsx → src/store/useTaskStore.ts
- `TaskItem()` --calls--> `useTaskStore`  [EXTRACTED]
  src/components/tasks/TaskItem.tsx → src/store/useTaskStore.ts
- `GameState` --references--> `AIGeneratedQuiz`  [EXTRACTED]
  src/quizflow/sessionStore.ts → src/quizflow/types.ts

## Import Cycles
- None detected.

## Communities (37 total, 4 thin omitted)

### Community 0 - "quizflow/play/page.tsx"
Cohesion: 0.08
Nodes (37): dynamic, LobbyInner(), LobbyPage(), dynamic, ScorePopup(), StudentPlayScreen(), dynamic, ResultsInner() (+29 more)

### Community 1 - "quizflow/practice/page.tsx"
Cohesion: 0.08
Nodes (42): HostNewPage(), CATEGORIES, CATEGORY_COLORS, CommunityPracticeHub(), dynamic, addQuizComment(), autoCategorizeQuiz(), CommunityQuiz (+34 more)

### Community 2 - "authStore.ts"
Cohesion: 0.13
Nodes (35): dynamic, TeacherAuthPage(), dynamic, formatDuration(), formatExactTime(), TeacherDashboard(), MarketingHomepage(), DEMO_HOST (+27 more)

### Community 3 - "sessionStore.ts"
Cohesion: 0.17
Nodes (35): ANONYMOUS_ALIASES, dynamic, getDisplayName(), TeacherHostDashboard(), FloatingReactions(), broadcast(), deleteState(), endGame() (+27 more)

### Community 4 - "devDependencies"
Cohesion: 0.07
Nodes (27): autoprefixer, devDependencies, autoprefixer, @playwright/test, postcss, tailwindcss, @types/node, @types/react (+19 more)

### Community 5 - "compilerOptions"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, e2e, esnext, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts (+19 more)

### Community 6 - "dependencies"
Cohesion: 0.07
Nodes (27): clsx, date-fns, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, lucide-react, dependencies, clsx (+19 more)

### Community 7 - "quizflow/studio/page.tsx"
Cohesion: 0.14
Nodes (21): AIQuizStudio(), BLOOM_LEVELS, DEFAULT_QUIZ, dynamic, LANGUAGES, extractYouTubeId(), IngestedContent, ingestWebpageUrl() (+13 more)

### Community 8 - "useTaskStore"
Cohesion: 0.11
Nodes (14): RightDashboardPanel(), TopBar(), QuickAddBar(), QuickAddBarProps, InboxView(), KanbanView(), priorityStyles, TagsView() (+6 more)

### Community 9 - "useTaskStore.ts"
Cohesion: 0.20
Nodes (16): DetailPanel(), PRIORITY_COLORS, TaskItem(), TaskItemProps, fetchApi(), getAuthHeaders(), TaskState, HabitLog (+8 more)

### Community 10 - "AntiCheatShield"
Cohesion: 0.19
Nodes (6): AntiCheatOptions, AntiCheatShield, AntiCheatViolationEvent, AntiCheatViolationReason, initAntiCheat(), useAntiCheat()

### Community 11 - "useAuthStore.ts"
Cohesion: 0.29
Nodes (9): AuthModal(), Sidebar(), SettingsView(), api, AuthState, useAuthStore, ThemeState, useThemeStore (+1 more)

### Community 12 - "generate-quiz/route.ts"
Cohesion: 0.38
Nodes (9): buildSystemPrompt(), callGeminiAPI(), callGroqAPI(), callOpenRouterAPI(), differentiateFallback(), generateFallbackQuiz(), LANGUAGE_SCRIPT_MAP, POST() (+1 more)

### Community 13 - "layout.tsx"
Cohesion: 0.24
Nodes (6): metadata, viewport, QuizFlowJsonLd(), constructMetadata(), DEFAULT_KEYWORDS, PageMetadataProps

### Community 14 - "OmniModal.tsx"
Cohesion: 0.31
Nodes (7): OmniModal(), OmniModalProps, ParsedTask, parseTaskInput(), Priority, Recurrence, useTaskParser()

### Community 15 - "CalendarView.tsx"
Cohesion: 0.25
Nodes (4): CalendarMode, CalendarView(), PASTEL_PALETTE, TASK_COLORS

### Community 16 - "useHabitStore.ts"
Cohesion: 0.43
Nodes (6): getHabitEmoji(), HabitView(), HabitState, localId(), useHabitStore, Habit

### Community 17 - "usePomodoroStore.ts"
Cohesion: 0.36
Nodes (6): PomodoroView(), MODE_DURATIONS, PomodoroState, TimerMode, usePomodoroStore, PomodoroSession

### Community 18 - "useCountdownStore.ts"
Cohesion: 0.43
Nodes (5): CountdownView(), CountdownItem, CountdownState, generateId(), useCountdownStore

### Community 19 - "[pin]/route.ts"
Cohesion: 0.33
Nodes (3): dynamic, fetchCache, revalidate

### Community 21 - "opengraph-image.tsx"
Cohesion: 0.33
Nodes (4): alt, contentType, runtime, size

### Community 22 - "EisenhowerView.tsx"
Cohesion: 0.40
Nodes (5): EisenhowerTaskRow(), EisenhowerView(), groupByDate(), QUADRANTS, EisenhowerQuadrant

## Knowledge Gaps
- **132 isolated node(s):** `AnswerColorKey`, `AvatarStyle`, `QuizComment`, `AvatarStyle`, `GameSession` (+127 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useTaskStore` connect `useTaskStore` to `useTaskStore.ts`, `useAuthStore.ts`, `OmniModal.tsx`, `CalendarView.tsx`, `usePomodoroStore.ts`, `EisenhowerView.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `getHostUser()` connect `authStore.ts` to `quizflow/practice/page.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `AnswerColorKey`, `AvatarStyle`, `QuizComment` to the rest of the system?**
  _132 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `quizflow/play/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07706766917293233 - nodes in this community are weakly interconnected._
- **Should `quizflow/practice/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0782312925170068 - nodes in this community are weakly interconnected._
- **Should `authStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12525252525252525 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._