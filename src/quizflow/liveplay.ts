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
 * Auto-repairs and cross-verifies correct_index against explanation and choices.
 * Fixes imported or AI quizzes where correct_index was defaulted to 0 despite
 * explanation clearly stating the correct answer value or letter.
 */
export function repairQuizQuestions(quiz: AIGeneratedQuiz): AIGeneratedQuiz {
  if (!quiz || !Array.isArray(quiz.questions)) return quiz

  const questions = quiz.questions.map((q: any) => {
    if (!Array.isArray(q.choices) || q.choices.length === 0) return q

    let targetIdx = typeof q.correct_index === 'number' && q.correct_index >= 0 && q.correct_index < q.choices.length
      ? q.correct_index
      : 0

    if (q.explanation && typeof q.explanation === 'string') {
      const exp = q.explanation.trim()
      const expLow = exp.toLowerCase()

      // 1. Explicit letter match: e.g. 'The correct answer is "B"' or 'Answer: (B)'
      const letterMatch = expLow.match(/(?:correct answer is|answer is|correct option is|correct:)\s*[\"\']?\(?([a-d])\)?[\"\']?/i)
      if (letterMatch) {
        const letter = letterMatch[1].toLowerCase()
        const lIdx = letter === 'a' ? 0 : letter === 'b' ? 1 : letter === 'c' ? 2 : 3
        if (lIdx < q.choices.length) {
          targetIdx = lIdx
        }
      } else {
        // 2. Exact quote or value match in explanation: e.g. The correct answer is "20".
        for (let i = 0; i < q.choices.length; i++) {
          const rawC = String(q.choices[i] || '').trim()
          if (!rawC) continue
          const cleanC = rawC.replace(/^[\(\[]?[A-Da-d1-4][\.\)\:\-\]]\s*/, '').trim().toLowerCase()
          if (cleanC && (
            expLow.includes(`"${cleanC}"`) ||
            expLow.includes(`'${cleanC}'`) ||
            expLow.includes(`is ${cleanC}`) ||
            expLow.includes(`is: ${cleanC}`) ||
            expLow.includes(`is "${cleanC}"`)
          )) {
            targetIdx = i
            break
          }
        }
      }
    }

    return {
      ...q,
      correct_index: targetIdx
    }
  })

  return {
    ...quiz,
    questions
  }
}

/**
 * Strip correct_index from a quiz so it can live in an anon-readable
 * row (`games.quiz`) and be served to clients before the reveal phase.
 * The answer keys are extracted separately and stored in the
 * server-only `game_answer_keys` table (no anon grants).
 */
export function sanitizeQuizForClient(quiz: AIGeneratedQuiz): AIGeneratedQuiz {
  const repaired = repairQuizQuestions(quiz)
  if (!repaired || !Array.isArray(repaired.questions)) return repaired
  const questions: AIGeneratedQuestion[] = repaired.questions.map((q) => {
    const { correct_index, ...safeQ } = q as AIGeneratedQuestion & { correct_index: number }
    void correct_index
    return safeQ as AIGeneratedQuestion
  })
  return { ...repaired, questions }
}

/**
 * Extract the correct-answer indices, in question order. These go to
 * the server-only `game_answer_keys` table and are never granted to
 * anon/authenticated roles.
 */
export function extractAnswerKeys(quiz: AIGeneratedQuiz): number[] {
  const repaired = repairQuizQuestions(quiz)
  if (!repaired || !Array.isArray(repaired.questions)) return []
  return repaired.questions.map((q) => {
    const idx = (q as AIGeneratedQuestion & { correct_index?: number }).correct_index
    return typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 ? idx : 0
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
