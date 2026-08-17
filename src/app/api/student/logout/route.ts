import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/quizflow/authToken'

/* ================================================================
   QuizFlow — Student Logout
   POST /api/student/logout
   Clears the httpOnly qf_session cookie. The device binding on the
   team stays intact (only an admin release unbinds — prevents
   credential sharing on the day).
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

export async function POST() {
  const res = NextResponse.json({ success: true }, { headers: noCacheHeaders })
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0
  })
  return res
}
