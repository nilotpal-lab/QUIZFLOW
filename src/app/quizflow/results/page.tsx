'use client'
export const dynamic = 'force-dynamic'
import { Suspense } from 'react'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { subscribeToSession } from '@/quizflow/sessionStore'
import type { GameState } from '@/quizflow/sessionStore'
import { buildAvatarUrl } from '@/quizflow/utils'

function ResultsInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pin     = searchParams.get('pin') || ''
  const myPid   = searchParams.get('pid') || ''

  const [gameState, setGameState] = useState<GameState | null>(null)
  const [confetti, setConfetti]   = useState<Array<{ id: number; x: number; color: string; delay: number; size: number }>>([])
  const [revealStep, setRevealStep] = useState(0) // 0: initial, 1: 3rd, 2: 2nd, 3: 1st
  const [activeBoard, setActiveBoard] = useState<'tactics' | 'mastery'>('tactics')

  const [sessionTimeout, setSessionTimeout] = useState(false)
  useEffect(() => {
    if (!pin) return
    const t = setTimeout(() => {
      if (!gameState) setSessionTimeout(true)
    }, 6000)
    return () => clearTimeout(t)
  }, [pin])

  useEffect(() => {
    if (!pin) return
    const unsub = subscribeToSession(pin, (state) => {
      if (state) setGameState(state)
    })
    return unsub
  }, [pin])

  // Sequential podium reveal timers
  useEffect(() => {
    if (!gameState) return
    const t1 = setTimeout(() => setRevealStep(1), 600)  // 3rd place
    const t2 = setTimeout(() => setRevealStep(2), 1600) // 2nd place
    const t3 = setTimeout(() => setRevealStep(3), 2800) // 1st place & spotlight
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [gameState])

  // Generate confetti on load (starts when 1st place is revealed)
  useEffect(() => {
    if (revealStep < 3) return
    const colors = ['var(--cherry)', 'var(--sun)', 'var(--mint)', 'var(--sky)', 'var(--violet)', '#F472B6']
    setConfetti(Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: colors[i % colors.length],
      delay: Math.random() * 1.5,
      size: 6 + Math.random() * 8,
    })))
  }, [revealStep])

  if (!gameState) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div className="card anim-scale-in" style={{ padding: 40, textAlign: 'center', maxWidth: 360 }}>
        {sessionTimeout ? (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🏁</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Results Not Found</div>
            <div style={{ fontFamily: 'Inter', fontSize: 13, color: '#888', marginBottom: 24 }}>This game session has ended or the PIN is invalid.</div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Loading results…</div>
            <div style={{ fontFamily: 'Inter', fontSize: 13, color: '#888', marginBottom: 24 }}>Fetching game data…</div>
          </>
        )}
        <a href="/quizflow"><button className="btn btn-primary" style={{ width: '100%' }}>← Go Home</button></a>
      </div>
    </div>
  )

  const players = Object.values(gameState.players).sort((a,b) => b.score - a.score)
  const me = myPid ? gameState.players[myPid] : null
  const winner = players[0]
  const PODIUM_COLORS = ['var(--sun)', '#94A3B8', '#B47C3C']
  const PODIUM_LABELS = ['👑 1ST PLACE', '🥈 2ND PLACE', '🥉 3RD PLACE']

  // ── Calculate Performance Badges ──
  const metricsMap = players.map(p => {
    const ansCount = p.totalAnswered || (p.score > 0 ? 1 : 0)
    const corrCount = p.totalCorrect || (p.score > 0 ? 1 : 0)
    const totalTime = p.totalResponseTimeMs || 0
    const avgResponseMs = ansCount > 0 ? totalTime / ansCount : Infinity
    const accuracy = ansCount > 0 ? corrCount / ansCount : 0
    const streakVal = p.maxStreak ?? p.streak ?? 0

    return { id: p.id, avgResponseMs, accuracy, streakVal, ansCount }
  })

  // ⚡ Speed Demon (lowest average response time among answered)
  let speedDemonId: string | null = null
  let minAvgMs = Infinity
  metricsMap.forEach(m => {
    if (m.ansCount > 0 && m.avgResponseMs < minAvgMs) {
      minAvgMs = m.avgResponseMs
      speedDemonId = m.id
    }
  })
  if (!speedDemonId && players.length > 0) {
    speedDemonId = players[0].id
  }

  // 🎯 Sharpshooter (100% accuracy)
  const sharpshooterIds = new Set(
    metricsMap.filter(m => (m.ansCount > 0 ? m.accuracy === 1 : (players.find(p => p.id === m.id)?.score || 0) > 0)).map(m => m.id)
  )

  // 🔥 Fire Starter (highest streak)
  let fireStarterId: string | null = null
  let maxStreakVal = 0
  metricsMap.forEach(m => {
    if (m.streakVal > maxStreakVal) {
      maxStreakVal = m.streakVal
      fireStarterId = m.id
    }
  })
  if (!fireStarterId && players.length > 0) {
    fireStarterId = players[0].id
  }

  const renderBadges = (pId: string) => {
    const badges = []
    if (pId === speedDemonId) {
      badges.push(
        <span key="speed" className="badge" style={{ background: '#E0F5FF', color: 'var(--ink)', border: '1.5px solid var(--ink)', fontSize: 10, padding: '2px 7px' }}>
          ⚡ Speed Demon
        </span>
      )
    }
    if (sharpshooterIds.has(pId)) {
      badges.push(
        <span key="sharp" className="badge" style={{ background: '#D6FFF4', color: 'var(--ink)', border: '1.5px solid var(--ink)', fontSize: 10, padding: '2px 7px' }}>
          🎯 Sharpshooter
        </span>
      )
    }
    if (pId === fireStarterId) {
      badges.push(
        <span key="fire" className="badge" style={{ background: '#FFE4E7', color: 'var(--ink)', border: '1.5px solid var(--ink)', fontSize: 10, padding: '2px 7px' }}>
          🔥 Fire Starter
        </span>
      )
    }
    if (badges.length === 0) return null
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
        {badges}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', overflowX: 'hidden', background: 'var(--paper)' }}>

      {/* Confetti */}
      {revealStep >= 3 && confetti.map(c => (
        <div key={c.id} style={{
          position: 'fixed', top: -20, left: `${c.x}%`, zIndex: 20, pointerEvents: 'none',
          width: c.size, height: c.size, borderRadius: 2, background: c.color,
          animation: `confetti-fall 3.5s ${c.delay}s ease-in infinite`
        }} />
      ))}

      <div style={{ position: 'relative', zIndex: 2, maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>

        {/* Header */}
        <div className="anim-fade-up" style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            fontFamily: 'Space Grotesk', fontSize: 52, fontWeight: 900, color: 'var(--ink)',
            textTransform: 'uppercase', letterSpacing: '-0.02em',
            textShadow: '4px 4px 0 var(--sun)'
          }}>
            🏆 FINAL RESULTS!
          </div>
          <div style={{ fontFamily: 'Inter', fontSize: 16, color: 'var(--ink)', marginTop: 10, opacity: 0.6 }}>
            {gameState.quiz.title}
          </div>
        </div>

        {/* Winner spotlight (Revealed at step >= 3) */}
        {winner && (
          <div className="card" style={{
            padding: '32px 24px', textAlign: 'center', marginBottom: 28,
            background: 'var(--sun)',
            opacity: revealStep >= 3 ? 1 : 0,
            transform: revealStep >= 3 ? 'scale(1)' : 'scale(0.85)',
            transition: 'all 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>👑</div>
            <div className="avatar-ring" style={{ width: 88, height: 88, margin: '0 auto 14px', border: '3px solid var(--ink)' }}>
              <img src={buildAvatarUrl(winner.avatarSeed, winner.avatarStyle as any, 88)} alt={winner.nickname} width={88} height={88} />
            </div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 30, fontWeight: 900, color: 'var(--ink)' }}>{winner.nickname}</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginTop: 4 }}>
              {winner.score.toLocaleString()} pts
            </div>
            <div style={{ color: 'var(--ink)', fontSize: 13, marginTop: 6, fontFamily: 'Inter', opacity: 0.65 }}>
              {winner.streak > 0 && `🔥 Best streak: ${winner.streak}x`}
            </div>
            {renderBadges(winner.id)}
            {myPid === winner.id && (
              <div className="badge badge-cherry" style={{ marginTop: 14, fontSize: 14, padding: '6px 20px' }}>
                🎉 That&apos;s YOU! Incredible!
              </div>
            )}
          </div>
        )}

        {/* Podium top 3 (Revealed sequentially: 3rd -> 2nd -> 1st) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28, alignItems: 'end' }}>
          {/* 2nd Place Card (Revealed at step >= 2) */}
          {players[1] && (
            <div className="card-sm" style={{
              padding: 16, textAlign: 'center',
              background: players[1].id === myPid ? 'var(--violet)' : 'var(--paper)',
              opacity: revealStep >= 2 ? 1 : 0,
              transform: revealStep >= 2 ? 'none' : 'translateY(24px) scale(0.9)',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🥈</div>
              <div className="avatar-ring" style={{ width: 52, height: 52, margin: '0 auto 8px' }}>
                <img src={buildAvatarUrl(players[1].avatarSeed, players[1].avatarStyle as any, 52)} alt="" width={52} height={52} />
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 800, color: players[1].id === myPid ? 'var(--sun)' : PODIUM_COLORS[1], textTransform: 'uppercase', letterSpacing: '0.05em' }}>🥈 2ND PLACE</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, marginTop: 2, color: players[1].id === myPid ? 'var(--paper)' : 'var(--ink)' }}>{players[1].nickname}</div>
              <div style={{ color: players[1].id === myPid ? 'var(--mint)' : PODIUM_COLORS[1], fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{players[1].score.toLocaleString()}</div>
              {renderBadges(players[1].id)}
            </div>
          )}

          {/* 1st Place Card (Revealed at step >= 3) */}
          {players[0] && (
            <div className="card-sm" style={{
              padding: 18, textAlign: 'center',
              background: players[0].id === myPid ? 'var(--violet)' : 'var(--sun)',
              opacity: revealStep >= 3 ? 1 : 0,
              transform: revealStep >= 3 ? 'translateY(-10px)' : 'translateY(24px) scale(0.9)',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>👑</div>
              <div className="avatar-ring" style={{ width: 60, height: 60, margin: '0 auto 8px', border: '3px solid var(--ink)' }}>
                <img src={buildAvatarUrl(players[0].avatarSeed, players[0].avatarStyle as any, 60)} alt="" width={60} height={60} />
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 800, color: players[0].id === myPid ? 'var(--sun)' : 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👑 1ST PLACE</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, marginTop: 2, color: players[0].id === myPid ? 'var(--paper)' : 'var(--ink)' }}>{players[0].nickname}</div>
              <div style={{ color: players[0].id === myPid ? 'var(--mint)' : 'var(--ink)', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 15 }}>{players[0].score.toLocaleString()}</div>
              {renderBadges(players[0].id)}
            </div>
          )}

          {/* 3rd Place Card (Revealed at step >= 1) */}
          {players[2] && (
            <div className="card-sm" style={{
              padding: 16, textAlign: 'center',
              background: players[2].id === myPid ? 'var(--violet)' : 'var(--paper)',
              opacity: revealStep >= 1 ? 1 : 0,
              transform: revealStep >= 1 ? 'none' : 'translateY(24px) scale(0.9)',
              transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>🥉</div>
              <div className="avatar-ring" style={{ width: 52, height: 52, margin: '0 auto 8px' }}>
                <img src={buildAvatarUrl(players[2].avatarSeed, players[2].avatarStyle as any, 52)} alt="" width={52} height={52} />
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 10, fontWeight: 800, color: players[2].id === myPid ? 'var(--sun)' : PODIUM_COLORS[2], textTransform: 'uppercase', letterSpacing: '0.05em' }}>🥉 3RD PLACE</div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, marginTop: 2, color: players[2].id === myPid ? 'var(--paper)' : 'var(--ink)' }}>{players[2].nickname}</div>
              <div style={{ color: players[2].id === myPid ? 'var(--mint)' : PODIUM_COLORS[2], fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14 }}>{players[2].score.toLocaleString()}</div>
              {renderBadges(players[2].id)}
            </div>
          )}
        </div>

        {/* My result card (if not winner) */}
        {me && myPid !== winner?.id && (
          <div className="card anim-fade-up" style={{ padding: '18px 20px', marginBottom: 24, background: 'var(--violet)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="avatar-ring" style={{ width: 52, height: 52, flexShrink: 0 }}>
              <img src={buildAvatarUrl(me.avatarSeed, me.avatarStyle as any, 52)} alt="" width={52} height={52} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, color: 'var(--paper)' }}>Your Result</div>
              <div style={{ color: 'var(--paper)', fontSize: 13, fontFamily: 'Inter', opacity: 0.75 }}>Rank #{me.rank} — {me.score.toLocaleString()} points</div>
              {renderBadges(me.id)}
            </div>
            <div className="badge badge-sun" style={{ fontSize: 18, padding: '8px 16px' }}>#{me.rank}</div>
          </div>
        )}

        {/* Boss Raid Mode Status Banner */}
        {gameState.gameMode === 'boss_raid' && (
          <div className="card anim-fade-up" style={{ padding: '16px 20px', marginBottom: 24, background: (gameState.bossHealth ?? 100) === 0 ? 'var(--mint)' : 'var(--cherry)', color: 'var(--ink)', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>
              {(gameState.bossHealth ?? 100) === 0 ? '🎉 BOSS DEFEATED! CO-OP VICTORY! 🗡️' : `🐉 BOSS SURVIVED WITH ${gameState.bossHealth} / ${gameState.bossMaxHealth ?? 100} HP!`}
            </div>
          </div>
        )}

        {/* Full leaderboard with Dual Leaderboard Toggle */}
        <div className="card anim-fade-up" style={{ padding: 20, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', opacity: 0.6 }}>
              Full Leaderboard ({players.length} players)
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

          {(activeBoard === 'mastery'
            ? [...players].sort((a,b) => {
                const aAcc = a.totalAnswered ? (a.totalCorrect || 0) / a.totalAnswered : 0
                const bAcc = b.totalAnswered ? (b.totalCorrect || 0) / b.totalAnswered : 0
                return bAcc - aAcc
              })
            : players
          ).map((p, i) => {
            const pAcc = p.totalAnswered ? Math.round(((p.totalCorrect || 0) / p.totalAnswered) * 100) : 0
            return (
              <div key={p.id} className="lb-row" style={{
                display: 'flex', alignItems: 'center', gap: 12,
                marginBottom: 8, padding: '8px 12px',
                background: p.id === myPid ? 'var(--violet)' : undefined,
              }}>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, minWidth: 28, color: i < 3 ? PODIUM_COLORS[i] : 'var(--ink)' }}>
                  {i === 0 ? '👑' : `#${i+1}`}
                </div>
                <div className="avatar-ring" style={{ width: 36, height: 36, flexShrink: 0 }}>
                  <img src={buildAvatarUrl(p.avatarSeed, p.avatarStyle as any, 36)} alt="" width={36} height={36} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 700, color: p.id === myPid ? 'var(--paper)' : 'var(--ink)' }}>
                    {p.nickname}{p.id === myPid ? ' (You)' : ''}
                  </div>
                  {renderBadges(p.id)}
                </div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: p.id === myPid ? 'var(--sun)' : 'var(--ink)' }}>
                  {activeBoard === 'mastery' ? `🎯 ${pAcc}% Acc (${p.totalCorrect || 0}/${p.totalAnswered || 0})` : `${p.score.toLocaleString()} pts`}
                </div>
              </div>
            )
          })}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/host/new"><button className="btn btn-primary btn-lg">🎮 Play Again</button></a>
          <a href="/"><button className="btn btn-sun btn-lg">🏠 Back to Home</button></a>
          <a href="/studio"><button className="btn btn-lg" style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: 'var(--line)', boxShadow: 'var(--shadow-hard)' }}>✨ Create New Quiz</button></a>
        </div>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', fontFamily: 'Space Grotesk', color: 'var(--ink)', fontSize: 20, fontWeight: 700 }}>
        Loading Results…
      </div>
    }>
      <ResultsInner />
    </Suspense>
  )
}
