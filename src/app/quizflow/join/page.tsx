'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const RANDOM_NICKNAMES = [
  'QuantumNinja', 'NeonSage', 'ByteTiger', 'CosmicFox',
  'PixelPanda', 'TurboMantis', 'NovaOwl', 'AstroLynx',
  'VaporWolf', 'CyberKoala', 'SolarFalcon', 'ShadowLeopard'
]

const ALL_AVATARS = [
  { id: 'clay_1', name: 'Curly Boy (3D)', src: '/avatars/clay_1.png', tag: '3D Clay', emoji: '🧸' },
  { id: 'custom_cabbage', name: 'Mr. Cabbage (3D)', src: '/avatars/custom_cabbage.png', tag: '3D Clay', emoji: '🥬' },
  { id: 'custom_boy', name: 'Blue Boy (2D)', src: '/avatars/custom_boy.png', tag: 'Cartoon', emoji: '👦' },
  { id: 'custom_winter_girl', name: 'Winter Girl', src: '/avatars/custom_winter_girl.png', tag: 'Anime', emoji: '❄️' },
  { id: 'custom_skeleton', name: 'Gentleman Skelly', src: '/avatars/custom_skeleton.png', tag: 'Monster', emoji: '💀' },
  { id: 'anime_1', name: 'Purple Twintails', src: '/avatars/anime_1.png', tag: 'Anime', emoji: '🌸' },
  { id: 'anime_2', name: 'Schoolboy Hero', src: '/avatars/anime_2.png', tag: 'Anime', emoji: '✨' },
  { id: 'anime_3', name: 'Fox Winter Girl', src: '/avatars/anime_3.png', tag: 'Anime', emoji: '🦊' },
  { id: 'anime_4', name: 'Solar Blaster', src: '/avatars/anime_4.png', tag: 'Anime', emoji: '🔥' },
  { id: 'clay_2', name: 'Spiky Champion', src: '/avatars/clay_2.png', tag: '3D Clay', emoji: '🦊' },
  { id: 'clay_3', name: 'Pink Dreamer', src: '/avatars/clay_3.png', tag: '3D Clay', emoji: '🦁' },
  { id: 'clay_4', name: 'Dreadlock King', src: '/avatars/clay_4.png', tag: '3D Clay', emoji: '🐯' },
  { id: 'retro_1', name: 'Golden Knight', src: '/avatars/retro_1.svg', tag: 'Retro', emoji: '👾' },
  { id: 'retro_2', name: 'Cosmic Wizard', src: '/avatars/retro_2.svg', tag: 'Retro', emoji: '🕹️' },
  { id: 'retro_3', name: 'Shadow Ninja', src: '/avatars/retro_3.svg', tag: 'Retro', emoji: '🚀' },
  { id: 'retro_4', name: 'Jungle Explorer', src: '/avatars/retro_4.svg', tag: 'Retro', emoji: '🛸' },
]

