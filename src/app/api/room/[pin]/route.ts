import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import os from 'os'

/* ================================================================
   QuizFlow — Cloud Room Relay Server
   Server-authoritative answer evaluation, coin awards, anti-cheat.
   Zero-configuration cross-device multiplayer state relay.
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
  // Server-only answer keys — never sent to clients during question_active
  var __qf_answerKeys: Map<string, number[]> | undefined
}

if (!global.__qf_rooms) global.__qf_rooms = new Map()
if (!global.__qf_answerKeys) global.__qf_answerKeys = new Map()

const rooms = global.__qf_rooms
const answerKeys = global.__qf_answerKeys

function getTmpPath(pin: string) {
  return path.join(os.tmpdir(), `qf_room_${pin}.json`)
}

function getKeyPath(pin: string) {
  return path.join(os.tmpdir(), `qf_key_${pin}.json`)
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
    fs.writeFileSync(getTmpPath(pin), JSON.stringify(data), 'utf8')
  } catch {}
}

function loadAnswerKeys(pin: string): number[] {
  if (answerKeys.has(pin)) return answerKeys.get(pin)!
  try {
    const kf = getKeyPath(pin)
    if (fs.existsSync(kf)) {
      const keys = JSON.parse(fs.readFileSync(kf, 'utf8'))
      if (Array.isArray(keys)) {
        answerKeys.set(pin, keys)
        return keys
      }
    }
  } catch {}
  return []
}

function saveAnswerKeys(pin: string, keys: number[]) {
  answerKeys.set(pin, keys)
  try {
    fs.writeFileSync(getKeyPath(pin), JSON.stringify(keys), 'utf8')
  } catch {}
}

/**
 * Strip correct_index from quiz questions in client-facing state.
 *
 * SECURITY (manually audited — do not weaken): the ONLY correct answer
 * that may ever reach a client is the CURRENT question's, and only when
 * that question has reached the reveal phase. Everything else stays
 * server-side:
 *   - lobby / question_active / boss_frenzy / leaderboard → strip ALL
 *     (the next question's answer must not leak during the interlude)
 *   - question_reveal → inject ONLY the current question's index
 *   - ended → full state is fine (all reveals have happened; the results
 *     page needs every answer for post-game review)
 */
function sanitizeStateForClient(state: any, pin: string): any {
  if (!state?.quiz?.questions) return state

  const revealable = state.status === 'question_reveal' || state.status === 'ended'
  const revealCurrentOnly = state.status === 'question_reveal'
  const currentIdx = state.currentQuestionIndex ?? 0

  return {
    ...state,
    quiz: {
      ...state.quiz,
      questions: state.quiz.questions.map((q: any, i: number) => {
        if (!revealable) {
          const { correct_index, ...safeQ } = q
          return safeQ
        }
        if (revealCurrentOnly && i !== currentIdx) {
          const { correct_index, ...safeQ } = q
          return safeQ
        }
        return q
      })
    }
  }
}

/** Compute coin award based on question difficulty and response speed */
function computeCoins(difficulty: string, responseTimeMs: number): number {
  const base = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 8 : 12
  const bonus = responseTimeMs < 5000 ? 3 : 0
  return base + bonus
}

/** Compute points with difficulty multiplier and bid multiplier */
function computePoints(
  timeRemainingMs: number,
  totalTimeMs: number,
  streak: number,
  powerUpActive: boolean,
  bidMultiplier: number,
  difficulty: string
): number {
  const diffMult = difficulty === 'hard' ? 1.5 : difficulty === 'medium' ? 1.25 : 1
  const ratio = Math.max(0, Math.min(1, (timeRemainingMs || 0) / totalTimeMs))
  const speedFactor = 0.5 + 0.5 * ratio
  const streakMultiplier = 1 + Math.min(streak * 0.1, 0.5)
  const multiplier = (powerUpActive ? 2 : 1) * bidMultiplier * diffMult
  const pts = Math.round(Math.max(50, 1000 * speedFactor * streakMultiplier * multiplier))
  return Math.min(12000, pts)
}

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0'
}

