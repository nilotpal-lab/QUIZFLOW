'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { buildAvatarUrl } from '@/quizflow/utils'
import { playClickSound, playLockInSound } from '@/quizflow/sound'

const RANDOM_NICKNAMES = [
  'CosmicTiger', 'PixelNinja', 'SpeedyOwl', 'StarVoyager',
  'NeonFalcon', 'TurboCheetah', 'QuantumFox', 'CyberPanda'
]

const SEEDS = ['Totoro','Kiki','Calcifer','Haku','Ponyo','Nausicaa','Howl','Chihiro']
const STYLES = [
  { id: 'adventurer', label: '🧝 Anime' },
  { id: 'lorelei',    label: '🎨 Lorelei' },
  { id: 'pixel-art',  label: '👾 Pixel' },
  { id: 'fun-emoji',  label: '😄 Emoji' },
]

export default function QuizFlowHome() {
  const router = useRouter()
  const [pin, setPin] = useState(['','','','','',''])
  const [nickname, setNickname] = useState('')
  const [seed, setSeed] = useState('Totoro')
  const [style, setStyle] = useState('adventurer')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputs = useRef<(HTMLInputElement|null)[]>([])

  const handlePinInput = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return
    playClickSound()
    const next = [...pin]
    next[i] = val.slice(-1)
    setPin(next)
    if (val && i < 5) inputs.current[i+1]?.focus()
  }
  const handlePinKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) inputs.current[i-1]?.focus()
  }

  const handleJoin = () => {
    const fullPin = pin.join('')
    if (fullPin.length < 6) { setError('Enter the full 6-digit PIN'); return }
    const trimmed = nickname.trim()
    if (!trimmed) { setError('Enter a nickname'); return }
    if (trimmed.length > 20) { setError('Nickname too long (max 20 chars)'); return }
    
    // Sanitize input against script tags / HTML
    const cleanNick = trimmed
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .trim()
      
    if (!cleanNick) { setError('Invalid characters in nickname'); return }
    setError('')
    setLoading(true)
    playLockInSound()
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    router.push(`/lobby/${fullPin}?nickname=${encodeURIComponent(cleanNick)}&seed=${encodeURIComponent(seed)}&style=${style}&pid=${playerId}`)
  }

  const shuffleSeed = () => {
    const others = SEEDS.filter(s => s !== seed)
    setSeed(others[Math.floor(Math.random() * others.length)])
  }

  return (
    <div className="page-wrapper memphis-bg" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top bar */}
      <div className="top-bar">
        <span style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>
          ⚡ QuizFlow
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="/dashboard"><button className="btn btn-sm" style={{ background: 'var(--violet)', color: '#fff' }}>📊 Dashboard</button></a>
          <a href="/auth"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>🔑 Login</button></a>
          <a href="/host/new"><button className="btn btn-sm" style={{ background: 'var(--sun)', color: 'var(--ink)' }}>📡 Host Game</button></a>
          <a href="/studio"><button className="btn btn-sm" style={{ background: 'var(--mint)', color: 'var(--ink)' }}>✨ AI Studio</button></a>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
        <div style={{ width: '100%', maxWidth: 480 }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="badge badge-cherry" style={{ marginBottom: 12, fontSize: 12 }}>🎮 LIVE CLASSROOM QUIZ</div>
            <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 40, fontWeight: 900, lineHeight: 1.1, marginBottom: 10 }}>
              Join the Game
            </h1>
            <p style={{ color: '#555', fontSize: 15, fontFamily: 'Inter' }}>
              Enter your game PIN and get ready to compete!
            </p>
          </div>

          {/* Card */}
          <div className="card" style={{ padding: 28 }}>

            {/* PIN */}
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555', display: 'block', marginBottom: 10 }}>
                Game PIN
              </label>
              <div style={{ display: 'flex', gap: 'clamp(4px, 2vw, 8px)', justifyContent: 'center' }}>
                {pin.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handlePinInput(i, e.target.value)}
                    onKeyDown={e => handlePinKey(i, e)}
                    aria-label={`PIN digit ${i + 1}`}
                    style={{
                      width: 'clamp(38px, 13vw, 52px)',
                      height: 'clamp(48px, 15vw, 60px)',
                      border: '2px solid var(--ink)',
                      borderRadius: 12,
                      textAlign: 'center',
                      fontFamily: 'Space Grotesk',
                      fontSize: 24,
                      fontWeight: 800,
                      background: d ? 'var(--sun)' : 'var(--paper)',
                      boxShadow: '3px 3px 0 var(--ink)',
                      outline: 'none',
                      color: 'var(--ink)',
                      transition: 'background 0.15s',
                    }}
                    onFocus={e => (e.target.style.boxShadow = '0 0 0 3px var(--violet), 3px 3px 0 var(--ink)')}
                    onBlur={e => (e.target.style.boxShadow = '3px 3px 0 var(--ink)')}
                  />
                ))}
              </div>
            </div>

            {/* Nickname */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555' }}>
                  Nickname
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="Enter your name..."
                  value={nickname}
                  onChange={e => setNickname(e.target.value.slice(0,20))}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                />
                <button
                  type="button"
                  onClick={() => {
                    playClickSound()
                    const rand = RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)]
                    setNickname(rand)
                  }}
                  className="btn"
                  style={{ background: 'var(--sun)', color: 'var(--ink)', whiteSpace: 'nowrap', fontSize: 13, padding: '0 14px' }}
                >
                  🎲 Randomize
                </button>
              </div>
            </div>

            {/* Avatar picker */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555' }}>
                  Avatar
                </label>
                <button onClick={shuffleSeed} className="btn btn-sm" style={{ padding: '4px 10px', fontSize: 12 }}>🔀 Shuffle</button>
              </div>

              {/* Style tabs */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                {STYLES.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className="btn btn-sm"
                    style={{
                      background: style === s.id ? 'var(--ink)' : 'var(--paper)',
                      color: style === s.id ? 'var(--paper)' : 'var(--ink)',
                      fontSize: 12,
                    }}
                  >{s.label}</button>
                ))}
              </div>

              {/* Seed grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {SEEDS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSeed(s)}
                    style={{
                      border: `2px solid var(--ink)`,
                      borderRadius: 12,
                      padding: 4,
                      background: seed === s ? 'var(--sun)' : 'var(--paper)',
                      boxShadow: seed === s ? '3px 3px 0 var(--ink)' : '2px 2px 0 var(--ink)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      transform: seed === s ? 'scale(1.05)' : 'scale(1)',
                    }}
                  >
                    <img src={buildAvatarUrl(s, style as any, 56)} alt={s} width={56} height={56} style={{ borderRadius: 8, display: 'block' }} />
                  </button>
                ))}
              </div>
            </div>

            {/* Your avatar preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', background: 'var(--paper-2)', border: '1.5px solid var(--ink)', borderRadius: 12, marginBottom: 20 }}>
              <div className="avatar-ring" style={{ width: 52, height: 52, flexShrink: 0 }}>
                <img src={buildAvatarUrl(seed, style as any, 52)} alt={seed} width={52} height={52} />
              </div>
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16 }}>{nickname || 'Your Name'}</div>
                <div style={{ color: '#555', fontSize: 12 }}>{seed} · {style}</div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '10px 14px', background: '#FFE4E6', border: '1.5px solid var(--cherry)', borderRadius: 10, color: 'var(--cherry)', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 13, marginBottom: 14 }}>
                ⚠️ {error}
              </div>
            )}

            {/* Join button */}
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', fontSize: 17 }}
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? '🎮 Joining...' : '🎮 Join Game'}
            </button>
          </div>

          {/* Host link */}
          <div style={{ textAlign: 'center', marginTop: 20, color: '#888', fontSize: 13 }}>
            Are you a teacher?{' '}
            <a href="/host/new" style={{ color: 'var(--violet)', fontWeight: 700, textDecoration: 'underline' }}>
              Host a Game →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
