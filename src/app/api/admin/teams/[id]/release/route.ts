import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'

/* ================================================================
   QuizFlow — Admin Team Release Override
   POST /api/admin/teams/[id]/release
   Clears claimed_by / device_id / claimed_at so a teammate can
   reclaim if the original device fails. Host-only: requires a
   valid Supabase host session (Bearer token).
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

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — host session required.' }, { status: 401, headers: noCacheHeaders })
  }

  const teamId = params?.id?.trim()
  if (!teamId) {
    return NextResponse.json({ success: false, error: 'Team id is required.' }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data: team, error } = await supabase
    .from('teams')
    .update({
      claimed_by: null,
      device_id: null,
      claimed_at: null,
      status: 'waiting'
    })
    .eq('id', teamId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ success: false, error: 'Team not found.' }, { status: 404, headers: noCacheHeaders })
    }
    console.warn('[Admin Release] Failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to release team.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true, team }, { headers: noCacheHeaders })
}
