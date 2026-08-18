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

export async function GET(req: Request) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — host session required.' }, { status: 401, headers: noCacheHeaders })
  }

  const url = new URL(req.url)
  const gameId = (url.searchParams.get('game_id') || 'EVENT').trim().toUpperCase()

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  // 1. Get Game Row
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle()

  if (gameErr) {
    return NextResponse.json({ success: false, error: 'Failed to fetch game.' }, { status: 500, headers: noCacheHeaders })
  }

  if (!game) {
    const { count: totalTeams } = await supabase.from('teams').select('id', { count: 'exact', head: true })
    return NextResponse.json({
      success: true,
      game: null,
      total_registered_teams: totalTeams || 0,
      active_sessions_count: 0,
      answered_count: 0,
      teams_status: []
    }, { headers: noCacheHeaders })
  }

  // 2. Attach correct_index to the host's quiz object from game_answer_keys
  const { data: keys } = await supabase
    .from('game_answer_keys')
    .select('question_index, correct_index')
    .eq('game_id', gameId)

  const keyMap = new Map<number, number>()
  if (Array.isArray(keys)) {
    for (const k of keys) {
      keyMap.set(k.question_index, k.correct_index)
    }
  }

  const fullQuestions = Array.isArray(game.quiz?.questions)
    ? game.quiz.questions.map((q: any, idx: number) => ({
        ...q,
        correct_index: keyMap.has(idx) ? keyMap.get(idx) : q.correct_index ?? 0
      }))
    : []

  const hostGame = {
    ...game,
    quiz: {
      ...(game.quiz || {}),
      questions: fullQuestions
    }
  }

  // 3. Count total registered teams
  const { count: totalTeams } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })

  // 4. Fetch live student sessions with submission radar status
  const { data: sessionRows } = await supabase
    .from('quiz_sessions')
    .select('team_id, points, coins, streak, total_answered, teams(name, code)')
    .eq('game_id', gameId)
    .order('points', { ascending: false })

  const currentQIdx = game.current_question_index ?? -1
  const teamsStatus = (sessionRows || []).map((s: any) => ({
    team_id: s.team_id,
    name: s.teams?.name || s.teams?.code || 'Team',
    code: s.teams?.code || '',
    points: s.points || 0,
    streak: s.streak || 0,
    has_answered: currentQIdx >= 0 ? (s.total_answered > currentQIdx) : false
  }))
  const answeredCount = teamsStatus.filter(t => t.has_answered).length

  return NextResponse.json({
    success: true,
    game: hostGame,
    total_registered_teams: totalTeams || 0,
    active_sessions_count: teamsStatus.length,
    answered_count: answeredCount,
    teams_status: teamsStatus
  }, { headers: noCacheHeaders })
}

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

  // Clear previous sessions for fresh game
  try {
    await supabase.from('quiz_sessions').delete().eq('game_id', gameId)
  } catch (cleanErr) {
    console.warn('[Quiz Game] Session clean notice:', cleanErr)
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

  // Automatically ungate student logins & set active_game_id in event_config
  try {
    await supabase.from('event_config').upsert({
      id: 1,
      login_open: true,
      active_game_id: gameId,
      updated_at: new Date().toISOString()
    })
  } catch (gateErr) {
    console.warn('[Quiz Game] Failed to auto-open event gate in event_config:', gateErr)
  }

  return NextResponse.json({
    success: true,
    game: data,
    question_count: quiz.questions.length,
    note: 'Quiz stored sanitized; answer keys are server-only. Student logins ungated automatically.'
  }, { headers: noCacheHeaders })
}

export async function DELETE(req: Request) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — host session required.' }, { status: 401, headers: noCacheHeaders })
  }

  const url = new URL(req.url)
  const gameId = (url.searchParams.get('game_id') || 'EVENT').trim().toUpperCase()

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  try {
    await supabase.from('games').delete().eq('id', gameId)
    await supabase.from('quiz_sessions').delete().eq('game_id', gameId)
    await supabase.from('game_answer_keys').delete().eq('game_id', gameId)
    await supabase.from('event_config').update({ active_game_id: null }).eq('id', 1)
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Failed to clear game.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true, message: `Game ${gameId} cleared.` }, { headers: noCacheHeaders })
}
