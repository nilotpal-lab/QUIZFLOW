import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import { hashPassword } from '@/quizflow/credentials'

/* ================================================================
   QuizFlow — Admin Team Password Reset
   POST /api/admin/teams/:id/reset-password
   Re-issues the team's credential: username is the team name and the
   password is the team leader's name (first roster member) — matching
   how credentials are generated at creation. PBKDF2-hashed server-side;
   the plaintext is returned once in the response for handout.
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — admin session required.' }, { status: 401, headers: noCacheHeaders })
  }

  const id = params?.id || ''
  if (!id) {
    return NextResponse.json({ success: false, error: 'Team id is required' }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data: team, error: findError } = await supabase
    .from('teams')
    .select('id, username, name, roster')
    .eq('id', id)
    .maybeSingle()

  if (findError || !team) {
    return NextResponse.json({ success: false, error: 'Team not found.' }, { status: 404, headers: noCacheHeaders })
  }

  const roster = Array.isArray(team.roster) ? team.roster : []
  // Username is the team name; the password is the leader's name (first
  // roster member), falling back to the team name when no roster exists.
  const password = (roster[0] || team.name || team.username || '').trim()
  const { salt, hash } = await hashPassword(password)

  const { error } = await supabase
    .from('teams')
    .update({ password_salt: salt, password_hash: hash, password_updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.warn('[Admin Reset Password] failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to reset password.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({
    success: true,
    team_id: id,
    // Plaintext returned exactly once.
    credentials: { username: team.username, password }
  }, { headers: noCacheHeaders })
}
