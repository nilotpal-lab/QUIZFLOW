'use client'
export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  subscribeToSession, startGame, revealAnswer,
  showLeaderboard, nextQuestion, endGame, kickPlayer, setGameMode,
  getTacticsRankings, getMasteryRankings,
  togglePauseTimer, extendTimer, skipQuestion, toggleAliasMode
} from '@/quizflow/sessionStore'
import type { GameState } from '@/quizflow/sessionStore'
import { buildAvatarUrl } from '@/quizflow/utils'
import { FloatingReactions } from '@/quizflow/FloatingReactions'

const ANONYMOUS_ALIASES = [
  '🕵️ Agent Falcon', '🥷 Stealth Ninja', '🦊 Clever Fox', '🚀 Cosmic Rover',
  '🦁 Brave Lion', '🦉 Wise Owl', '⚡ Turbo Cheetah', '🐬 Swift Dolphin',
  '🐼 Gentle Panda', '🐯 Mighty Tiger', '🦅 Sharp Eagle', '🐻 Bear Cub',
  '🦄 Magic Pony', '🐲 Dragon Flame', '🐺 Lone Wolf', '🦈 Star Shark'
]

function getDisplayName(player: { id: string; nickname: string }, index: number, isAliasMode: boolean) {
  if (!isAliasMode) return player.nickname
  const charSum = player.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const aliasName = ANONYMOUS_ALIASES[(charSum + index) % ANONYMOUS_ALIASES.length]
  return aliasName
}

