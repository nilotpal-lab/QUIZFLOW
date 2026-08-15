/* ================================================================
   QuizFlow — Session Store
   Real-time sync via localStorage + BroadcastChannel.
   Works across tabs in the same browser — perfect for classroom demos
   and full Supabase migration later.
   ================================================================ */

import type { AIGeneratedQuiz } from './types'

export type GameStatus =
  | 'lobby'           // Waiting for host to start
  | 'question_active' // Question is live, timer running
  | 'question_reveal' // Answer revealed, waiting for next
  | 'leaderboard'     // Between-question leaderboard
  | 'boss_frenzy'     // Final rapid-fire 10Q 60s mode
  | 'ended'           // Game over, final results

export type GameMode = 'classic' | 'boss_raid' | 'tournament'

export interface Reaction {
  id: string
  emoji: string
  senderName?: string
  createdAt: number
}

export interface Player {
  id: string
  nickname: string
  avatarSeed: string
  avatarStyle: string
  score: number
  streak: number
  maxStreak?: number
  totalCorrect?: number
  totalAnswered?: number
  totalResponseTimeMs?: number
  rank: number
  tacticsRank?: number
  masteryRank?: number
  lastAnswerCorrect: boolean | null
  lastPointsEarned: number
  hasAnswered: boolean
  selectedIndex: number | null
  joinedAt: number
  connected: boolean
  // Coin economy
  coins: number
  coinPowerUps?: import('./types').ActiveCoinPowerUp[]  // active coin power-ups
  bidMultiplier?: number  // active bid multiplier (2x/3x/4x) for next question
  frozenUntil?: number    // ms timestamp — player answers blocked until then
  // Anti-cheat
  violations?: number
  flagged?: boolean
  // Boss frenzy
  frenzyScore?: number  // correct answers in boss frenzy
}

export interface GameState {
  pin: string
  status: GameStatus
  gameMode?: GameMode
  bossHealth?: number
  bossMaxHealth?: number
  masteryRankings?: Player[]
  tacticsRankings?: Player[]
  quiz: AIGeneratedQuiz
  currentQuestionIndex: number
  questionStartedAt: number   // timestamp ms
  questionEndsAt: number      // timestamp ms
  players: Record<string, Player>
  hostId: string
  revealCorrectIndex: number | null  // set when revealing
  createdAt: number
  reactions?: Reaction[]
  isPaused?: boolean
  pausedTimeRemainingMs?: number
  aliasMode?: boolean
  // Multi-round tournament fields
  tournamentConfig?: import('./types').TournamentConfig
  currentRound?: number
  eliminatedPlayers?: string[]  // player IDs eliminated from tournament
  tournamentRoundLabel?: string // e.g. "Round 2 of 3"
  // Boss Frenzy finale
  bossFrenzy?: import('./types').BossFrenzyState
}

const CHANNEL_NAME = 'quizflow_session'
const STORE_PREFIX  = 'qf_session_'

// ── Ranking Helpers ───────────────────────────────────────────────

export function getTacticsRankings(players: Record<string, Player> | Player[]): Player[] {
  const list = Array.isArray(players) ? [...players] : Object.values(players)
  return list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aStreak = a.maxStreak ?? a.streak ?? 0
    const bStreak = b.maxStreak ?? b.streak ?? 0
    if (bStreak !== aStreak) return bStreak - aStreak
    return (a.totalResponseTimeMs || 0) - (b.totalResponseTimeMs || 0)
  })
}

export function getMasteryRankings(players: Record<string, Player> | Player[]): Player[] {
  const list = Array.isArray(players) ? [...players] : Object.values(players)
  return list.sort((a, b) => {
    const aAns = a.totalAnswered || 0
    const bAns = b.totalAnswered || 0
    const aAcc = aAns > 0 ? (a.totalCorrect || 0) / aAns : 0
    const bAcc = bAns > 0 ? (b.totalCorrect || 0) / bAns : 0
    if (bAcc !== aAcc) return bAcc - aAcc
    if ((b.totalCorrect || 0) !== (a.totalCorrect || 0)) return (b.totalCorrect || 0) - (a.totalCorrect || 0)
    return (a.totalResponseTimeMs || 0) - (b.totalResponseTimeMs || 0)
  })
}

