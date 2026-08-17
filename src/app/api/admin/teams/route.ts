import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import { createTeamRecord } from '@/quizflow/teamFactory'

/* ================================================================
   QuizFlow — Admin Team Registry
   GET  /api/admin/teams
   Lists every team with its claim/status for the admin dashboard.

   POST /api/admin/teams  { name, roster?: string[] }
   Creates a team and generates its credentials: unique team code,
   username = team name, password = team leader's name (first roster
   member) — PBKDF2-hashed server-side; the plaintext is returned ONCE
   in the response for day-of handout).
   Gated behind a valid Supabase admin session (Bearer token) — the
   app's existing host/admin auth.
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
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — admin session required.' }, { status: 401, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data: teams, error } = await supabase
    .from('teams')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[Admin Teams] List failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to load teams.' }, { status: 500, headers: noCacheHeaders })
  }

  // Never leak password hashes to the UI payload — strip them.
  const safe = (teams || []).map(({ password_hash, password_salt, ...t }: any) => t)
  return NextResponse.json({ success: true, count: safe.length, teams: safe }, { headers: noCacheHeaders })
}

export async function POST(req: Request) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — admin session required.' }, { status: 401, headers: noCacheHeaders })
  }

  let body: { name?: unknown; roster?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 80) {
    return NextResponse.json({ success: false, error: 'A team name (≤80 chars) is required' }, { status: 400, headers: noCacheHeaders })
  }

  const rawRoster = Array.isArray(body?.roster) ? body.roster : []
  const roster = rawRoster
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((r) => r.trim())
    .slice(0, 8)

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  try {
    const result = await createTeamRecord(supabase, name, roster)
    return NextResponse.json({
      success: true,
      team: result.team,
      // Plaintext password is returned exactly once — save it for day-of handout.
      credentials: result.credentials
    }, { headers: noCacheHeaders })
  } catch (err: any) {
    console.error('[Admin Teams] Create error:', err)
    return NextResponse.json({ success: false, error: err?.message || 'Failed to create team.' }, { status: 500, headers: noCacheHeaders })
  }
}