export async function GET(
  req: Request,
  { params }: { params: { pin: string } }
) {
  const pin = params?.pin?.trim().toUpperCase()
  if (!pin) {
    return NextResponse.json({ error: 'PIN required' }, { status: 400 })
  }

  // 1. Check in-memory map
  let room = rooms.get(pin)
  if (room?.state) {
    return NextResponse.json({
      success: true, pin,
      state: sanitizeStateForClient(room.state, pin),
      updatedAt: room.updatedAt
    }, { headers: noCacheHeaders })
  }

  // 2. Check disk /tmp cache fallback
  const tmp = readTmpRoom(pin)
  if (tmp?.state) {
    rooms.set(pin, tmp)
    // Also restore answer keys from disk
    loadAnswerKeys(pin)
    return NextResponse.json({
      success: true, pin,
      state: sanitizeStateForClient(tmp.state, pin),
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
        // Restore keys from db state (they were stored stripped — load from disk key file)
        loadAnswerKeys(pin)
        return NextResponse.json({
          success: true, pin,
          state: sanitizeStateForClient(data.quiz_data, pin),
          updatedAt: item.updatedAt
        }, { headers: noCacheHeaders })
      }
    } catch {
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

    // ── Handle actions ─────────────────────────────────────────────

    if (state) {
      // Full state sync (host broadcasting state)
      // Extract and store answer keys server-side on first sync
      if (state.quiz?.questions) {
        const keys = (state.quiz.questions as any[]).map((q: any) => q.correct_index ?? -1)
        saveAnswerKeys(pin, keys)
      }
      current = state

    } else if (action === 'submit_answer' && current) {
      const { playerId, selectedIndex, powerUpActive, timeRemainingMs, responseTimeMs } = body
      const p = current.players?.[playerId]
      if (p && !p.hasAnswered) {
        // Check frozen
        const now = Date.now()
        if (p.frozenUntil && p.frozenUntil > now) {
          // Player is frozen — mark answered but award 0 points
          const frozenPlayer = {
            ...p,
            hasAnswered: true,
            selectedIndex,
            lastAnswerCorrect: false,
            lastPointsEarned: 0
          }
          current = { ...current, players: { ...current.players, [playerId]: frozenPlayer } }
        } else {
          // Look up correct answer from server-only key store
          const keys = loadAnswerKeys(pin)
          const qIdx = current.currentQuestionIndex ?? 0
          const correctIdx = keys[qIdx] ?? current.quiz?.questions?.[qIdx]?.correct_index ?? -1

          const q = current.quiz?.questions?.[qIdx]
          const totalTimeMs = q?.time_limit_ms ?? 20000
          const difficulty = q?.difficulty ?? 'medium'
          const isCorrect = correctIdx >= 0 && selectedIndex === correctIdx

          // Anti-bot: sub-100ms answers flagged
          const isSuspiciousBot = (responseTimeMs ?? 0) < 100 && totalTimeMs >= 5000

          let points = 0
          const newStreak = isCorrect ? (p.streak || 0) + 1 : 0
          const bidMultiplier = p.bidMultiplier ?? 1

          if (isCorrect && !isSuspiciousBot) {
            points = computePoints(timeRemainingMs, totalTimeMs, p.streak || 0, powerUpActive, bidMultiplier, difficulty)
          } else if (current.gameMode === 'boss_raid') {
            points = -5
          }

          // Boss health
          let bossHp = current.bossHealth ?? 100
          if (current.gameMode === 'boss_raid' && isCorrect && !isSuspiciousBot) {
            bossHp = Math.max(0, bossHp - 10)
          }

          // Coin award
          const coinsEarned = isCorrect && !isSuspiciousBot
            ? computeCoins(difficulty, responseTimeMs ?? 0)
            : 0

          const updatedPlayer = {
            ...p,
            hasAnswered: true,
            selectedIndex,
            lastAnswerCorrect: isCorrect,
            lastPointsEarned: points,
            score: Math.max(0, (p.score || 0) + points),
            streak: newStreak,
            maxStreak: Math.max(p.maxStreak || 0, newStreak),
            totalCorrect: (p.totalCorrect || 0) + (isCorrect ? 1 : 0),
            totalAnswered: (p.totalAnswered || 0) + 1,
            totalResponseTimeMs: (p.totalResponseTimeMs || 0) + (responseTimeMs || 0),
            coins: (p.coins || 0) + coinsEarned,
            bidMultiplier: 1 // reset bid multiplier after use
          }

          const updatedPlayers = { ...current.players, [playerId]: updatedPlayer }
          current = { ...current, bossHealth: bossHp, players: updatedPlayers }
        }
      }

    } else if (action === 'frenzy_answer' && current) {
      const { playerId, selectedIndex, frenzyIndex } = body
      const frenzy = current.bossFrenzy
      if (frenzy?.active && frenzyIndex === frenzy.currentFrenzyIndex) {
        const keys = loadAnswerKeys(pin)
        const qIdx = frenzy.questionIndices?.[frenzyIndex]
        const correctIdx = keys[qIdx] ?? current.quiz?.questions?.[qIdx]?.correct_index ?? -1
        const isCorrect = correctIdx >= 0 && selectedIndex === correctIdx

        const newScores = { ...frenzy.frenzyScores }
        if (isCorrect) newScores[playerId] = (newScores[playerId] || 0) + 1

        const nextIdx = frenzyIndex + 1
        const isLast = nextIdx >= (frenzy.questionIndices?.length ?? 10)
        const isTimeUp = Date.now() > frenzy.endsAt

        let updatedPlayers = { ...current.players }
        if (isLast || isTimeUp) {
          // Award 200pts per correct frenzy answer to all players
          Object.entries(newScores).forEach(([pid, correct]) => {
            if (updatedPlayers[pid]) {
              updatedPlayers[pid] = {
                ...updatedPlayers[pid],
                score: updatedPlayers[pid].score + (correct as number) * 200,
                frenzyScore: correct as number
              }
            }
          })
        }

        current = {
          ...current,
          players: updatedPlayers,
          bossFrenzy: {
            ...frenzy,
            currentFrenzyIndex: isLast ? frenzyIndex : nextIdx,
            frenzyScores: newScores,
            active: !isLast && !isTimeUp,
            questionStartedAt: Date.now()
          },
          status: (isLast || isTimeUp) ? 'ended' : 'boss_frenzy'
        }
      }

    } else if (action === 'buy_powerup' && current) {
      const { playerId, powerUpType, targetId } = body
      const p = current.players?.[playerId]
      const COSTS: Record<string, number> = {
        freeze_player: 15, freeze_all: 25, bid_2x: 10, bid_3x: 20, bid_4x: 35
      }
      const cost = COSTS[powerUpType] ?? 999

      if (p && (p.coins || 0) >= cost) {
        const updatedPlayers = { ...current.players }
        updatedPlayers[playerId] = { ...p, coins: p.coins - cost }

        if (powerUpType === 'bid_2x' || powerUpType === 'bid_3x' || powerUpType === 'bid_4x') {
          const mult = powerUpType === 'bid_2x' ? 2 : powerUpType === 'bid_3x' ? 3 : 4
          updatedPlayers[playerId] = { ...updatedPlayers[playerId], bidMultiplier: mult }
        } else if (powerUpType === 'freeze_player' && targetId && updatedPlayers[targetId]) {
          updatedPlayers[targetId] = { ...updatedPlayers[targetId], frozenUntil: Date.now() + 6000 }
        } else if (powerUpType === 'freeze_all') {
          const freezeEnd = Date.now() + 4000
          Object.keys(updatedPlayers).forEach(pid => {
            if (pid !== playerId) {
              updatedPlayers[pid] = { ...updatedPlayers[pid], frozenUntil: freezeEnd }
            }
          })
        }
        current = { ...current, players: updatedPlayers }
      }

    } else if (action === 'report_violation' && current) {
      const { playerId, reason } = body
      const p = current.players?.[playerId]
      if (p) {
        const violations = (p.violations || 0) + 1
        const flagged = violations >= 3
        const updatedPlayer = { ...p, violations, flagged }
        current = { ...current, players: { ...current.players, [playerId]: updatedPlayer } }
      }

    } else if (action === 'join' && player && current) {
      current = {
        ...current,
        players: {
          ...current.players,
          [player.id]: {
            ...player,
            score: 0, streak: 0, maxStreak: 0, totalCorrect: 0, totalAnswered: 0,
            totalResponseTimeMs: 0, rank: 0,
            lastAnswerCorrect: null, lastPointsEarned: 0,
            hasAnswered: false, selectedIndex: null,
            joinedAt: Date.now(), connected: true,
            coins: 0, violations: 0, flagged: false, frenzyScore: 0
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

    // 2. Persist to Supabase only on status-changing events (not every submit_answer)
    // This reduces Supabase write load from 300 concurrent players
    const isStatusChange = !action ||
      action === 'join' ||
      (state && state.status !== rooms.get(pin)?.state?.status)

    if (supabase && isStatusChange) {
      // SECURITY: persist the SANITIZED state only. The `quizzes` table
      // is readable with the anon key, so storing `current` here would
      // leak every correct_index to any client that can read the DB.
      // Answer keys stay in the server-only in-memory/tmp store; on a
      // fresh machine the host's next state broadcast re-extracts them.
      void supabase.from('quizzes').upsert({
        id: 'room_' + pin,
        host_id: current.hostId || 'host_live',
        title: current.quiz?.title || 'Live Room ' + pin,
        description: 'Live active game session',
        question_count: current.quiz?.questions?.length || 0,
        quiz_data: sanitizeStateForClient(current, pin),
        is_draft: false,
        updated_at: new Date().toISOString()
      })
    }

    return NextResponse.json({
      success: true, pin,
      state: sanitizeStateForClient(current, pin),
      updatedAt: Date.now()
    }, { headers: noCacheHeaders })

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to update room' },
      { status: 500, headers: noCacheHeaders }
    )
  }
}