// ── Monotonic Non-Destructive State Merging ────────────────────────
export function mergeGameStates(current: GameState | null, incoming: GameState | null): GameState | null {
  if (!current) return incoming
  if (!incoming) return current

  // Identify newest question progression
  const currentQ = current.currentQuestionIndex ?? 0
  const incomingQ = incoming.currentQuestionIndex ?? 0

  let base: GameState
  const isQuestionAdvancement = incomingQ > currentQ
  const isQuestionRegression = currentQ > incomingQ

  if (isQuestionAdvancement) {
    base = incoming
  } else if (isQuestionRegression) {
    base = current
  } else {
    // Same question: prioritize 'ended' > 'boss_frenzy' > 'leaderboard' > 'question_reveal' > 'question_active' > 'lobby'
    const statusWeight: Record<GameStatus, number> = {
      lobby: 0,
      question_active: 1,
      question_reveal: 2,
      leaderboard: 3,
      boss_frenzy: 4,
      ended: 5,
    }
    const inWeight = statusWeight[incoming.status] ?? 0
    const curWeight = statusWeight[current.status] ?? 0
    base = inWeight >= curWeight ? incoming : current
  }

  // Merge players monotonically: never erase cumulative scores or streaks, but respect question reset!
  const mergedPlayers: Record<string, Player> = {}
  const allPlayerIds = Array.from(new Set([
    ...Object.keys(current.players || {}),
    ...Object.keys(incoming.players || {})
  ]))

  for (const pid of allPlayerIds) {
    const p1 = current.players?.[pid]
    const p2 = incoming.players?.[pid]
    if (!p1 && p2) {
      mergedPlayers[pid] = p2
    } else if (p1 && !p2) {
      mergedPlayers[pid] = p1
    } else if (p1 && p2) {
      const score = Math.max(p1.score || 0, p2.score || 0)
      const streak = Math.max(p1.streak || 0, p2.streak || 0)
      const maxStreak = Math.max(p1.maxStreak || 0, p2.maxStreak || 0, streak)
      const totalCorrect = Math.max(p1.totalCorrect || 0, p2.totalCorrect || 0)
      const totalAnswered = Math.max(p1.totalAnswered || 0, p2.totalAnswered || 0)
      const totalResponseTimeMs = Math.max(p1.totalResponseTimeMs || 0, p2.totalResponseTimeMs || 0)
      const coins = Math.max(p1.coins || 0, p2.coins || 0)
      const violations = Math.max(p1.violations || 0, p2.violations || 0)
      const flagged = p1.flagged || p2.flagged

      if (isQuestionAdvancement) {
        // Advanced to new question -> reset per-question answer flags from incoming (Host)
        mergedPlayers[pid] = {
          ...p2,
          score,
          streak,
          maxStreak,
          totalCorrect,
          totalAnswered,
          totalResponseTimeMs,
          coins,
          violations,
          flagged,
          hasAnswered: p2.hasAnswered || false,
          selectedIndex: p2.selectedIndex ?? null,
          lastAnswerCorrect: p2.lastAnswerCorrect ?? null,
          lastPointsEarned: p2.lastPointsEarned ?? 0
        }
      } else if (isQuestionRegression) {
        // Keep current
        mergedPlayers[pid] = {
          ...p1,
          score,
          streak,
          maxStreak,
          totalCorrect,
          totalAnswered,
          totalResponseTimeMs,
          coins,
          violations,
          flagged
        }
      } else {
        // Same question: if either answered on THIS question, preserve the answer
        const hasAnswered = Boolean(p1.hasAnswered || p2.hasAnswered)
        const selectedIndex = p1.hasAnswered && p1.selectedIndex !== null ? p1.selectedIndex : p2.selectedIndex
        const lastAnswerCorrect = p1.hasAnswered && p1.lastAnswerCorrect !== null ? p1.lastAnswerCorrect : p2.lastAnswerCorrect
        const lastPointsEarned = Math.max(p1.lastPointsEarned || 0, p2.lastPointsEarned || 0)

        mergedPlayers[pid] = {
          ...(p2.joinedAt >= p1.joinedAt ? p2 : p1),
          score,
          streak,
          maxStreak,
          totalCorrect,
          totalAnswered,
          totalResponseTimeMs,
          coins,
          violations,
          flagged,
          hasAnswered,
          selectedIndex,
          lastAnswerCorrect,
          lastPointsEarned
        }
      }
    }
  }

  // Preserve answer keys the server stripped for anti-cheat.
  // The server omits correct_index while a question is active; if we let that
  // overwrite the client's quiz, local scoring breaks (answers look wrong even
  // when the server scores them correctly). Keep the client's key whenever the
  // incoming question doesn't carry one.
  const baseQuiz = base.quiz && current.quiz && base.quiz.questions && current.quiz.questions
    ? {
        ...base.quiz,
        questions: base.quiz.questions.map((bq, i) => {
          const lq = current.quiz.questions[i]
          if (bq && lq && (bq.correct_index === undefined || bq.correct_index === null) && lq.correct_index !== undefined) {
            return { ...bq, correct_index: lq.correct_index }
          }
          return bq
        })
      }
    : base.quiz

  const tactics = getTacticsRankings(mergedPlayers)
  const mastery = getMasteryRankings(mergedPlayers)

  return {
    ...base,
    quiz: baseQuiz,
    bossHealth: Math.min(current.bossHealth ?? 100, incoming.bossHealth ?? 100),
    players: mergedPlayers,
    tacticsRankings: tactics.map((p, i) => ({ ...p, rank: i + 1, tacticsRank: i + 1 })),
    masteryRankings: mastery.map((p, i) => ({ ...p, masteryRank: i + 1 }))
  }
}

// ── Broadcast & Cross-Device Cloud Sync ───────────────────────────
import { supabase } from './supabaseClient'

let _channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME)
  return _channel
}

