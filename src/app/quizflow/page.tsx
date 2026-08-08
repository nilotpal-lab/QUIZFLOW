'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { buildAvatarUrl } from '@/quizflow/utils'
import { playClickSound, playLockInSound } from '@/quizflow/sound'

const RANDOM_NICKNAMES = [
  'QuantumNinja', 'NeonSage', 'ByteTiger', 'CosmicFox',
  'PixelPanda', 'TurboMantis', 'NovaOwl', 'AstroLynx',
  'VaporWolf', 'CyberKoala'
]

const AVATAR_PREVIEWS = [
  { emoji: '🦊', bg: '#FF5252' },
  { emoji: '🐼', bg: '#FFE57F' },
  { emoji: '🦄', bg: '#00E676' },
  { emoji: '🤖', bg: '#40C4FF' },
  { emoji: '👾', bg: '#7C4DFF' },
  { emoji: '🦁', bg: '#FF5252' },
  { emoji: '🐙', bg: '#FFE57F' },
  { emoji: '🐯', bg: '#00E676' }
]

export default function QuizFlowHome() {
  const router = useRouter()
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [nickname, setNickname] = useState('')
  const [style, setStyle] = useState('Adventurer')
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [seed, setSeed] = useState('seed-042')
  const [randomBtnText, setRandomBtnText] = useState('🎲 Randomize')
  const [shuffleBtnText, setShuffleBtnText] = useState('🔀 Shuffle')
  const [error, setError] = useState('')
  const inputs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ]

  const handlePinInput = (i: number, val: string) => {
    const char = val.replace(/[^0-9A-Za-z]/g, '').slice(-1).toUpperCase()
    const next = [...pin]
    next[i] = char
    setPin(next)
    if (char && i < 5) inputs[i + 1].current?.focus()
  }

  const handlePinKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) {
      inputs[i - 1].current?.focus()
    }
  }

  const handleRandomizeNick = () => {
    playClickSound()
    const rand = RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)] + Math.floor(Math.random() * 99)
    setNickname(rand)
    setRandomBtnText('✓ ' + rand)
    setTimeout(() => setRandomBtnText('🎲 Randomize'), 1500)
  }

  const handleShuffleSeed = () => {
    playClickSound()
    const newSeed = 'seed-' + Math.random().toString(36).slice(2, 6)
    setSeed(newSeed)
    setShuffleBtnText('✓ ' + newSeed)
    setTimeout(() => setShuffleBtnText('🔀 Shuffle'), 1500)
  }

  const handleJoin = () => {
    const fullPin = pin.join('')
    if (fullPin.length < 6) { setError('Enter the full 6-digit PIN'); return }
    const trimmed = nickname.trim()
    if (!trimmed) { setError('Enter a nickname'); return }
    if (trimmed.length > 20) { setError('Nickname too long (max 20 chars)'); return }

    const cleanNick = trimmed
      .replace(/<[^>]*>/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .trim()

    if (!cleanNick) { setError('Invalid characters in nickname'); return }
    setError('')
    playLockInSound()
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    router.push(`/lobby/${fullPin}?nickname=${encodeURIComponent(cleanNick)}&seed=${seed}&style=${style.toLowerCase()}&pid=${playerId}`)
  }

  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[#FFE57F] overflow-x-hidden">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="font-display font-[800] text-[24px] tracking-tight flex items-center gap-1">
              <span>⚡</span> QuizFlow
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/dashboard"><button className="hidden lg:inline-flex hard bg-white rounded-full px-3 py-1.5 text-[12px] font-display font-bold">📊 Dashboard</button></a>
            <a href="/auth"><button className="hidden lg:inline-flex hard bg-white rounded-full px-3 py-1.5 text-[12px] font-display font-bold">🔑 Login</button></a>
            <a href="/host/new"><button className="hard bg-[var(--violet)] text-white rounded-full px-3.5 py-1.5 text-[12px] font-display font-bold">📡 Host Game</button></a>
            <a href="/studio"><button className="hard bg-[var(--sun)] text-[var(--ink)] rounded-full px-3.5 py-1.5 text-[12px] font-display font-bold">✨ AI Studio</button></a>
          </div>
        </div>
      </nav>

      {/* Main Dual-Track Hero */}
      <main className="max-w-[1280px] mx-auto px-4 md:px-6 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        {/* Left: Student Track */}
        <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-5 md:p-8 relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 opacity-[0.06] rotate-12 select-none text-[90px]">◐</div>
          <div className="absolute right-10 bottom-10 opacity-[0.05] text-[var(--ink)] font-display font-[800] text-[80px]">〰</div>
          
          <h1 className="font-display font-[800] text-[38px] md:text-[48px] leading-[0.95] tracking-[-0.02em]">
            JOIN THE<br />ARENA
          </h1>

          {error && (
            <div className="mt-3 text-[13px] font-bold text-[var(--cherry)] bg-red-100 border border-red-300 p-2 rounded-md">
              ⚠️ {error}
            </div>
          )}

          {/* PIN Input */}
          <div className="mt-6">
            <label className="font-display text-[12px] font-[800] tracking-widest block mb-2">GAME PIN</label>
            <div className="flex gap-2 flex-wrap">
              {pin.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputs[idx]}
                  value={digit}
                  onChange={e => handlePinInput(idx, e.target.value)}
                  onKeyDown={e => handlePinKey(idx, e)}
                  maxLength={1}
                  className="w-[clamp(38px,13vw,52px)] h-[64px] text-center bg-[var(--paper)] rounded-[12px] border-[3px] border-[var(--ink)] font-display text-[24px] font-[800] outline-none focus:ring-[3px] focus:ring-[#FFE57F] shadow-[3px_3px_0px_#10100F]"
                  placeholder="·"
                  aria-label={`PIN digit ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Nickname Input */}
          <div className="mt-6">
            <label className="font-display text-[12px] font-[800] tracking-widest block mb-2">NICKNAME</label>
            <div className="flex gap-2">
              <input
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                placeholder="Enter nickname..."
                className="flex-1 h-[48px] px-4 bg-white rounded-[12px] border-[3px] border-[var(--ink)] text-[16px] outline-none focus:ring-[3px] focus:ring-[#FFE57F] shadow-[3px_3px_0px_#10100F]"
              />
              <button
                type="button"
                onClick={handleRandomizeNick}
                className="hard btn-press bg-[var(--sun)] rounded-[12px] px-4 h-[48px] font-display font-[800] text-[13px] min-w-[130px]"
              >
                {randomBtnText}
              </button>
            </div>
          </div>

          {/* Avatar Selector */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <label className="font-display text-[12px] font-[800] tracking-widest">AVATAR STYLE</label>
              <button
                type="button"
                onClick={handleShuffleSeed}
                className="hard bg-white rounded-full px-3 py-1 text-[11px] font-display font-[700] min-w-[90px]"
              >
                {shuffleBtnText}
              </button>
            </div>

            {/* Style Pills */}
            <div className="flex gap-2 mb-3">
              {['Adventurer', 'Bottts', 'Lorelei'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`px-3 py-1.5 rounded-full border-[3px] border-[var(--ink)] font-display text-[12px] font-[800] ${
                    style === s ? 'bg-[var(--violet)] text-white shadow-[2px_2px_0px_#10100F]' : 'bg-white shadow-[2px_2px_0px_#10100F]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Avatar Grid */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              {AVATAR_PREVIEWS.map((av, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarIndex(idx)}
                  className={`relative aspect-square rounded-[16px] border-[3px] flex items-center justify-center text-[28px] transition-all hard btn-press ${
                    avatarIndex === idx ? 'border-[var(--violet)] ring-[3px] ring-[#7C4DFF]/30' : 'border-[var(--ink)]'
                  }`}
                  style={{ background: av.bg }}
                >
                  <span>{av.emoji}</span>
                  {avatarIndex === idx && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--violet)] border-[2px] border-[var(--ink)] flex items-center justify-center text-white text-[12px]">
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 font-display text-[10px] opacity-60">
              seed: {seed} · style: {style.toLowerCase()}
            </div>
          </div>

          {/* Big CTA */}
          <button
            type="button"
            onClick={handleJoin}
            className="mt-7 w-full h-[56px] rounded-[var(--radius-btn)] bg-[var(--violet)] text-[var(--paper)] font-display font-[800] text-[20px] hard btn-press tracking-tight"
          >
            🚀 Join Game →
          </button>
        </div>

        {/* Right: Teacher & Highlights Track */}
        <div className="flex flex-col gap-4">
          <div className="hard bg-[var(--paper)] rounded-[var(--radius-card)] p-6">
            <div className="font-display font-[800] text-[20px] leading-tight">
              Host your classroom<br />in 10 seconds
            </div>
            <p className="text-[13px] opacity-70 mt-1">
              Zero setup. Monotonic scoring + hard shadows.
            </p>

            <a href="/studio">
              <button className="mt-5 w-full h-[48px] rounded-[12px] hard btn-press bg-[var(--sky)] font-display font-[800] text-[14px]">
                ✨ Create Quiz with AI → /studio
              </button>
            </a>
            
            <a href="/host/new">
              <button className="mt-3 w-full h-[48px] rounded-[12px] hard btn-press bg-[var(--mint)] font-display font-[800] text-[14px]">
                🎮 Instant Demo Match
              </button>
            </a>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {[
                { k: '12k+', l: 'quizzes' },
                { k: '<50ms', l: 'latency' },
                { k: '99.9%', l: 'uptime' }
              ].map(stat => (
                <div key={stat.l} className="hard bg-[var(--paper-2)] rounded-[10px] py-2">
                  <div className="font-display font-[800] text-[16px]">{stat.k}</div>
                  <div className="text-[10px] font-display uppercase tracking-wide opacity-60">{stat.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feature Highlight Pill */}
          <div className="hard bg-[var(--ink)] text-[var(--paper)] rounded-[var(--radius-card)] p-5">
            <div className="font-display font-[800] text-[12px] tracking-widest opacity-70">
              REAL-TIME ARCHITECTURE
            </div>
            <div className="mt-3 space-y-1.5 font-mono text-[11px] leading-[1.4]">
              <div><span className="text-[#00E676]">subscribeToSession</span>(pin, cb)</div>
              <div><span className="text-[#40C4FF]">joinSessionAsync</span>(pin, player)</div>
              <div><span className="text-[#FFE57F]">submitAnswer</span>(pin, pid, idx)</div>
              <div className="opacity-60">Monotonic state merging · Zero split-brain</div>
            </div>
          </div>
        </div>
      </main>

      {/* Marquee Ticker */}
      <section className="w-full bg-[var(--ink)] text-[var(--paper)] h-[44px] overflow-hidden flex items-center border-y-[3px] border-[var(--ink)] relative max-w-[100vw]">
        <div className="whitespace-nowrap flex animate-[marquee_30s_linear_infinite] will-change-transform max-w-none">
          <span className="font-display font-[800] tracking-widest text-[14px] px-4">
            Quantum Mechanics · Ancient Rome · Cell Biology · World Geography · Web Engineering · Photosynthesis · World War II · React Hooks · 
          </span>
          <span className="font-display font-[800] tracking-widest text-[14px] px-4">
            Quantum Mechanics · Ancient Rome · Cell Biology · World Geography · Web Engineering · Photosynthesis · World War II · React Hooks · 
          </span>
          <span className="font-display font-[800] tracking-widest text-[14px] px-4">
            Quantum Mechanics · Ancient Rome · Cell Biology · World Geography · Web Engineering · Photosynthesis · World War II · React Hooks · 
          </span>
        </div>
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[var(--ink)] to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--ink)] to-transparent pointer-events-none" />
      </section>

      {/* 4-Card Feature Grid */}
      <section className="max-w-[1280px] mx-auto px-4 md:px-6 py-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: '⚡', title: 'Zero-Latency Multiplayer', desc: 'Supabase Realtime WebSocket sync + monotonic non-destructive state merging.', bg: 'var(--sun)' },
          { icon: '🧠', title: "AI Bloom's Taxonomy", desc: 'Recall, Comprehension, Application, and Analysis with diagnostic misconceptions.', bg: 'var(--sky)' },
          { icon: '🛡️', title: 'Anti-Cheat Focus Shield', desc: 'Tab switch detection, clipboard lock, and honest gameplay accolades.', bg: 'var(--mint)' },
          { icon: '🐉', title: 'Boss Raid Co-Op Mode', desc: 'Whole classroom vs Monster health bar with shared attack mechanics.', bg: 'var(--cherry)' }
        ].map(item => (
          <div key={item.title} className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-5 relative overflow-hidden">
            <div className="w-10 h-10 rounded-[10px] hard flex items-center justify-center text-[20px]" style={{ background: item.bg }}>
              {item.icon}
            </div>
            <h3 className="font-display font-[800] text-[18px] mt-3 leading-tight">{item.title}</h3>
            <p className="text-[14px] leading-[1.4] mt-1 opacity-70">{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t-[3px] border-[var(--ink)] bg-[var(--paper-2)] py-4 text-center font-display text-[11px] tracking-wide opacity-60">
        ⚡ QuizFlow · Neo-Brutalist Memphis · Space Grotesk + Inter · Hard shadows only · Zero glassmorphism
      </footer>
    </div>
  )
}
