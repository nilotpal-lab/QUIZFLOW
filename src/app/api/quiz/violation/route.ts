import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from '@/quizflow/authToken'
import { noCacheHeaders } from '@/quizflow/liveplay'

/* ================================================================
   QuizFlow — Anti-Cheat Violation Report (soft mode)
   POST /api/quiz/violation  { reason }

   SOFT enforcement (team decision): violations are counted and made
   visible to the host (leaderboard/state), but answers are never
   blocked. The real security boundary is that correct answers are
   never in any client payload before reveal — the client-side
   fullscreen/devtools guards are deterrents, not the boundary.
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

  let body: { reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 200) : 'unknown'

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data: session, error: sessionError } = await supabase
    .from('quiz_sessions')
    .select('id')
    .eq('team_id', claims.team_id)
    .maybeSingle()

  if (sessionError || !session) {
    return NextResponse.json({ success: false, error: 'No game session for this team.' }, { status: 404, headers: noCacheHeaders })
  }

  const { data, error } = await supabase.rpc('qf_report_violation', {
    p_session_id: session.id
  })

  if (error) {
    console.warn('[Violation] RPC failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to record violation.' }, { status: 500, headers: noCacheHeaders })
  }

  const result = Array.isArray(data) ? data[0] : data

  return NextResponse.json({
    success: true,
    reason,
    violation_count: result?.violation_count ?? 0
  }, { headers: noCacheHeaders })
}
