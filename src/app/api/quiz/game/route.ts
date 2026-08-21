import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import {
  sanitizeQuizForClient,
  extractAnswerKeys,
  buildGameConfig,
  noCacheHeaders,
  resolveQuestionCorrectIndex
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
    ? game.quiz.questions.map((q: any, idx: number) => {
        const resolved = resolveQuestionCorrectIndex(q)
        const dbKey = keyMap.get(idx)
        const keyIdx = q.explanation ? resolved : (typeof dbKey === 'number' ? dbKey : resolved)
        return {
          ...q,
          correct_index: keyIdx
        }
      })
    : []

  const hostGame = {
    ...game,
    is_paused: Boolean(game.config?.is_paused),
    quiz: {
      ...(game.quiz || {}),
      questions: fullQuestions
    }
  }

  // 3. Count total registered teams and presence status
  const { data: allTeams } = await supabase
    .from('teams')
    .select('id, name, code, status, device_id, roster, claimed_by')
    .order('created_at', { ascending: true })

  const totalRegistered = allTeams?.length || 0
  const claimedCount = (allTeams || []).filter(t => t.device_id !== null || t.status === 'claimed').length

  // 4. Fetch live student sessions with unified rank ordering
  const { data: sessionRows } = await supabase
    .from('quiz_sessions')
    .select('team_id, points, coins, streak, max_streak, total_correct, total_answered, last_answered_question_index, total_response_time_ms, frenzy_correct_count, violation_count, teams(name, code, status, device_id, roster, claimed_by)')
    .eq('game_id', gameId)
    .order('points', { ascending: false })
    .order('max_streak', { ascending: false })
    .order('total_response_time_ms', { ascending: true })

  const currentQIdx = game.current_question_index ?? -1
  
  // Build team map from allTeams for guaranteed O(1) metadata
  const teamMap = new Map((allTeams || []).map(t => [t.id, t]))

  // Include all participating teams with active device binding or recorded session activity
  const liveSessionRows = (sessionRows || []).filter((s: any) => {
    const t = teamMap.get(s.team_id)
    const hasDevice = Boolean(t?.device_id || t?.claimed_by || t?.status === 'claimed')
    const hasActivity = (s.points > 0 || s.total_answered > 0 || s.coins > 0)
    return Boolean(t && (hasDevice || hasActivity))
  })

  const teamsStatus = liveSessionRows.map((s: any, idx: number) => {
    const t = teamMap.get(s.team_id)
    return {
      rank: idx + 1,
      team_id: s.team_id,
      name: t?.name || t?.code || 'Team',
      code: t?.code || '',
      roster: t?.roster || null,
      points: s.points || 0,
      coins: s.coins || 0,
      streak: s.streak || 0,
      max_streak: s.max_streak || 0,
      total_correct: s.total_correct || 0,
      total_answered: s.total_answered || 0,
      total_response_time_ms: s.total_response_time_ms || 0,
      frenzy_correct_count: s.frenzy_correct_count || 0,
      violation_count: s.violation_count || 0,
      device_id: t?.device_id || null,
      status: t?.status || 'active',
      has_answered: currentQIdx >= 0 ? (s.last_answered_question_index === currentQIdx) : false
    }
  })

  const answeredCount = teamsStatus.filter(t => t.has_answered).length
  const waitingTeams = teamsStatus.filter(t => !t.has_answered)
  
  // Identify registered teams who haven't logged in on a device / entered arena yet
  const arenaTeamIds = new Set(teamsStatus.map(t => t.team_id))
  const offlineTeams = (allTeams || [])
    .filter(t => !arenaTeamIds.has(t.id))
    .map(t => ({
      id: t.id,
      name: t.name,
      code: t.code,
      roster: t.roster,
      is_claimed: t.device_id !== null,
      device_id: t.device_id
    }))

  return NextResponse.json({
    success: true,
    game: hostGame,
    total_registered_teams: totalRegistered,
    claimed_teams_count: claimedCount,
    active_sessions_count: teamsStatus.length,
    answered_count: answeredCount,
    waiting_teams: waitingTeams,
    offline_teams: offlineTeams,
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

  // End any other active games so there is strictly 1 active game
  try {
    await supabase.from('games').update({ status: 'ended' }).neq('id', gameId).neq('status', 'ended')
  } catch (endErr) {
    console.warn('[Quiz Game] End previous games notice:', endErr)
  }

  // Clear previous sessions for this game
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

  // Purge pre-allocated phantom sessions for teams that are not yet bound/claimed on a device
  try {
    const { data: unclaimedTeams } = await supabase.from('teams').select('id').is('device_id', null)
    if (unclaimedTeams && unclaimedTeams.length > 0) {
      const unclaimedIds = unclaimedTeams.map(t => t.id)
      await supabase.from('quiz_sessions').delete().eq('game_id', gameId).in('team_id', unclaimedIds)
    }
  } catch (cleanUnclaimedErr) {
    console.warn('[Quiz Game] Clean unclaimed sessions notice:', cleanUnclaimedErr)
  }

  // Automatically ungate student logins in event_config
  try {
    await supabase.from('event_config').upsert({
      id: 1,
      login_open: true,
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
    // 1. Delete dependent quiz sessions first
    await supabase.from('quiz_sessions').delete().eq('game_id', gameId)
    // 2. Delete answer keys
    await supabase.from('game_answer_keys').delete().eq('game_id', gameId)
    // 3. Delete the game itself
    await supabase.from('games').delete().eq('id', gameId)
    // 4. Reset gate in event_config
    await supabase.from('event_config').update({ login_open: false, updated_at: new Date().toISOString() }).eq('id', 1)
  } catch (err: any) {
    console.warn('[Quiz Game DELETE] Error clearing game:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Failed to clear game.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true, message: `Game ${gameId} cleared.` }, { headers: noCacheHeaders })
}