function postRelay(pin: string, payload: GameState) {
  const status = payload?.status
  // Flush immediately on status transitions (host-driven) — everything else can
  // tolerate a 200ms coalescing window since clients poll the relay anyway.
  const flushNow = Boolean(status) && _lastPostedStatus[pin] !== status
  if (_relayTimers[pin]) {
    clearTimeout(_relayTimers[pin])
    delete _relayTimers[pin]
  }
  const doPost = () => {
    delete _relayTimers[pin]
    if (status) _lastPostedStatus[pin] = status
    fetch(`/api/room/${pin}?_t=${Date.now()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store',
      body: JSON.stringify({ state: payload }),
    }).catch(() => {})
  }
  if (flushNow) doPost()
  else _relayTimers[pin] = setTimeout(doPost, 200)
}

function broadcast(pin: string, state?: GameState, relay = true) {
  const ch = getChannel()
  if (ch) ch.postMessage({ pin, ts: Date.now() })

  const payload = state || loadState(pin)
  if (typeof window === 'undefined' || !payload) return

  // 1. Cloud Room Relay Sync (Works across all laptops, phones, and tablets over the internet)
  if (relay) postRelay(pin, payload)

  // 2. Supabase Realtime WebSocket Sync (if configured) — reuse the cached channel
  if (supabase) {
    try {
      if (!_relayChannels[pin]) _relayChannels[pin] = supabase.channel(`qf_room_${pin}`)
      _relayChannels[pin].send({
        type: 'broadcast',
        event: 'state_sync',
        payload
      }).catch(() => {})
    } catch {
      // Graceful fallback if offline
    }
  }
}

// ── In-Memory & Storage helpers ──────────────────────────────────
const _memState: Record<string, GameState> = {}

// Change detection: fingerprint of the last state we served/wrote per pin.
// When a polled/merged state is byte-identical we skip localStorage writes AND
// return the same object reference, so React bails out of re-renders and the
// play/lobby effects that depend on the state object stop re-firing at 2.5Hz.
const _sigByPin: Record<string, string> = {}
const _servedByPin: Record<string, GameState> = {}

// Relay POST throttling: at most one POST per pin per 200ms window, flushed
// immediately when the session status changes so host transitions stay snappy.
const _relayTimers: Record<string, ReturnType<typeof setTimeout>> = {}
const _lastPostedStatus: Record<string, string> = {}

// Cached Supabase broadcast channels per pin — creating a channel on every
// broadcast leaked sockets during busy games.
const _relayChannels: Record<string, any> = {}

function key(pin: string) { return STORE_PREFIX + pin }

export function saveState(state: GameState, opts?: { relay?: boolean }) {
  _memState[state.pin] = state
  const skipRelay = opts?.relay === false
  if (typeof window !== 'undefined') {
    try {
      const current = loadState(state.pin)
      const merged = mergeGameStates(current, state) || state
      _memState[state.pin] = merged
      // No observable change → skip the localStorage write and relay round-trip.
      // Polling/merging an identical state is the common case, so this removes
      // the 2.5Hz full-state writes and redundant POSTs during idle polling.
      const sig = JSON.stringify(merged)
      if (sig === _sigByPin[state.pin]) {
        _memState[state.pin] = _servedByPin[state.pin] || merged
        return _memState[state.pin]
      }
      _sigByPin[state.pin] = sig
      _servedByPin[state.pin] = merged
      localStorage.setItem(key(state.pin), JSON.stringify(merged))
      broadcast(state.pin, _memState[state.pin], !skipRelay)
    } catch {}
  } else {
    broadcast(state.pin, _memState[state.pin], !skipRelay)
  }
  return _memState[state.pin]
}

export function loadState(pin: string): GameState | null {
  if (typeof window === 'undefined') return _memState[pin] || null
  try {
    const raw = localStorage.getItem(key(pin))
    if (raw) {
      const parsed = JSON.parse(raw) as GameState
      _memState[pin] = parsed
      return parsed
    }
  } catch {}
  return _memState[pin] || null
}

export async function fetchRemoteState(pin: string, maxRetries = 3): Promise<GameState | null> {
  if (typeof window === 'undefined') return null
  const cleanPin = pin.trim().toUpperCase()
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(`/api/room/${cleanPin}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.state) {
          const local = loadState(cleanPin)
          const merged = mergeGameStates(local, data.state as GameState) || data.state
          // Identical to what we last served → return the SAME object reference.
          // React's Object.is bailout then skips the re-render entirely.
          const sig = JSON.stringify(merged)
          if (sig === _sigByPin[cleanPin]) {
            return _servedByPin[cleanPin] || (merged as GameState)
          }
          _memState[cleanPin] = merged
          _sigByPin[cleanPin] = sig
          _servedByPin[cleanPin] = merged
          try {
            localStorage.setItem(key(cleanPin), JSON.stringify(merged))
          } catch {}
          return merged as GameState
        }
      }
    } catch {}
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 250 * (attempt + 1)))
    }
  }
  return _memState[cleanPin] || null
}

export function deleteState(pin: string) {
  delete _memState[pin]
  delete _sigByPin[pin]
  delete _servedByPin[pin]
  delete _lastPostedStatus[pin]
  if (_relayTimers[pin]) {
    clearTimeout(_relayTimers[pin])
    delete _relayTimers[pin]
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(key(pin))
    } catch {}
  }
  broadcast(pin)
}

// ── Subscribe to changes ──────────────────────────────────────────
export function subscribeToSession(
  pin: string,
  callback: (state: GameState | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  // 1. Immediate read from local cache
  const local = loadState(pin)

  // Track the latest known status so polling can adapt its cadence.
  let knownStatus: GameStatus | '' = local?.status || ''
  const notify = (state: GameState | null) => {
    if (state) knownStatus = state.status
    callback(state)
  }

  if (local) notify(local)

  // 2. Fetch from Cloud Room Relay (for other devices on the internet)
  fetchRemoteState(pin).then(remote => {
    if (remote) notify(remote)
  })

  // 3. BroadcastChannel (instant 0ms cross-tab same browser)
  let ch: BroadcastChannel | null = null
  let onMsg: ((e: MessageEvent) => void) | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    ch = new BroadcastChannel(CHANNEL_NAME)
    onMsg = (e: MessageEvent) => {
      if (e.data?.pin === pin) notify(loadState(pin))
    }
    ch.addEventListener('message', onMsg)
  }

  // 4. StorageEvent (same-tab fallback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === key(pin)) notify(loadState(pin))
  }
  window.addEventListener('storage', onStorage)

  // 5. Cloud Room Relay Polling for cross-device internet sync.
  //    Adaptive cadence: fast during live questions, slower otherwise, and
  //    paused entirely while the tab is hidden (a big battery/network win when
  //    a classroom has many background tabs open).
  let lastPollAt = 0
  const poll = () => {
    if (typeof document !== 'undefined' && document.hidden) return
    const now = Date.now()
    const minInterval =
      knownStatus === 'question_active' || knownStatus === 'boss_frenzy' ? 400 :
      knownStatus === 'question_reveal' || knownStatus === 'leaderboard' ? 800 : 2000
    if (now - lastPollAt < minInterval) return
    lastPollAt = now
    fetchRemoteState(pin).then(remote => {
      if (remote) notify(remote)
    })
  }
  const pollInterval = setInterval(poll, 400)
  const onVisible = () => { if (!document.hidden) poll() }
  document.addEventListener('visibilitychange', onVisible)

  // 6. Supabase Realtime WebSocket subscription (zero-latency internet sync)
  let sbSub: any = null
  if (supabase) {
    try {
      sbSub = supabase.channel(`qf_room_${pin}`, {
        config: { broadcast: { self: true } }
      })
      sbSub
        .on('broadcast', { event: 'state_sync' }, (res: any) => {
          if (res?.payload && res.payload.pin === pin) {
            const current = loadState(pin)
            const merged = mergeGameStates(current, res.payload) || res.payload
            _memState[pin] = merged
            try {
              localStorage.setItem(key(pin), JSON.stringify(merged))
            } catch {}
            notify(merged)
          }
        })
        .on('broadcast', { event: 'player_join' }, (res: any) => {
          if (res?.payload?.player && res?.payload?.pin === pin) {
            const current = loadState(pin)
            if (current) {
              const existing = current.players?.[res.payload.player.id]
              const updated = {
                ...current,
                players: {
                  ...current.players,
                  [res.payload.player.id]: {
                    ...res.payload.player,
                    score: existing ? existing.score : 0,
                    streak: existing ? existing.streak : 0,
                    maxStreak: existing ? existing.maxStreak : 0,
                    totalCorrect: existing ? existing.totalCorrect : 0,
                    totalAnswered: existing ? existing.totalAnswered : 0,
                    totalResponseTimeMs: existing ? existing.totalResponseTimeMs : 0,
                    rank: existing ? existing.rank : 0,
                    lastAnswerCorrect: existing ? existing.lastAnswerCorrect : null,
                    lastPointsEarned: existing ? existing.lastPointsEarned : 0,
                    hasAnswered: existing ? existing.hasAnswered : false,
                    selectedIndex: existing ? existing.selectedIndex : null,
                    joinedAt: existing ? existing.joinedAt : Date.now(),
                    connected: true,
                  }
                }
              }
              saveState(updated)
            }
          }
        })
        .on('broadcast', { event: 'request_state' }, () => {
          const current = loadState(pin)
          if (current) {
            sbSub.send({
              type: 'broadcast',
              event: 'state_sync',
              payload: current
            }).catch(() => {})
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            sbSub.send({
              type: 'broadcast',
              event: 'request_state',
              payload: { pin }
            }).catch(() => {})
          }
        })
    } catch {
      // Offline fallback
    }
  }

  return () => {
    clearInterval(pollInterval)
    document.removeEventListener('visibilitychange', onVisible)
    if (ch && onMsg) {
      ch.removeEventListener('message', onMsg)
      ch.close()
    }
    window.removeEventListener('storage', onStorage)
    if (sbSub && supabase) {
      try {
        supabase.removeChannel(sbSub)
      } catch {}
    }
  }
}

