/* ================================================================
   QuizFlow — Live-Play Game Engine (server-side shared helpers)
   Used by the /api/quiz/* routes. Kept dependency-light: pure
   functions + types, no Supabase imports here.
   ================================================================ */

import type { AIGeneratedQuiz, AIGeneratedQuestion } from './types'
import { buildGameConfig } from './scoring'

export type LiveGameStatus =
  | 'lobby'
  | 'question_active'
  | 'question_reveal'
  | 'leaderboard'
  | 'boss_frenzy'
  | 'ended'

/** Game record shape as stored in the `games` table (client-safe). */
export interface GameRecord {
  id: string
  mode: 'classic' | 'boss_raid' | 'tournament'
  status: LiveGameStatus
  quiz: AIGeneratedQuiz
  config: ReturnType<typeof buildGameConfig>
  current_question_index: number
  question_started_at: string | null
  boss_question_index: number
  boss_window_ends_at: string | null
  boss_bonus_awarded: boolean
  created_at: string
}

/**
 * Strip correct_index from a quiz so it can live in an anon-readable
 * row (`games.quiz`) and be served to clients before the reveal phase.
 * The answer keys are extracted separately and stored in the
 * server-only `game_answer_keys` table (no anon grants).
 */
export function sanitizeQuizForClient(quiz: AIGeneratedQuiz): AIGeneratedQuiz {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz
  const questions: AIGeneratedQuestion[] = quiz.questions.map((q) => {
    const { correct_index, ...safeQ } = q as AIGeneratedQuestion & { correct_index: number }
    void correct_index
    return safeQ as AIGeneratedQuestion
  })
  return { ...quiz, questions }
}

/**
 * Extract the correct-answer indices, in question order. These go to
 * the server-only `game_answer_keys` table and are never granted to
 * anon/authenticated roles.
 */
export function extractAnswerKeys(quiz: AIGeneratedQuiz): number[] {
  if (!quiz || !Array.isArray(quiz.questions)) return []
  return quiz.questions.map((q) => {
    const idx = (q as AIGeneratedQuestion & { correct_index?: number }).correct_index
    return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 ? idx : -1
  })
}

/** Shared no-store cache headers for every live-play route. */
export const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0'
}

export { buildGameConfig }
