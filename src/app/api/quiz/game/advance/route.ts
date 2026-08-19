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

const ACTIONS = ['start', 'next', 'reveal', 'leaderboard', 'end', 'pause', 'resume'] as const

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

  // Handle Pause & Resume directly via atomic config updates
  if (action === 'pause') {
    const { data: g } = await supabase.from('games').select('config, question_started_at, status').eq('id', gameId).maybeSingle()
    const prevConfig = g?.config || {}
    const now = Date.now()
    const startedAt = g?.question_started_at ? new Date(g.question_started_at).getTime() : now
    const elapsed = Math.max(0, now - startedAt)
    await supabase.from('games').update({
      config: {
        ...prevConfig,
        is_paused: true,
        paused_at: new Date(now).toISOString(),
        elapsed_before_pause_ms: elapsed
      }
    }).eq('id', gameId)
    return NextResponse.json({ success: true, game: { id: gameId, status: g?.status, is_paused: true } }, { headers: noCacheHeaders })
  }

  if (action === 'resume') {
    const { data: g } = await supabase.from('games').select('config, status').eq('id', gameId).maybeSingle()
    const prevConfig = g?.config || {}
    const elapsed = typeof prevConfig.elapsed_before_pause_ms === 'number' ? prevConfig.elapsed_before_pause_ms : 0
    const newStartedAt = new Date(Date.now() - elapsed).toISOString()
    await supabase.from('games').update({
      question_started_at: newStartedAt,
      config: {
        ...prevConfig,
        is_paused: false,
        paused_at: null,
        elapsed_before_pause_ms: 0
      }
    }).eq('id', gameId)
    return NextResponse.json({ success: true, game: { id: gameId, status: g?.status, is_paused: false } }, { headers: noCacheHeaders })
  }

  const { data, error } = await supabase.rpc('qf_advance_game', {
    p_game_id: gameId,
    p_action: action
  })

  if (error) {
    console.warn('[Quiz Advance] failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to advance game.' }, { status: 500, headers: noCacheHeaders })
  }

  // Reset pause state on new question/start
  if (action === 'start' || action === 'next') {
    try {
      const { data: curG } = await supabase.from('games').select('config').eq('id', gameId).maybeSingle()
      if (curG?.config?.is_paused) {
        await supabase.from('games').update({
          config: { ...curG.config, is_paused: false, paused_at: null, elapsed_before_pause_ms: 0 }
        }).eq('id', gameId)
      }
    } catch { /* best effort */ }
  }

  return NextResponse.json({ success: true, game: data }, { headers: noCacheHeaders })
}
