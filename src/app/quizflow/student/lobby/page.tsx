'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QuizFlowLogo from '@/quizflow/QuizFlowLogo'
import { requestFullscreen, exitFullscreen } from '@/quizflow/antiCheat'

interface GameStateResponse {
  success: boolean
  game?: {
    id: string
    mode: string
    status: string
    question_started_at: string | null
    boss_window_ends_at: string | null
    question_count: number
    is_paused?: boolean
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
    team_id?: string
    points: number
    coins: number
    streak: number
    max_streak: number
    total_correct: number
    total_answered: number
    last_answered_question_index?: number
    frozen_until: string | null
    bid_multiplier: number
    coin_multiplier?: number
    frenzy_correct_count: number
    violation_count?: number
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
  const [showShop, setShowShop] = useState(false)
  const [buyingItem, setBuyingItem] = useState<string | null>(null)
  const [shopMsg, setShopMsg] = useState<string | null>(null)
  const [board, setBoard] = useState<LbRow[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [bossCountdown, setBossCountdown] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [closedNotice, setClosedNotice] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wasInGameRef = useRef(false)

  const lastQuestionIdxRef = useRef<number | null>(null)

  const status = state?.game?.status || 'lobby'
  const isBoss = status === 'boss_frenzy'
  const isPaused = Boolean(state?.game?.is_paused)
  const q = state?.game?.active_question || null
  const me = state?.me

  /* ── Fullscreen toggle ────────────────────────────────────────── */
  const toggleFullscreen = () => {
    try {
      if (!document.fullscreenElement) {
        requestFullscreen()
        setIsFullscreen(true)
      } else {
        exitFullscreen()
        setIsFullscreen(false)
      }
    } catch { /* best-effort */ }
  }

  const handleReturnToDashboard = () => {
    try {
      if (typeof document !== 'undefined' && document.fullscreenElement) {
        exitFullscreen()
        setIsFullscreen(false)
      }
    } catch { /* best-effort */ }
    router.push('/quizflow/student/dashboard')
  }

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFsChange)
    return () => document.removeEventListener('fullscreenchange', handleFsChange)
  }, [])

  // Auto-exit fullscreen when unmounting
  useEffect(() => {
    return () => {
      try {
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          exitFullscreen()
        }
      } catch {}
    }
  }, [])

  /* ── Poll game state ─────────────────────────────────────────── */
  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/quiz/game/state')
      if (res.status === 401) {
        try {
          if (typeof document !== 'undefined' && document.fullscreenElement) {
            exitFullscreen()
          }
        } catch {}
        router.push('/quizflow/student/login')
        return
      }
      const data: GameStateResponse = await res.json()
      if (data?.success && data?.game) {
        setState(data)
        setLoadState('ready')
        wasInGameRef.current = true

        if (data.game.status === 'ended') {
          // If match ended, exit fullscreen so standings are viewed comfortably in normal screen
          try {
            if (typeof document !== 'undefined' && document.fullscreenElement) {
              exitFullscreen()
              setIsFullscreen(false)
            }
          } catch {}
        }

        const newQIdx = data.game?.active_question?.index ?? null

        // Only reset answer state when moving to a brand new question!
        if (lastQuestionIdxRef.current !== null && newQIdx !== null && lastQuestionIdxRef.current !== newQIdx) {
          setAnsweredIndex(null)
          setSelected(null)
          setResult(null)
        } else if (newQIdx !== null && data.me?.last_answered_question_index === newQIdx) {
          // If student refreshed after answering, restore their locked-in state
          setAnsweredIndex(newQIdx)
        }
        lastQuestionIdxRef.current = newQIdx
      } else if (res.status === 404 || !data?.success) {
        // Game has been closed or does not exist
        try {
          if (typeof document !== 'undefined' && document.fullscreenElement) {
            exitFullscreen()
            setIsFullscreen(false)
          }
        } catch {}
        setState(null)
        setLoadState('no_game')

        // If the student was inside an active game and the host closed it, gracefully return to dashboard
        if (wasInGameRef.current) {
          wasInGameRef.current = false
          setClosedNotice(true)
          setTimeout(() => {
            router.replace('/quizflow/student/dashboard?notice=arena_closed')
          }, 1200)
        }
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
    if (!showBoard && !showShop) return
    loadBoard()
    const t = setInterval(loadBoard, 2000)
    return () => clearInterval(t)
  }, [showBoard, showShop, loadBoard])

  /* ── Buy Shop Item ────────────────────────────────────────────── */
  const handleBuyShopItem = async (itemType: string, targetTeamId?: string) => {
    setBuyingItem(itemType)
    setShopMsg(null)
    try {
      let finalTarget = targetTeamId
      const myTeamId = state?.me?.team_id
      if (itemType === 'freeze_player' && !finalTarget && board.length > 0) {
        const opponents = board.filter(b => b.team_id && b.team_id !== myTeamId)
        if (opponents.length > 0) {
          finalTarget = opponents[Math.floor(Math.random() * opponents.length)].team_id
        }
      }

      const res = await fetch('/api/quiz/shop/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: itemType, target_team_id: finalTarget })
      })
      const data = await res.json()
      if (data?.success) {
        setShopMsg(`✅ Power-up activated!`)
        poll()
        setTimeout(() => {
          setShopMsg(null)
          setShowShop(false)
        }, 1000)
      } else {
        setShopMsg(`❌ ${data?.error || 'Purchase failed.'}`)
      }
    } catch {
      setShopMsg('❌ Network error.')
    } finally {
      setBuyingItem(null)
    }
  }

  /* ── Submit answer (server-authoritative) ────────────────────── */
  const handleAnswer = async (optionIndex: number) => {
    if (selected !== null || answeredIndex === q?.index || isPaused) return
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
        // Refresh live score immediately
        poll()
      }
    } catch {
      setResult({ correct: false, points: 0, coins: 0, reason: 'network_error' })
    }
  }

  const revealCorrect = status === 'question_reveal' || status === 'ended'
  const showQuestion = (status === 'question_active' || status === 'boss_frenzy' || status === 'question_reveal') && q
  const answerLocked = answeredIndex === q?.index

  const isFrozen = Boolean(me?.frozen_until && new Date(me.frozen_until).getTime() > Date.now())

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
            <span className={`badge ${isBoss ? 'badge-cherry' : status === 'ended' ? 'badge-violet' : isPaused ? 'badge-sun' : status === 'question_active' ? 'badge-mint' : status === 'question_reveal' ? 'badge-sky' : 'badge-sun'}`} style={{ fontSize: 9.5, maxWidth: 130, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isPaused ? 'PAUSED' : STATUS_LABEL[status] || status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {me && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="badge badge-ink text-[11px] sm:text-[12px] font-bold" title="Team Points">
                  ⚡ {me.points.toLocaleString()}
                </span>
                <button
                  onClick={() => setShowShop(true)}
                  className="badge badge-sun text-[11px] sm:text-[12px] font-bold cursor-pointer hover:scale-105 transition-transform flex items-center gap-1 border-[1.5px] border-[var(--ink)]"
                  title="Click to open Stadium Coin Shop"
                >
                  <span>🪙 {me.coins}</span>
                  <span className="bg-[#10100F] text-[var(--sun)] text-[8.5px] px-1 py-0.2 rounded font-black uppercase">Shop</span>
                </button>
                {me.streak > 1 && (
                  <span className="badge badge-cherry text-[11px] sm:text-[12px] font-bold" title="Current Streak">
                    🔥 {me.streak}
                  </span>
                )}
                {isFrozen && <span className="badge badge-sky text-[11px] sm:text-[12px] font-bold">🧊 FROZEN</span>}
              </div>
            )}
            <button
              onClick={toggleFullscreen}
              className="hard rounded-full px-2.5 py-1 text-[11px] font-display font-extrabold uppercase tracking-wider border-[2px] border-[var(--ink)] bg-white text-[var(--ink)] hover:bg-[var(--sun)] btn-press"
              style={{ minHeight: 30 }}
              title="Toggle Fullscreen Arena Mode"
            >
              {isFullscreen ? '✕ Normal' : '⛶ Fullscreen'}
            </button>
            {(status === 'question_active' || status === 'boss_frenzy' || status === 'question_reveal') && (
              <button
                onClick={() => setShowBoard(v => !v)}
                className={`hard rounded-full px-3 py-1.5 text-[11px] sm:px-4 sm:text-[12px] font-display font-bold uppercase tracking-wider border-[2px] border-[var(--ink)] btn-press ${showBoard ? 'bg-[var(--violet)] text-white' : 'bg-[var(--sun)] text-[var(--ink)]'}`}
                style={{ minHeight: 32 }}
              >
                🏆 {showBoard ? 'Hide' : 'Board'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-[820px] mx-auto px-3 md:px-6 py-5 md:py-10 flex flex-col gap-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        {/* ═══ WAITING (no game) ═══ */}
        {loadState === 'no_game' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="text-[64px] mb-4">🎯</div>
            <h1 className="font-display font-[900] text-[26px] uppercase tracking-tight mb-2">Arena Not Open Yet</h1>
            <p className="font-body text-[14px] font-semibold opacity-70 max-w-[400px] mb-6">
              The admin hasn&apos;t created the game yet. This page refreshes automatically — you&apos;ll drop into the lobby the moment it opens.
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
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="card anim-scale-in w-full max-w-[560px] p-6 md:p-8 bg-white border-[3px] border-[var(--ink)] shadow-[6px_6px_0px_#10100F]">
              <div className="flex justify-center gap-2 mb-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-3.5 h-3.5 rounded-full bg-[var(--sun)] border-[2px] border-[var(--ink)]" style={{ animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
              <h1 className="font-display font-[900] text-[26px] md:text-[32px] uppercase tracking-tight mb-2 text-[var(--ink)]">
                YOU&apos;RE IN THE ARENA LOBBY! 🚀
              </h1>
              <p className="font-body text-[14px] font-bold text-[#555] mb-6">
                Connected to Game Code:
              </p>

              {/* HUGE YELLOW GAME CODE BOX */}
              <div className="inline-block bg-[var(--sun)] border-[3.5px] border-[var(--ink)] rounded-[16px] px-8 py-4 shadow-[5px_5px_0px_#10100F] mb-6">
                <div className="font-display font-[900] text-[36px] md:text-[48px] tracking-[0.14em] text-[var(--ink)] leading-none">
                  {state?.game?.id || 'EVENT'}
                </div>
              </div>

              <div className="bg-[var(--paper-2)] border-[2px] border-[var(--ink)] rounded-[12px] p-4 mb-6 text-left">
                <div className="font-display font-[800] text-[13px] uppercase tracking-wider text-[var(--violet)] mb-1">
                  MATCH DETAILS
                </div>
                <div className="font-display font-[900] text-[16px] text-[var(--ink)]">
                  {state?.game?.question_count || 0} Questions · Mode: {state?.game?.mode.toUpperCase()}
                </div>
              </div>

              {!isFullscreen && (
                <button
                  onClick={toggleFullscreen}
                  className="w-full mb-4 py-2.5 px-4 bg-[var(--violet)] text-white border-[2.5px] border-[var(--ink)] rounded-[12px] font-display font-extrabold text-[13px] hard btn-press shadow-[3px_3px_0px_#10100F] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>⛶</span>
                  <span>Enter Fullscreen Arena Mode</span>
                </button>
              )}

              <div className="flex items-center justify-center gap-2 font-display font-[800] text-[13px] text-[var(--ink)] bg-[#E8F8F5] border-[2px] border-[#2ECC71] rounded-[10px] py-3 px-4">
                <span className="animate-spin text-[16px]">⏳</span>
                <span>Waiting for host to press START GAME...</span>
              </div>
            </div>
          </div>
        )}

        {/* ═══ QUESTION (active / boss) ═══ */}
        {showQuestion && q && (
          <div className="card anim-scale-in p-5 md:p-7 relative">
            {/* Host Paused Banner */}
            {isPaused && (
              <div className="mb-4 p-3.5 bg-[var(--sun)] border-[3px] border-[var(--ink)] rounded-[12px] text-center shadow-[4px_4px_0px_#10100F] animate-pulse">
                <div className="font-display font-[900] text-[16px] uppercase tracking-wider text-[var(--ink)] flex items-center justify-center gap-2">
                  <span>⏸️</span>
                  <span>QUIZ PAUSED BY HOST</span>
                </div>
                <div className="text-[12px] font-semibold text-[#444] mt-0.5">
                  Timer and input are frozen. Please wait for the host to resume.
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <span className="badge badge-ink">Q{q.index + 1} of {state?.game?.question_count}</span>
              <span className="font-display font-[800] text-[12px] uppercase tracking-wider opacity-60">
                {q.difficulty ? `🎚 ${q.difficulty.toUpperCase()}` : ''}
              </span>
            </div>

            {/* Active Multiplier or Freeze Banner */}
            {me && me.bid_multiplier > 1 && (
              <div className="mb-4 px-3 py-1.5 bg-[var(--sun)] border-[2.5px] border-[var(--ink)] rounded-[10px] font-display font-extrabold text-[12px] text-[var(--ink)] shadow-[2px_2px_0px_#10100F] inline-flex items-center gap-1.5">
                <span>⚡</span>
                <span>{me.bid_multiplier}× Points Multiplier Armed!</span>
              </div>
            )}
            {me && (me.coin_multiplier || 1) > 1 && (
              <div className="mb-4 ml-2 px-3 py-1.5 bg-[var(--mint)] border-[2.5px] border-[var(--ink)] rounded-[10px] font-display font-extrabold text-[12px] text-[var(--ink)] shadow-[2px_2px_0px_#10100F] inline-flex items-center gap-1.5">
                <span>🪙</span>
                <span>{me.coin_multiplier}× Coin Boost Armed!</span>
              </div>
            )}
            {isFrozen && (
              <div className="mb-4 px-4 py-2 bg-blue-100 border-[2.5px] border-blue-600 rounded-[10px] font-display font-extrabold text-[12px] sm:text-[13px] text-blue-900 shadow-[2px_2px_0px_#10100F] flex items-center gap-2">
                <span className="text-[16px]">🧊</span>
                <span>YOUR TEAM IS FROZEN! You cannot submit answers until the freeze expires.</span>
              </div>
            )}

            <h1 className="font-display font-[900] text-[clamp(17px,4.6vw,28px)] leading-snug tracking-tight mb-6">{q.prompt}</h1>

            <div className="quiz-answer-grid">
              {q.choices.map((choice, ci) => {
                const color = ANSWER_COLORS[ci % ANSWER_COLORS.length]
                const isCorrect = revealCorrect && q.correct_index === ci
                const isWrongPick = revealCorrect && selected === ci && !result?.correct && !isCorrect
                const isSelected = selected === ci
                const locked = answerLocked || result !== null || revealCorrect || selected !== null || isFrozen || isPaused

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
                    className={`answer-btn ${color} ${stateClass} ${isSelected && locked ? 'is-locked' : ''} ${isPaused ? 'opacity-60 cursor-not-allowed' : ''}`}
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
          <BoardPanel gameId={state?.game?.id || ''} onReturn={handleReturnToDashboard} />
        )}

        {/* ═══ ENDED — final standings ═══ */}
        {loadState === 'ready' && status === 'ended' && (
          <BoardPanel gameId={state?.game?.id || ''} final showMe={me} onReturn={handleReturnToDashboard} />
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

        {/* ═══ STADIUM COIN SHOP MODAL ═══ */}
        {showShop && (
          <div className="fixed inset-0 z-50 bg-[rgba(16,16,15,0.65)] flex items-center justify-center p-4" onClick={() => setShowShop(false)}>
            <div className="hard bg-[var(--paper)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-5 w-full max-w-[540px] max-h-[85vh] overflow-y-auto shadow-[8px_8px_0px_#10100F] animate-scale-in" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4 border-b-[2.5px] border-[var(--ink)] pb-3">
                <div>
                  <h2 className="font-display font-[900] text-[20px] uppercase tracking-tight flex items-center gap-2">
                    <span>🛒</span> Stadium Coin Shop
                  </h2>
                  <div className="text-[12px] text-[#555] font-semibold">
                    Spend your team coins on tactical advantages and multipliers.
                  </div>
                </div>
                <button onClick={() => setShowShop(false)} className="w-8 h-8 rounded-full border-[2px] border-[var(--ink)] bg-white font-bold hover:bg-[var(--cherry)] hover:text-white">✕</button>
              </div>

              {/* Coin Balance Badge */}
              <div className="mb-4 p-3 bg-[var(--paper-2)] border-[2px] border-[var(--ink)] rounded-[12px] flex items-center justify-between">
                <span className="font-display font-[800] text-[13px] uppercase tracking-wider text-[#555]">Your Team Balance</span>
                <span className="font-display font-[900] text-[18px] text-[var(--ink)]">🪙 {me?.coins ?? 0} Coins</span>
              </div>

              {shopMsg && (
                <div className="mb-4 p-2.5 rounded-[8px] border-[2px] border-[var(--ink)] text-[13px] font-bold text-center bg-[var(--mint)] shadow-[2px_2px_0px_#10100F]">
                  {shopMsg}
                </div>
              )}

              {/* Shop Items Catalog */}
              <div className="flex flex-col gap-3">
                {[
                  { type: 'coin_boost_2x', label: '2× Coin Doubler', emoji: '🪙', cost: 15, desc: 'Earn 2× Stadium Coins on your next correct answer.' },
                  { type: 'coin_boost_3x', label: '3× Coin Rush', emoji: '🔥', cost: 25, desc: 'Earn 3× Stadium Coins on your next correct answer.' },
                  { type: 'bid_2x', label: '2× Point Multiplier', emoji: '⚡', cost: 20, desc: 'Double your points on your next question.' },
                  { type: 'bid_3x', label: '3× Point Multiplier', emoji: '🔥', cost: 35, desc: 'Triple your points on your next question.' },
                  { type: 'bid_4x', label: '4× Point Multiplier', emoji: '💥', cost: 50, desc: 'Quadruple your points on your next question.' },
                  { type: 'freeze_all', label: 'Blizzard', emoji: '❄️', cost: 30, desc: 'Freeze ALL opposing teams for 4 seconds.' },
                  { type: 'freeze_player', label: 'Freeze Opponent', emoji: '🧊', cost: 15, desc: 'Freeze a random active rival team for 6 seconds.' }
                ].map(item => {
                  const canAfford = (me?.coins ?? 0) >= item.cost
                  const isPointArmed = Boolean(item.type.startsWith('bid_') && me?.bid_multiplier && me.bid_multiplier > 1)
                  const isCoinArmed = Boolean(item.type.startsWith('coin_boost_') && (me?.coin_multiplier || 1) > 1)
                  const isArmed = isPointArmed || isCoinArmed
                  return (
                    <div key={item.type} className="hard bg-white border-[2px] border-[var(--ink)] rounded-[12px] p-3.5 flex items-center justify-between gap-3 shadow-[2px_2px_0px_#10100F]">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[26px] shrink-0">{item.emoji}</span>
                        <div>
                          <div className="font-display font-[800] text-[14px] text-[var(--ink)]">{item.label}</div>
                          <div className="text-[12px] text-[#555] font-medium leading-tight">{item.desc}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleBuyShopItem(item.type)}
                        disabled={!canAfford || Boolean(buyingItem) || isArmed}
                        className={`hard px-3.5 py-2 rounded-[10px] font-display font-extrabold text-[12px] border-[2px] border-[var(--ink)] btn-press shrink-0 ${
                          isArmed 
                            ? 'bg-[var(--mint)] text-[var(--ink)] cursor-default'
                            : canAfford 
                              ? 'bg-[var(--sun)] text-[var(--ink)] hover:bg-[#FFD54F]' 
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {isArmed ? 'ARMED ✓' : buyingItem === item.type ? '⏳...' : `🪙 ${item.cost}`}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        {/* ═══ ARENA CLOSED MODAL NOTICE ═══ */}
        {closedNotice && (
          <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 anim-fade-in">
            <div className="card bg-white border-[3.5px] border-[var(--ink)] p-6 sm:p-8 max-w-[440px] w-full text-center shadow-[8px_8px_0px_#10100F] anim-scale-in">
              <div className="text-[52px] mb-3">🏟️</div>
              <h2 className="font-display font-[900] text-[24px] uppercase tracking-tight text-[var(--ink)] mb-2">
                Game Arena Closed
              </h2>
              <p className="font-body text-[14px] font-bold text-[#555] mb-6">
                The host has closed and reset the live arena. Returning you to the normal dashboard...
              </p>
              <button
                onClick={handleReturnToDashboard}
                className="hard bg-[var(--sun)] text-[var(--ink)] font-display font-[800] text-[14px] px-6 py-3 rounded-[12px] border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F] cursor-pointer w-full btn-press"
              >
                ← Go to Dashboard Now
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

/* ── Standings panel (leaderboard status / ended) ──────────────── */
function BoardPanel({ gameId, final, showMe, onReturn }: { gameId: string; final?: boolean; showMe?: { points: number; total_correct: number } | null; onReturn?: () => void }) {
  const router = useRouter()
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

  const handleBack = () => {
    if (onReturn) {
      onReturn()
    } else {
      try {
        if (typeof document !== 'undefined' && document.fullscreenElement) {
          exitFullscreen()
        }
      } catch {}
      router.push('/quizflow/student/dashboard')
    }
  }

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

      <div className="text-center mt-4">
        <button
          onClick={handleBack}
          className="hard btn-press bg-white text-[var(--ink)] font-display font-[800] text-[14px] px-6 py-3 rounded-[12px] border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F] cursor-pointer"
        >
          ← Return to Main Dashboard
        </button>
      </div>
    </div>
  )
}
