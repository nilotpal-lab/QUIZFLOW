import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from '@/quizflow/authToken'
import { noCacheHeaders } from '@/quizflow/liveplay'
import { POWERUP_COSTS, type PowerUpItem } from '@/quizflow/scoring'

/* ================================================================
   QuizFlow — Power-Up Shop Purchase
   POST /api/quiz/shop/buy  { item, target_team_id? }

   item: freeze_player | freeze_all | bid_2x | bid_3x | bid_4x

   The purchase is ATOMIC inside qf_buy_powerup:
     UPDATE quiz_sessions SET coins = coins - $cost
     WHERE id = $session AND coins >= $cost
   → 0 rows = insufficient funds (handles concurrent buys; coins can
   never go negative). The effect (freeze / bid) is applied server-side
   in the same definer function; the client only renders what the
   server confirms. Broadcast of "You've been frozen!" is presentation
   — the real enforcement is the frozen_until check in qf_apply_answer.
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Broadcast a power-up effect on the game's realtime channel.
 *
 * PRESENTATION ONLY — the UI uses this to react instantly ("You've
 * been frozen!"). The actual enforcement is the server-side
 * frozen_until / bid state in qf_buy_powerup + qf_apply_answer. This
 * matches the existing qf_room_<pin> broadcast pattern in
 * sessionStore.ts (fire-and-forget, no-op when Supabase is absent).
 */
async function broadcastPowerUpEffect(
  supabase: NonNullable<ReturnType<typeof getServerSupabase>>,
  gameId: string,
  payload: Record<string, unknown>
) {
  try {
    const roomChannel = supabase.channel(`qf_room_${gameId}`, {
      config: { broadcast: { self: true } }
    })
    await roomChannel.send({
      type: 'broadcast',
      event: 'powerup_effect',
      payload: { ...payload, ts: Date.now() }
    })
    try { supabase.removeChannel(roomChannel) } catch { /* best-effort */ }
  } catch {
    // Graceful: broadcast is presentation-only.
  }
}

function getToken(req: Request): string | null {
  const cookie = getSessionTokenFromRequest(req)
  if (cookie) return cookie
  const auth = req.headers.get('authorization') || ''
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim()
  return null
}

