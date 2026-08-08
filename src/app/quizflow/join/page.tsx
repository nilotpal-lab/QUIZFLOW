'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const RANDOM_NICKNAMES = [
  'QuantumNinja', 'NeonSage', 'ByteTiger', 'CosmicFox',
  'PixelPanda', 'TurboMantis', 'NovaOwl', 'AstroLynx',
  'VaporWolf', 'CyberKoala', 'SolarFalcon', 'ShadowLeopard'
]

const AVATARS = {
  cartoon: [
    { src: '/avatars/clay_1.png', emoji: '🧸' },
    { src: '/avatars/clay_2.png', emoji: '🦊' },
    { src: '/avatars/clay_3.png', emoji: '🦁' },
    { src: '/avatars/clay_4.png', emoji: '🐯' },
  ],
  anime: [
    { src: '/avatars/anime_1.png', emoji: '🌸' },
    { src: '/avatars/anime_2.png', emoji: '✨' },
    { src: '/avatars/anime_3.png', emoji: '💫' },
    { src: '/avatars/anime_4.png', emoji: '🌟' },
  ],
  retro: [
    { src: '/avatars/retro_1.png', emoji: '👾' },
    { src: '/avatars/retro_2.png', emoji: '🕹️' },
    { src: '/avatars/retro_3.png', emoji: '🚀' },
    { src: '/avatars/retro_4.png', emoji: '🛸' },
  ]
}

type TabType = 'cartoon' | 'anime' | 'retro'