export default function JoinPage() {
  const router = useRouter()
  const [pin, setPin] = useState(['', '', '', '', '', ''])
  const [nickname, setNickname] = useState('')
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState<number>(0)
  
  const [randomBtnText, setRandomBtnText] = useState('🎲 Randomize')
  const [randomAvatarText, setRandomAvatarText] = useState('🔀 Random Avatar')
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

  const handleRandomizeAvatar = () => {
    const randomIdx = Math.floor(Math.random() * ALL_AVATARS.length)
    setSelectedAvatarIdx(randomIdx)
    setRandomAvatarText('✓ ' + ALL_AVATARS[randomIdx].name)
    setTimeout(() => setRandomAvatarText('🔀 Random Avatar'), 1500)
  }

  const handleJoin = () => {
    const fullPin = pin.join('')
    if (fullPin.length < 6) { setError('Please enter the complete 6-digit PIN'); return }
    const trimmed = nickname.trim()
    if (!trimmed) { setError('Please enter your nickname'); return }
    if (trimmed.length > 20) { setError('Nickname cannot exceed 20 characters'); return }

    setError('')
    const chosenAvatar = ALL_AVATARS[selectedAvatarIdx] || ALL_AVATARS[0]
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    router.push(`/lobby/${fullPin}?nickname=${encodeURIComponent(trimmed)}&seed=${encodeURIComponent(chosenAvatar.id)}&style=custom&avatar=${encodeURIComponent(chosenAvatar.src)}&pid=${playerId}`)
  }

  const selectedAvatar = ALL_AVATARS[selectedAvatarIdx] || ALL_AVATARS[0]

  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[#FFE57F] flex flex-col items-center">
      {/* Top Nav */}
      <nav className="w-full bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[64px] flex items-center justify-between">
          <Link href="/quizflow" className="font-display font-[800] text-[24px] tracking-tight flex items-center gap-1 cursor-pointer">
            <span>⚡</span> QuizFlow
          </Link>
          <Link href="/studio">
            <button className="hard bg-[var(--sun)] text-[var(--ink)] rounded-full px-3.5 py-1 text-[12px] font-display font-bold">
              ✨ AI Studio
            </button>
          </Link>
        </div>
      </nav>

      {/* Landscape Main Content Area */}
      <main className="flex-1 w-full max-w-[1040px] px-4 md:px-6 py-6 md:py-10 flex flex-col justify-center">
        <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-5 md:p-8 relative overflow-hidden w-full">
          
          <div className="absolute right-6 top-6 w-20 h-20 bg-[var(--sun)] border-[3px] border-[var(--ink)] rotate-[15deg] opacity-20 -z-0"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10">
            
            {/* Left Column: Form Info */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 hard bg-[var(--cherry)] text-white px-3 py-1 rounded-full font-display font-[800] text-[11px] mb-3 self-start">
                  <span>🎮</span> LIVE GAME JOIN
                </div>

                <h1 className="font-display font-[900] text-[36px] md:text-[44px] leading-[1] tracking-[-0.02em] mb-4 uppercase">
                  Join the Arena
                </h1>
                
                {error && (
                  <div className="mb-4 text-[13px] font-[700] text-[var(--cherry)] bg-red-100 border-[3px] border-[var(--cherry)] p-3 rounded-[8px]">
                    ⚠️ {error}
                  </div>
                )}

                {/* PIN Input */}
                <div className="mt-4">
                  <label className="font-display text-[13px] font-[800] tracking-widest block mb-2.5 uppercase opacity-85">6-Digit Room PIN</label>
                  <div className="flex gap-2 justify-between">
                    {pin.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={inputs[idx]}
                        value={digit}
                        onChange={e => handlePinInput(idx, e.target.value)}
                        onKeyDown={e => handlePinKey(idx, e)}
                        maxLength={1}
                        className="w-[calc(16.66%-6px)] aspect-[3/4] text-center bg-[var(--paper)] rounded-[12px] border-[3px] border-[var(--ink)] font-display text-[26px] md:text-[30px] font-[800] outline-none focus:ring-[4px] focus:ring-[#FFE57F] focus:border-[var(--violet)] transition-colors shadow-[3px_3px_0px_#10100F]"
                        placeholder="·"
                        aria-label={`PIN digit ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Nickname Input */}
                <div className="mt-6">
                  <label className="font-display text-[13px] font-[800] tracking-widest block mb-2.5 uppercase opacity-85">Player Nickname</label>
                  <div className="flex gap-2">
                    <input
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleJoin()}
                      placeholder="Enter your name..."
                      className="flex-1 h-[52px] px-4 bg-white rounded-[12px] border-[3px] border-[var(--ink)] text-[16px] font-[700] outline-none focus:ring-[4px] focus:ring-[#FFE57F] shadow-[3px_3px_0px_#10100F]"
                    />
                    <button
                      type="button"
                      onClick={handleRandomizeNick}
                      className="hard btn-press bg-[var(--sun)] rounded-[12px] px-3.5 h-[52px] font-display font-[800] text-[13px] min-w-[130px]"
                    >
                      {randomBtnText}
                    </button>
                  </div>
                </div>
              </div>

              {/* Big Join Button at Bottom of Left Column */}
              <button
                onClick={handleJoin}
                className="mt-8 lg:mt-auto w-full h-[62px] rounded-[var(--radius-btn)] bg-[var(--violet)] text-white font-display font-[900] text-[22px] uppercase tracking-wide hard btn-press shadow-[4px_4px_0px_#10100F]"
              >
                🚀 Join Game Arena →
              </button>
            </div>

            {/* Right Column: Avatar Selector */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <label className="font-display text-[13px] font-[800] tracking-widest uppercase opacity-85 block">CHOOSE YOUR AVATAR</label>
                  <span className="text-[11px] font-display font-bold text-[var(--violet)]">16 Custom Characters · Scroll to explore</span>
                </div>
                <button
                  type="button"
                  onClick={handleRandomizeAvatar}
                  className="hard bg-white rounded-full px-3 py-1 text-[11px] font-display font-[700] hover:bg-[var(--sun)] transition-colors"
                >
                  {randomAvatarText}
                </button>
              </div>

              {/* Active Avatar Spotlight Banner */}
              <div className="hard bg-white rounded-[14px] p-3 mb-3 flex items-center gap-3.5 border-[3px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F]">
                <div className="w-14 h-14 rounded-[10px] hard border-[2px] border-[var(--ink)] overflow-hidden bg-[var(--paper)] shrink-0">
                  <img src={selectedAvatar.src} alt={selectedAvatar.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-display font-bold uppercase tracking-wider text-[var(--violet)]">
                    SELECTED: {selectedAvatar.tag}
                  </div>
                  <div className="font-display font-[800] text-[16px] truncate text-[var(--ink)]">
                    {selectedAvatar.name}
                  </div>
                </div>
                <div className="hard bg-[var(--mint)] text-[var(--ink)] px-2.5 py-1 rounded-full text-[11px] font-display font-bold shrink-0">
                  ✓ READY
                </div>
              </div>

              {/* Scrollable Gallery Window */}
              <div className="hard bg-white rounded-[16px] p-3.5 border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F]">
                <div className="max-h-[260px] lg:max-h-[290px] overflow-y-auto overflow-x-hidden pr-1.5 scrollbar-thin space-y-2">
                  <div className="grid grid-cols-4 gap-2.5">
                    {ALL_AVATARS.map((avatar, idx) => {
                      const isSelected = selectedAvatarIdx === idx
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedAvatarIdx(idx)}
                          className={`relative aspect-square rounded-[12px] border-[3px] flex flex-col items-center justify-center transition-all p-1 btn-press overflow-hidden ${
                            isSelected
                              ? 'border-[var(--violet)] bg-[#F5F0FF] ring-[3px] ring-[#7C4DFF]/40 shadow-[2px_2px_0px_#7C4DFF]'
                              : 'border-[var(--ink)] bg-[var(--paper)] hover:bg-[#FFF9E6] shadow-[2px_2px_0px_#10100F]'
                          }`}
                        >
                          <img
                            src={avatar.src}
                            alt={avatar.name}
                            className="w-full h-full object-cover rounded-[8px]"
                          />
                          {isSelected && (
                            <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--violet)] border-[2px] border-[var(--ink)] flex items-center justify-center text-white text-[10px] font-bold z-10">
                              ✓
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="text-center text-[10px] font-display font-bold opacity-50 mt-2">
                  ↕ Scroll to view all 16 avatars
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
