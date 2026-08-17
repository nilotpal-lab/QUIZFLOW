import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken
} from '@/quizflow/authToken'

/* ================================================================
   QuizFlow — Team Claim Endpoint (Race-safe single-device login)
   POST { code, member_name, device_id }

   The claim is a SINGLE conditional UPDATE ... WHERE code = ? AND
   claimed_by IS NULL, so concurrent claims at go-live resolve
   atomically in Postgres: exactly one device wins the team, the
   rest get a 409 with the winning member's name.

   Reconnect: if the claiming device_id already owns the team
   (page refresh), the request is treated as a successful resume.
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/* ── Per-IP rate limiting (in-memory, matches room-relay pattern) ── */
declare global {
  // eslint-disable-next-line no-var
  var __qf_claim_limits: Map<string, { count: number; resetAt: number }> | undefined
}

if (!global.__qf_claim_limits) global.__qf_claim_limits = new Map()

const RATE_WINDOW_MS = 10_000
const RATE_MAX = 20 // requests per IP per window

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function rateLimited(ip: string): boolean {
  const limits = global.__qf_claim_limits!
  const now = Date.now()
  const entry = limits.get(ip)
  if (!entry || entry.resetAt <= now) {
    limits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count += 1
  if (entry.count > RATE_MAX) return true
  return false
}

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0'
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    if (rateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please wait a moment and try again.' },
        { status: 429, headers: noCacheHeaders }
      )
    }

    let body: { code?: unknown; member_name?: unknown; device_id?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
    }

    const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
    const memberName = typeof body?.member_name === 'string' ? body.member_name.trim() : ''
    const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : ''

    if (!code) {
      return NextResponse.json({ success: false, error: 'Team code is required' }, { status: 400, headers: noCacheHeaders })
    }
    if (!memberName || memberName.length > 50) {
      return NextResponse.json({ success: false, error: 'A member name (≤50 chars) is required' }, { status: 400, headers: noCacheHeaders })
    }
    if (!deviceId || deviceId.length > 200) {
      return NextResponse.json({ success: false, error: 'A device id is required' }, { status: 400, headers: noCacheHeaders })
    }

    const supabase = getServerSupabase()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured — the teams database is unavailable.' },
        { status: 503, headers: noCacheHeaders }
      )
    }

    // ── Atomic claim: single conditional UPDATE ──────────────────
    // UPDATE teams SET claimed_by = $1, device_id = $2, claimed_at = now(),
    //        status = 'claimed' WHERE code = $3 AND claimed_by IS NULL RETURNING *;
    const { data: claimedRows, error: claimError } = await supabase
      .from('teams')
      .update({
        claimed_by: memberName,
        device_id: deviceId,
        claimed_at: new Date().toISOString(),
        status: 'claimed'
      })
      .eq('code', code)
      .is('claimed_by', null)
      .select()

    if (claimError) {
      console.warn('[Team Claim] Update failed:', claimError.message)
      return NextResponse.json({ success: false, error: 'Claim failed on the server.' }, { status: 500, headers: noCacheHeaders })
    }

    // Won the claim
    if (claimedRows && claimedRows.length === 1) {
      return await issueSession(req, claimedRows[0], memberName, deviceId, false)
    }

    // 0 rows updated → either already claimed, or the code doesn't exist.
    const { data: existing, error: lookupError } = await supabase
      .from('teams')
      .select('*')
      .eq('code', code)
      .maybeSingle()

    if (lookupError || !existing) {
      return NextResponse.json(
        { success: false, error: `No team found with code ${code}.` },
        { status: 404, headers: noCacheHeaders }
      )
    }

    // Reconnect: same device refreshing — treat as successful resume.
    if (existing.device_id && existing.device_id === deviceId) {
      return await issueSession(req, existing, existing.claimed_by || memberName, deviceId, true)
    }

    // Someone else claimed first → tell the UI who.
    return NextResponse.json(
      {
        success: false,
        error: `Already claimed by ${existing.claimed_by || 'another member'}`,
        claimed_by: existing.claimed_by || null
      },
      { status: 409, headers: noCacheHeaders }
    )
  } catch (err: any) {
    console.error('[Team Claim] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Failed to claim team.' }, { status: 500, headers: noCacheHeaders })
  }
}

/** Sign a session token, set the httpOnly cookie, and return the payload. */
async function issueSession(
  req: Request,
  team: any,
  memberName: string,
  deviceId: string,
  reconnect: boolean
) {
  const token = await signSessionToken({
    team_id: team.id,
    member_name: memberName,
    device_id: deviceId
  })

  const res = NextResponse.json({
    success: true,
    reconnect,
    token,
    team: {
      id: team.id,
      name: team.name,
      code: team.code,
      roster: team.roster,
      status: team.status,
      claimed_by: team.claimed_by || memberName
    }
  }, { headers: noCacheHeaders })

  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS
  })

  return res
}