export async function POST(req: Request) {
  const token = getToken(req)
  const claims = token ? await verifySessionToken(token) : null
  if (!claims) {
    return NextResponse.json({ success: false, error: 'Unauthorized — no valid session.' }, { status: 401, headers: noCacheHeaders })
  }

  const supabase = getServerSupabase()
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
  }

  let body: { item?: unknown; target_team_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
  }

  const item = typeof body?.item === 'string' ? body.item : ''
  if (!(item in POWERUP_COSTS)) {
    return NextResponse.json({ success: false, error: `item must be one of: ${Object.keys(POWERUP_COSTS).join(', ')}` }, { status: 400, headers: noCacheHeaders })
  }

  // 1. Resolve active game ID directly from games table
  const { data: activeGames } = await supabase
    .from('games')
    .select('id')
    .neq('status', 'ended')
    .order('created_at', { ascending: false })
    .limit(1)

  const activeGameId = activeGames?.[0]?.id || 'EVENT'

  // 2. Resolve the team's session row via unique token index
  const sessToken = 'sess_' + claims.team_id
  let { data: session } = await supabase
    .from('quiz_sessions')
    .select('id, game_id')
    .eq('token', sessToken)
    .maybeSingle()

  if (!session || session.game_id !== activeGameId) {
    const { data: newSession } = await supabase
      .from('quiz_sessions')
      .upsert({
        team_id: claims.team_id,
        game_id: activeGameId,
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
      .select('id, game_id')
      .maybeSingle()

    if (newSession) session = newSession
  }

  if (!session || !session.game_id) {
    return NextResponse.json({ success: false, error: 'No game session for this team.' }, { status: 404, headers: noCacheHeaders })
  }

  // Resolve a target team → its session id (must be in the SAME game).
  let targetSessionId: string | null = null
  const targetTeamId = typeof body?.target_team_id === 'string' ? body.target_team_id : null
  if (item === 'freeze_player') {
    if (!targetTeamId) {
      return NextResponse.json({ success: false, error: 'freeze_player requires target_team_id' }, { status: 400, headers: noCacheHeaders })
    }
    if (targetTeamId === claims.team_id) {
      return NextResponse.json({ success: false, error: 'You cannot freeze your own team.' }, { status: 400, headers: noCacheHeaders })
    }
    const { data: target } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('team_id', targetTeamId)
      .eq('game_id', session.game_id)
      .maybeSingle()
    if (!target) {
      return NextResponse.json({ success: false, error: 'Target team is not in this game.' }, { status: 404, headers: noCacheHeaders })
    }
    targetSessionId = target.id
  }

  // Handle coin boost power-ups (strictly multiplies coins on next answer, NEVER touches points)
  if (item === 'coin_boost_2x' || item === 'coin_boost_3x') {
    const cost = POWERUP_COSTS[item as PowerUpItem]
    const multiplier = item === 'coin_boost_2x' ? 2 : 3
    const { data: curSess } = await supabase.from('quiz_sessions').select('coins').eq('id', session.id).maybeSingle()
    if (!curSess || (curSess.coins ?? 0) < cost) {
      return NextResponse.json({ success: false, error: 'Insufficient coins.', reason: 'insufficient' }, { status: 402, headers: noCacheHeaders })
    }
    const { data: updated, error: upErr } = await supabase
      .from('quiz_sessions')
      .update({
        coins: curSess.coins - cost,
        coin_multiplier: multiplier,
        coin_question_index: -1
      })
      .eq('id', session.id)
      .gte('coins', cost)
      .select('coins')
      .maybeSingle()

    if (upErr || !updated) {
      return NextResponse.json({ success: false, error: 'Purchase failed.', reason: 'insufficient' }, { status: 402, headers: noCacheHeaders })
    }

    void broadcastPowerUpEffect(supabase, session.game_id!, {
      type: 'powerup',
      item,
      actor_team_id: claims.team_id,
      target_team_ids: [claims.team_id],
      effect: 'coin_boost'
    })

    return NextResponse.json({
      success: true,
      item,
      coins_remaining: updated.coins
    }, { headers: noCacheHeaders })
  }

  const { data, error } = await supabase.rpc('qf_buy_powerup', {
    p_session_id: session.id,
    p_item: item as PowerUpItem,
    p_target_session_id: targetSessionId
  })

  if (error) {
    console.warn('[Quiz Shop] RPC failed:', error.message)
    return NextResponse.json({ success: false, error: 'Failed to process purchase.' }, { status: 500, headers: noCacheHeaders })
  }

  const result = Array.isArray(data) ? data[0] : data

  if (!result || !result.ok) {
    const reason = result?.reason || 'unknown'
    const status = reason === 'insufficient' ? 402 : reason === 'no_session' || reason === 'no_game' ? 404 : 409
    return NextResponse.json({ success: false, error: `Purchase failed: ${reason}`, reason }, { status, headers: noCacheHeaders })
  }

  // Broadcast the effect to affected clients (presentation only — the
  // enforcement already happened server-side). Freeze targets are the
  // other teams; bid purchases notify the buyer's own device.
  if (item === 'freeze_player' && targetTeamId) {
    void broadcastPowerUpEffect(supabase, session.game_id!, {
      type: 'powerup',
      item,
      actor_team_id: claims.team_id,
      target_team_ids: [targetTeamId],
      effect: 'frozen'
    })
  } else if (item === 'freeze_all') {
    void (async () => {
      try {
        const { data } = await supabase
          .from('quiz_sessions')
          .select('team_id')
          .eq('game_id', session.game_id)
          .neq('team_id', claims.team_id)
        const targetIds = (data || []).map((r: any) => r.team_id)
        await broadcastPowerUpEffect(supabase, session.game_id!, {
          type: 'powerup',
          item,
          actor_team_id: claims.team_id,
          target_team_ids: targetIds,
          effect: 'frozen'
        })
      } catch {
        // Best-effort broadcast.
      }
    })()
  } else {
    void broadcastPowerUpEffect(supabase, session.game_id!, {
      type: 'powerup',
      item,
      actor_team_id: claims.team_id,
      target_team_ids: [claims.team_id],
      effect: 'bid'
    })
  }

  return NextResponse.json({
    success: true,
    item,
    coins_remaining: result.coins_remaining
  }, { headers: noCacheHeaders })
}
