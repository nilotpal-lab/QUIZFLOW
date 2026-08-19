import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import { computeGateState, gateStateMessage, type EventConfig } from '@/quizflow/eventGate'

/* ================================================================
   QuizFlow — Day-of Gate Config (public read)
   GET /api/event/config
   Returns the gate state so the student login page and dashboards
   can render the right screen BEFORE the student has a session.
   event_config contains no secrets (booleans + timestamps only),
   so it is safe to read with the anon key / no auth.
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

export async function GET() {
  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  const { data, error } = await supabase
    .from('event_config')
    .select('login_open, opens_at, closes_at')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    console.warn('[Event Config] read failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to load event status.' }, { status: 500, headers: noCacheHeaders })
  }

  // Check if an active game currently exists in games table
  const { data: activeGames } = await supabase
    .from('games')
    .select('id, status')
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)

  const activeGame = activeGames && activeGames.length > 0 ? activeGames[0] : null
  const hasActiveGame = Boolean(activeGame)
  const activeGameStatus = activeGame?.status || null

  const cfg: EventConfig | null = data
    ? { login_open: Boolean(data.login_open), opens_at: data.opens_at, closes_at: data.closes_at }
    : null
  const gateState = computeGateState(cfg)

  return NextResponse.json({
    success: true,
    gate_state: gateState,
    message: gateStateMessage(gateState, cfg),
    has_active_game: hasActiveGame,
    active_game_status: activeGameStatus,
    config: cfg
  }, { headers: noCacheHeaders })
}
