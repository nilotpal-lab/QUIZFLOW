import { NextResponse } from 'next/server'
import { getServerSupabase, getAuthenticatedHost } from '@/quizflow/serverSupabase'
import { createTeamRecord } from '@/quizflow/teamFactory'

/* ================================================================
   QuizFlow — Admin Bulk Team Creation (Excel/CSV upload)
   POST /api/admin/teams/bulk  { teams: [{ name, roster?: string[] }] }
   Creates many teams at once, continuing past individual failures so
   one bad row never blocks the whole import. Credentials per team:
   username = team name, password = first roster member (leader). Each
   plaintext password is returned once (day-of handout).
   Gated behind the same admin auth as /api/admin/teams.
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

  let body: { teams?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const rawTeams = Array.isArray(body?.teams) ? body.teams : []
  if (rawTeams.length === 0) {
    return NextResponse.json({ success: false, error: 'At least one team is required.' }, { status: 400, headers: noCacheHeaders })
  }
  if (rawTeams.length > 500) {
    return NextResponse.json({ success: false, error: 'Maximum 500 teams per upload.' }, { status: 400, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const created: any[] = []
  const failed: { name: string; error: string }[] = []

  for (const raw of rawTeams as any[]) {
    const name = typeof raw?.name === 'string' ? raw.name.trim() : ''
    if (!name || name.length > 80) {
      failed.push({ name: name || '(missing name)', error: 'A team name (≤80 chars) is required.' })
      continue
    }

    const roster = (Array.isArray(raw?.roster) ? raw.roster : [])
      .filter((r: any): r is string => typeof r === 'string' && r.trim().length > 0)
      .map((r: string) => r.trim())
      .slice(0, 8)

    try {
      created.push(await createTeamRecord(supabase, name, roster))
    } catch (err: any) {
      console.warn(`[Admin Teams Bulk] Failed to create "${name}":`, err?.message)
      failed.push({ name, error: err?.message || 'Failed to create team.' })
    }
  }

  return NextResponse.json({
    success: true,
    createdCount: created.length,
    failedCount: failed.length,
    created,
    failed
  }, { headers: noCacheHeaders })
}
