import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from '@/quizflow/authToken'

/* ================================================================
   QuizFlow — Session Self-Inspection
   GET /api/session/me
   Validates the httpOnly team session cookie and returns the
   current team + quiz session state. 401 if invalid/expired.
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0'
}

export async function GET(req: Request) {
  const token = getSessionTokenFromRequest(req)
  const claims = token ? await verifySessionToken(token) : null
  if (!claims) {
    return NextResponse.json({ success: false, error: 'Unauthorized — no valid session.' }, { status: 401, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('id', claims.team_id)
    .maybeSingle()

  // Team no longer exists → session is invalid.
  if (teamError || !team) {
    return NextResponse.json({ success: false, error: 'Session invalid — team not found.' }, { status: 401, headers: noCacheHeaders })
  }

  const { data: quizSession, error: sessionError } = await supabase
    .from('quiz_sessions')
    .select('*')
    .eq('team_id', claims.team_id)
    .maybeSingle()

  if (sessionError) {
    console.warn('[Session Me] quiz_session lookup failed:', sessionError.message)
  }

  return NextResponse.json({
    success: true,
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
      roster: team.roster,
      status: team.status,
      claimed_by: team.claimed_by,
      device_id: team.device_id,
      claimed_at: team.claimed_at
    },
    member_name: claims.member_name,
    session: quizSession || null
  }, { headers: noCacheHeaders })
}
