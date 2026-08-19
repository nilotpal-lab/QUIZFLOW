import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from '@/quizflow/authToken'
import { noCacheHeaders } from '@/quizflow/liveplay'

/* ================================================================
   QuizFlow — Server-Authoritative Answer Submission
   POST /api/quiz/answer  { question_id?, selected_option, client_elapsed_ms? }

   The client only sends INTENT. Everything that matters is resolved
   server-side:
     * session token (httpOnly cookie / Bearer) → team → session row
     * the ACTIVE question index comes from the game row (server
       state), never from the client
     * the correct answer + difficulty come from the server-only
       `game_answer_keys` table via the SECURITY DEFINER qf_apply_answer
       RPC
     * elapsed time is recomputed from games.question_started_at —
       client_elapsed_ms is accepted but only logged (UX), never
       trusted for scoring

   Response NEVER contains the correct answer id — reveal happens
   through the existing reveal-phase mechanism (status flips to
   question_reveal and the client reads game state).
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

export async function POST(req: Request) {
  const token = getToken(req)
  const claims = token ? await verifySessionToken(token) : null
  if (!claims) {
    return NextResponse.json({ success: false, error: 'Unauthorized — no valid session.' }, { status: 401, headers: noCacheHeaders })
  }

  let body: { question_id?: unknown; question_index?: unknown; selected_option?: unknown; client_elapsed_ms?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const selectedOption = body?.selected_option
  if (typeof selectedOption !== 'number' || !Number.isInteger(selectedOption) || selectedOption < 0) {
    return NextResponse.json({ success: false, error: 'selected_option must be a non-negative integer' }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  // 1. Resolve active game ID directly from games table
  const { data: activeGames } = await supabase
    .from('games')
    .select('id')
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)

  const activeGameId = activeGames?.[0]?.id || 'EVENT'

  // 2. Resolve the team's session row via unique token index
  const sessToken = 'sess_' + claims.team_id
  let { data: session } = await supabase
    .from('quiz_sessions')
    .select('id, game_id, coins, bid_multiplier')
    .eq('token', sessToken)
    .maybeSingle()

  if (!session || session.game_id !== activeGameId) {
    const { data: newSession } = await supabase
      .from('quiz_sessions')
      .upsert({
        team_id: claims.team_id,
        game_id: activeGameId,
        token: sessToken,
        points: 0,
        coins: session?.coins || 0,
        streak: 0,
        max_streak: 0,
        total_correct: 0,
        total_answered: 0,
        total_response_time_ms: 0,
        last_answered_question_index: -1
      }, { onConflict: 'token' })
      .select('id, game_id, coins, bid_multiplier')
      .maybeSingle()

    if (newSession) session = newSession
  }

  if (!session || !session.game_id) {
    return NextResponse.json({ success: false, error: 'No game session for this team.' }, { status: 404, headers: noCacheHeaders })
  }

  // The ACTIVE question index is server-authoritative. Normal rounds
  // use current_question_index; the boss finale uses the frenzy slot.
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('status, current_question_index, boss_question_index, config')
    .eq('id', session.game_id)
    .maybeSingle()

  if (gameError || !game) {
    return NextResponse.json({ success: false, error: 'Game not found.' }, { status: 404, headers: noCacheHeaders })
  }

  // Reject answer submissions if the host has paused the game
  if (game.config?.is_paused) {
    return NextResponse.json({ success: false, error: 'Quiz is currently paused by the host.' }, { status: 409, headers: noCacheHeaders })
  }

  const questionIndex = game.status === 'boss_frenzy'
    ? game.boss_question_index
    : game.current_question_index

  if (typeof questionIndex !== 'number' || questionIndex < 0) {
    return NextResponse.json({ success: false, error: 'No active question.' }, { status: 409, headers: noCacheHeaders })
  }

  const { data, error } = await supabase.rpc('qf_apply_answer', {
    p_session_id: session.id,
    p_question_index: questionIndex,
    p_selected: selectedOption
  })

  if (error) {
    console.warn('[Quiz Answer] RPC failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to score answer.' }, { status: 500, headers: noCacheHeaders })
  }

  const row = Array.isArray(data) ? data[0] : data

  if (!row) {
    return NextResponse.json({ success: false, error: 'No scoring result.' }, { status: 500, headers: noCacheHeaders })
  }

  // Handle Multiplier Power-Up Bonus
  let finalCoinsEarned = row.coin_delta || 0
  const mult = (session as any).bid_multiplier || 1
  if (row.correct && mult > 1) {
    const extraCoins = finalCoinsEarned * (mult - 1)
    if (extraCoins > 0) {
      await supabase
        .from('quiz_sessions')
        .update({
          coins: (session.coins || 0) + finalCoinsEarned + extraCoins,
          bid_multiplier: 1
        })
        .eq('id', session.id)
      finalCoinsEarned += extraCoins
    }
  }

  // NEVER echo the correct answer id — even during reveal.
  // client_elapsed_ms was accepted but ignored for scoring (the RPC
  // recomputed elapsed from the server-stamped question start).
  return NextResponse.json({
    success: row.reason === 'ok',
    correct: row.correct,
    points_earned: row.points_delta,
    coins_earned: finalCoinsEarned,
    reason: row.reason
  }, { headers: noCacheHeaders })
}