function TeacherHostDashboard() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pin          = searchParams.get('pin') || ''

  const [gameState, setGameState]           = useState<GameState | null>(null)
  const [copiedPin, setCopiedPin]           = useState(false)
  const [timeLeft, setTimeLeft]             = useState(0)
  const [activeBoard, setActiveBoard]       = useState<'tactics' | 'mastery'>('tactics')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Redirect if no PIN
  useEffect(() => {
    if (!pin) router.push('/quizflow/host/new')
  }, [pin])

  // Subscribe to session
  useEffect(() => {
    if (!pin) return
    const unsub = subscribeToSession(pin, (state) => {
      setGameState(state)
    })
    return unsub
  }, [pin])

  const [sessionTimeout, setSessionTimeout] = useState(false)
  useEffect(() => {
    if (!pin) return
    const t = setTimeout(() => {
      if (!gameState) setSessionTimeout(true)
    }, 6000)
    return () => clearTimeout(t)
  }, [pin])

  // Host timer countdown & auto-reveal when timer expires
  useEffect(() => {
    clearInterval(timerRef.current!)
    if (!gameState || gameState.status !== 'question_active') { setTimeLeft(0); return }
    if (gameState.isPaused) {
      const remaining = Math.max(0, Math.ceil((gameState.pausedTimeRemainingMs || 0) / 1000))
      setTimeLeft(remaining)
      return
    }
    const tick = () => {
      const remaining = Math.max(0, gameState.questionEndsAt - Date.now())
      setTimeLeft(Math.ceil(remaining / 1000))
      if (remaining <= 0) {
        clearInterval(timerRef.current!)
        revealAnswer(pin)
      }
    }
    tick()
    timerRef.current = setInterval(tick, 250)
    return () => clearInterval(timerRef.current!)
  }, [gameState?.status, gameState?.currentQuestionIndex, gameState?.questionEndsAt, gameState?.isPaused, gameState?.pausedTimeRemainingMs, pin])

  // Auto-reveal when ALL joined players have submitted their answers
  useEffect(() => {
    if (!gameState || gameState.status !== 'question_active') return
    const playersList = Object.values(gameState.players)
    if (playersList.length > 0 && playersList.every(p => p.hasAnswered)) {
      revealAnswer(pin)
    }
  }, [gameState?.status, gameState?.players, pin])

  // Auto-advance: question_reveal -> leaderboard (4s), leaderboard -> next question / end game (5s)
  useEffect(() => {
    if (!gameState) return

    if (gameState.status === 'question_reveal') {
      const timer = setTimeout(() => {
        showLeaderboard(pin)
      }, 4000)
      return () => clearTimeout(timer)
    }

    if (gameState.status === 'leaderboard') {
      const timer = setTimeout(() => {
        const totalQ = gameState.quiz.questions.length
        if (gameState.currentQuestionIndex + 1 < totalQ) {
          nextQuestion(pin)
        } else {
          endGame(pin)
        }
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [gameState?.status, gameState?.currentQuestionIndex, pin])

  const copyPin = () => {
    navigator.clipboard.writeText(pin)
    setCopiedPin(true)
    setTimeout(() => setCopiedPin(false), 2000)
  }

  if (!gameState) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div className="card anim-scale-in" style={{ padding: 48, textAlign: 'center', maxWidth: 400 }}>
        {sessionTimeout ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Session Not Found</div>
            <div style={{ fontFamily: 'Inter', fontSize: 14, color: '#666', marginBottom: 24 }}>PIN <strong>{pin}</strong> doesn't exist or has expired.</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Loading session…</div>
            <div style={{ fontFamily: 'Inter', fontSize: 13, color: '#888', marginBottom: 24 }}>Connecting to game room…</div>
          </>
        )}
        <a href="/quizflow/host/new">
          <button className="btn btn-primary" style={{ width: '100%' }}>← Back to Quiz Select</button>
        </a>
      </div>
    </div>
  )

  const players      = Object.values(gameState.players)
  const totalPlayers = players.length
  const answered     = players.filter(p => p.hasAnswered).length
  const q            = gameState.quiz.questions[gameState.currentQuestionIndex]
  const qIdx         = gameState.currentQuestionIndex
  const totalQ       = gameState.quiz.questions.length

  // Ranked players based on active leaderboard selection
  const rankedPlayers = activeBoard === 'mastery'
    ? getMasteryRankings(players)
    : getTacticsRankings(players)

  const sortedTop3 = rankedPlayers.slice(0, 3)

  // Answer distribution for current question
  const distColors = ['var(--cherry)', 'var(--sky)', 'var(--sun)', 'var(--mint)']
  const dist = q ? q.choices.map((text, i) => {
    const count = players.filter(p => p.selectedIndex === i).length
    const pct   = totalPlayers > 0 ? Math.round((count / totalPlayers) * 100) : 0
    return { label: String.fromCharCode(65+i), text, count, pct, color: distColors[i], isCorrect: i === q.correct_index }
  }) : []

  const accuracy = totalPlayers > 0 && dist.length > 0
    ? Math.round((players.filter(p => p.lastAnswerCorrect).length / Math.max(1, answered)) * 100)
    : 0

  // ── LOBBY VIEW ──
  if (gameState.status === 'lobby') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)', position: 'relative' }}>
        <FloatingReactions reactions={gameState?.reactions} />
        {/* Top bar */}
        <header className="top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', gap: 12 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, color: 'var(--paper)' }}>
            QuizFlow <span className="badge badge-sun" style={{ fontSize: 10, verticalAlign: 'middle' }}>HOST LOBBY</span>
          </div>
          <div className="pin-display" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)' }}>GAME PIN</span>
            <span className="pin-code">{pin}</span>
            <button onClick={copyPin} className="btn btn-sm" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
              {copiedPin ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => toggleAliasMode(pin)}
              className={`btn btn-sm ${gameState?.aliasMode ? 'btn-violet' : ''}`}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, border: '2px solid var(--paper)' }}
              title="Toggle Alias Mode to hide real student nicknames"
            >
              {gameState?.aliasMode ? '🕵️ Alias Mode: ON' : '🕵️ Alias Mode: OFF'}
            </button>
            <button
              className="btn btn-mint btn-lg"
              style={{ opacity: totalPlayers === 0 ? 0.5 : 1 }}
              onClick={() => startGame(pin)}
              disabled={totalPlayers === 0}
            >
              {totalPlayers === 0 ? '⏳ Waiting for players…' : `🎮 START GAME (${totalPlayers} joined)`}
            </button>
          </div>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 24 }}>
          {/* Game Mode Selector */}
          <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 800, color: 'var(--ink)' }}>GAME MODE:</span>
            <button
              onClick={() => setGameMode(pin, 'classic')}
              className={`btn btn-sm ${gameState.gameMode !== 'boss_raid' ? 'btn-sun' : ''}`}
              style={{ padding: '6px 14px', fontSize: 13, background: gameState.gameMode !== 'boss_raid' ? undefined : 'var(--paper-2)', color: 'var(--ink)' }}
            >
              🎯 Classic Mode
            </button>
            <button
              onClick={() => setGameMode(pin, 'boss_raid')}
              className={`btn btn-sm ${gameState.gameMode === 'boss_raid' ? 'btn-cherry' : ''}`}
              style={{ padding: '6px 14px', fontSize: 13, background: gameState.gameMode === 'boss_raid' ? undefined : 'var(--paper-2)', color: 'var(--ink)' }}
            >
              🐉 Boss Raid Mode
            </button>
          </div>

          <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 700, color: 'var(--ink)', textAlign: 'center' }}>
            📡 Join at <strong>quizflow.app</strong>
          </div>
          <div className="pin-display" style={{ padding: '24px 48px' }}>
            <span className="pin-code" style={{ fontSize: 80, letterSpacing: '0.18em' }}>{pin}</span>
          </div>
          <div style={{ color: 'var(--ink)', fontSize: 15, fontFamily: 'Inter', opacity: 0.6, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>📚 {gameState.quiz.title} — {totalQ} questions</span>
            {gameState.gameMode === 'boss_raid' && (
              <span className="badge badge-cherry">🐉 Boss Raid Active (100 HP)</span>
            )}
          </div>

          {totalPlayers > 0 && (
            <div className="card anim-scale-in" style={{ padding: 24, width: '100%', maxWidth: 700 }}>
              <div style={{ fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: 14, opacity: 0.6 }}>
                Players Joined ({totalPlayers})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {players.map((p, idx) => (
                  <div key={p.id} className="lb-row" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 6px 8px', borderRadius: 99 }}>
                    <div className="avatar-ring" style={{ width: 32, height: 32 }}>
                      <img src={buildAvatarUrl(p.avatarSeed, p.avatarStyle as any, 32)} alt="" width={32} height={32} />
                    </div>
                    <span style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {getDisplayName(p, idx, gameState?.aliasMode || false)}
                    </span>
                    <button onClick={() => kickPlayer(pin, p.id)} title="Kick" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cherry)', fontSize: 14, padding: '0 2px', fontWeight: 800 }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── ENDED VIEW ──
  if (gameState.status === 'ended') {
    router.push(`/quizflow/results?pin=${pin}`)
    return null
  }

  // ── GAME VIEW (question_active / question_reveal / leaderboard) ──
  const timePct = q ? Math.min(1, timeLeft / (q.time_limit_ms / 1000)) : 0

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)', position: 'relative' }}>
      <FloatingReactions reactions={gameState?.reactions} />

      {/* TOP BAR */}
      <header className="top-bar anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: 'var(--paper)' }}>
            QuizFlow
          </div>
          <div className="pin-display" style={{ padding: '4px 14px' }}>
            <span style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink)', marginRight: 8 }}>PIN</span>
            <span className="pin-code" style={{ fontSize: 20, letterSpacing: '0.14em' }}>{pin}</span>
          </div>
          {gameState.gameMode === 'boss_raid' && (
            <span className="badge badge-cherry" style={{ fontSize: 11, padding: '4px 10px', boxShadow: '2px 2px 0 var(--ink)' }}>
              🐉 BOSS RAID MODE
            </span>
          )}
        </div>

        {/* Live timer */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 40, fontWeight: 900, color: timePct > 0.5 ? 'var(--mint)' : timePct > 0.25 ? 'var(--sun)' : 'var(--cherry)', lineHeight: 1, transition: 'color 0.5s' }}>
            {gameState.status === 'question_active' ? timeLeft : '—'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--paper)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', opacity: 0.7 }}>seconds</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {gameState.status === 'question_active' && (
            <button className="btn btn-cherry" style={{ padding: '8px 18px', fontWeight: 700 }} onClick={() => revealAnswer(pin)}>
              👁 Reveal Answer
            </button>
          )}
          {gameState.status === 'question_reveal' && (
            <button className="btn btn-violet" style={{ padding: '8px 18px', fontWeight: 700 }} onClick={() => showLeaderboard(pin)}>
              🏆 Show Leaderboard
            </button>
          )}
          {gameState.status === 'leaderboard' && qIdx + 1 < totalQ && (
            <button className="btn btn-sun" style={{ padding: '8px 18px', fontWeight: 700 }} onClick={() => nextQuestion(pin)}>
              Next Question ({qIdx+2}/{totalQ}) →
            </button>
          )}
          {gameState.status === 'leaderboard' && qIdx + 1 >= totalQ && (
            <button className="btn btn-primary" style={{ padding: '8px 18px', fontWeight: 700 }} onClick={() => endGame(pin)}>
              🏁 End Game &amp; Show Results
            </button>
          )}
          <button onClick={copyPin} className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)', border: 'var(--line)', boxShadow: 'var(--shadow-hard)', padding: '8px 12px', fontSize: 12 }}>
            {copiedPin ? '✓' : '📋'} {pin}
          </button>
        </div>
      </header>

      {/* TEACHER LIVE CONTROL PANEL TOOLBAR */}
      <div className="anim-fade-up" style={{
        background: 'var(--paper-2)',
        borderBottom: 'var(--line)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink)', opacity: 0.75 }}>
            🎛️ Live Controls:
          </span>

          {/* ⏸️ Pause / Resume */}
          <button
            onClick={() => togglePauseTimer(pin)}
            disabled={gameState.status !== 'question_active'}
            className={`btn btn-sm ${gameState.isPaused ? 'btn-sun' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              opacity: gameState.status !== 'question_active' ? 0.5 : 1,
              border: '2px solid var(--ink)',
              boxShadow: '2px 2px 0 var(--ink)',
              background: gameState.isPaused ? '#FFE57F' : 'var(--paper)'
            }}
            title="Pause or Resume Question Timer"
          >
            {gameState.isPaused ? '▶️ Resume Timer' : '⏸️ Pause Timer'}
          </button>

          {/* ⏱️ +15s Extension */}
          <button
            onClick={() => extendTimer(pin, 15000)}
            disabled={gameState.status !== 'question_active'}
            className="btn btn-sm"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              opacity: gameState.status !== 'question_active' ? 0.5 : 1,
              border: '2px solid var(--ink)',
              boxShadow: '2px 2px 0 var(--ink)',
              background: 'var(--paper)'
            }}
            title="Add 15 Seconds to Timer"
          >
            ⏱️ +15s Extension
          </button>

          {/* ⏭️ Skip Question */}
          <button
            onClick={() => skipQuestion(pin)}
            disabled={gameState.status !== 'question_active'}
            className="btn btn-sm"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              opacity: gameState.status !== 'question_active' ? 0.5 : 1,
              border: '2px solid var(--ink)',
              boxShadow: '2px 2px 0 var(--ink)',
              background: 'var(--paper)'
            }}
            title="Skip Question / Advance Phase"
          >
            ⏭️ Skip Question
          </button>

          {gameState.isPaused && (
            <span className="badge badge-cherry" style={{ fontSize: 11 }}>
              ⏸️ TIMER PAUSED
            </span>
          )}
        </div>

        <div>
          {/* 🕵️ Alias Mode Toggle */}
          <button
            onClick={() => toggleAliasMode(pin)}
            className={`btn btn-sm ${gameState.aliasMode ? 'btn-violet' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              border: '2px solid var(--ink)',
              boxShadow: '2px 2px 0 var(--ink)',
              background: gameState.aliasMode ? '#E1BEE7' : 'var(--paper)'
            }}
            title="Hide real student nicknames on projector display to prevent shaming"
          >
            {gameState.aliasMode ? '🕵️ Alias Mode: ON (Names Hidden)' : '🕵️ Alias Mode: OFF'}
          </button>
        </div>
      </div>

      {/* BOSS RAID HEALTH BAR (When Boss Raid mode active) */}
      {gameState.gameMode === 'boss_raid' && (
        <div className="anim-fade-up" style={{
          background: 'var(--paper-2)',
          borderBottom: 'var(--line)',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          boxShadow: '0 4px 0 var(--ink)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
            <span style={{ fontSize: 20 }}>🐉</span>
            <span>BOSS RAID HEALTH</span>
            {(gameState.bossHealth ?? 100) === 0 ? (
              <span className="badge badge-mint" style={{ fontSize: 11 }}>DEFEATED! 🎉</span>
            ) : (
              <span className="badge badge-cherry" style={{ fontSize: 11 }}>ACTIVE</span>
            )}
          </div>
          <div style={{ flex: 1, maxWidth: 450, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 800, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
              HP: {gameState.bossHealth ?? 100} / {gameState.bossMaxHealth ?? 100}
            </div>
            <div style={{ flex: 1, height: 18, background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 9, overflow: 'hidden', boxShadow: '2px 2px 0 var(--ink)', position: 'relative' }}>
              <div style={{
                width: `${Math.max(0, Math.min(100, ((gameState.bossHealth ?? 100) / (gameState.bossMaxHealth ?? 100)) * 100))}%`,
                height: '100%',
                background: (gameState.bossHealth ?? 100) > 50 ? 'var(--mint)' : (gameState.bossHealth ?? 100) > 25 ? 'var(--sun)' : 'var(--cherry)',
                transition: 'width 0.4s ease, background 0.4s'
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Timer bar */}
      <div className="timer-bar" style={{ borderRadius: 0, border: 'none', borderBottom: 'var(--line)', height: 8 }}>
        <div className="timer-bar-fill" style={{ width: `${timePct * 100}%`, background: timePct > 0.5 ? 'var(--mint)' : timePct > 0.25 ? 'var(--sun)' : 'var(--cherry)', transition: 'width 0.2s linear, background 0.5s' }} />
      </div>

      {/* MAIN THREE-COLUMN */}
      <div style={{ flex: 1, padding: '16px 20px', display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16 }}>

        {/* LEFT: Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Accuracy */}
          <div className="card anim-scale-in" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: 10, opacity: 0.6 }}>Class Accuracy</div>
            <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 8px' }}>
              <svg width={110} height={110} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={55} cy={55} r={46} fill="none" stroke="var(--paper-2)" strokeWidth={10} />
                <circle cx={55} cy={55} r={46} fill="none" stroke="var(--mint)" strokeWidth={10}
                  strokeDasharray={2*Math.PI*46}
                  strokeDashoffset={2*Math.PI*46*(1-accuracy/100)}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 800, color: 'var(--ink)' }}>{accuracy}%</div>
                <div style={{ fontSize: 9, color: 'var(--ink)', fontFamily: 'Space Grotesk', opacity: 0.5, textTransform: 'uppercase' }}>ACCURATE</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'Inter', opacity: 0.6 }}>{answered}/{totalPlayers} answered</div>
          </div>

          {/* Response Bars */}
          <div className="card anim-scale-in" style={{ padding: 16, flex: 1 }}>
            <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', marginBottom: 12, opacity: 0.6 }}>Response Distribution</div>
            {dist.map(item => (
              <div key={item.label} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, color: 'var(--ink)', fontFamily: 'Space Grotesk' }}>
                    {item.label}. {item.text.slice(0,18)}{item.isCorrect && gameState.status !== 'question_active' ? ' ✓' : ''}
                  </span>
                  <span style={{ color: 'var(--ink)', fontFamily: 'Space Grotesk', opacity: 0.6 }}>{item.count}</span>
                </div>
                <div style={{ height: 10, background: 'var(--paper-2)', border: '1.5px solid var(--ink)', borderRadius: 0, overflow: 'hidden' }}>
                  <div style={{ width: `${item.pct}%`, height: '100%', background: item.color, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER: Question + Podium */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Question card */}
          <div className="card anim-scale-in" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="badge badge-ink">Question {qIdx+1} of {totalQ}</span>
              <span style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'Space Grotesk', opacity: 0.6 }}>
                {gameState.status === 'question_active' ? `⏱ ${timeLeft}s left` : gameState.status === 'question_reveal' ? '✅ Revealed' : '🏆 Leaderboard'}
              </span>
            </div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 700, lineHeight: 1.4, marginBottom: 20, color: 'var(--ink)' }}>{q?.prompt}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {dist.map((choice, ci) => (
                <div key={choice.label} style={{
                  padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
                  border: 'var(--line)',
                  background: (gameState.status !== 'question_active' && choice.isCorrect) ? 'var(--mint)' : distColors[ci] + '20',
                  boxShadow: '2px 2px 0 var(--ink)'
                }}>
                  <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>{choice.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: 'var(--ink)', fontFamily: 'Inter' }}>{choice.text}</span>
                  {gameState.status !== 'question_active' && choice.isCorrect && <span style={{ color: 'var(--ink)', fontSize: 16, fontWeight: 800 }}>✓</span>}
                  <span style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'Space Grotesk', opacity: 0.6 }}>{choice.count}</span>
                </div>
              ))}
            </div>

            {/* Submission progress */}
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: 'var(--ink)', fontFamily: 'Inter', opacity: 0.6 }}>Live Submissions</span>
                <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)' }}>{answered} / {totalPlayers} Answered</span>
              </div>
              <div className="timer-bar">
                <div className="timer-bar-fill" style={{ width: `${totalPlayers > 0 ? (answered/totalPlayers)*100 : 0}%` }} />
              </div>
            </div>
          </div>

          {/* Top-3 Podium + Dual Leaderboard Toggle */}
          <div className="card anim-scale-in" style={{ padding: 20, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', opacity: 0.6 }}>
                🏆 Top Podium ({activeBoard === 'mastery' ? 'Accuracy' : 'Tactics'})
              </div>
              {/* Dual Leaderboard Toggle Button */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--paper-2)', padding: 3, borderRadius: 8, border: 'var(--line)' }}>
                <button
                  onClick={() => setActiveBoard('tactics')}
                  style={{
                    fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    background: activeBoard === 'tactics' ? 'var(--sun)' : 'transparent',
                    color: 'var(--ink)', border: activeBoard === 'tactics' ? '1.5px solid var(--ink)' : 'none',
                    boxShadow: activeBoard === 'tactics' ? '1px 1px 0 var(--ink)' : 'none'
                  }}
                >
                  ⚡ Tactics Board
                </button>
                <button
                  onClick={() => setActiveBoard('mastery')}
                  style={{
                    fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, padding: '4px 8px', borderRadius: 6, cursor: 'pointer',
                    background: activeBoard === 'mastery' ? 'var(--mint)' : 'transparent',
                    color: 'var(--ink)', border: activeBoard === 'mastery' ? '1.5px solid var(--ink)' : 'none',
                    boxShadow: activeBoard === 'mastery' ? '1px 1px 0 var(--ink)' : 'none'
                  }}
                >
                  🎯 Mastery Board
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
              {sortedTop3[1] && (
                <div className="card-sm" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="avatar-ring" style={{ width: 44, height: 44, margin: '0 auto 6px' }}>
                    <img src={buildAvatarUrl(sortedTop3[1].avatarSeed, sortedTop3[1].avatarStyle as any, 44)} alt="" width={44} height={44} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink)', fontFamily: 'Space Grotesk', fontWeight: 800, opacity: 0.7 }}>2ND</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}>
                    {getDisplayName(sortedTop3[1], 1, gameState?.aliasMode || false)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sky)', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                    {activeBoard === 'mastery'
                      ? `${sortedTop3[1].totalAnswered ? Math.round(((sortedTop3[1].totalCorrect || 0) / sortedTop3[1].totalAnswered) * 100) : 0}% Acc`
                      : `${sortedTop3[1].score.toLocaleString()} pts`
                    }
                  </div>
                </div>
              )}
              {sortedTop3[0] && (
                <div className="card-sm" style={{ padding: 14, textAlign: 'center', transform: 'translateY(-8px)', background: activeBoard === 'mastery' ? 'var(--mint)' : 'var(--sun)' }}>
                  <div className="avatar-ring" style={{ width: 54, height: 54, margin: '0 auto 6px', border: '3px solid var(--ink)' }}>
                    <img src={buildAvatarUrl(sortedTop3[0].avatarSeed, sortedTop3[0].avatarStyle as any, 54)} alt="" width={54} height={54} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'Space Grotesk', fontWeight: 800 }}>👑 1ST</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>
                    {getDisplayName(sortedTop3[0], 0, gameState?.aliasMode || false)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink)', fontFamily: 'Space Grotesk', fontWeight: 800 }}>
                    {activeBoard === 'mastery'
                      ? `${sortedTop3[0].totalAnswered ? Math.round(((sortedTop3[0].totalCorrect || 0) / sortedTop3[0].totalAnswered) * 100) : 0}% Acc`
                      : `${sortedTop3[0].score.toLocaleString()} pts`
                    }
                  </div>
                </div>
              )}
              {sortedTop3[2] && (
                <div className="card-sm" style={{ padding: 12, textAlign: 'center' }}>
                  <div className="avatar-ring" style={{ width: 44, height: 44, margin: '0 auto 6px' }}>
                    <img src={buildAvatarUrl(sortedTop3[2].avatarSeed, sortedTop3[2].avatarStyle as any, 44)} alt="" width={44} height={44} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink)', fontFamily: 'Space Grotesk', fontWeight: 800, opacity: 0.5 }}>3RD</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}>
                    {getDisplayName(sortedTop3[2], 2, gameState?.aliasMode || false)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--sky)', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                    {activeBoard === 'mastery'
                      ? `${sortedTop3[2].totalAnswered ? Math.round(((sortedTop3[2].totalCorrect || 0) / sortedTop3[2].totalAnswered) * 100) : 0}% Acc`
                      : `${sortedTop3[2].score.toLocaleString()} pts`
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Student roster */}
        <div className="card anim-scale-in" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', opacity: 0.6 }}>
              {activeBoard === 'mastery' ? '🎯 Mastery Roster' : '⚡ Tactics Roster'} ({totalPlayers})
            </div>
            <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
              <span style={{ color: 'var(--mint)', fontFamily: 'Space Grotesk', fontWeight: 700 }}>● {answered}</span>
              <span style={{ color: 'var(--sun)', fontFamily: 'Space Grotesk', fontWeight: 700 }}>● {totalPlayers - answered}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flex: 1, maxHeight: 480 }}>
            {rankedPlayers.map((player, pIdx) => {
              const pAcc = player.totalAnswered ? Math.round(((player.totalCorrect || 0) / player.totalAnswered) * 100) : 0
              return (
                <div key={player.id} className="lb-row" style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="avatar-ring" style={{ width: 32, height: 32, flexShrink: 0 }}>
                    <img src={buildAvatarUrl(player.avatarSeed, player.avatarStyle as any, 32)} alt="" width={32} height={32} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                      {getDisplayName(player, pIdx, gameState?.aliasMode || false)}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink)', fontFamily: 'Inter', opacity: 0.7 }}>
                      {activeBoard === 'mastery'
                        ? `🎯 ${pAcc}% (${player.totalCorrect || 0}/${player.totalAnswered || 0})`
                        : `⚡ ${player.score.toLocaleString()} pts`
                      }
                    </div>
                  </div>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: player.hasAnswered ? 'var(--mint)' : 'var(--sun)', border: '1.5px solid var(--ink)' }} />
                  <button onClick={() => kickPlayer(pin, player.id)} title="Kick" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cherry)', fontSize: 13, padding: '2px', fontWeight: 800 }}>✕</button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HostPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', fontFamily: 'Space Grotesk', color: 'var(--ink)', fontSize: 20, fontWeight: 700 }}>
        Loading Host Dashboard…
      </div>
    }>
      <TeacherHostDashboard />
    </Suspense>
  )
}
