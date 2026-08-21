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
 * Strips option markers (e.g. "A) ", "B. ", "(C) ", "1: ", "+", "*", "✓")
 */
export function cleanOptionText(text: string): string {
  return String(text ?? '')
    .replace(/^[\(\[]?[A-Da-d1-4][\.\)\:\-\]]\s*/, '')
    .replace(/^\+\s*/, '')
    .replace(/\s*\+$/, '')
    .replace(/^\*\s*/, '')
    .replace(/\s*\*$/, '')
    .replace(/^\[x\]\s*/i, '')
    .replace(/^\[correct\]\s*/i, '')
    .replace(/\s*\[correct\]/i, '')
    .replace(/\s*\(correct\)/i, '')
    .replace(/^[✓✔]\s*/, '')
    .trim()
}

/**
 * Resolves the 0-based correct answer index for a question using:
 * 1. Explicit quoted string or exact value inside explanation (e.g. The correct answer is "Amino acids" -> matches choice "Amino acids")
 * 2. Word-bounded option letter inside explanation (e.g. "(B)", "Option B", "Choice B", "answer is B.")
 * 3. Choice text appearing inside explanation
 * 4. Fallback to question's existing correct_index
 */
export function resolveQuestionCorrectIndex(q: { choices: string[]; correct_index?: number; explanation?: string }): number {
  if (!q || !Array.isArray(q.choices) || q.choices.length === 0) return 0

  const cleanedChoices = q.choices.map(c => cleanOptionText(c))

  if (q.explanation && typeof q.explanation === 'string') {
    const rawExp = q.explanation.trim()
    const expLow = rawExp.toLowerCase()

    // 1. Quoted text match: e.g. The correct answer is "Amino acids" or '20' or "20"
    const quotedMatches = Array.from(rawExp.matchAll(/["'“‘]([^"'”’]+)["'”’]/g)).map(m => m[1].trim())
    for (const quoted of quotedMatches) {
      const cleanQuoted = cleanOptionText(quoted).toLowerCase()
      if (!cleanQuoted) continue
      const matchIdx = cleanedChoices.findIndex(c => c.toLowerCase() === cleanQuoted)
      if (matchIdx !== -1) {
        return matchIdx
      }
    }

    // 2. Explicit Option Letter match with STRICT word boundaries / delimiters:
    // Matches: "Option B", "Choice B", "(B)", "Answer is B.", "Correct: B"
    // MUST NOT match words starting with a letter (e.g. "answer is \"amino acids\"" has 'a' followed by 'm', so \b won't match just 'a')
    const optLetterMatch = expLow.match(/\b(?:option|choice)\s+([a-d])\b/i) ||
                           expLow.match(/\(([a-d])\)/i) ||
                           expLow.match(/(?:correct\s+answer\s+is|answer\s+is|correct\s+option\s+is|correct:)\s*\(?([a-d])\)?(?:\s*[\.\,\:\;\!\-\)]|\s*$|\s+(?:because|which|as|due|\-|\:))/i)

    if (optLetterMatch) {
      const letter = optLetterMatch[1].toLowerCase()
      const lIdx = letter === 'a' ? 0 : letter === 'b' ? 1 : letter === 'c' ? 2 : 3
      if (lIdx < cleanedChoices.length) {
        return lIdx
      }
    }

    // 3. Exact phrase match: check if a choice is explicitly mentioned after "correct answer is ..."
    const afterPhraseMatch = expLow.match(/(?:correct\s+answer\s+is|answer\s+is|correct\s+option\s+is|correct:)\s*[:\-]?\s*([^.,;\n\r]+)/i)
    if (afterPhraseMatch) {
      const targetPhrase = cleanOptionText(afterPhraseMatch[1]).replace(/["'”’]/g, '').trim().toLowerCase()
      if (targetPhrase) {
        const phraseIdx = cleanedChoices.findIndex(c => {
          const cLow = c.toLowerCase()
          return cLow === targetPhrase || targetPhrase.startsWith(cLow) || cLow.startsWith(targetPhrase)
        })
        if (phraseIdx !== -1) {
          return phraseIdx
        }
      }
    }

    // 4. Whole-word choice inclusion in explanation
    for (let i = 0; i < cleanedChoices.length; i++) {
      const c = cleanedChoices[i]
      if (!c || c.length < 2) continue
      const cLow = c.toLowerCase()
      if (expLow.includes(` ${cLow} `) || expLow.includes(` ${cLow}.`) || expLow.includes(` ${cLow},`)) {
        return i
      }
    }
  }

  // Fallback: valid integer correct_index on the question
  if (typeof q.correct_index === 'number' && Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.choices.length) {
    return q.correct_index
  }

  return 0
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
    const resolvedIndex = resolveQuestionCorrectIndex(q)
    return {
      ...q,
      correct_index: resolvedIndex
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
