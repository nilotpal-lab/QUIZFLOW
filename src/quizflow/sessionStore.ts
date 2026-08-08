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
  | 'ended'           // Game over, final results

export type GameMode = 'classic' | 'boss_raid'

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
    // Same question: prioritize 'ended' > 'leaderboard' > 'question_reveal' > 'question_active' > 'lobby'
    const statusWeight: Record<GameStatus, number> = {
      lobby: 0,
      question_active: 1,
      question_reveal: 2,
      leaderboard: 3,
      ended: 4,
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
          totalResponseTimeMs
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
          hasAnswered,
          selectedIndex,
          lastAnswerCorrect,
          lastPointsEarned
        }
      }
    }
  }

  const tactics = getTacticsRankings(mergedPlayers)
  const mastery = getMasteryRankings(mergedPlayers)

  return {
    ...base,
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

function broadcast(pin: string, state?: GameState) {
  const ch = getChannel()
  if (ch) ch.postMessage({ pin, ts: Date.now() })

  const payload = state || loadState(pin)

  // 1. Cloud Room Relay Sync (Works across all laptops, phones, and tablets over the internet)
  if (typeof window !== 'undefined' && payload) {
    fetch(`/api/room/${pin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: payload }),
    }).catch(() => {})
  }

  // 2. Supabase Realtime WebSocket Sync (if configured)
  if (supabase && payload) {
    try {
      const roomChannel = supabase.channel(`qf_room_${pin}`)
      roomChannel.send({
        type: 'broadcast',
        event: 'state_sync',
        payload
      }).catch(() => {})
    } catch {
      // Graceful fallback if offline
    }
  }
}

// ── Storage helpers ───────────────────────────────────────────────
function key(pin: string) { return STORE_PREFIX + pin }

export function saveState(state: GameState) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  const current = loadState(state.pin)
  const merged = mergeGameStates(current, state) || state
  localStorage.setItem(key(state.pin), JSON.stringify(merged))
  broadcast(state.pin, merged)
}

export function loadState(pin: string): GameState | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(key(pin))
  if (!raw) return null
  try { return JSON.parse(raw) as GameState } catch { return null }
}

export async function fetchRemoteState(pin: string): Promise<GameState | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch(`/api/room/${pin}`)
    if (res.ok) {
      const data = await res.json()
      if (data?.state) {
        const local = loadState(pin)
        const merged = mergeGameStates(local, data.state as GameState) || data.state
        localStorage.setItem(key(pin), JSON.stringify(merged))
        return merged as GameState
      }
    }
  } catch {}
  return null
}

export function deleteState(pin: string) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return
  localStorage.removeItem(key(pin))
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
  if (local) callback(local)

  // 2. Fetch from Cloud Room Relay (for other devices on the internet)
  fetchRemoteState(pin).then(remote => {
    if (remote) callback(remote)
  })

  // 3. BroadcastChannel (instant 0ms cross-tab same browser)
  let ch: BroadcastChannel | null = null
  let onMsg: ((e: MessageEvent) => void) | null = null
  if (typeof BroadcastChannel !== 'undefined') {
    ch = new BroadcastChannel(CHANNEL_NAME)
    onMsg = (e: MessageEvent) => {
      if (e.data?.pin === pin) callback(loadState(pin))
    }
    ch.addEventListener('message', onMsg)
  }

  // 4. StorageEvent (same-tab fallback)
  const onStorage = (e: StorageEvent) => {
    if (e.key === key(pin)) callback(loadState(pin))
  }
  window.addEventListener('storage', onStorage)

  // 5. Cloud Room Relay Polling for cross-device internet sync (every 900ms)
  const pollInterval = setInterval(() => {
    fetchRemoteState(pin).then(remote => {
      if (remote) callback(remote)
    })
  }, 900)

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
            localStorage.setItem(key(pin), JSON.stringify(merged))
            callback(merged)
          }
        })
        .on('broadcast', { event: 'player_join' }, (res: any) => {
          if (res?.payload?.player && res?.payload?.pin === pin) {
            const current = loadState(pin)
            if (current) {
              const updated = {
                ...current,
                players: {
                  ...current.players,
                  [res.payload.player.id]: {
                    ...res.payload.player,
                    score: 0,
                    streak: 0,
                    maxStreak: 0,
                    totalCorrect: 0,
                    totalAnswered: 0,
                    totalResponseTimeMs: 0,
                    rank: 0,
                    lastAnswerCorrect: null,
                    lastPointsEarned: 0,
                    hasAnswered: false,
                    selectedIndex: null,
                    joinedAt: Date.now(),
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
  if (!state) return
  const q = state.quiz.questions[0]
  const now = Date.now()
  saveState({
    ...state,
    status: 'question_active',
    currentQuestionIndex: 0,
    questionStartedAt: now,
    questionEndsAt: now + q.time_limit_ms,
    revealCorrectIndex: null,
    players: Object.fromEntries(
      Object.entries(state.players).map(([id, p]) => [id, { ...p, hasAnswered: false, selectedIndex: null, lastAnswerCorrect: null, lastPointsEarned: 0 }])
    )
  })
}

export function revealAnswer(pin: string) {
  const state = loadState(pin)
  if (!state) return
  const q = state.quiz.questions[state.currentQuestionIndex]
  saveState({ ...state, status: 'question_reveal', revealCorrectIndex: q.correct_index })
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
  if (!state) return
  const nextIdx = state.currentQuestionIndex + 1
  if (nextIdx >= state.quiz.questions.length) {
    endGame(pin)
    return
  }
  const q = state.quiz.questions[nextIdx]
  const now = Date.now()
  const resetPlayers = Object.fromEntries(
    Object.entries(state.players).map(([id, p]) => [id, {
      ...p, hasAnswered: false, selectedIndex: null,
      lastAnswerCorrect: null, lastPointsEarned: 0
    }])
  )
  saveState({
    ...state,
    status: 'question_active',
    currentQuestionIndex: nextIdx,
    questionStartedAt: now,
    questionEndsAt: now + q.time_limit_ms,
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

  saveState({
    ...state,
    status: 'ended',
    players: updated,
    tacticsRankings: tactics.map((p, i) => ({ ...p, rank: i + 1, tacticsRank: i + 1 })),
    masteryRankings: mastery.map((p, i) => ({ ...p, masteryRank: i + 1 })),
  })
}

export function kickPlayer(pin: string, playerId: string) {
  const state = loadState(pin)
  if (!state) return
  const players = { ...state.players }
  delete players[playerId]
  saveState({ ...state, players })
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
  player: Omit<Player, 'score' | 'streak' | 'rank' | 'lastAnswerCorrect' | 'lastPointsEarned' | 'hasAnswered' | 'selectedIndex' | 'joinedAt' | 'connected'>
): Promise<'ok' | 'not_found' | 'locked' | 'duplicate'> {
  let state = loadState(pin)
  if (!state) {
    state = await fetchRemoteState(pin)
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
  }
  saveState({ ...state, players: { ...(state.players || {}), [player.id]: newPlayer } })
  return 'ok'
}

export function joinSession(
  pin: string,
  player: Omit<Player, 'score' | 'streak' | 'rank' | 'lastAnswerCorrect' | 'lastPointsEarned' | 'hasAnswered' | 'selectedIndex' | 'joinedAt' | 'connected'>
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
  const player = state.players[playerId]
  if (!player || player.hasAnswered) return

  const q = state.quiz.questions[state.currentQuestionIndex]
  const isCorrect = selectedIndex === q.correct_index
  const now = Date.now()
  const timeRemainingMs = state.isPaused
    ? Math.max(0, state.pausedTimeRemainingMs || 0)
    : Math.max(0, state.questionEndsAt - now)
  const totalTimeMs = q.time_limit_ms
  const responseTimeMs = Math.max(0, now - state.questionStartedAt)

  // SECURITY: Prevent sub-100ms automated script answers
  const isSuspiciousBot = responseTimeMs < 100 && totalTimeMs >= 5000

  let points = 0
  const newStreak = isCorrect ? player.streak + 1 : 0
  if (isCorrect && !isSuspiciousBot) {
    const ratio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs))
    const speedFactor = 0.5 + 0.5 * ratio
    const streakMultiplier = 1 + Math.min(player.streak * 0.1, 0.5)
    const multiplier = powerUpActive ? 2 : 1
    points = Math.round(Math.max(50, 1000 * speedFactor * streakMultiplier * multiplier))
    
    // SECURITY: Mathematically clamp maximum points to stop score injection cheats
    points = Math.min(6000, points)
  } else {
    if (state.gameMode === 'boss_raid') {
      points = -5 // Boss attacks (-5 class points)
    }
  }

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
  }

  const updatedPlayers = { ...state.players, [playerId]: updatedPlayer }
  const tactics = getTacticsRankings(updatedPlayers)
  const mastery = getMasteryRankings(updatedPlayers)

  saveState({
    ...state,
    bossHealth: currentBossHp,
    players: updatedPlayers,
    tacticsRankings: tactics,
    masteryRankings: mastery,
  })
}
