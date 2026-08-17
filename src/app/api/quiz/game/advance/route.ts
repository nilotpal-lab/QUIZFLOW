import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import { noCacheHeaders } from '@/quizflow/liveplay'

/* ================================================================
   QuizFlow — Question Pacing (host-only)
   POST /api/quiz/game/advance  { game_id, action }

   action: start | next | reveal | leaderboard | end
   The question-start timestamp is stamped server-side by the RPC;
   the client never supplies timing. `reveal` flips status to
   question_reveal — this is the ONLY moment the correct answer may
   be shown (the client reads it from game state at that status).
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const ACTIONS = ['start', 'next', 'reveal', 'leaderboard', 'end'] as const

export async function POST(req: Request) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — host session required.' }, { status: 401, headers: noCacheHeaders })
  }

  let body: { game_id?: unknown; action?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const gameId = typeof body?.game_id === 'string' ? body.game_id.trim().toUpperCase() : ''
  const action = typeof body?.action === 'string' ? body.action : ''

  if (!gameId) {
    return NextResponse.json({ success: false, error: 'game_id is required' }, { status: 400, headers: noCacheHeaders })
  }
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ success: false, error: `action must be one of: ${ACTIONS.join(', ')}` }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data, error } = await supabase.rpc('qf_advance_game', {
    p_game_id: gameId,
    p_action: action
  })

  if (error) {
    console.warn('[Quiz Advance] failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to advance game.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true, game: data }, { headers: noCacheHeaders })
}
