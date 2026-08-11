'use client'
export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  subscribeToSession, submitAnswer
} from '@/quizflow/sessionStore'
import type { GameState } from '@/quizflow/sessionStore'
import { buildAvatarUrl, POWER_UPS, calculatePoints, formatPoints } from '@/quizflow/utils'
import type { PowerUpType } from '@/quizflow/types'
import {
  playClickSound, playLockInSound, playCountdownTick,
  playCorrectSound, playWrongSound, playPowerUpSound, playStreakSound,
  playWrongBuzzer
} from '@/quizflow/sound'
import { speakText, stopSpeech, toggleSpeech, isSpeaking } from '@/quizflow/speech'
import { useAntiCheat } from '@/quizflow/antiCheat'

function ScorePopup({ points, onDone }: { points: number; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 1400); return () => clearTimeout(t) }, [onDone])
  return <div className="score-popup" style={{ top: '38%', left: '50%', transform: 'translateX(-50%)' }}>{formatPoints(points)} ✨</div>
}

function StudentPlayScreen() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const pin        = searchParams.get('pin')      || ''
  const playerId   = searchParams.get('pid')      || ''

  const [nickname] = useState(() => {
    const fromUrl = searchParams.get('nickname')
    if (fromUrl) {
      if (typeof window !== 'undefined') sessionStorage.setItem(`qf_nick_${pin}`, fromUrl)
      return fromUrl
    }
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`qf_nick_${pin}`) || 'Player'
    }
    return 'Player'
  })

  const [avatarSeed] = useState(() => {
    const fromUrl = searchParams.get('seed')
    if (fromUrl) {
      if (typeof window !== 'undefined') sessionStorage.setItem(`qf_seed_${pin}`, fromUrl)
      return fromUrl
    }
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`qf_seed_${pin}`) || 'Totoro'
    }
    return 'Totoro'
  })

  const [avatarStyle] = useState(() => {
    const fromUrl = searchParams.get('style')
    if (fromUrl) {
      if (typeof window !== 'undefined') sessionStorage.setItem(`qf_style_${pin}`, fromUrl)
      return fromUrl
    }
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(`qf_style_${pin}`) || 'custom'
    }
    return 'custom'
  })

  const [gameState, setGameState]       = useState<GameState | null>(null)
  const [timeMs, setTimeMs]             = useState(20000)
  const [usedPowers, setUsedPowers]     = useState<Set<PowerUpType>>(new Set())
  const [hiddenChoices, setHiddenChoices] = useState<Set<number>>(new Set())
  const [frozen, setFrozen]             = useState(false)
  const [doubleActive, setDoubleActive] = useState(false)
  const [showPopup, setShowPopup]       = useState(false)
  const [popupPoints, setPopupPoints]   = useState(0)
  const [prevQIndex, setPrevQIndex]     = useState(-1)
  const [playedRevealSound, setPlayedRevealSound] = useState(false)
  const [activeBoard, setActiveBoard]   = useState<'tactics' | 'mastery'>('tactics')
  const [isTTSActive, setIsTTSActive]   = useState(false)
  const [sessionTimeout, setSessionTimeout] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Anti-cheat shield integration
  const { violationCount, showWarning, dismissWarning, lastReason } = useAntiCheat({
    enabled: gameState?.status === 'question_active' || gameState?.status === 'question_reveal',
    blockCopyPaste: true,
    blockContextMenu: true,
    onViolation: () => {
      playWrongBuzzer()
    }
  })

  // Subscribe to session
  useEffect(() => {
    const unsub = subscribeToSession(pin, (state) => {
      setGameState(state)
    })
    return unsub
  }, [pin])

  // Session timeout: if no state after 6s, show error
  useEffect(() => {
    if (!pin) return
    const t = setTimeout(() => {
      if (!gameState) setSessionTimeout(true)
    }, 6000)
    return () => clearTimeout(t)
  }, [pin])

  // Navigate away when game ends
  useEffect(() => {
    if (!gameState) return
    if (gameState.status === 'ended') {
      stopSpeech()
      router.push(`/quizflow/results?pin=${pin}&pid=${playerId}`)
    }
  }, [gameState?.status, pin, playerId, router])

  // Reset speech & state when question changes (preserve used power-ups across session)
  useEffect(() => {
    if (!gameState) return
    const qIdx = gameState.currentQuestionIndex
    if (qIdx !== prevQIndex) {
      setPrevQIndex(qIdx)
      setHiddenChoices(new Set())
      setFrozen(false)
      setDoubleActive(false)
      setPlayedRevealSound(false)
      setIsTTSActive(false)
      stopSpeech()
    }
  }, [gameState?.currentQuestionIndex, prevQIndex, gameState])

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      stopSpeech()
    }
  }, [])

  // Play reveal sound audio when status changes to question_reveal
  useEffect(() => {
    if (!gameState || gameState.status !== 'question_reveal' || playedRevealSound) return
    setPlayedRevealSound(true)
    const mePlayer = gameState.players[playerId]
    if (mePlayer?.lastAnswerCorrect) {
      playCorrectSound()
      if ((mePlayer?.streak ?? 0) >= 3) {
        setTimeout(playStreakSound, 400)
      }
    } else if (mePlayer?.hasAnswered) {
      playWrongSound()
    }
  }, [gameState?.status, playedRevealSound, playerId, gameState])

  // Local timer (cosmetic — synced with server ends_at)
  useEffect(() => {
    if (!gameState || gameState.status !== 'question_active') {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    if (gameState.isPaused) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      const remaining = Math.max(0, gameState.pausedTimeRemainingMs || 0)
      setTimeMs(remaining)
      return
    }
    if (frozen) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    const q = gameState.quiz.questions[gameState.currentQuestionIndex]
    const totalDuration = q?.time_limit_ms ?? 20000

    let lastSec = Math.ceil((gameState.questionEndsAt - Date.now()) / 1000)
    const tick = () => {
      const remaining = gameState.questionEndsAt - Date.now()
      const currentSec = Math.ceil(remaining / 1000)
      setTimeMs(Math.max(0, remaining))
      if (currentSec !== lastSec && currentSec > 0) {
        lastSec = currentSec
        const urgency = totalDuration > 0 ? 1 - Math.max(0, remaining) / totalDuration : 0
        playCountdownTick(urgency)
      }
      if (remaining <= 0 && intervalRef.current) clearInterval(intervalRef.current)
    }
    tick()
    intervalRef.current = setInterval(tick, 100)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [gameState?.status, gameState?.currentQuestionIndex, gameState?.questionEndsAt, gameState?.isPaused, gameState?.pausedTimeRemainingMs, frozen, gameState])

  const me = gameState?.players[playerId]
  const q  = gameState ? gameState.quiz.questions[gameState.currentQuestionIndex] : null
  const totalTime = q?.time_limit_ms ?? 20000
  const timePct   = totalTime > 0 ? timeMs / totalTime : 0
  const seconds   = Math.ceil(timeMs / 1000)

  const handleAnswer = useCallback((idx: number) => {
    if (!gameState || gameState.status !== 'question_active') return
    if (me?.hasAnswered) return

    if (typeof window !== 'undefined' && window.navigator?.vibrate) {
      window.navigator.vibrate(30)
    }

    playLockInSound()

    if (q) {
      const isCorrect = idx === q.correct_index
      const result = calculatePoints(timeMs, totalTime, isCorrect, me?.streak || 0, doubleActive)
      setPopupPoints(result.points)
      setShowPopup(true)
    }
    submitAnswer(pin, playerId, idx, doubleActive)
  }, [gameState, me, q, timeMs, totalTime, doubleActive, pin, playerId])

  const usePowerUp = (type: PowerUpType) => {
    if (usedPowers.has(type)) return
    setUsedPowers(prev => {
      const next = new Set<PowerUpType>()
      prev.forEach(p => next.add(p))
      next.add(type)
      return next
    })

    if (type === 'fifty_fifty' && q) {
      playPowerUpSound('5050')
      const wrong = q.choices.map((_, i) => i).filter(i => i !== q.correct_index)
      setHiddenChoices(new Set(wrong.sort(() => Math.random() - 0.5).slice(0, Math.min(2, wrong.length))))
    } else if (type === 'time_freeze') {
      playPowerUpSound('freeze')
      setFrozen(true)
      setTimeout(() => setFrozen(false), 5000)
    } else if (type === 'double_points') {
      playPowerUpSound('double')
      setDoubleActive(true)
    }
  }

  const handleToggleTTS = (text: string) => {
    playClickSound()
    const active = toggleSpeech(text)
    setIsTTSActive(active)
  }

  // answer-btn bg colors (light tints per design)
  const answerBgColors = [
    { bg: '#FFE4E7', border: 'var(--cherry)' }, // A cherry-light
    { bg: '#E0F5FF', border: 'var(--sky)' },    // B sky-light
    { bg: '#FFF8D6', border: 'var(--sun)' },    // C sun-light
    { bg: '#D6FFF4', border: 'var(--mint)' },   // D mint-light
  ]
  const answerGlyphs = ['▲', '◆', '●', '■']

  // ── LOBBY STATE ──
  if (!gameState || gameState.status === 'lobby') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <div className="card anim-scale-in" style={{ padding: '48px 40px', textAlign: 'center', maxWidth: 380 }}>
          {sessionTimeout && !gameState ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 8 }}>Session Not Found</div>
              <div style={{ fontFamily: 'Inter', fontSize: 14, color: '#666', marginBottom: 24 }}>PIN <strong>{pin}</strong> doesn't exist or has expired.</div>
              <a href="/quizflow">
                <button className="btn btn-primary" style={{ width: '100%' }}>← Back to Quiz Select</button>
              </a>
            </>
          ) : (
            <>
              <div className="avatar-ring" style={{ width: 80, height: 80, margin: '0 auto 16px' }}>
                <img src={buildAvatarUrl(avatarSeed, avatarStyle, 80)} alt={nickname} width={80} height={80} />
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: 'var(--ink)' }}>{nickname}</div>
              <div style={{ color: 'var(--ink)', fontSize: 14, fontFamily: 'Inter', marginTop: 8, opacity: 0.55 }}>
                {!gameState ? 'Connecting to game room…' : 'Waiting for teacher to start the game…'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--violet)', border: '1.5px solid var(--ink)', animation: `pulse-dot 1.2s ease-in-out ${i*0.2}s infinite` }} />
                ))}
              </div>
            </>
          )}
        </div>
        <style>{`@keyframes pulse-dot{0%,100%{transform:scale(1);opacity:0.4}50%{transform:scale(1.5);opacity:1}}`}</style>
      </div>
    )
  }

  // ── LEADERBOARD STATE ──
  if (gameState.status === 'leaderboard') {
    const sorted = activeBoard === 'mastery'
      ? Object.values(gameState.players).sort((a,b) => {
          const aAcc = a.totalAnswered ? (a.totalCorrect || 0) / a.totalAnswered : 0
          const bAcc = b.totalAnswered ? (b.totalCorrect || 0) / b.totalAnswered : 0
          return bAcc - aAcc
        })
      : Object.values(gameState.players).sort((a,b) => b.score - a.score)

    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--paper)' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>
          <div className="card anim-scale-in" style={{ padding: '28px 24px' }}>
            <div style={{ textAlign: 'center', fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 800, marginBottom: 4, color: 'var(--ink)' }}>
              🏆 Leaderboard
            </div>
            <div style={{ textAlign: 'center', color: 'var(--ink)', fontSize: 13, marginBottom: 16, fontFamily: 'Inter', opacity: 0.55 }}>
              Q{gameState.currentQuestionIndex + 1} of {gameState.quiz.questions.length} complete
            </div>

            {/* Dual Leaderboard Toggle Button */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 20 }}>
              <button
                onClick={() => setActiveBoard('tactics')}
                style={{
                  fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  background: activeBoard === 'tactics' ? 'var(--sun)' : 'var(--paper-2)',
                  color: 'var(--ink)', border: '1.5px solid var(--ink)',
                  boxShadow: activeBoard === 'tactics' ? '2px 2px 0 var(--ink)' : 'none'
                }}
              >
                ⚡ Tactics Board
              </button>
              <button
                onClick={() => setActiveBoard('mastery')}
                style={{
                  fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                  background: activeBoard === 'mastery' ? 'var(--mint)' : 'var(--paper-2)',
                  color: 'var(--ink)', border: '1.5px solid var(--ink)',
                  boxShadow: activeBoard === 'mastery' ? '2px 2px 0 var(--ink)' : 'none'
                }}
              >
                🎯 Mastery Board
              </button>
            </div>

            {sorted.slice(0, 8).map((p, i) => {
              const pAcc = p.totalAnswered ? Math.round(((p.totalCorrect || 0) / p.totalAnswered) * 100) : 0
              return (
                <div key={p.id} className="lb-row" style={{
                  padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
                  background: p.id === playerId ? 'var(--violet)' : undefined,
                }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, minWidth: 28, color: i === 0 ? 'var(--sun)' : i === 1 ? '#94A3B8' : i === 2 ? '#B47C3C' : 'var(--ink)' }}>
                    {i === 0 ? '👑' : `#${i+1}`}
                  </div>
                  <div className="avatar-ring" style={{ width: 36, height: 36 }}>
                    <img src={buildAvatarUrl(p.avatarSeed, p.avatarStyle as any, 36)} alt="" width={36} height={36} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 700, color: p.id === playerId ? 'var(--paper)' : 'var(--ink)' }}>{p.nickname}{p.id === playerId && ' (You)'}</div>
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 800, color: p.id === playerId ? 'var(--sun)' : 'var(--ink)' }}>
                    {activeBoard === 'mastery' ? `${pAcc}% Acc` : p.score.toLocaleString()}
                  </div>
                  {p.lastAnswerCorrect !== null && (
                    <span style={{ fontSize: 16 }}>{p.lastAnswerCorrect ? '✅' : '❌'}</span>
                  )}
                </div>
              )
            })}
            <div style={{ textAlign: 'center', color: 'var(--ink)', fontSize: 12, marginTop: 12, fontFamily: 'Inter', opacity: 0.5 }}>
              Next question loading…
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── QUESTION ACTIVE or REVEAL STATE ──
  const hasAnswered = me?.hasAnswered ?? false
  const isRevealed  = gameState.status === 'question_reveal'
  const myCorrect   = me?.lastAnswerCorrect
  const streakCount = me?.streak ?? 0

  return (
    <div
      className={`page-wrapper ${frozen ? 'frosted-freeze-container' : ''} ${isRevealed && myCorrect && streakCount >= 5 ? 'anim-shake' : ''}`}
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--paper)', position: 'relative' }}
    >
      {showPopup && <ScorePopup points={popupPoints} onDone={() => setShowPopup(false)} />}

      {/* FOCUS SHIELD WARNING POPUP MODAL */}
      {showWarning && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          background: 'rgba(16, 16, 15, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="card anim-scale-in" style={{
            maxWidth: 420,
            width: '100%',
            padding: '28px 24px',
            textAlign: 'center',
            background: 'var(--paper)',
            borderColor: 'var(--ink)',
            boxShadow: 'var(--shadow-hard-lg)'
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🛡️</div>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: 'var(--cherry)', marginBottom: 8 }}>
              FOCUS SHIELD WARNING
            </h3>
            <p style={{ fontFamily: 'Inter', fontSize: 14, color: 'var(--ink)', opacity: 0.8, marginBottom: 16, lineHeight: 1.45 }}>
              {lastReason === 'copy_paste_attempt'
                ? 'Copying and pasting is disabled during live quiz sessions to maintain academic integrity.'
                : 'Tab switch or window focus loss detected! Please keep your screen active and stay focused on the quiz.'}
            </p>
            <div style={{
              background: '#FFE4E7',
              border: '1.5px solid var(--cherry)',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 20,
              fontFamily: 'Space Grotesk',
              fontWeight: 700,
              fontSize: 13,
              color: 'var(--ink)'
            }}>
              ⚠️ Total Focus Losses / Violations: <span style={{ color: 'var(--cherry)', fontSize: 16 }}>{violationCount}</span>
            </div>
            <button
              onClick={() => {
                playClickSound()
                dismissWarning()
              }}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'var(--sun)',
                color: 'var(--ink)',
                border: 'var(--line)',
                borderRadius: 'var(--radius-btn)',
                boxShadow: 'var(--shadow-hard)',
                fontFamily: 'Space Grotesk',
                fontWeight: 800,
                fontSize: 15,
                cursor: 'pointer'
              }}
            >
              I Understand & Resume Quiz 🎯
            </button>
          </div>
        </div>
      )}

      {/* 3x+ Streak Floating Flame Particles on screen sides */}
      {streakCount >= 3 && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 40 }}>
          <div className="streak-flame streak-flame-left" style={{ top: '25%' }}>🔥</div>
          <div className="streak-flame streak-flame-left" style={{ top: '50%', animationDelay: '0.4s' }}>🔥</div>
          <div className="streak-flame streak-flame-left" style={{ top: '75%', animationDelay: '0.8s' }}>🔥</div>
          <div className="streak-flame streak-flame-right" style={{ top: '25%', animationDelay: '0.2s' }}>🔥</div>
          <div className="streak-flame streak-flame-right" style={{ top: '50%', animationDelay: '0.6s' }}>🔥</div>
          <div className="streak-flame streak-flame-right" style={{ top: '75%', animationDelay: '1s' }}>🔥</div>
        </div>
      )}

      {/* Time Freeze Falling Snowflake Particles */}
      {frozen && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 45, overflow: 'hidden' }}>
          {[10, 25, 40, 58, 72, 88].map((leftPct, i) => (
            <div
              key={i}
              className="snowflake"
              style={{
                left: `${leftPct}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: `${3 + (i % 3)}s`
              }}
            >
              ❄
            </div>
          ))}
        </div>
      )}

      {/* Frozen banner */}
      {frozen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'var(--sky)', border: 'none', borderBottom: 'var(--line)', padding: '10px 20px', textAlign: 'center', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15, color: 'var(--ink)', pointerEvents: 'none' }}>
          ⏳ Time Frozen for 5s!
        </div>
      )}

      {/* TOP HUD BAR */}
      <div className="top-bar anim-fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', gap: 12 }}>
        {/* Rank + avatar + anti-cheat focus badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="avatar-ring" style={{ width: 40, height: 40 }}>
            <img src={buildAvatarUrl(avatarSeed, avatarStyle, 40)} alt="" width={40} height={40} />
          </div>
          <div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: 'var(--paper)', lineHeight: 1, opacity: 0.7, textTransform: 'uppercase' }}>RANK</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: 'var(--sun)', lineHeight: 1.2 }}>
              #{me?.rank || '?'} <span style={{ color: 'var(--paper)', fontSize: 11, fontWeight: 500, opacity: 0.7 }}>/ {Object.keys(gameState.players).length}</span>
            </div>
          </div>
          {/* Anti-cheat shield badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            background: violationCount > 0 ? '#FFE4E7' : '#D6FFF4',
            border: '1.5px solid var(--ink)',
            borderRadius: 'var(--radius-pill)',
            boxShadow: '1.5px 1.5px 0px var(--ink)',
            fontFamily: 'Space Grotesk',
            fontSize: 10,
            fontWeight: 800,
            color: 'var(--ink)',
            marginLeft: 6
          }}>
            <span>{violationCount > 0 ? '⚠️' : '🛡️'}</span>
            <span>{violationCount > 0 ? `${violationCount} Violations` : 'Shield Active'}</span>
          </div>
        </div>

        {/* Timer countdown in center */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            fontFamily: 'Space Grotesk', fontSize: 44, fontWeight: 900, lineHeight: 1,
            color: timePct > 0.5 ? 'var(--mint)' : timePct > 0.25 ? 'var(--sun)' : 'var(--cherry)',
            transition: 'color 0.5s',
            animation: seconds <= 5 && seconds > 0 ? 'jitter 0.1s infinite' : 'none'
          }}>
            {isRevealed ? '—' : seconds}
          </div>
          {frozen && <div style={{ fontSize: 10, color: 'var(--sky)', fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase' }}>FROZEN</div>}
        </div>

        {/* Score + streak + 5x supercharged banner */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, color: 'var(--paper)', lineHeight: 1, opacity: 0.7, textTransform: 'uppercase' }}>SCORE</div>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: 'var(--mint)' }}>⚡ {(me?.score ?? 0).toLocaleString()}</div>
          {streakCount >= 5 ? (
            <div className="badge badge-sun anim-stamp-in" style={{ marginTop: 4, fontSize: 10, padding: '2px 8px', background: 'var(--sun)', color: 'var(--ink)', border: '1.5px solid var(--ink)' }}>
              SUPERCHARGED! ⚡
            </div>
          ) : streakCount > 1 ? (
            <div className="streak-badge" style={{ marginTop: 4, fontSize: 11, padding: '2px 8px' }}>🔥 {streakCount}x</div>
          ) : null}
        </div>
      </div>

      {/* BOSS RAID HEALTH BAR IN HUD (When gameMode === 'boss_raid') */}
      {gameState.gameMode === 'boss_raid' && (
        <div className="anim-fade-up" style={{
          background: 'var(--paper-2)',
          borderBottom: 'var(--line)',
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          boxShadow: '0 2px 0 var(--ink)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>
            <span style={{ fontSize: 18 }}>🐉</span>
            <span>BOSS HP:</span>
            <span>{gameState.bossHealth ?? 100} / {gameState.bossMaxHealth ?? 100}</span>
            {(gameState.bossHealth ?? 100) === 0 && <span className="badge badge-mint" style={{ fontSize: 10 }}>DEFEATED! 🎉</span>}
          </div>
          <div style={{ flex: 1, maxWidth: 350, height: 16, background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 8, overflow: 'hidden', boxShadow: '2px 2px 0 var(--ink)' }}>
            <div style={{
              width: `${Math.max(0, Math.min(100, ((gameState.bossHealth ?? 100) / (gameState.bossMaxHealth ?? 100)) * 100))}%`,
              height: '100%',
              background: (gameState.bossHealth ?? 100) > 50 ? 'var(--mint)' : (gameState.bossHealth ?? 100) > 25 ? 'var(--sun)' : 'var(--cherry)',
              transition: 'width 0.3s ease, background 0.3s'
            }} />
          </div>
        </div>
      )}

      {/* Timer bar */}
      <div style={{ padding: '0', position: 'relative' }}>
        <div className="timer-bar" style={{ borderRadius: 0, border: 'none', borderBottom: 'var(--line)', height: 8 }}>
          <div className="timer-bar-fill" style={{
            width: `${(isRevealed ? 0 : timePct) * 100}%`,
            background: timePct > 0.5 ? 'var(--mint)' : timePct > 0.25 ? 'var(--sun)' : 'var(--cherry)',
            transition: 'width 0.1s linear, background 0.5s'
          }} />
        </div>
      </div>

      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Question Card with Dominant Hero Typography & TTS */}
        {q && (
          <div className={`card anim-scale-in ${doubleActive ? 'star-aura' : ''}`} style={{ padding: '24px 22px', background: 'var(--surface-1)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(20px, 3.6vw, 30px)', fontWeight: 800, lineHeight: 1.3, flex: 1, color: 'var(--ink)', margin: 0 }}>
                {q.prompt}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {doubleActive && <span className="badge badge-sun">⭐ 2× DOUBLE</span>}
                <button
                  type="button"
                  onClick={() => handleToggleTTS(q.prompt)}
                  style={{
                    padding: '8px 14px',
                    background: isTTSActive ? 'var(--sun)' : 'var(--paper)',
                    border: '2px solid var(--ink)',
                    borderRadius: 'var(--radius-btn)',
                    boxShadow: '2px 2px 0px var(--ink)',
                    fontFamily: 'Space Grotesk',
                    fontSize: 12,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                  title="Read question prompt aloud"
                  aria-label="Read question aloud"
                >
                  <span>{isTTSActive ? '🔊' : '🔈'}</span>
                  <span>{isTTSActive ? 'Stop' : 'Listen'}</span>
                </button>
              </div>
            </div>
            {(q.imageUrl || q.media_url) && (
              <div style={{ marginTop: 14, textAlign: 'center' }}>
                <img
                  src={q.imageUrl || q.media_url}
                  alt="Question Diagram"
                  style={{
                    maxHeight: 200,
                    maxWidth: '100%',
                    objectFit: 'contain',
                    borderRadius: 12,
                    border: '3px solid var(--ink)',
                    boxShadow: '3px 3px 0 var(--ink)',
                    margin: '0 auto',
                    background: 'var(--paper)'
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none'
                  }}
                />
              </div>
            )}
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink)', fontFamily: 'Space Grotesk', opacity: 0.6, fontWeight: 700 }}>
              QUESTION {gameState.currentQuestionIndex + 1} OF {gameState.quiz.questions.length}
            </div>
          </div>
        )}

        {/* Answer Grid 2×2 */}
        {q && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
            {q.choices.map((choice, idx) => {
              const colors   = answerBgColors[idx]
              const isHidden = hiddenChoices.has(idx)
              const isCorrect = idx === q.correct_index
              const myPick    = me?.selectedIndex === idx

              let bg = colors.bg
              let borderColor = colors.border
              if (isRevealed) {
                if (isCorrect) { bg = 'var(--mint)'; borderColor = 'var(--ink)' }
                else if (myPick) { bg = 'var(--cherry)'; borderColor = 'var(--ink)' }
              }

              const btnClasses = [
                'answer-btn',
                doubleActive ? 'star-aura' : '',
                isHidden ? 'choice-dissolved' : '',
                myPick ? 'is-locked' : '',
                hasAnswered && !myPick && !isCorrect ? 'is-dimmed' : ''
              ].filter(Boolean).join(' ')

              return (
                <button
                  key={idx}
                  className={btnClasses}
                  onClick={() => handleAnswer(idx)}
                  disabled={hasAnswered || isRevealed || isHidden}
                  style={{
                    position: 'relative',
                    minHeight: 88,
                    background: bg,
                    borderColor,
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                    ...(myPick ? { transform: 'translate(3px, 3px)', boxShadow: '1px 1px 0 var(--ink)' } : {}),
                    ...(hasAnswered && !myPick && !isCorrect ? { opacity: 0.35 } : {})
                  }}
                >
                  {/* Floating LOCKED IN badge */}
                  {myPick && (
                    <span
                      className="badge badge-ink anim-scale-in"
                      style={{
                        position: 'absolute',
                        top: -12,
                        right: 12,
                        zIndex: 10,
                        boxShadow: '2px 2px 0 var(--ink)',
                        padding: '3px 9px',
                        fontSize: 11,
                        fontWeight: 800,
                        background: 'var(--ink)',
                        color: 'var(--paper)'
                      }}
                    >
                      LOCKED IN 🔒
                    </span>
                  )}
                  <div className="answer-glyph" style={{ color: borderColor, flexShrink: 0, fontSize: 18, fontWeight: 900 }}>{answerGlyphs[idx]}</div>
                  <span style={{ fontSize: 14, lineHeight: 1.35, textAlign: 'left', color: 'var(--ink)', fontFamily: 'Inter', fontWeight: 600, flex: 1 }}>{choice}</span>
                  {isRevealed && isCorrect && <span style={{ marginLeft: 'auto', fontSize: 20, fontWeight: 800 }}>✓</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Waiting overlay: answer locked */}
        {hasAnswered && !isRevealed && (
          <div className="card anim-scale-in" style={{ padding: '16px 18px', textAlign: 'center', background: 'var(--mint)', borderColor: 'var(--ink)' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>
              ✅ Answer locked! Waiting for others…
            </div>
            <div style={{ color: 'var(--ink)', fontSize: 12, marginTop: 4, fontFamily: 'Inter', opacity: 0.65 }}>
              {Object.values(gameState.players).filter(p => p.hasAnswered).length} / {Object.keys(gameState.players).length} answered
            </div>
          </div>
        )}

        {/* Reveal feedback & Diagnostic Explanation TTS */}
        {isRevealed && me && (
          <div className={`card anim-scale-in ${streakCount >= 5 && myCorrect ? 'anim-shake' : ''}`} style={{
            padding: '18px 20px',
            background: myCorrect ? 'var(--mint)' : 'var(--cherry)',
            textAlign: 'center'
          }}>
            {myCorrect ? (
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
                ✅ Correct! +{(me.lastPointsEarned ?? 0).toLocaleString()} pts
              </div>
            ) : me.selectedIndex !== null ? (
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: 'var(--paper)' }}>
                ❌ Wrong! The answer was: <span style={{ color: 'var(--sun)' }}>{q?.choices[q.correct_index]}</span>
              </div>
            ) : (
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: 'var(--paper)' }}>
                ⏰ Time&apos;s up! The answer was: <span style={{ color: 'var(--sun)' }}>{q?.choices[q?.correct_index ?? 0]}</span>
              </div>
            )}
            {q?.explanation && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ color: 'var(--ink)', fontSize: 13, fontFamily: 'Inter', opacity: 0.85, fontWeight: 500 }}>
                  💡 {q.explanation}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleTTS(q.explanation || '')}
                  style={{
                    padding: '4px 12px',
                    background: 'var(--paper)',
                    border: '1.5px solid var(--ink)',
                    borderRadius: 'var(--radius-pill)',
                    boxShadow: '2px 2px 0px var(--ink)',
                    fontFamily: 'Space Grotesk',
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 4
                  }}
                >
                  <span>🔊</span> Read Explanation
                </button>
              </div>
            )}

            {/* Targeted Diagnostic Misconception Analysis */}
            {!myCorrect && me.selectedIndex !== null && (
              <div className="anim-scale-in" style={{
                marginTop: 12,
                padding: '12px 14px',
                background: 'var(--paper)',
                border: '2px solid var(--ink)',
                borderRadius: 12,
                boxShadow: '3px 3px 0 var(--ink)',
                textAlign: 'left',
                color: 'var(--ink)'
              }}>
                <div style={{
                  fontFamily: 'Space Grotesk',
                  fontWeight: 800,
                  fontSize: 12,
                  color: 'var(--cherry)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  <span>🔍 Diagnostic Misconception Analysis</span>
                </div>
                <div style={{ fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>
                  {q?.misconceptions?.[me.selectedIndex] || `Choosing "${q?.choices[me.selectedIndex]}" reflects a common misconception confusing it with ${q?.choices[q.correct_index]}.`}
                </div>
              </div>
            )}

            <div style={{ color: 'var(--ink)', fontSize: 11, marginTop: 10, fontFamily: 'Inter', opacity: 0.55 }}>Waiting for next question…</div>
          </div>
        )}

        {/* Bottom: Avatar + Power-up tray */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar-ring" style={{ width: 48, height: 48 }}>
              <img src={buildAvatarUrl(avatarSeed, avatarStyle, 48)} alt={nickname} width={48} height={48} />
            </div>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{nickname}</span>
          </div>
          {/* Power-up tray */}
          <div style={{ display: 'flex', gap: 8 }}>
            {POWER_UPS.map(p => (
              <button
                key={p.type}
                className={`powerup-btn ${usedPowers.has(p.type) ? 'used' : ''}`}
                onClick={() => usePowerUp(p.type)}
                title={`${p.label}: ${p.description}`}
                disabled={hasAnswered || isRevealed}
              >{p.emoji}</button>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes jitter{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}`}</style>
    </div>
  )
}

export default function PlayPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', fontFamily: 'Space Grotesk', color: 'var(--ink)', fontSize: 20, fontWeight: 700 }}>
        Loading…
      </div>
    }>
      <StudentPlayScreen />
    </Suspense>
  )
}
