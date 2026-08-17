import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'

/* ================================================================
   QuizFlow — Admin Team Delete
   DELETE /api/admin/teams/:id
   Removes a team. quiz_sessions rows cascade via the FK (they are
   keyed to team_id with on delete — see the team migration).
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

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
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

  const { error } = await supabase.from('teams').delete().eq('id', id)

  if (error) {
    console.warn('[Admin Teams] Delete failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to delete team.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({ success: true }, { headers: noCacheHeaders })
}
