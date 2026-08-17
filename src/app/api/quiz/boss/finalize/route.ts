import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import { noCacheHeaders } from '@/quizflow/liveplay'

/* ================================================================
   QuizFlow — Boss Finale Finalize (host-only)
   POST /api/quiz/boss/finalize  { game_id }

   Ranks teams by correct answers in the boss window (ties broken by
   cumulative frenzy response time), awards per-correct points + the
   rank bonus from the game config, and flips the game to ended.
   Idempotent — qf_finalize_boss only awards once (boss_bonus_awarded
   guard). The same function is also triggered lazily inside
   qf_apply_answer when the window expires, so a host call here is a
   belt-and-braces, not a requirement.
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

  const { data, error } = await supabase.rpc('qf_finalize_boss', { p_game_id: gameId })

  if (error) {
    console.warn('[Boss Finalize] RPC failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to finalize boss mode.' }, { status: 500, headers: noCacheHeaders })
  }

  const result = Array.isArray(data) ? data[0] : data

  if (!result || !result.ok) {
    const already = result?.reason === 'already_finalized'
    return NextResponse.json(
      { success: false, error: already ? 'Boss mode was already finalized.' : 'Failed to finalize boss mode.' },
      { status: already ? 409 : 500, headers: noCacheHeaders }
    )
  }

  return NextResponse.json({ success: true, finalize: result }, { headers: noCacheHeaders })
}
