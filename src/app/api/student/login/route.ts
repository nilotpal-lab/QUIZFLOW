import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSessionToken
} from '@/quizflow/authToken'
import { verifyPassword } from '@/quizflow/credentials'
import { computeGateState, type EventConfig } from '@/quizflow/eventGate'

/* ================================================================
   QuizFlow — Student Login (team credential)
   POST /api/student/login  { username, password, device_id }

   Day-of gate first (admin toggle + optional schedule, see
   eventGate.ts). Then verify the team's PBKDF2 password, bind the
   device (one device per team — conditional UPDATE resolves races),
   and issue the httpOnly qf_session cookie (same infra as the
   legacy /api/teams/claim).

   Same-device re-login resumes (reconnect:true). A different device
   gets 409 — only an admin release clears the binding.
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/* ── Rate limiting: per-IP (burst) + per-username (brute force) ── */
declare global {
  // eslint-disable-next-line no-var
  var __qf_login_limits: Map<string, { count: number; resetAt: number }> | undefined
}

if (!global.__qf_login_limits) global.__qf_login_limits = new Map()

const RATE_WINDOW_MS = 10_000
const RATE_MAX_PER_IP = 100    // school-network stampede (150 teams on one IP)
const RATE_MAX_PER_USER = 8    // brute-force guard per username

function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

function rateLimited(key: string, max: number): boolean {
  const limits = global.__qf_login_limits!
  const now = Date.now()
  const entry = limits.get(key)
  if (!entry || entry.resetAt <= now) {
    limits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > max
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

    let body: { username?: unknown; password?: unknown; device_id?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
    }

    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password.trim() : ''
    const deviceId = typeof body?.device_id === 'string' ? body.device_id.trim() : ''

    if (!username) {
      return NextResponse.json({ success: false, error: 'Team username is required' }, { status: 400, headers: noCacheHeaders })
    }
    if (!password) {
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400, headers: noCacheHeaders })
    }
    if (!deviceId || deviceId.length > 200) {
      return NextResponse.json({ success: false, error: 'A device id is required' }, { status: 400, headers: noCacheHeaders })
    }

    if (rateLimited(`ip:${ip}`, RATE_MAX_PER_IP)) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Please wait a moment and try again.' },
        { status: 429, headers: noCacheHeaders }
      )
    }
    if (rateLimited(`user:${username}`, RATE_MAX_PER_USER)) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts for this team. Please wait a moment and try again.' },
        { status: 429, headers: noCacheHeaders }
      )
    }

    const supabase = getServerSupabase()
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Supabase is not configured — student login is unavailable.' },
        { status: 503, headers: noCacheHeaders }
      )
    }

    // ── Day-of gate ────────────────────────────────────────────────
    const { data: cfgRow, error: cfgError } = await supabase
      .from('event_config')
      .select('login_open, opens_at, closes_at')
      .eq('id', 1)
      .maybeSingle()

    if (cfgError) {
      console.warn('[Student Login] event_config read failed:', cfgError.message)
      return NextResponse.json({ success: false, error: 'Failed to check event status.' }, { status: 500, headers: noCacheHeaders })
    }

    const cfg: EventConfig | null = cfgRow
      ? { login_open: Boolean(cfgRow.login_open), opens_at: cfgRow.opens_at, closes_at: cfgRow.closes_at }
      : null

    const gateState = computeGateState(cfg)
    if (gateState !== 'open') {
      return NextResponse.json(
        {
          success: false,
          error: gateState === 'closed_after'
            ? 'The competition has ended. Login is closed.'
            : 'Student login is not open yet.',
          gate_state: gateState,
          config: cfg
        },
        { status: 403, headers: noCacheHeaders }
      )
    }

    // Check if an active, non-ended game currently exists
    const { data: activeGames } = await supabase
      .from('games')
      .select('id, status')
      .neq('status', 'ended')
      .order('created_at', { ascending: false })
      .limit(1)

    const activeGame = activeGames && activeGames.length > 0 ? activeGames[0] : null

    // ── Find the team by username ──────────────────────────────────
    // Usernames are the team name (e.g. "Phoenix Squad") while the input
    // is lowercased above — match case-insensitively so the exact team
    // name typed by the student always resolves.
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .ilike('username', username)
      .maybeSingle()

    if (teamError || !team) {
      return NextResponse.json({ success: false, error: 'Invalid team username or password.' }, { status: 401, headers: noCacheHeaders })
    }

    const ok = await verifyPassword(password, team.password_salt || '', team.password_hash || '')
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Invalid team username or password.' }, { status: 401, headers: noCacheHeaders })
    }

    // ── Device binding (race-safe, mirrors /api/teams/claim) ───────
    // Atomic claim: only succeeds when the team is currently unbound.
    // Concurrent logins from two devices resolve in Postgres — exactly
    // one wins the UPDATE.
    const claimUpdate = {
      device_id: deviceId,
      claimed_by: team.claimed_by || (Array.isArray(team.roster) && team.roster.length ? team.roster[0] : 'Team Member'),
      claimed_at: new Date().toISOString(),
      status: team.status === 'submitted' ? team.status : 'claimed'
    }

    const { data: boundRows, error: bindError } = await supabase
      .from('teams')
      .update(claimUpdate)
      .eq('id', team.id)
      .is('device_id', null)
      .select()

    if (bindError) {
      console.warn('[Student Login] device bind failed:', bindError.message)
      return NextResponse.json({ success: false, error: 'Login failed on the server.' }, { status: 500, headers: noCacheHeaders })
    }

    let bound = boundRows?.[0] ?? null
    let reconnect = false

    if (!bound) {
      // Already bound → same device resumes, a different device is rejected.
      const { data: existing } = await supabase
        .from('teams')
        .select('device_id')
        .eq('id', team.id)
        .maybeSingle()

      if (existing?.device_id === deviceId) {
        reconnect = true
        bound = { ...team, device_id: existing.device_id }
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'This team is already logged in on another device. Ask an admin to release the team if this is a mistake.'
          },
          { status: 409, headers: noCacheHeaders }
        )
      }
    }

    // ── Issue the session cookie ───────────────────────────────────
    const token = await signSessionToken({
      team_id: bound.id,
      member_name: bound.claimed_by || 'Team Member',
      device_id: deviceId
    })

    // Immediately register team into active game's quiz_sessions
    if (activeGame?.id) {
      try {
        const sessToken = 'sess_' + bound.id
        await supabase
          .from('quiz_sessions')
          .upsert({
            team_id: bound.id,
            game_id: activeGame.id,
            token: sessToken,
            points: 0,
            coins: 0,
            streak: 0,
            max_streak: 0,
            total_correct: 0,
            total_answered: 0,
            total_response_time_ms: 0,
            last_answered_question_index: -1
          }, { onConflict: 'token' })
      } catch (sessErr) {
        console.warn('[Student Login] quiz_sessions upsert notice:', sessErr)
      }
    }

    const res = NextResponse.json({
      success: true,
      reconnect,
      team: {
        id: bound.id,
        name: bound.name,
        code: bound.code,
        username: bound.username,
        roster: bound.roster,
        status: bound.status,
        claimed_by: bound.claimed_by
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
  } catch (err: any) {
    console.error('[Student Login] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Failed to log in.' }, { status: 500, headers: noCacheHeaders })
  }
}
