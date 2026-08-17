import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'

/* ================================================================
   QuizFlow — Day-of Gate Config (host-only write)
   POST /api/admin/event-config  { login_open?, opens_at?, closes_at? }
   Save the student-login gate: manual toggle + optional schedule.
   Empty strings are normalized to null (schedule cleared).
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

export async function POST(req: Request) {
  const host = await getAuthenticatedHost(req)
  if (!host) {
    return NextResponse.json({ success: false, error: 'Unauthorized — admin session required.' }, { status: 401, headers: noCacheHeaders })
  }

  let body: { login_open?: unknown; opens_at?: unknown; closes_at?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const patch: Record<string, unknown> = {}

  if (typeof body?.login_open === 'boolean') {
    patch.login_open = body.login_open
  }
  const opensAt = typeof body?.opens_at === 'string' && body.opens_at.trim()
    ? body.opens_at.trim()
    : null
  const closesAt = typeof body?.closes_at === 'string' && body.closes_at.trim()
    ? body.closes_at.trim()
    : null

  if (opensAt !== null || typeof body?.opens_at === 'string') patch.opens_at = opensAt
  if (closesAt !== null || typeof body?.closes_at === 'string') patch.closes_at = closesAt

  patch.updated_at = new Date().toISOString()

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data, error } = await supabase
    .from('event_config')
    .upsert({ id: 1, ...patch }, { onConflict: 'id' })
    .select()
    .maybeSingle()

  if (error) {
    console.warn('[Admin Event Config] save failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to save event settings.' }, { status: 500, headers: noCacheHeaders })
  }

  return NextResponse.json({
    success: true,
    config: data ? {
      login_open: Boolean(data.login_open),
      opens_at: data.opens_at,
      closes_at: data.closes_at
    } : null
  }, { headers: noCacheHeaders })
}