export function shuffleQuizChoices(quiz: AIGeneratedQuiz): AIGeneratedQuiz {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz

  const shuffledQuestions = quiz.questions.map(q => {
    if (!Array.isArray(q.choices) || q.choices.length <= 1) return q

    const choiceItems = q.choices.map((text, origIdx) => ({
      text,
      origIdx,
      misconception: Array.isArray(q.misconceptions) ? q.misconceptions[origIdx] || '' : ''
    }))

    for (let i = choiceItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[choiceItems[i], choiceItems[j]] = [choiceItems[j], choiceItems[i]]
    }

    const newChoices = choiceItems.map(item => item.text)
    const newMisconceptions = choiceItems.map(item => item.misconception)
    const newCorrectIndex = choiceItems.findIndex(item => item.origIdx === q.correct_index)

    return {
      ...q,
      choices: newChoices,
      correct_index: newCorrectIndex >= 0 ? newCorrectIndex : 0,
      misconceptions: newMisconceptions
    }
  })

  return {
    ...quiz,
    questions: shuffledQuestions
  }
}

// ── Host actions ──────────────────────────────────────────────────

export function createSession(quiz: AIGeneratedQuiz, hostId: string, gameMode: GameMode = 'classic'): GameState {
  const pin = String(Math.floor(100000 + Math.random() * 900000))
  const shuffledQuiz = shuffleQuizChoices(quiz)
  const state: GameState = {
    pin,
    status: 'lobby',
    gameMode,
    bossHealth: 100,
    bossMaxHealth: 100,
    quiz: shuffledQuiz,
    currentQuestionIndex: 0,
    questionStartedAt: 0,
    questionEndsAt: 0,
    players: {},
    hostId,
    revealCorrectIndex: null,
    createdAt: Date.now(),
  }
  saveState(state)
  return state
}

export function setGameMode(pin: string, gameMode: GameMode) {
  const state = loadState(pin)
  if (!state) return
  saveState({ ...state, gameMode })
}

export function startGame(pin: string) {
  const state = loadState(pin)
  if (!state || !state.quiz?.questions?.length) return
  const q = state.quiz.questions[0]
  const timeLimit = q?.time_limit_ms || 20000
  const now = Date.now()
  saveState({
    ...state,
    status: 'question_active',
    currentQuestionIndex: 0,
    questionStartedAt: now,
    questionEndsAt: now + timeLimit,
    revealCorrectIndex: null,
    players: Object.fromEntries(
      Object.entries(state.players || {}).map(([id, p]) => [id, { ...p, hasAnswered: false, selectedIndex: null, lastAnswerCorrect: null, lastPointsEarned: 0 }])
    )
  })
}

export function revealAnswer(pin: string) {
  const state = loadState(pin)
  if (!state || !state.quiz?.questions?.length) return
  const q = state.quiz.questions[state.currentQuestionIndex]
  const correctIdx = q?.correct_index ?? 0
  saveState({ ...state, status: 'question_reveal', revealCorrectIndex: correctIdx })
}

export function showLeaderboard(pin: string) {
  const state = loadState(pin)
  if (!state) return
  
  const tactics = getTacticsRankings(state.players)
  const mastery = getMasteryRankings(state.players)
  const updated: Record<string, Player> = {}

  Object.values(state.players).forEach(p => {
    const tRank = tactics.findIndex(x => x.id === p.id) + 1
    const mRank = mastery.findIndex(x => x.id === p.id) + 1
    updated[p.id] = {
      ...p,
      rank: tRank,
      tacticsRank: tRank,
      masteryRank: mRank,
    }
  })

  saveState({
    ...state,
    status: 'leaderboard',
    players: updated,
    tacticsRankings: tactics.map((p, i) => ({ ...p, rank: i + 1, tacticsRank: i + 1 })),
    masteryRankings: mastery.map((p, i) => ({ ...p, masteryRank: i + 1 })),
  })
}

