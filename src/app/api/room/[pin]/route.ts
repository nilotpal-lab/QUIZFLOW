import { NextResponse } from 'next/server'

/* ================================================================
   QuizFlow — Cloud Room Relay Server
   Zero-configuration cross-device multiplayer state relay.
   Allows any laptop, phone, or tablet anywhere on the internet
   to join live games via 6-digit PIN with zero latency.
   ================================================================ */

declare global {
  // eslint-disable-next-line no-var
  var __qf_rooms: Map<string, { state: any; updatedAt: number }> | undefined
}

if (!global.__qf_rooms) {
  global.__qf_rooms = new Map()
}

const rooms = global.__qf_rooms

export async function GET(
  req: Request,
  { params }: { params: { pin: string } }
) {
  const pin = params?.pin
  if (!pin) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  const room = rooms.get(pin)
  if (!room || !room.state) {
    return NextResponse.json({ error: 'Room not found', pin }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    pin,
    state: room.state,
    updatedAt: room.updatedAt
  })
}

export async function POST(
  req: Request,
  { params }: { params: { pin: string } }
) {
  const pin = params?.pin
  if (!pin) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  try {
    const body = await req.json()
    const { state, action, player, reaction } = body

    let current = rooms.get(pin)?.state

    if (state) {
      current = state
    } else if (action === 'join' && player && current) {
      current = {
        ...current,
        players: {
          ...current.players,
          [player.id]: {
            ...player,
            score: 0,
            streak: 0,
            maxStreak: 0,
            totalCorrect: 0,
            totalAnswered: 0,
            totalResponseTimeMs: 0,
            rank: 0,
            lastAnswerCorrect: null,
            lastPointsEarned: 0,
            hasAnswered: false,
            selectedIndex: null,
            joinedAt: Date.now(),
            connected: true
          }
        }
      }
    } else if (action === 'reaction' && reaction && current) {
      const reactions = [...(current.reactions || []), reaction].slice(-25)
      current = { ...current, reactions }
    }

    if (!current) {
      return NextResponse.json({ error: 'Cannot update non-existent room' }, { status: 404 })
    }

    rooms.set(pin, {
      state: current,
      updatedAt: Date.now()
    })

    // Clean up rooms older than 4 hours
    const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000
    rooms.forEach((val, k) => {
      if (val.updatedAt < fourHoursAgo) rooms.delete(k)
    })

    return NextResponse.json({
      success: true,
      pin,
      state: current,
      updatedAt: Date.now()
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update room' }, { status: 500 })
  }
}
