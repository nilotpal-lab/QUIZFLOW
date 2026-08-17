'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QuizFlowLogo from '@/quizflow/QuizFlowLogo'

interface GameStateResponse {
  success: boolean
  game?: {
    id: string
    mode: string
    status: string
    question_started_at: string | null
    boss_window_ends_at: string | null
    question_count: number
    active_question: {
      index: number
      prompt: string
      choices: string[]
      time_limit_ms?: number
      difficulty?: string
      explanation?: string
      correct_index?: number
    } | null
  }
  me?: {
    points: number
    coins: number
    streak: number
    max_streak: number
    total_correct: number
    total_answered: number
    frozen_until: string | null
    bid_multiplier: number
    frenzy_correct_count: number
    violation_count: number
  }
}

interface LbRow {
  rank: number
  team_id: string
  name: string | null
  code: string | null
  points: number
  coins: number
  streak: number
  total_correct: number
  total_answered: number
  frenzy_correct_count: number
}

const STATUS_LABEL: Record<string, string> = {
  lobby: 'LOBBY',
  question_active: 'QUESTION LIVE',
  question_reveal: 'ANSWER REVEALED',
  leaderboard: 'LEADERBOARD',
  boss_frenzy: 'BOSS FRENZY',
  ended: 'COMPETITION COMPLETE'
}

/* Memphis 4-color answer grid (matches the global `.answer-btn` system). */
const ANSWER_COLORS = ['cherry', 'sky', 'sun', 'mint']