export function nextQuestion(pin: string) {
  const state = loadState(pin)
  if (!state || !state.quiz?.questions?.length) return
  const nextIdx = state.currentQuestionIndex + 1
  if (nextIdx >= state.quiz.questions.length) {
    endGame(pin)
    return
  }
  const q = state.quiz.questions[nextIdx]
  const timeLimit = q?.time_limit_ms || 20000
  const now = Date.now()
  const resetPlayers = Object.fromEntries(
    Object.entries(state.players || {}).map(([id, p]) => [id, {
      ...p, hasAnswered: false, selectedIndex: null,
      lastAnswerCorrect: null, lastPointsEarned: 0
    }])
  )
  saveState({
    ...state,
    status: 'question_active',
    currentQuestionIndex: nextIdx,
    questionStartedAt: now,
    questionEndsAt: now + timeLimit,
    revealCorrectIndex: null,
    players: resetPlayers,
  })
}

export function endGame(pin: string) {
  const state = loadState(pin)
  if (!state) return

  const tactics = getTacticsRankings(state.players)
  const mastery = getMasteryRankings(state.players)
  const updated: Record<string, Player> = {}

  Object.values(state.players).forEach(p => {
    const tRank = tactics.findIndex(x => x.id === p.id) + 1
    const mRank = mastery.findIndex(x => x.id === p.id) + 1
    updated[p.id] = {
      ...p,
      rank: tRank,
      tacticsRank: tRank,
      masteryRank: mRank,
    }
  })

  const finalState: GameState = {
    ...state,
    status: 'ended',
    players: updated,
    tacticsRankings: tactics.map((p, i) => ({ ...p, rank: i + 1, tacticsRank: i + 1 })),
    masteryRankings: mastery.map((p, i) => ({ ...p, masteryRank: i + 1 })),
  }

  saveState(finalState)

  try {
    const { recordCompletedSession } = require('./historyStore')
    recordCompletedSession(finalState)
  } catch (e) {
    console.warn('Failed to record completed session history:', e)
  }
}

export function kickPlayer(pin: string, playerId: string) {
  const state = loadState(pin)
  if (!state) return
  const players = { ...state.players }
  delete players[playerId]
  saveState({ ...state, players })
}

/**
 * Eliminate players after a tournament round based on the elimination rule.
 * rule examples: "bottom 30%", "bottom 3", "score < 500", "only top 5 survive"
 */
export function eliminateRoundLosers(pin: string, roundNumber: number, rule: string): string[] {
  const state = loadState(pin)
  if (!state) return []

  const players = Object.values(state.players)
  if (players.length === 0) return []

  const sorted = getTacticsRankings(players)  // best -> worst
  let eliminated: string[] = []

  const ruleL = rule.toLowerCase().trim()

  // Pattern: "bottom X%"
  const pctMatch = ruleL.match(/bottom\s+(\d+)\s*%/)
  if (pctMatch) {
    const pct = parseInt(pctMatch[1]) / 100
    const cutCount = Math.floor(players.length * pct)
    eliminated = sorted.slice(sorted.length - cutCount).map(p => p.id)
  }

  // Pattern: "bottom X players" or "bottom X"
  const countMatch = !pctMatch && ruleL.match(/bottom\s+(\d+)/)
  if (countMatch) {
    const n = parseInt(countMatch[1])
    eliminated = sorted.slice(sorted.length - n).map(p => p.id)
  }

  // Pattern: "top X survive" or "only top X"
  const topMatch = ruleL.match(/top\s+(\d+)/)
  if (topMatch) {
    const n = parseInt(topMatch[1])
    eliminated = sorted.slice(n).map(p => p.id)
  }

  // Pattern: "score < N" or "score below N"
  const scoreMatch = ruleL.match(/score\s*(?:<|below|less than)\s*(\d+)/)
  if (scoreMatch) {
    const minScore = parseInt(scoreMatch[1])
    eliminated = players.filter(p => p.score < minScore).map(p => p.id)
  }

  // Pattern: "less than N correct" or "fewer than N correct"
  const correctMatch = ruleL.match(/(?:less than|fewer than|<)\s*(\d+)\s*correct/)
  if (correctMatch) {
    const minCorrect = parseInt(correctMatch[1])
    eliminated = players.filter(p => (p.totalCorrect || 0) < minCorrect).map(p => p.id)
  }

  // Record eliminations in tournamentConfig
  const tc = state.tournamentConfig
  const newEliminations = { ...(tc?.eliminations || {}), [roundNumber]: eliminated }
  const allEliminated = Array.from(new Set((state.eliminatedPlayers || []).concat(eliminated)))

  saveState({
    ...state,
    eliminatedPlayers: allEliminated,
    tournamentConfig: tc ? { ...tc, eliminations: newEliminations } : undefined
  })

  return eliminated
}

/**
 * Advance tournament to the next round:
 * 1. Run elimination rules for current round
 * 2. Load next round's quiz
 * 3. Reset per-question state for surviving players
 * 4. Transition status to 'lobby' or 'question_active'
 */
export function advanceTournamentRound(pin: string) {
  const state = loadState(pin)
  if (!state || !state.tournamentConfig) return

  const tc = state.tournamentConfig
  const currentRoundIdx = tc.currentRoundIndex ?? 0
  const nextRoundIdx = currentRoundIdx + 1

  // Run eliminations for current round
  const currentRoundConfig = tc.rounds[currentRoundIdx]
  if (currentRoundConfig) {
    eliminateRoundLosers(pin, currentRoundConfig.roundNumber, currentRoundConfig.eliminationRule)
  }

  // Refresh state after eliminations
  const freshState = loadState(pin) || state

  if (nextRoundIdx >= tc.rounds.length) {
    endGame(pin)
    return
  }

  const nextRoundConfig = tc.rounds[nextRoundIdx]
  const shuffledQuiz = shuffleQuizChoices(nextRoundConfig.quiz)

  const updatedTc = {
    ...tc,
    currentRoundIndex: nextRoundIdx
  }

  const resetPlayers = Object.fromEntries(
    Object.entries(freshState.players || {}).map(([id, p]) => [id, {
      ...p,
      hasAnswered: false,
      selectedIndex: null,
      lastAnswerCorrect: null,
      lastPointsEarned: 0
    }])
  )

  saveState({
    ...freshState,
    status: 'lobby',
    quiz: shuffledQuiz,
    currentQuestionIndex: 0,
    questionStartedAt: 0,
    questionEndsAt: 0,
    revealCorrectIndex: null,
    currentRound: nextRoundConfig.roundNumber,
    tournamentRoundLabel: `Round ${nextRoundConfig.roundNumber} of ${tc.rounds.length}`,
    tournamentConfig: updatedTc,
    players: resetPlayers
  })
}


