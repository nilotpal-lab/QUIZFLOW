import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import { noCacheHeaders } from '@/quizflow/liveplay'

/* ================================================================
   QuizFlow — Boss Finale Start (host-only)
   POST /api/quiz/boss/start  { game_id }

   Opens the server-owned 60-second, 10-question finale. The window
   and per-question pacing are entirely server-timed (qf_start_boss
   stamps boss_window_ends_at and the qf_apply_answer RPC advances
   the shared question). The client only renders a countdown it's
   told — it never runs an authoritative timer.
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function POST(req: Request) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — host session required.' }, { status: 401, headers: noCacheHeaders })
  }

  let body: { game_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const gameId = typeof body?.game_id === 'string' ? body.game_id.trim().toUpperCase() : ''
  if (!gameId) {
    return NextResponse.json({ success: false, error: 'game_id is required' }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data, error } = await supabase.rpc('qf_start_boss', { p_game_id: gameId })

  if (error) {
    console.warn('[Boss Start] RPC failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to start boss mode.' }, { status: 500, headers: noCacheHeaders })
  }

  const result = Array.isArray(data) ? data[0] : data
  if (!result || !result.ok) {
    return NextResponse.json({ success: false, error: `Failed to start boss mode: ${result?.reason || 'unknown'}` }, { status: 409, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true, boss: result }, { headers: noCacheHeaders })
}
