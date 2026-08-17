import { NextResponse } from 'next/server'
import { signAdminToken, ADMIN_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/quizflow/authToken'
import { verifyAdminCredential } from '@/quizflow/adminCredentials'

/* ================================================================
   QuizFlow — Local Admin Session
   POST /api/admin/session  { name, password }
   Verifies a name+password against the local admin registry
   (adminCredentials.ts) and issues a signed, httpOnly `qf_admin`
   cookie. The admin API routes accept this cookie via
   getAuthenticatedHost, so the local admin can use the event tools
   without a Supabase account.
   ================================================================ */

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: { name?: unknown; password?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  const cred = verifyAdminCredential(name, password)
  if (!cred) {
    return NextResponse.json({ success: false, error: 'Invalid admin name or password.' }, { status: 401 })
  }

  const token = await signAdminToken(cred.name)

  const res = NextResponse.json({
    success: true,
    name: cred.name,
    school: cred.school || ''
  })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS
  })
  return res
}