export default function StudentLobby() {
  const router = useRouter()
  const [state, setState] = useState<GameStateResponse | null>(null)
  const [loadState, setLoadState] = useState<'loading' | 'no_game' | 'ready'>('loading')
  const [selected, setSelected] = useState<number | null>(null)
  const [answeredIndex, setAnsweredIndex] = useState<number | null>(null)
  const [result, setResult] = useState<{ correct: boolean; points: number; coins: number; reason: string } | null>(null)
  const [showBoard, setShowBoard] = useState(false)
  const [board, setBoard] = useState<LbRow[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [bossCountdown, setBossCountdown] = useState<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const status = state?.game?.status || 'lobby'
  const isBoss = status === 'boss_frenzy'
  const q = state?.game?.active_question || null
  const me = state?.me

  /* ── Poll game state ─────────────────────────────────────────── */
  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/quiz/game/state')
      if (res.status === 401) {
        router.push('/quizflow/student/login')
        return
      }
      const data: GameStateResponse = await res.json()
      if (data?.success) {
        setState(data)
        setLoadState('ready')
        // Reset per-question answer state when a new question begins.
        setAnsweredIndex(prev => (prev !== null && prev !== data.game?.active_question?.index ? null : prev))
        setSelected(null)
        setResult(null)
      } else if (res.status === 404) {
        setState(null)
        setLoadState('no_game')
      }
    } catch {
      /* transient network error — keep last state */
    }
  }, [router])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, 1000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [poll])

  /* ── Server-side elapsed tick (cosmetic; server recomputes) ──── */
  useEffect(() => {
    if (!state?.game?.question_started_at || (status !== 'question_active' && status !== 'boss_frenzy')) return
    const tick = () => {
      const ms = Date.now() - new Date(state.game!.question_started_at!).getTime()
      setElapsed(Math.max(0, ms))
    }
    tick()
    const t = setInterval(tick, 250)
    return () => clearInterval(t)
  }, [state?.game?.question_started_at, status])

  /* ── Boss window countdown (server-timed, rendered only) ─────── */
  useEffect(() => {
    if (!isBoss || !state?.game?.boss_window_ends_at) return
    const tick = () => {
      const secs = Math.max(0, Math.ceil((new Date(state.game!.boss_window_ends_at!).getTime() - Date.now()) / 1000))
      setBossCountdown(secs)
    }
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [isBoss, state?.game?.boss_window_ends_at])

  /* ── Leaderboard (while answering — decision #11) ────────────── */
  const loadBoard = useCallback(async () => {
    const id = state?.game?.id
    if (!id) return
    try {
      const res = await fetch(`/api/quiz/leaderboard?game_id=${encodeURIComponent(id)}`)
      const data = await res.json()
      if (data?.success) setBoard(data.leaderboard)
    } catch { /* ignore */ }
  }, [state?.game?.id])

  useEffect(() => {
    if (!showBoard) return
    loadBoard()
    const t = setInterval(loadBoard, 2000)
    return () => clearInterval(t)
  }, [showBoard, loadBoard])

  /* ── Submit answer (server-authoritative) ────────────────────── */
  const handleAnswer = async (optionIndex: number) => {
    if (selected !== null || answeredIndex === q?.index) return
    setSelected(optionIndex)
    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_option: optionIndex, client_elapsed_ms: elapsed })
      })
      const data = await res.json()
      if (data?.success !== undefined) {
        setResult({ correct: Boolean(data.correct), points: data.points_earned || 0, coins: data.coins_earned || 0, reason: data.reason || 'ok' })
        setAnsweredIndex(q?.index ?? null)
      }
    } catch {
      setResult({ correct: false, points: 0, coins: 0, reason: 'network_error' })
    }
  }

  const revealCorrect = status === 'question_reveal' || status === 'ended'
  const showQuestion = (status === 'question_active' || status === 'boss_frenzy') && q
  const answerLocked = answeredIndex === q?.index

  /* ═══ Shared shell ═══ */
  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col text-[var(--ink)] overflow-x-hidden">
      {/* Top nav — wraps on phones so status + leaderboard never collide */}
      <nav className="w-full bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-3 md:px-6 min-h-[56px] py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/quizflow/student/dashboard" className="font-display font-[900] text-[18px] md:text-[20px] tracking-tight flex items-center gap-1.5 shrink-0">
              <QuizFlowLogo size={22} className="md:w-[24px] md:h-[24px]" alt="QuizFlow" /> QuizFlow
            </Link>
            <span className={`badge ${isBoss ? 'badge-cherry' : status === 'ended' ? 'badge-violet' : status === 'question_active' ? 'badge-mint' : 'badge-sun'}`} style={{ fontSize: 9.5, maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {STATUS_LABEL[status] || status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {me && (
              <div className="hidden sm:flex items-center gap-2">
                <span className="badge badge-ink">⚡ {me.points.toLocaleString()}</span>
                {me.streak > 1 && <span className="badge badge-sun">🔥 {me.streak}</span>}
              </div>
            )}
            {(status === 'question_active' || status === 'boss_frenzy' || status === 'question_reveal') && (
              <button
                onClick={() => setShowBoard(v => !v)}
                className={`hard rounded-full px-3.5 py-2 text-[11px] sm:px-4 sm:text-[12px] font-display font-bold uppercase tracking-wider border-[2px] border-[var(--ink)] btn-press ${showBoard ? 'bg-[var(--violet)] text-white' : 'bg-[var(--sun)] text-[var(--ink)]'}`}
                style={{ minHeight: 36 }}
              >
                🏆 {showBoard ? 'Hide Board' : 'Leaderboard'}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Boss banner */}
      {isBoss && (
        <div className="w-full bg-[var(--ink)] text-[var(--paper)] border-b-[3px] border-[var(--cherry)] px-4 py-2.5 flex items-center justify-center gap-3">
          <span className="text-[16px]">💥</span>
          <span className="font-display font-[900] text-[13px] uppercase tracking-widest text-[var(--cherry)]">Boss Frenzy Finale</span>
          {bossCountdown !== null && (
            <span className="font-display font-[900] text-[15px] text-[var(--sun)]">⏱ {bossCountdown}s</span>
          )}
        </div>
      )}

      <main className="flex-1 w-full max-w-[820px] mx-auto px-3 md:px-6 py-5 md:py-10 flex flex-col gap-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        {/* ═══ WAITING (no game) ═══ */}
        {loadState === 'no_game' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="text-[64px] mb-4">🎯</div>
            <h1 className="font-display font-[900] text-[26px] uppercase tracking-tight mb-2">Arena Not Open Yet</h1>
            <p className="font-body text-[14px] font-semibold opacity-70 max-w-[400px] mb-6">
              The admin hasn't created the game yet. This page refreshes automatically — you'll drop into the lobby the moment it opens.
            </p>
            <Link href="/quizflow/student/dashboard">
              <button className="hard btn-press bg-white text-[var(--ink)] font-display font-[800] text-[14px] px-6 py-3 rounded-[12px] border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F] cursor-pointer">
                ← Back to Dashboard
              </button>
            </Link>
          </div>
        )}

        {/* ═══ LOBBY ═══ */}
        {loadState === 'ready' && status === 'lobby' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="flex gap-2 mb-6">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-3 h-3 rounded-full bg-[var(--violet)] border-[1.5px] border-[var(--ink)]" style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <h1 className="font-display font-[900] text-[28px] uppercase tracking-tight mb-3">Waiting for the Admin</h1>
            <p className="font-body text-[14px] font-semibold opacity-70 mb-2">
              You're in the lobby of <strong>{state?.game?.id}</strong> ({state?.game?.mode} mode).
            </p>
            <p className="font-body text-[14px] font-semibold opacity-70 mb-6">
              The game will start automatically when the admin presses start.
            </p>
            <div className="hard bg-[var(--paper-2)] border-[2.5px] border-[var(--ink)] rounded-[12px] px-5 py-3 font-display font-[800] text-[14px]">
              👥 {state?.game?.question_count || 0} questions · {state?.game?.mode.toUpperCase()}
            </div>
          </div>
        )}

        {/* ═══ QUESTION (active / boss) ═══ */}
        {showQuestion && q && (
          <div className="card anim-scale-in p-5 md:p-7">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <span className="badge badge-ink">Q{q.index + 1} of {state?.game?.question_count}</span>
              <span className="font-display font-[800] text-[12px] uppercase tracking-wider opacity-60">
                {isBoss ? `💥 Frenzy Q${q.index + 1}` : q.difficulty ? `🎚 ${q.difficulty.toUpperCase()}` : ''}
              </span>
            </div>
            <h1 className="font-display font-[900] text-[clamp(17px,4.6vw,28px)] leading-snug tracking-tight mb-6">{q.prompt}</h1>

            <div className="quiz-answer-grid">
              {q.choices.map((choice, ci) => {
                const color = ANSWER_COLORS[ci % ANSWER_COLORS.length]
                const isCorrect = revealCorrect && q.correct_index === ci
                const isWrongPick = revealCorrect && selected === ci && !result?.correct && !isCorrect
                const isSelected = selected === ci
                const locked = answerLocked || result !== null || revealCorrect || selected !== null

                let stateClass = ''
                if (revealCorrect) {
                  if (isCorrect) stateClass = 'revealed-correct'
                  else if (isWrongPick) stateClass = 'selected-wrong'
                } else if (isSelected) {
                  stateClass = result?.correct ? 'selected-correct' : 'selected-wrong'
                }

                return (
                  <button
                    key={ci}
                    onClick={() => handleAnswer(ci)}
                    disabled={locked}
                    className={`answer-btn ${color} ${stateClass} ${isSelected && locked ? 'is-locked' : ''}`}
                  >
                    <span className="answer-glyph">{String.fromCharCode(65 + ci)}</span>
                    <span className="flex-1">{choice}</span>
                    {revealCorrect && isCorrect && <span className="text-[18px] font-[900] shrink-0">✓</span>}
                    {revealCorrect && isWrongPick && <span className="text-[14px] font-[900] shrink-0">✕</span>}
                  </button>
                )
              })}
            </div>

            {/* Answer result chip (server-confirmed only) */}
            {result && (
              <div className={`mt-5 hard rounded-[12px] border-[3px] border-[var(--ink)] px-4 py-3 font-display font-[800] text-[15px] shadow-[3px_3px_0px_#10100F] ${result.correct ? 'bg-[var(--mint)]' : 'bg-red-100 text-[var(--cherry)]'}`}>
                {result.correct
                  ? `✅ Correct! +${result.points.toLocaleString()} pts · 🪙 +${result.coins} coins`
                  : result.reason === 'already_answered' || result.reason === 'rejected'
                    ? '⏳ Already answered — waiting for the admin to reveal.'
                    : result.reason === 'frozen'
                      ? '🧊 Your team is frozen — wait a moment.'
                      : result.reason === 'network_error'
                        ? '⚠️ Could not submit. Try again.'
                        : `❌ ${result.reason === 'ok' ? 'Wrong answer.' : `(${result.reason})`}`}
              </div>
            )}

            {answerLocked && !result && (
              <div className="mt-5 hard bg-white rounded-[12px] border-[3px] border-[var(--ink)] px-4 py-3 font-display font-[800] text-[14px] shadow-[3px_3px_0px_#10100F]">
                ⏳ Answer locked in — waiting for the admin to reveal…
              </div>
            )}

            {/* Educational explanation at reveal (matches the classic flow) */}
            {revealCorrect && q.explanation && (
              <div className="card-sm mt-4" style={{ padding: '12px 16px' }}>
                <div className="font-display font-[800] text-[11px] uppercase tracking-widest opacity-60 mb-1">💡 Explanation</div>
                <div className="font-body text-[14px] font-semibold leading-relaxed">{q.explanation}</div>
              </div>
            )}
          </div>
        )}

        {/* ═══ REVEAL (no active question shown) ═══ */}
        {loadState === 'ready' && status === 'question_reveal' && !q && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="text-[56px] mb-4">👁</div>
            <h1 className="font-display font-[900] text-[24px] uppercase tracking-tight mb-2">Answer Revealed</h1>
            <p className="font-body text-[14px] font-semibold opacity-70 mb-4">Check the results on the admin screen.</p>
            <button onClick={() => setShowBoard(true)} className="hard btn-press bg-[var(--violet)] text-white font-display font-[900] text-[15px] px-8 py-3.5 rounded-[12px] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] cursor-pointer">
              🏆 View Leaderboard
            </button>
          </div>
        )}

        {/* ═══ LEADERBOARD status ═══ */}
        {loadState === 'ready' && status === 'leaderboard' && (
          <BoardPanel gameId={state?.game?.id || ''} />
        )}

        {/* ═══ ENDED — final standings ═══ */}
        {loadState === 'ready' && status === 'ended' && (
          <BoardPanel gameId={state?.game?.id || ''} final showMe={me} />
        )}

        {/* ═══ Overlay leaderboard (while answering) ═══ */}
        {showBoard && (
          <div className="fixed inset-0 z-50 bg-[rgba(16,16,15,0.6)] flex items-center justify-center p-4" onClick={() => setShowBoard(false)}>
            <div className="hard bg-[var(--paper)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-5 w-full max-w-[560px] max-h-[80vh] overflow-y-auto shadow-[8px_8px_0px_#10100F]" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-display font-[900] text-[20px] uppercase tracking-tight">🏆 Live Standings</h2>
                <button onClick={() => setShowBoard(false)} className="w-8 h-8 rounded-full border-[2px] border-[var(--ink)] bg-white font-bold hover:bg-[var(--cherry)] hover:text-white">✕</button>
              </div>
              <div className="flex flex-col gap-2">
                {board.length === 0 && <div className="text-center font-body text-[14px] font-semibold opacity-60 py-6">Standings loading…</div>}
                {board.map(row => (
                  <div
                    key={row.team_id}
                    className={`lb-row ${row.rank === 1 ? 'first' : row.rank === 2 ? 'second' : row.rank === 3 ? 'third' : ''}`}
                    style={{ justifyContent: 'space-between', padding: '10px 14px' }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-display font-[900] text-[15px] shrink-0">
                        {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
                      </span>
                      <span className="font-display font-[800] text-[14px] truncate">{row.name || row.code}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {row.streak > 1 && <span className="text-[12px]">🔥{row.streak}</span>}
                      <span className="font-display font-[900] text-[15px] text-violet">{row.points.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/* ── Standings panel (leaderboard status / ended) ──────────────── */
function BoardPanel({ gameId, final, showMe }: { gameId: string; final?: boolean; showMe?: { points: number; total_correct: number } | null }) {
  const [board, setBoard] = useState<LbRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`/api/quiz/leaderboard?game_id=${encodeURIComponent(gameId)}`)
        const data = await res.json()
        if (!cancelled && data?.success) setBoard(data.leaderboard)
        else if (!cancelled && !data?.success) setError(data?.error || 'Failed to load standings.')
      } catch {
        if (!cancelled) setError('Failed to load standings.')
      }
    }
    load()
    if (!final) {
      const t = setInterval(load, 2000)
      return () => { cancelled = true; clearInterval(t) }
    }
    return () => { cancelled = true }
  }, [gameId, final])

  return (
    <div className="flex-1 flex flex-col gap-4 py-6">
      <div className="text-center">
        <div className="text-[52px] mb-2">{final ? '🏁' : '🏆'}</div>
        <h1 className="font-display font-[900] text-[26px] uppercase tracking-tight mb-2">
          {final ? 'Final Standings' : 'Standings'}
        </h1>
        {showMe && (
          <p className="font-body text-[14px] font-semibold opacity-70 mb-3">
            Your team: <strong>{showMe.points.toLocaleString()} pts</strong> · {showMe.total_correct} correct
          </p>
        )}
        {error && <p className="text-[13px] font-bold text-[var(--cherry)]">{error}</p>}
      </div>

      <div className="flex flex-col gap-2.5">
        {board.length === 0 && !error && (
          <div className="text-center font-body text-[14px] font-semibold opacity-60 py-8">Loading standings…</div>
        )}
        {board.map(row => (
          <div
            key={row.team_id}
            className={`lb-row ${row.rank === 1 ? 'first' : row.rank === 2 ? 'second' : row.rank === 3 ? 'third' : ''}`}
            style={{ justifyContent: 'space-between', padding: '12px 16px' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-display font-[900] text-[20px] shrink-0">
                {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
              </span>
              <span className="font-display font-[800] text-[16px] truncate">{row.name || row.code}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[13px] hidden sm:inline">{row.total_correct}/{row.total_answered} correct</span>
              {row.frenzy_correct_count > 0 && <span className="text-[12px]">💥{row.frenzy_correct_count}</span>}
              <span className="font-display font-[900] text-[18px] text-violet">{row.points.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <Link href="/quizflow/student/dashboard">
          <button className="hard btn-press bg-white text-[var(--ink)] font-display font-[800] text-[14px] px-6 py-3 rounded-[12px] border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F] cursor-pointer">
            ← Back to Dashboard
          </button>
        </Link>
      </div>
    </div>
  )
}
