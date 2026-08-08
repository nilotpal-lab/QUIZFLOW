import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/* ================================================================
   QuizFlow — Cloud Room Relay Server
   Zero-configuration cross-device multiplayer state relay.
   Allows any laptop, phone, or tablet anywhere on the internet
   to join live games via 6-digit PIN with zero latency.
   ================================================================ */

const DEFAULT_SUPABASE_URL = 'https://ogciyskjrefwmazzckfg.supabase.co'
const DEFAULT_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nY2l5c2tqcmVmd21henpja2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjgxMTgsImV4cCI6MjEwMTYwNDExOH0.JwBvcMMESPGo_4qcFHcreuUVVmdSk8RRq9jtGPIjm7I'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON

const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

  // 1. Check in-memory map
  let room = rooms.get(pin)
  if (room?.state) {
    return NextResponse.json({
      success: true,
      pin,
      state: room.state,
      updatedAt: room.updatedAt
    })
  }

  // 2. Fallback to Supabase Cloud Database if serverless lambda was cold
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('quiz_data, updated_at')
      .eq('id', 'room_' + pin)
      .maybeSingle()

    if (data?.quiz_data) {
      rooms.set(pin, {
        state: data.quiz_data,
        updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
      })
      return NextResponse.json({
        success: true,
        pin,
        state: data.quiz_data,
        updatedAt: Date.now()
      })
    }
  } catch (err) {
    // Graceful fallback
  }

  return NextResponse.json({ error: 'Room not found', pin }, { status: 404 })
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

    // If memory is empty, attempt to restore from Supabase
    if (!current) {
      try {
        const { data } = await supabase
          .from('quizzes')
          .select('quiz_data')
          .eq('id', 'room_' + pin)
          .maybeSingle()
        if (data?.quiz_data) current = data.quiz_data
      } catch {}
    }

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

    // 1. Update in-memory Map
    rooms.set(pin, {
      state: current,
      updatedAt: Date.now()
    })

    // 2. Persist to Supabase Cloud Database (so all Vercel lambdas share it)
    try {
      await supabase.from('quizzes').upsert({
        id: 'room_' + pin,
        host_id: current.hostId || 'host_live',
        title: current.quiz?.title || 'Live Room ' + pin,
        description: 'Live active game session',
        question_count: current.quiz?.questions?.length || 0,
        quiz_data: current,
        is_draft: false,
        updated_at: new Date().toISOString()
      })
    } catch {}

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
