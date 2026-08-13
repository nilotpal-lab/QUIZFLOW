import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import os from 'os'

/* ================================================================
   QuizFlow — Cloud Room Relay Server
   Zero-configuration cross-device multiplayer state relay.
   Allows any laptop, phone, or tablet anywhere on the internet
   to join live games via 6-digit PIN with zero latency.
   ================================================================ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

declare global {
  // eslint-disable-next-line no-var
  var __qf_rooms: Map<string, { state: any; updatedAt: number }> | undefined
}

if (!global.__qf_rooms) {
  global.__qf_rooms = new Map()
}

const rooms = global.__qf_rooms

function getTmpPath(pin: string) {
  return path.join(os.tmpdir(), `qf_room_${pin}.json`)
}

function readTmpRoom(pin: string) {
  try {
    const file = getTmpPath(pin)
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf8')
      const parsed = JSON.parse(raw)
      if (parsed?.state) return parsed
    }
  } catch {}
  return null
}

function writeTmpRoom(pin: string, data: { state: any; updatedAt: number }) {
  try {
    const file = getTmpPath(pin)
    fs.writeFileSync(file, JSON.stringify(data), 'utf8')
  } catch {}
}

export async function GET(
  req: Request,
  { params }: { params: { pin: string } }
) {
  const pin = params?.pin?.trim().toUpperCase()
  if (!pin) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0'
  }

  // 1. Check in-memory map
  let room = rooms.get(pin)
  if (room?.state) {
    return NextResponse.json({
      success: true,
      pin,
      state: room.state,
      updatedAt: room.updatedAt
    }, { headers: noCacheHeaders })
  }

  // 2. Check disk /tmp cache fallback
  const tmp = readTmpRoom(pin)
  if (tmp?.state) {
    rooms.set(pin, tmp)
    return NextResponse.json({
      success: true,
      pin,
      state: tmp.state,
      updatedAt: tmp.updatedAt
    }, { headers: noCacheHeaders })
  }

  // 3. Fallback to Supabase Cloud Database if serverless lambda was cold
  if (supabase) {
    try {
      const { data } = await supabase
        .from('quizzes')
        .select('quiz_data, updated_at')
        .eq('id', 'room_' + pin)
        .maybeSingle()

      if (data?.quiz_data) {
        const item = {
          state: data.quiz_data,
          updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now()
        }
        rooms.set(pin, item)
        writeTmpRoom(pin, item)
        return NextResponse.json({
          success: true,
          pin,
          state: data.quiz_data,
          updatedAt: item.updatedAt
        }, { headers: noCacheHeaders })
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  return NextResponse.json({ error: 'Room not found', pin }, { status: 404, headers: noCacheHeaders })
}

export async function POST(
  req: Request,
  { params }: { params: { pin: string } }
) {
  const pin = params?.pin
  if (!pin) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0'
  }

  try {
    const body = await req.json()
    const { state, action, player, reaction } = body

    let current = rooms.get(pin)?.state

    // If memory is empty, attempt to restore from Supabase
    if (!current && supabase) {
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
    } else if (action === 'submit_answer' && current) {
      const { playerId, selectedIndex, powerUpActive, timeRemainingMs, responseTimeMs } = body
      const player = current.players?.[playerId]
      if (player && !player.hasAnswered) {
        const q = current.quiz.questions[current.currentQuestionIndex]
        const isCorrect = q ? selectedIndex === q.correct_index : false
        const totalTimeMs = q?.time_limit_ms ?? 20000
        const isSuspiciousBot = responseTimeMs < 100 && totalTimeMs >= 5000

        let points = 0
        const newStreak = isCorrect ? player.streak + 1 : 0
        if (isCorrect && !isSuspiciousBot) {
          const ratio = Math.max(0, Math.min(1, (timeRemainingMs || 0) / totalTimeMs))
          const speedFactor = 0.5 + 0.5 * ratio
          const streakMultiplier = 1 + Math.min(player.streak * 0.1, 0.5)
          const multiplier = powerUpActive ? 2 : 1
          points = Math.round(Math.max(50, 1000 * speedFactor * streakMultiplier * multiplier))
          points = Math.min(6000, points)
        } else if (current.gameMode === 'boss_raid') {
          points = -5
        }

        let bossHp = current.bossHealth ?? 100
        if (current.gameMode === 'boss_raid' && isCorrect && !isSuspiciousBot) {
          bossHp = Math.max(0, bossHp - 10)
        }

        const updatedPlayer = {
          ...player,
          hasAnswered: true,
          selectedIndex,
          lastAnswerCorrect: isCorrect,
          lastPointsEarned: points,
          score: Math.max(0, player.score + points),
          streak: newStreak,
          maxStreak: Math.max(player.maxStreak || 0, newStreak),
          totalCorrect: (player.totalCorrect || 0) + (isCorrect ? 1 : 0),
          totalAnswered: (player.totalAnswered || 0) + 1,
          totalResponseTimeMs: (player.totalResponseTimeMs || 0) + (responseTimeMs || 0)
        }

        const updatedPlayers = { ...current.players, [playerId]: updatedPlayer }
        current = {
          ...current,
          bossHealth: bossHp,
          players: updatedPlayers
        }
      }
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

    // 1. Update in-memory Map & disk tmp cache
    const item = { state: current, updatedAt: Date.now() }
    rooms.set(pin, item)
    writeTmpRoom(pin, item)

    // 2. Persist to Supabase Cloud Database (so all Vercel lambdas share it)
    if (supabase) {
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
    }

    return NextResponse.json({
      success: true,
      pin,
      state: current,
      updatedAt: Date.now()
    }, { headers: noCacheHeaders })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update room' }, { status: 500, headers: noCacheHeaders })
  }
}
