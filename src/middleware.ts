import { NextResponse, type NextRequest } from 'next/server'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from './quizflow/authToken'

/* ================================================================
   QuizFlow — Route Protection Middleware (Edge runtime)

   Gates the session-protected pages behind a valid qf_session cookie
   (set by POST /api/teams/claim or POST /api/student/login). Requests
   without a session are redirected to the right login screen with the
   intended destination preserved for post-login return:
     * /quizflow/student/*        → /quizflow/student/login (credential login)
     * everything else gated      → /quizflow/join (classic PIN join)

   Exemptions (no session required):
   - /quizflow/host/* — legacy PIN host setup + dashboard.
   - /quizflow/play?pin&pid&nickname — classic students already routed
     with full join context.
   - /quizflow/student/login — hosts the day-of gate screens.

   Admin API routes are NOT gated here — they enforce their own
   Supabase host-session auth inside each handler.
   ================================================================ */

/** Classic PIN + nickname room mode — no team session required. */
function isLegacyRoomRequest(req: NextRequest): boolean {
  const { pathname, searchParams } = req.nextUrl

  // Host setup pages + the PIN-driven host dashboard are legacy room mode.
  if (pathname.startsWith('/quizflow/host')) {
    return true
  }

  // Classic students are routed here by the lobby with full join context.
  if (pathname.startsWith('/quizflow/play')) {
    const pin = searchParams.get('pin')
    return Boolean(pin && searchParams.get('pid') && searchParams.get('nickname'))
  }

  return false
}

export async function middleware(req: NextRequest) {
  // Hard opt-out for local demos / flows that never use the team login.
  // Gate is ON by default.
  if (process.env.QUIZFLOW_DISABLE_SESSION_GATE === '1') {
    return NextResponse.next()
  }

  const token = getSessionTokenFromRequest(req)
  const claims = token ? await verifySessionToken(token) : null

  if (claims) {
    return NextResponse.next()
  }

  // Legacy PIN + nickname room mode keeps working without a team session.
  if (isLegacyRoomRequest(req)) {
    return NextResponse.next()
  }

  // The student login page itself must be reachable without a session
  // (it also hosts the day-of gate screens).
  if (req.nextUrl.pathname === '/quizflow/student/login') {
    return NextResponse.next()
  }

  const target = req.nextUrl.clone()
  // Student pages bounce to the credential login; everything else keeps
  // the classic PIN join.
  target.pathname = req.nextUrl.pathname.startsWith('/quizflow/student')
    ? '/quizflow/student/login'
    : '/quizflow/join'
  // Preserve where the user was headed so the login flow can bounce back.
  target.search = new URLSearchParams({
    next: req.nextUrl.pathname + req.nextUrl.search
  }).toString()

  return NextResponse.redirect(target)
}

export const config = {
  matcher: ['/quizflow/play/:path*', '/quizflow/host/:path*', '/quizflow/student/:path*']
}
