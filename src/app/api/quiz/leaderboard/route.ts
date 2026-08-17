import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from '@/quizflow/authToken'
import { noCacheHeaders } from '@/quizflow/liveplay'
import { fetchGameLeaderboard } from '@/quizflow/gameLeaderboard'

/* ================================================================
   QuizFlow — Live Leaderboard (team-facing read)
   GET /api/quiz/leaderboard?game_id=...

   Debounced read used by the student in-game standings ("leaderboard
   while answering") and the after-close standings screen. Same
   ranking as the admin leaderboard (points desc → max_streak desc →
   total response time asc) and the same safe payload — no answer
   keys, no correct indices. The game_id comes from the team's own
   quiz_sessions row when omitted.
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

  const url = new URL(req.url)
  let gameId = (url.searchParams.get('game_id') || '').trim().toUpperCase()

  if (!gameId) {
    const { data: session } = await supabase
      .from('quiz_sessions')
      .select('game_id')
      .eq('team_id', claims.team_id)
      .maybeSingle()
    gameId = session?.game_id || ''
  }

  if (!gameId) {
    return NextResponse.json({ success: false, error: 'game_id query param is required' }, { status: 400, headers: noCacheHeaders })
  }

  const result = await fetchGameLeaderboard(supabase, gameId)

  if ('error' in result) {
    console.warn('[Quiz Leaderboard] read failed:', result.error.message)
    return NextResponse.json({ success: false, error: 'Failed to load leaderboard.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true, game_id: gameId, count: result.count, leaderboard: result.leaderboard }, { headers: noCacheHeaders })
}
