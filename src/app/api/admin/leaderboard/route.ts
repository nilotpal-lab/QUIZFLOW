import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import { noCacheHeaders } from '@/quizflow/liveplay'
import { fetchGameLeaderboard } from '@/quizflow/gameLeaderboard'

/* ================================================================
   QuizFlow — Host Leaderboard (debounced read)
   GET /api/admin/leaderboard?game_id=...

   The host dashboard polls this on a fixed 1–2s interval instead of
   the server pushing a recompute+broadcast on every answer — with
   ~150 teams answering together, per-answer broadcasts would be a
   storm. Ranking lives in the shared fetchGameLeaderboard helper
   (points desc → max_streak desc → total response time asc).
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
  const gameId = (url.searchParams.get('game_id') || '').trim().toUpperCase()
  if (!gameId) {
    return NextResponse.json({ success: false, error: 'game_id query param is required' }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const result = await fetchGameLeaderboard(supabase, gameId)

  if ('error' in result) {
    console.warn('[Leaderboard] read failed:', result.error.message)
    return NextResponse.json({ success: false, error: 'Failed to load leaderboard.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true, count: result.count, leaderboard: result.leaderboard }, { headers: noCacheHeaders })
}