export function togglePauseTimer(pin: string) {
  const state = loadState(pin)
  if (!state || state.status !== 'question_active') return
  if (state.isPaused) {
    const remaining = state.pausedTimeRemainingMs || 0
    saveState({
      ...state,
      isPaused: false,
      questionEndsAt: Date.now() + remaining,
      pausedTimeRemainingMs: undefined,
    })
  } else {
    const remaining = Math.max(0, state.questionEndsAt - Date.now())
    saveState({
      ...state,
      isPaused: true,
      pausedTimeRemainingMs: remaining,
    })
  }
}

export function extendTimer(pin: string, addMs: number = 15000) {
  const state = loadState(pin)
  if (!state || state.status !== 'question_active') return
  if (state.isPaused) {
    saveState({
      ...state,
      pausedTimeRemainingMs: (state.pausedTimeRemainingMs || 0) + addMs,
    })
  } else {
    saveState({
      ...state,
      questionEndsAt: state.questionEndsAt + addMs,
    })
  }
}

export function skipQuestion(pin: string) {
  const state = loadState(pin)
  if (!state) return
  if (state.status === 'question_active') {
    revealAnswer(pin)
  } else if (state.status === 'question_reveal') {
    showLeaderboard(pin)
  } else if (state.status === 'leaderboard') {
    const totalQ = state.quiz.questions.length
    if (state.currentQuestionIndex + 1 < totalQ) {
      nextQuestion(pin)
    } else {
      endGame(pin)
    }
  }
}

export function toggleAliasMode(pin: string) {
  const state = loadState(pin)
  if (!state) return
  saveState({
    ...state,
    aliasMode: !state.aliasMode,
  })
}


// ── Player actions ────────────────────────────────────────────────

