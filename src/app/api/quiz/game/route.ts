import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import {
  sanitizeQuizForClient,
  extractAnswerKeys,
  buildGameConfig,
  noCacheHeaders
} from '@/quizflow/liveplay'
import type { AIGeneratedQuiz } from '@/quizflow/types'

/* ================================================================
   QuizFlow — Live Game Registration (host-only)
   POST /api/quiz/game  { game_id, quiz, mode? }

   Creates or replaces a live game. The quiz is SANITIZED before it
   touches an anon-readable table (correct_index stripped) and the
   answer keys go to the server-only `game_answer_keys` table via the
   SECURITY DEFINER qf_create_game RPC. Scoring tunables are snapshotted
   into games.config from scoring.ts (single source of truth).
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function POST(req: Request) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — host session required.' }, { status: 401, headers: noCacheHeaders })
  }

  let body: { game_id?: unknown; quiz?: unknown; mode?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const gameId = typeof body?.game_id === 'string' ? body.game_id.trim().toUpperCase() : ''
  const quiz = body?.quiz as AIGeneratedQuiz | undefined
  const mode = typeof body?.mode === 'string' && ['classic', 'boss_raid', 'tournament'].includes(body.mode)
    ? (body.mode as 'classic' | 'boss_raid' | 'tournament')
    : 'classic'

  if (!gameId) {
    return NextResponse.json({ success: false, error: 'game_id is required' }, { status: 400, headers: noCacheHeaders })
  }
  if (!quiz || !Array.isArray(quiz.questions) || quiz.questions.length === 0) {
    return NextResponse.json({ success: false, error: 'A quiz with at least one question is required' }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const sanitized = sanitizeQuizForClient(quiz)
  const keys = extractAnswerKeys(quiz)

  if (keys.some((k) => k < 0)) {
    return NextResponse.json({ success: false, error: 'Every question must have a valid correct_index.' }, { status: 400, headers: noCacheHeaders })
  }

  const { data, error } = await supabase.rpc('qf_create_game', {
    p_game_id: gameId,
    p_quiz: sanitized,
    p_keys: keys,
    p_mode: mode,
    p_config: buildGameConfig()
  })

  if (error) {
    console.warn('[Quiz Game] create failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to create game.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({
    success: true,
    game: data,
    question_count: quiz.questions.length,
    note: 'Quiz stored sanitized; answer keys are server-only.'
  }, { headers: noCacheHeaders })
}
