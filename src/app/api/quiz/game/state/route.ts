import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from '@/quizflow/authToken'
import {
  noCacheHeaders,
  type LiveGameStatus,
  resolveQuestionCorrectIndex
} from '@/quizflow/liveplay'

/* ================================================================
   QuizFlow — Live Game State (team-facing)
   GET /api/quiz/game/state

   Returns the game status, the active question (from the SANITIZED
   games.quiz — correct_index is absent until reveal), the server-
   stamped question timing, and the team's own live stats.
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

function getToken(req: Request): string | null {
  const cookie = getSessionTokenFromRequest(req)
  if (cookie) return cookie
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

export async function GET(req: Request) {
  const token = getToken(req)
  const claims = token ? await verifySessionToken(token) : null
  if (!claims) {
    return NextResponse.json({ success: false, error: 'Unauthorized — no valid session.' }, { status: 401, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  // 0. Verify device binding: if team was released by admin or bound to another device, revoke access
  const { data: teamRow } = await supabase
    .from('teams')
    .select('id, device_id')
    .eq('id', claims.team_id)
    .maybeSingle()

  if (teamRow && teamRow.device_id && claims.device_id && teamRow.device_id !== claims.device_id) {
    return NextResponse.json(
      { success: false, error: 'Device binding has been claimed on another device. Please log in again.' },
      { status: 401, headers: noCacheHeaders }
    )
  }

  // 1. Resolve active game ID — only live (non-ended) games
  const { data: activeGames } = await supabase
    .from('games')
    .select('id, status')
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)

  // No active game at all → return 404 so student is redirected out of lobby
  if (!activeGames || activeGames.length === 0) {
    return NextResponse.json({ success: false, error: 'No active game.' }, { status: 404, headers: noCacheHeaders })
  }

  const activeGameId = activeGames[0].id

  // 2. Fetch student's session row for this team in the active game
  let { data: session } = await supabase
    .from('quiz_sessions')
    .select('id, game_id, points, coins, streak, max_streak, total_correct, total_answered, last_answered_question_index, frozen_until, bid_multiplier, frenzy_correct_count, violation_count')
    .eq('team_id', claims.team_id)
    .eq('game_id', activeGameId)
    .maybeSingle()

  // 3. If session is missing for active game, create one gracefully (carry coins/points from prev session)
  if (!session) {
    const { data: prevSession } = await supabase
      .from('quiz_sessions')
      .select('id, game_id, points, coins, streak, max_streak, total_correct, total_answered, last_answered_question_index, frozen_until, bid_multiplier, frenzy_correct_count, violation_count')
      .eq('team_id', claims.team_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sessToken = 'sess_' + claims.team_id
    const { data: newSession } = await supabase
      .from('quiz_sessions')
      .upsert({
        team_id: claims.team_id,
        game_id: activeGameId,
        token: sessToken,
        points: prevSession?.points || 0,
        coins: prevSession?.coins || 0,
        streak: prevSession?.streak || 0,
        max_streak: prevSession?.max_streak || 0,
        total_correct: prevSession?.total_correct || 0,
        total_answered: prevSession?.total_answered || 0,
        total_response_time_ms: 0,
        last_answered_question_index: -1
      }, { onConflict: 'token' })
      .select('id, game_id, points, coins, streak, max_streak, total_correct, total_answered, last_answered_question_index, frozen_until, bid_multiplier, frenzy_correct_count, violation_count')
      .maybeSingle()

    session = newSession || prevSession
  }

  const effectiveSession = session || {
    id: 'temp_' + claims.team_id,
    game_id: activeGameId,
    points: 0,
    coins: 0,
    streak: 0,
    max_streak: 0,
    total_correct: 0,
    total_answered: 0,
    last_answered_question_index: -1,
    frozen_until: null,
    bid_multiplier: 1,
    frenzy_correct_count: 0,
    violation_count: 0
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, mode, status, quiz, config, current_question_index, question_started_at, boss_question_index, boss_window_ends_at')
    .eq('id', effectiveSession.game_id)
    .maybeSingle()

  if (gameError || !game) {
    return NextResponse.json({ success: false, error: 'Game not found.' }, { status: 404, headers: noCacheHeaders })
  }

  // Safety: if this specific game is ended, return 404 so student is redirected to dashboard
  if (game.status === 'ended') {
    return NextResponse.json({ success: false, error: 'Game has ended.' }, { status: 404, headers: noCacheHeaders })
  }

  const status = game.status as LiveGameStatus
  const isBoss = status === 'boss_frenzy'
  const questionIndex = isBoss ? game.boss_question_index : game.current_question_index

  let question: any = null
  const questions: any[] = Array.isArray(game.quiz?.questions) ? game.quiz.questions : []
  if (questionIndex >= 0 && questions.length > 0) {
    const idx = isBoss ? questionIndex % questions.length : questionIndex
    question = questions[idx]
  }

  // Reveal-phase: only include the correct answer once revealed.
  const canReveal = status === 'question_reveal' || status === 'ended'
  let correctIndex: number | undefined
  if (canReveal && question) {
    const keyIdx = isBoss ? questionIndex % questions.length : questionIndex
    const { data: keyData } = await supabase.rpc('qf_get_answer_key', {
      p_game_id: game.id,
      p_question_index: keyIdx
    })
    const keyRow = Array.isArray(keyData) ? keyData[0] : keyData
    const dbKey = typeof keyRow?.correct_index === 'number' ? keyRow.correct_index : (typeof keyData === 'number' ? keyData : undefined)
    const resolvedKey = resolveQuestionCorrectIndex(question)
    correctIndex = question.explanation ? resolvedKey : (typeof dbKey === 'number' ? dbKey : resolvedKey)
  }

  const activeQuestion = question ? {
    index: questionIndex,
    prompt: question.prompt,
    choices: question.choices,
    time_limit_ms: question.time_limit_ms,
    difficulty: question.difficulty,
    explanation: canReveal ? question.explanation : undefined,
    correct_index: correctIndex
  } : null

  return NextResponse.json({
    success: true,
    game: {
      id: game.id,
      mode: game.mode,
      status,
      question_started_at: game.question_started_at,
      boss_window_ends_at: game.boss_window_ends_at,
      question_count: questions.length,
      active_question: activeQuestion,
      is_paused: Boolean(game.config?.is_paused)
    },
    server_time: new Date().toISOString(),
    me: {
      team_id: claims.team_id,
      points: effectiveSession.points || 0,
      coins: effectiveSession.coins || 0,
      streak: effectiveSession.streak || 0,
      max_streak: effectiveSession.max_streak || 0,
      total_correct: effectiveSession.total_correct || 0,
      total_answered: effectiveSession.total_answered || 0,
      last_answered_question_index: effectiveSession.last_answered_question_index ?? -1,
      frozen_until: effectiveSession.frozen_until,
      bid_multiplier: (effectiveSession as any).bid_multiplier || 1,
      coin_multiplier: (effectiveSession as any).coin_multiplier || 1,
      frenzy_correct_count: effectiveSession.frenzy_correct_count || 0,
      violation_count: effectiveSession.violation_count || 0
    }
  }, { headers: noCacheHeaders })
}