export async function joinSessionAsync(
  pin: string,
  player: Omit<Player, 'score' | 'streak' | 'rank' | 'lastAnswerCorrect' | 'lastPointsEarned' | 'hasAnswered' | 'selectedIndex' | 'joinedAt' | 'connected' | 'coins' | 'violations' | 'flagged' | 'frenzyScore'>
): Promise<'ok' | 'not_found' | 'locked' | 'duplicate'> {
  const cleanPin = pin.trim().toUpperCase()
  let state = loadState(cleanPin)
  if (!state) {
    state = await fetchRemoteState(cleanPin, 4)
  }
  if (!state) return 'not_found'
  if (state.status === 'ended') return 'not_found'

  // If this exact player ID is already registered, update player info & return ok (re-join)
  if (state.players && state.players[player.id]) {
    saveState({
      ...state,
      players: {
        ...state.players,
        [player.id]: {
          ...state.players[player.id],
          nickname: player.nickname,
          avatarSeed: player.avatarSeed,
          avatarStyle: player.avatarStyle,
          connected: true,
        }
      }
    })
    return 'ok'
  }

  // Check duplicate nickname for a DIFFERENT player ID
  const existing = state.players ? Object.values(state.players).find(
    p => p.nickname.toLowerCase() === player.nickname.toLowerCase()
  ) : null

  if (existing) {
    if (existing.id === player.id) return 'ok'
    return 'duplicate'
  }

  const newPlayer: Player = {
    ...player,
    score: 0, streak: 0, maxStreak: 0, totalCorrect: 0, totalAnswered: 0, totalResponseTimeMs: 0, rank: 0,
    lastAnswerCorrect: null,
    lastPointsEarned: 0,
    hasAnswered: false,
    selectedIndex: null,
    joinedAt: Date.now(),
    connected: true,
    coins: 0, // Coins earned through quiz answers & performance
    violations: 0,
    flagged: false,
    frenzyScore: 0,
  }

  const updatedState = { ...state, players: { ...(state.players || {}), [player.id]: newPlayer } }
  saveState(updatedState)

  // Direct cloud API sync for cross-device join guarantee
  if (typeof window !== 'undefined') {
    fetch(`/api/room/${cleanPin}?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', player: newPlayer })
    }).catch(() => {})
  }

  return 'ok'
}

export function joinSession(
  pin: string,
  player: Omit<Player, 'score' | 'streak' | 'rank' | 'lastAnswerCorrect' | 'lastPointsEarned' | 'hasAnswered' | 'selectedIndex' | 'joinedAt' | 'connected' | 'coins' | 'violations' | 'flagged' | 'frenzyScore'>
): 'ok' | 'not_found' | 'locked' | 'duplicate' {
  const state = loadState(pin)
  if (!state) {
    // Trigger background remote fetch
    fetchRemoteState(pin).then(rem => {
      if (rem) {
        joinSessionAsync(pin, player)
      }
    })
    return 'ok' // Optimistic ok while remote state synchronizes
  }
  if (state.status === 'ended') return 'not_found'

  if (state.players && state.players[player.id]) {
    saveState({
      ...state,
      players: {
        ...state.players,
        [player.id]: {
          ...state.players[player.id],
          nickname: player.nickname,
          avatarSeed: player.avatarSeed,
          avatarStyle: player.avatarStyle,
          connected: true,
        }
      }
    })
    return 'ok'
  }

  const existing = state.players ? Object.values(state.players).find(
    p => p.nickname.toLowerCase() === player.nickname.toLowerCase()
  ) : null

  if (existing) {
    if (existing.id === player.id) return 'ok'
    return 'duplicate'
  }

  const newPlayer: Player = {
    ...player,
    score: 0, streak: 0, maxStreak: 0, totalCorrect: 0, totalAnswered: 0, totalResponseTimeMs: 0, rank: 0,
    lastAnswerCorrect: null,
    lastPointsEarned: 0,
    hasAnswered: false,
    selectedIndex: null,
    joinedAt: Date.now(),
    connected: true,
    coins: 0, // Coins earned through quiz answers & performance
    violations: 0,
    flagged: false,
    frenzyScore: 0,
  }
  saveState({ ...state, players: { ...(state.players || {}), [player.id]: newPlayer } })
  return 'ok'
}

export function sendReaction(pin: string, emoji: string, senderName?: string) {
  const state = loadState(pin)
  if (!state) return
  const newReaction: Reaction = {
    id: 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    emoji,
    senderName,
    createdAt: Date.now(),
  }
  const reactions = [...(state.reactions || []), newReaction].slice(-25)
  saveState({ ...state, reactions })
}

export function submitAnswer(pin: string, playerId: string, selectedIndex: number, powerUpActive = false) {
  const state = loadState(pin)
  if (!state || state.status !== 'question_active') return
  const player = state.players?.[playerId]
  if (!player || player.hasAnswered) return

  const q = state.quiz?.questions?.[state.currentQuestionIndex]
  if (!q) return

  const isCorrect = selectedIndex === q.correct_index
  const now = Date.now()
  const timeRemainingMs = state.isPaused
    ? Math.max(0, state.pausedTimeRemainingMs || 0)
    : Math.max(0, state.questionEndsAt - now)
  const totalTimeMs = q.time_limit_ms || 20000
  const responseTimeMs = Math.max(0, now - state.questionStartedAt)

  // SECURITY: Prevent sub-100ms automated script answers
  const isSuspiciousBot = responseTimeMs < 100 && totalTimeMs >= 5000

  let points = 0
  const newStreak = isCorrect ? player.streak + 1 : 0
  const bidMultiplier = player.bidMultiplier ?? 1
  const difficulty = q.difficulty || 'medium'
  const diffMult = difficulty === 'hard' ? 1.5 : difficulty === 'medium' ? 1.25 : 1

  if (isCorrect && !isSuspiciousBot) {
    const ratio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs))
    const speedFactor = 0.5 + 0.5 * ratio
    const streakMultiplier = 1 + Math.min(player.streak * 0.1, 0.5)
    const multiplier = (powerUpActive ? 2 : 1) * bidMultiplier * diffMult
    points = Math.round(Math.max(50, 1000 * speedFactor * streakMultiplier * multiplier))
    
    // SECURITY: Mathematically clamp maximum points to stop score injection cheats
    points = Math.min(12000, points)
  } else {
    if (state.gameMode === 'boss_raid') {
      points = -5 // Boss attacks (-5 class points)
    }
  }

  // Coin award (generous for Freshers Event)
  const baseCoins = isCorrect ? (difficulty === 'hard' ? 25 : difficulty === 'medium' ? 18 : 12) : 3
  const speedCoinBonus = isCorrect && responseTimeMs < 5000 ? 8 : (isCorrect && responseTimeMs < 10000 ? 4 : 0)
  const streakCoinBonus = isCorrect && player.streak >= 2 ? 5 : 0
  const coinsEarned = baseCoins + speedCoinBonus + streakCoinBonus

  // Calculate Boss Health update for Boss Raid mode
  let currentBossHp = state.bossHealth ?? 100
  if (state.gameMode === 'boss_raid') {
    if (isCorrect && !isSuspiciousBot) {
      currentBossHp = Math.max(0, currentBossHp - 10) // On correct answers, reduce bossHealth by 10 points
    }
  }

  const updatedPlayer: Player = {
    ...player,
    hasAnswered: true,
    selectedIndex,
    lastAnswerCorrect: isCorrect,
    lastPointsEarned: points,
    score: Math.max(0, player.score + points),
    streak: newStreak,
    maxStreak: Math.max(player.maxStreak || 0, newStreak),
    totalCorrect: (player.totalCorrect || 0) + (isCorrect ? 1 : 0),
    totalAnswered: (player.totalAnswered || 0) + 1,
    totalResponseTimeMs: (player.totalResponseTimeMs || 0) + responseTimeMs,
    coins: (player.coins || 0) + coinsEarned,
    bidMultiplier: 1, // reset bid multiplier after question is answered
  }

  const updatedPlayers = { ...state.players, [playerId]: updatedPlayer }
  const tactics = getTacticsRankings(updatedPlayers)
  const mastery = getMasteryRankings(updatedPlayers)

  // Skip the redundant full-state relay POST — the action POST below already
  // carries this answer to the server, which re-scores it authoritatively.
  saveState({
    ...state,
    bossHealth: currentBossHp,
    players: updatedPlayers,
    tacticsRankings: tactics,
    masteryRankings: mastery,
  }, { relay: false })

  // Direct cloud API sync for cross-device answer submission guarantee
  if (typeof window !== 'undefined') {
    fetch(`/api/room/${pin}?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'submit_answer',
        playerId,
        selectedIndex,
        powerUpActive,
        timeRemainingMs,
        responseTimeMs
      })
    }).catch(() => {})
  }
}

// ── Boss Frenzy ───────────────────────────────────────────────────

/**
 * Host triggers Boss Frenzy on the last question.
 * Picks up to 10 questions (cycling if quiz has fewer), starts 60s countdown.
 */
export function startBossFrenzy(pin: string) {
  const state = loadState(pin)
  if (!state || !state.quiz?.questions?.length) return

  const totalQ = state.quiz.questions.length
  const frenzyCount = 10
  const indices: number[] = []
  for (let i = 0; i < frenzyCount; i++) {
    indices.push(i % totalQ)
  }

  const now = Date.now()
  const bossFrenzy: import('./types').BossFrenzyState = {
    active: true,
    endsAt: now + 60000,
    questionIndices: indices,
    currentFrenzyIndex: 0,
    questionStartedAt: now,
    frenzyScores: Object.fromEntries(Object.keys(state.players).map(id => [id, 0]))
  }

  saveState({ ...state, status: 'boss_frenzy', bossFrenzy })
}

/**
 * Player submits an answer in boss frenzy mode.
 * Increments frenzyScore if correct; does NOT modify main score.
 * Advances to next rapid-fire question or ends frenzy if all 10 done.
 */
