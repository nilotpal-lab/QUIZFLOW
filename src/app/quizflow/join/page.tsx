'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function JoinInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pinFromUrl = searchParams.get('pin') || ''

  const [pin, setPin] = useState<string[]>(() => {
    const clean = pinFromUrl.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6)
    const arr = ['', '', '', '', '', '']
    clean.split('').forEach((char, idx) => { arr[idx] = char })
    return arr
  })

  useEffect(() => {
    if (pinFromUrl) {
      const clean = pinFromUrl.replace(/[^0-9A-Za-z]/g, '').toUpperCase().slice(0, 6)
      const arr = ['', '', '', '', '', '']
      clean.split('').forEach((char, idx) => { arr[idx] = char })
      setPin(arr)
    }
  }, [pinFromUrl])
  const [nickname, setNickname] = useState('')
  const [selectedAvatarIdx, setSelectedAvatarIdx] = useState<number>(0)
  
  const [randomBtnText, setRandomBtnText] = useState('🎲 Randomize')
  const [randomAvatarText, setRandomAvatarText] = useState('🔀 Random Avatar')
  const [error, setError] = useState('')
  const [isJoining, setIsJoining] = useState(false)
  const [joinBtnText, setJoinBtnText] = useState('🚀 Enter Arena →')
  
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

  const handlePinPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    if (!pasted) return

    const digits = pasted.slice(0, 6).split('')
    const next = ['', '', '', '', '', '']
    digits.forEach((d, idx) => {
      if (idx < 6) next[idx] = d
    })
    setPin(next)
    
    // Focus appropriate input
    const nextFocusIdx = Math.min(digits.length, 5)
    inputs[nextFocusIdx].current?.focus()
  }

  const handlePinKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!pin[i] && i > 0) {
        inputs[i - 1].current?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      inputs[i - 1].current?.focus()
    } else if (e.key === 'ArrowRight' && i < 5) {
      inputs[i + 1].current?.focus()
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

  const handleJoin = async () => {
    const fullPin = pin.join('')
    if (fullPin.length < 6) { 
      setError('Please enter the complete 6-digit PIN')
      inputs[Math.max(0, pin.findIndex(d => !d))].current?.focus()
      return 
    }
    const trimmed = nickname.trim()
    if (!trimmed) { 
      setError('Please enter your player nickname')
      return 
    }
    if (trimmed.length > 20) { 
      setError('Nickname cannot exceed 20 characters')
      return 
    }

    setError('')
    setIsJoining(true)
    setJoinBtnText('⏳ Connecting to Room...')

    // Smooth navigation to room lobby
    const chosenAvatar = ALL_AVATARS[selectedAvatarIdx] || ALL_AVATARS[0]
    const playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    
    setJoinBtnText('✓ Joined! Loading Arena...')
    setTimeout(() => {
      router.push(`/lobby/${fullPin}?nickname=${encodeURIComponent(trimmed)}&seed=${encodeURIComponent(chosenAvatar.id)}&style=custom&avatar=${encodeURIComponent(chosenAvatar.src)}&pid=${playerId}`)
    }, 150)
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
          <Link href="/quizflow/studio">
            <button className="hard bg-[var(--sun)] text-[var(--ink)] rounded-full px-3.5 py-1 text-[12px] font-display font-bold">
              ✨ AI Studio
            </button>
          </Link>
        </div>
      </nav>

      {/* Landscape Main Content Area */}
      <main className="flex-1 w-full max-w-[1040px] px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-10 flex flex-col justify-center">
        <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-4 sm:p-6 md:p-8 relative overflow-hidden w-full box-border">
          
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6 w-16 sm:w-20 h-16 sm:h-20 bg-[var(--sun)] border-[3px] border-[var(--ink)] rotate-[15deg] opacity-20 -z-0 pointer-events-none"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-6 lg:gap-10">
            
            {/* Left Column: Form Info */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 hard bg-[var(--cherry)] text-white px-3 py-1 rounded-full font-display font-[800] text-[11px] mb-3 self-start">
                  <span>🎮</span> LIVE GAME JOIN
                </div>

                <h1 className="font-display font-[900] text-[28px] sm:text-[36px] md:text-[44px] leading-[1.1] tracking-[-0.02em] mb-4 uppercase text-[var(--ink)]">
                  Join the Arena
                </h1>
                
                {error && (
                  <div className="mb-4 text-[13px] font-[700] text-[var(--cherry)] bg-red-100 border-[3px] border-[var(--cherry)] p-3 rounded-[8px]">
                    ⚠️ {error}
                  </div>
                )}

                {/* PIN Input */}
                <div className="mt-2 sm:mt-4">
                  <label htmlFor="pin-input-0" className="font-display text-[12px] sm:text-[13px] font-[800] tracking-widest block mb-2 uppercase opacity-85 text-[var(--ink)]">
                    6-Digit Room PIN (Paste or Type)
                  </label>
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2 w-full">
                    {pin.map((digit, idx) => (
                      <input
                        key={idx}
                        id={`pin-input-${idx}`}
                        ref={inputs[idx]}
                        value={digit}
                        onChange={e => handlePinInput(idx, e.target.value)}
                        onPaste={handlePinPaste}
                        onKeyDown={e => handlePinKey(idx, e)}
                        inputMode="numeric"
                        autoComplete={idx === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        className="w-full aspect-[4/5] sm:aspect-[3/4] text-center bg-[var(--paper)] rounded-[10px] sm:rounded-[12px] border-[2.5px] sm:border-[3px] border-[var(--ink)] font-display text-[22px] sm:text-[26px] md:text-[30px] font-[800] outline-none focus:ring-[3px] focus:ring-[#FFE57F] focus:border-[var(--violet)] transition-colors shadow-[2px_2px_0px_#10100F] sm:shadow-[3px_3px_0px_#10100F] p-0 text-[var(--ink)]"
                        placeholder="·"
                        aria-label={`PIN digit ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Nickname Input */}
                <div className="mt-5 sm:mt-6">
                  <label htmlFor="player-nickname-input" className="font-display text-[12px] sm:text-[13px] font-[800] tracking-widest block mb-2 uppercase opacity-85 text-[var(--ink)]">
                    Player Nickname
                  </label>
                  <div className="flex gap-2 w-full items-center">
                    <input
                      id="player-nickname-input"
                      value={nickname}
                      onChange={e => setNickname(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleJoin()}
                      placeholder="Enter your name..."
                      className="min-w-0 flex-1 h-[48px] sm:h-[52px] px-3 sm:px-4 bg-white rounded-[12px] border-[2.5px] sm:border-[3px] border-[var(--ink)] text-[15px] sm:text-[16px] font-[700] outline-none focus:ring-[3px] focus:ring-[#FFE57F] shadow-[2px_2px_0px_#10100F] sm:shadow-[3px_3px_0px_#10100F] text-[var(--ink)]"
                      aria-label="Player Nickname"
                    />
                    <button
                      type="button"
                      onClick={handleRandomizeNick}
                      className="shrink-0 hard btn-press bg-[var(--sun)] rounded-[12px] px-3 sm:px-4 h-[48px] sm:h-[52px] font-display font-[800] text-[12px] sm:text-[13px] whitespace-nowrap text-[var(--ink)] flex items-center justify-center gap-1"
                      aria-label="Randomize nickname"
                    >
                      <span>🎲</span>
                      <span className="hidden xs:inline sm:inline">{randomBtnText.replace(/^🎲\s*/, '')}</span>
                      <span className="inline xs:hidden sm:hidden">Dice</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Big Join Button at Bottom of Left Column */}
              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="mt-6 sm:mt-8 lg:mt-auto w-full h-[54px] sm:h-[62px] rounded-[var(--radius-btn)] bg-[var(--violet)] text-white font-display font-[900] text-[18px] sm:text-[20px] md:text-[22px] uppercase tracking-wide hard btn-press shadow-[3px_3px_0px_#10100F] sm:shadow-[4px_4px_0px_#10100F] disabled:opacity-70 flex items-center justify-center gap-2"
                aria-label="Join game arena"
              >
                {joinBtnText}
              </button>
            </div>

            {/* Right Column: Avatar Selector */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <label className="font-display text-[13px] font-[800] tracking-widest uppercase opacity-85 block">CHOOSE YOUR AVATAR</label>
                  <span className="text-[11px] font-display font-bold text-[var(--violet)]">16 Custom Characters · Scroll to explore</span>
                </div>
                {ENABLE_AVATAR_SPINNING && (
                  <button
                    type="button"
                    onClick={handleRandomizeAvatar}
                    className="hard bg-white rounded-full px-3 py-1 text-[11px] font-display font-[700] hover:bg-[var(--sun)] transition-colors"
                    aria-label="Pick a random avatar"
                  >
                    {randomAvatarText}
                  </button>
                )}
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
                          aria-label={`Select ${avatar.name}`}
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

// Feature Flag: Set to true to re-enable avatar spinning & randomizing options
const ENABLE_AVATAR_SPINNING = false

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', fontFamily: 'Space Grotesk', color: 'var(--ink)', fontSize: 20, fontWeight: 700 }}>
        Loading Join Arena…
      </div>
    }>
      <JoinInner />
    </Suspense>
  )
}