export default function JoinPage() {
  const router = useRouter()
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [nickname, setNickname] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('cartoon')
  const [selectedAvatarId, setSelectedAvatarId] = useState<number>(0)
  
  const [randomBtnText, setRandomBtnText] = useState('🎲 Randomize')
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
    const rand = RANDOM_NICKNAMES[Math.floor(Math.random() * RANDOM_NICKNAMES.length)] + Math.floor(Math.random() * 99)
    setNickname(rand)
    setRandomBtnText('✓ ' + rand)
    setTimeout(() => setRandomBtnText('🎲 Randomize'), 1500)
  }

  const handleJoin = () => {
    const fullPin = pin.join('')
    if (fullPin.length < 6) { setError('Please enter the complete 6-digit PIN'); return }
    const trimmed = nickname.trim()
    if (!trimmed) { setError('Please enter your nickname'); return }
    if (trimmed.length > 20) { setError('Nickname cannot exceed 20 characters'); return }

    setError('')
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    router.push(`/lobby/${fullPin}?nickname=${encodeURIComponent(trimmed)}&style=${activeTab}&avatar=${selectedAvatarId}&pid=${playerId}`)
  }

  const currentAvatars = AVATARS[activeTab]

  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[#FFE57F] flex flex-col items-center">
      {/* Top Nav */}
      <nav className="w-full bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[64px] flex items-center">
          <Link href="/quizflow" className="font-display font-[800] text-[24px] tracking-tight flex items-center gap-1 cursor-pointer">
            <span>⚡</span> QuizFlow
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-[600px] px-4 md:px-6 py-8 md:py-12 flex flex-col">
        <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 md:p-10 relative overflow-hidden w-full">
          
          <div className="absolute right-6 top-6 w-20 h-20 bg-[var(--sun)] border-[3px] border-[var(--ink)] rotate-[15deg] opacity-20 -z-0"></div>

          <div className="relative z-10 flex flex-col">
            <h1 className="font-display font-[900] text-[36px] md:text-[44px] leading-[1] tracking-[-0.02em] mb-2 uppercase">
              Join the Arena
            </h1>
            
            {error && (
              <div className="mt-4 text-[14px] font-[700] text-[var(--cherry)] bg-red-100 border-[3px] border-[var(--cherry)] p-3 rounded-[8px]">
                ⚠️ {error}
              </div>
            )}

            {/* PIN Input */}
            <div className="mt-8">
              <label className="font-display text-[14px] font-[800] tracking-widest block mb-3 uppercase">6-Digit Room PIN</label>
              <div className="flex gap-2 justify-between">
                {pin.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={inputs[idx]}
                    value={digit}
                    onChange={e => handlePinInput(idx, e.target.value)}
                    onKeyDown={e => handlePinKey(idx, e)}
                    maxLength={1}
                    className="w-[calc(16.66%-8px)] aspect-[3/4] text-center bg-[var(--paper)] rounded-[12px] border-[3px] border-[var(--ink)] font-display text-[28px] md:text-[36px] font-[800] outline-none focus:ring-[4px] focus:ring-[#FFE57F] focus:border-[var(--violet)] transition-colors shadow-[4px_4px_0px_#10100F]"
                    placeholder="·"
                    aria-label={`PIN digit ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Nickname Input */}
            <div className="mt-8">
              <label className="font-display text-[14px] font-[800] tracking-widest block mb-3 uppercase">Player Nickname</label>
              <div className="flex gap-3">
                <input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleJoin()}
                  placeholder="Enter your name..."
                  className="flex-1 h-[56px] px-4 bg-white rounded-[12px] border-[3px] border-[var(--ink)] text-[18px] font-[700] outline-none focus:ring-[4px] focus:ring-[#FFE57F] shadow-[4px_4px_0px_#10100F]"
                />
                <button
                  type="button"
                  onClick={handleRandomizeNick}
                  className="hard btn-press bg-[var(--sun)] rounded-[12px] px-4 h-[56px] font-display font-[800] text-[14px] min-w-[140px]"
                >
                  {randomBtnText}
                </button>
              </div>
            </div>

            {/* Avatar Selection */}
            <div className="mt-10">
              <label className="font-display text-[14px] font-[800] tracking-widest block mb-4 uppercase">Choose Avatar</label>
              
              {/* Style Tabs */}
              <div className="flex gap-3 mb-5">
                <button
                  onClick={() => { setActiveTab('cartoon'); setSelectedAvatarId(0); }}
                  className={`flex-1 py-2 rounded-full border-[3px] border-[var(--ink)] font-display text-[14px] font-[800] ${
                    activeTab === 'cartoon' ? 'bg-[var(--violet)] text-white shadow-[3px_3px_0px_#10100F]' : 'bg-white shadow-[3px_3px_0px_#10100F]'
                  }`}
                >
                  🧸 Cartoon
                </button>
                <button
                  onClick={() => { setActiveTab('anime'); setSelectedAvatarId(0); }}
                  className={`flex-1 py-2 rounded-full border-[3px] border-[var(--ink)] font-display text-[14px] font-[800] ${
                    activeTab === 'anime' ? 'bg-[var(--sky)] text-[var(--ink)] shadow-[3px_3px_0px_#10100F]' : 'bg-white shadow-[3px_3px_0px_#10100F]'
                  }`}
                >
                  🌸 Anime
                </button>
                <button
                  onClick={() => { setActiveTab('retro'); setSelectedAvatarId(0); }}
                  className={`flex-1 py-2 rounded-full border-[3px] border-[var(--ink)] font-display text-[14px] font-[800] ${
                    activeTab === 'retro' ? 'bg-[var(--mint)] text-[var(--ink)] shadow-[3px_3px_0px_#10100F]' : 'bg-white shadow-[3px_3px_0px_#10100F]'
                  }`}
                >
                  👾 Retro
                </button>
              </div>

              {/* Avatar Grid */}
              <div className="grid grid-cols-4 gap-4">
                {currentAvatars.map((avatar, idx) => (
                  <AvatarButton
                    key={avatar.src}
                    avatar={avatar}
                    isSelected={selectedAvatarId === idx}
                    onClick={() => setSelectedAvatarId(idx)}
                  />
                ))}
              </div>
            </div>

            {/* Big Join Button */}
            <button
              onClick={handleJoin}
              className="mt-10 w-full h-[64px] rounded-[var(--radius-btn)] bg-[var(--violet)] text-white font-display font-[900] text-[24px] uppercase tracking-wide hard btn-press"
            >
              🚀 Join Game →
            </button>
            
          </div>
        </div>
      </main>
    </div>
  )
}

function AvatarButton({ avatar, isSelected, onClick }: { avatar: any, isSelected: boolean, onClick: () => void }) {
  const [error, setError] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative aspect-square rounded-[16px] border-[3px] bg-white flex items-center justify-center transition-all btn-press overflow-hidden ${
        isSelected ? 'border-[var(--violet)] shadow-[4px_4px_0px_#7C4DFF]' : 'border-[var(--ink)] shadow-[4px_4px_0px_#10100F]'
      }`}
    >
      {!error ? (
        <img 
          src={avatar.src} 
          alt="Avatar" 
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span className="text-[32px]">{avatar.emoji}</span>
      )}
      {isSelected && (
        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[var(--violet)] border-[3px] border-[var(--ink)] flex items-center justify-center text-white text-[12px] font-bold z-10">
          ✓
        </span>
      )}
    </button>
  )
}