export function submitFrenzyAnswer(pin: string, playerId: string, selectedIndex: number) {
  const state = loadState(pin)
  if (!state || state.status !== 'boss_frenzy' || !state.bossFrenzy?.active) return

  const frenzy = state.bossFrenzy
  if (Date.now() > frenzy.endsAt) {
    endBossFrenzy(pin)
    return
  }

  const qIdx = frenzy.questionIndices[frenzy.currentFrenzyIndex]
  const q = state.quiz.questions[qIdx]
  if (!q) return

  const isCorrect = selectedIndex === q.correct_index
  const newFrenzyScores = { ...frenzy.frenzyScores }
  if (isCorrect) {
    newFrenzyScores[playerId] = (newFrenzyScores[playerId] || 0) + 1
  }

  const nextFrenzyIndex = frenzy.currentFrenzyIndex + 1
  const isLastQ = nextFrenzyIndex >= frenzy.questionIndices.length

  // Award bonus score from frenzy at the end
  let updatedPlayers = { ...state.players }
  if (isLastQ) {
    // Award 200pts per correct frenzy answer
    Object.entries(newFrenzyScores).forEach(([pid, correct]) => {
      if (updatedPlayers[pid]) {
        updatedPlayers[pid] = {
          ...updatedPlayers[pid],
          score: updatedPlayers[pid].score + correct * 200,
          frenzyScore: correct
        }
      }
    })
  }

  const updatedFrenzy: import('./types').BossFrenzyState = {
    ...frenzy,
    currentFrenzyIndex: isLastQ ? frenzy.currentFrenzyIndex : nextFrenzyIndex,
    questionStartedAt: Date.now(),
    frenzyScores: newFrenzyScores,
    active: !isLastQ
  }

  saveState({
    ...state,
    players: updatedPlayers,
    bossFrenzy: updatedFrenzy,
    status: isLastQ ? 'ended' : 'boss_frenzy'
  }, { relay: false })

  if (typeof window !== 'undefined') {
    fetch(`/api/room/${pin}?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'frenzy_answer',
        playerId,
        selectedIndex,
        frenzyIndex: frenzy.currentFrenzyIndex
      })
    }).catch(() => {})
  }
}

/** Host manually ends boss frenzy early */
export function endBossFrenzy(pin: string) {
  const state = loadState(pin)
  if (!state || !state.bossFrenzy) return

  // Award 200pts per correct frenzy answer to all players
  const updatedPlayers = { ...state.players }
  const scores = state.bossFrenzy.frenzyScores || {}
  Object.entries(scores).forEach(([pid, correct]) => {
    if (updatedPlayers[pid]) {
      updatedPlayers[pid] = {
        ...updatedPlayers[pid],
        score: updatedPlayers[pid].score + correct * 200,
        frenzyScore: correct
      }
    }
  })

  saveState({
    ...state,
    players: updatedPlayers,
    status: 'ended',
    bossFrenzy: { ...state.bossFrenzy, active: false }
  })
}

// ── Anti-Cheat Violation Reporting ───────────────────────────────

export function reportViolation(pin: string, playerId: string, reason: string) {
  if (typeof window === 'undefined') return
  fetch(`/api/room/${pin}?_t=${Date.now()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'report_violation', playerId, reason })
  }).catch(() => {})
}

// ── Coin Economy ─────────────────────────────────────────────────

/**
 * Award coins to a player (called after server confirms correct answer).
 * difficulty → coin award: easy=5, medium=8, hard=12; fast (<5s) → +3 bonus
 */
export function awardCoins(pin: string, playerId: string, difficulty: 'easy' | 'medium' | 'hard', responseTimeMs: number) {
  const state = loadState(pin)
  if (!state) return
  const player = state.players[playerId]
  if (!player) return

  const base = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 8 : 12
  const bonus = responseTimeMs < 5000 ? 3 : 0
  const earned = base + bonus

  saveState({
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, coins: (player.coins || 0) + earned }
    }
  })
}

/**
 * Spend coins to buy a power-up (client-side optimistic, server validates).
 * Returns true if purchase succeeded.
 */
export function buyPowerUp(
  pin: string,
  playerId: string,
  powerUpType: import('./types').CoinPowerUpType,
  targetId?: string
): boolean {
  const state = loadState(pin)
  if (!state) return false
  const player = state.players[playerId]
  if (!player) return false

  // Cost map
  const COSTS: Record<string, number> = {
    freeze_player: 15,
    freeze_all: 25,
    bid_2x: 10,
    bid_3x: 20,
    bid_4x: 35
  }
  const cost = COSTS[powerUpType] ?? 999
  if ((player.coins || 0) < cost) return false

  // Deduct coins
  const updatedPlayers = { ...state.players }
  updatedPlayers[playerId] = { ...player, coins: player.coins - cost }

  // Apply effect
  if (powerUpType === 'bid_2x' || powerUpType === 'bid_3x' || powerUpType === 'bid_4x') {
    const mult = powerUpType === 'bid_2x' ? 2 : powerUpType === 'bid_3x' ? 3 : 4
    updatedPlayers[playerId] = { ...updatedPlayers[playerId], bidMultiplier: mult }
  } else if (powerUpType === 'freeze_player' && targetId && updatedPlayers[targetId]) {
    updatedPlayers[targetId] = { ...updatedPlayers[targetId], frozenUntil: Date.now() + 6000 }
  } else if (powerUpType === 'freeze_all') {
    const freezeEnd = Date.now() + 4000
    Object.keys(updatedPlayers).forEach(pid => {
      if (pid !== playerId) {
        updatedPlayers[pid] = { ...updatedPlayers[pid], frozenUntil: freezeEnd }
      }
    })
  }

  // Skip the redundant full-state relay POST — the action POST below applies
  // the purchase server-side for all other devices.
  saveState({ ...state, players: updatedPlayers }, { relay: false })

  // Sync to server
  if (typeof window !== 'undefined') {
    fetch(`/api/room/${pin}?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'buy_powerup',
        playerId,
        powerUpType,
        targetId
      })
    }).catch(() => {})
  }

  return true
}

