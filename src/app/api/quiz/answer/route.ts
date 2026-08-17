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

  // Resolve the team's session row (and therefore its game).
  const { data: session, error: sessionError } = await supabase
    .from('quiz_sessions')
    .select('id, game_id')
    .eq('team_id', claims.team_id)
    .maybeSingle()

  if (sessionError || !session) {
    return NextResponse.json({ success: false, error: 'No game session for this team.' }, { status: 404, headers: noCacheHeaders })
  }
  if (!session.game_id) {
    return NextResponse.json({ success: false, error: 'Team is not registered to a live game.' }, { status: 409, headers: noCacheHeaders })
  }

  // The ACTIVE question index is server-authoritative. Normal rounds
  // use current_question_index; the boss finale uses the frenzy slot.
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('status, current_question_index, boss_question_index')
    .eq('id', session.game_id)
    .maybeSingle()

  if (gameError || !game) {
    return NextResponse.json({ success: false, error: 'Game not found.' }, { status: 404, headers: noCacheHeaders })
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

  // NEVER echo the correct answer id — even during reveal.
  // client_elapsed_ms was accepted but ignored for scoring (the RPC
  // recomputed elapsed from the server-stamped question start).
  return NextResponse.json({
    success: row.reason === 'ok',
    correct: row.correct,
    points_earned: row.points_delta,
    coins_earned: row.coin_delta,
    reason: row.reason
  }, { headers: noCacheHeaders })
}
