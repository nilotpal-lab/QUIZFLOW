/* ================================================================
   QuizFlow — Past Game History & Class Analytics Store
   Persists completed teacher game sessions and performance reports.
   ================================================================ */

import type { GameState, Player } from './sessionStore'
import { syncSessionHistoryToSupabase } from './supabaseClient'

export interface SessionHistoryRecord {
  id: string
  pin: string
  quizTitle: string
  language: string
  bloomLevel: string
  totalQuestions: number
  totalPlayers: number
  winnerName: string
  winnerScore: number
  classAccuracyPercent: number
  completedAt: number
  playersSummary: Array<{
    nickname: string
    avatarSeed: string
    score: number
    totalCorrect: number
    totalAnswered: number
    accuracyPercent: number
    rank: number
  }>
  questionStats: Array<{
    questionIndex: number
    prompt: string
    correctCount: number
    totalResponses: number
    accuracyPercent: number
  }>
}

const HISTORY_KEY = 'qf_session_history'

const DEMO_HISTORY: SessionHistoryRecord[] = [
  {
    id: 'hist_demo_1',
    pin: '839201',
    quizTitle: 'Quantum Mechanics & Wave-Particle Duality',
    language: 'English',
    bloomLevel: 'Application',
    totalQuestions: 3,
    totalPlayers: 6,
    winnerName: 'AuditTester',
    winnerScore: 3120,
    classAccuracyPercent: 83,
    completedAt: Date.now() - 2 * 86400 * 1000,
    playersSummary: [
      { nickname: 'AuditTester', avatarSeed: 'Totoro', score: 3120, totalCorrect: 3, totalAnswered: 3, accuracyPercent: 100, rank: 1 },
      { nickname: 'CosmicNinja', avatarSeed: 'Kiki', score: 2840, totalCorrect: 3, totalAnswered: 3, accuracyPercent: 100, rank: 2 },
      { nickname: 'StarVoyager', avatarSeed: 'Howl', score: 2190, totalCorrect: 2, totalAnswered: 3, accuracyPercent: 67, rank: 3 },
      { nickname: 'PixelPanda', avatarSeed: 'Ponyo', score: 1850, totalCorrect: 2, totalAnswered: 3, accuracyPercent: 67, rank: 4 },
      { nickname: 'SpeedyOwl', avatarSeed: 'Calcifer', score: 1200, totalCorrect: 1, totalAnswered: 3, accuracyPercent: 33, rank: 5 },
      { nickname: 'QuantumFox', avatarSeed: 'Jiji', score: 980, totalCorrect: 1, totalAnswered: 3, accuracyPercent: 33, rank: 6 }
    ],
    questionStats: [
      { questionIndex: 0, prompt: 'In a double-slit experiment, what pattern forms...', correctCount: 6, totalResponses: 6, accuracyPercent: 100 },
      { questionIndex: 1, prompt: 'According to Heisenberg Uncertainty Principle...', correctCount: 5, totalResponses: 6, accuracyPercent: 83 },
      { questionIndex: 2, prompt: 'What physical concept explains quantum barrier passage...', correctCount: 4, totalResponses: 6, accuracyPercent: 67 }
    ]
  }
]

import { getHostUser } from './authStore'

function getHistoryStorageKey(): string {
  if (typeof window === 'undefined') return HISTORY_KEY
  const user = getHostUser()
  if (user && user.email) {
    return `qf_session_history_${user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`
  }
  return HISTORY_KEY
}

export function getSessionHistory(): SessionHistoryRecord[] {
  if (typeof window === 'undefined') return DEMO_HISTORY
  const key = getHistoryStorageKey()
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
    localStorage.setItem(key, JSON.stringify(DEMO_HISTORY))
    return DEMO_HISTORY
  } catch (err) {
    console.warn('Failed to load session history from storage:', err)
    return DEMO_HISTORY
  }
}

export function recordCompletedSession(gameState: GameState): SessionHistoryRecord | null {
  if (!gameState || !gameState.quiz) return null

  const playersList: Player[] = Object.values(gameState.players || {})
  const totalPlayers = playersList.length
  if (totalPlayers === 0) return null

  // Sort players by score
  const sortedPlayers = [...playersList].sort((a, b) => b.score - a.score)
  const winner = sortedPlayers[0]

  let totalCorrectAll = 0
  let totalAnsweredAll = 0

  const playersSummary = sortedPlayers.map((p, idx) => {
    const ans = p.totalAnswered || 0
    const corr = p.totalCorrect || 0
    totalCorrectAll += corr
    totalAnsweredAll += ans
    return {
      nickname: p.nickname,
      avatarSeed: p.avatarSeed || p.nickname,
      score: p.score,
      totalCorrect: corr,
      totalAnswered: ans,
      accuracyPercent: ans > 0 ? Math.round((corr / ans) * 100) : 0,
      rank: idx + 1
    }
  })

  const classAccuracyPercent = totalAnsweredAll > 0 ? Math.round((totalCorrectAll / totalAnsweredAll) * 100) : 0

  // Compute per-question accuracy stats
  const questions = gameState.quiz.questions || []
  const questionStats = questions.map((q, idx) => {
    let corrCount = 0
    let respCount = 0
    playersList.forEach(p => {
      if (p.hasAnswered) {
        respCount++
        if (p.selectedIndex === q.correct_index) corrCount++
      }
    })
    return {
      questionIndex: idx,
      prompt: q.prompt,
      correctCount: corrCount,
      totalResponses: respCount,
      accuracyPercent: respCount > 0 ? Math.round((corrCount / respCount) * 100) : 0
    }
  })

  const record: SessionHistoryRecord = {
    id: 'session_' + gameState.pin + '_' + Date.now(),
    pin: gameState.pin,
    quizTitle: gameState.quiz.title || 'Live Quiz Session',
    language: gameState.quiz.language || 'English',
    bloomLevel: gameState.quiz.bloomLevel || 'Recall',
    totalQuestions: questions.length,
    totalPlayers,
    winnerName: winner ? winner.nickname : 'No Players',
    winnerScore: winner ? winner.score : 0,
    classAccuracyPercent,
    completedAt: Date.now(),
    playersSummary,
    questionStats
  }

  const history = getSessionHistory()
  history.unshift(record)

  if (typeof window !== 'undefined') {
    const key = getHistoryStorageKey()
    localStorage.setItem(key, JSON.stringify(history))
    syncSessionHistoryToSupabase(record)
  }

  return record
}
