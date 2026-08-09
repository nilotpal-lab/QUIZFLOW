'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getHostUser, initAuthSync, type HostUser } from '@/quizflow/authStore'

export default function MarketingHomepage() {
  const router = useRouter()
  const [user, setUser] = useState<HostUser | null>(null)
  
  // Hero Interactive Demo States
  const [quickPin, setQuickPin] = useState('')
  const [demoTopic, setDemoTopic] = useState('')
  const [selectedDemoAnswer, setSelectedDemoAnswer] = useState<number | null>(null)
  const [showDemoFeedback, setShowDemoFeedback] = useState(false)

  useEffect(() => {
    setUser(getHostUser())
    const unsubscribe = initAuthSync(updatedUser => {
      setUser(updatedUser)
    })
    return () => unsubscribe()
  }, [])

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault()
    if (quickPin.trim().length >= 5) {
      router.push(`/quizflow/join?pin=${quickPin.trim()}`)
    } else {
      router.push('/quizflow/join')
    }
  }

  const handleQuickGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    if (demoTopic.trim()) {
      router.push(`/quizflow/studio?topic=${encodeURIComponent(demoTopic.trim())}`)
    } else {
      router.push('/quizflow/studio')
    }
  }

  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col overflow-x-hidden text-[var(--ink)] relative">
      
      <style>{`
        .interactive-shape {
          transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.35s ease, box-shadow 0.35s ease;
          cursor: pointer;
        }
        .interactive-shape:hover {
          transform: scale(1.18) translateY(-10px) rotate(8deg) !important;
          box-shadow: 6px 6px 0px #10100F !important;
        }
        .interactive-shape-circle:hover {
          transform: scale(1.18) translate(8px, -8px) rotate(180deg) !important;
          box-shadow: 6px 6px 0px #10100F !important;
        }
        .interactive-shape-triangle:hover {
          transform: scale(1.18) translate(-6px, -6px) rotate(-15deg) !important;
          filter: drop-shadow(6px 6px 0px #10100F) !important;
        }
      `}</style>
      
      {/* Premium Dotted Grid Texture Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.22]"
        style={{
          backgroundImage: `radial-gradient(var(--ink) 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-[var(--paper)] border-b-[3px] border-[var(--ink)] shadow-[0_2px_0px_#10100F]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[72px] flex items-center justify-between">
          <div 
            className="font-display font-[900] text-[26px] tracking-tight flex items-center gap-2 cursor-pointer select-none"
            onClick={() => router.push('/quizflow')}
          >
            <span className="text-[var(--violet)] drop-shadow-[1px_1px_0px_var(--ink)]">⚡</span> QuizFlow
          </div>
          
          <div className="flex items-center gap-3">
            <Link href="/quizflow/join">
              <button className="hard bg-[var(--violet)] text-white rounded-full px-4 py-1.5 text-[12px] font-display font-black uppercase tracking-wider btn-press hidden sm:inline-block">
                🎮 Join Game
              </button>
            </Link>
            
            {user ? (
              <div className="flex items-center gap-2.5">
                <Link href="/quizflow/studio">
                  <button className="hard bg-[var(--sun)] text-[var(--ink)] rounded-full px-4 py-1.5 text-[12px] font-display font-black uppercase tracking-wider btn-press hidden md:inline-block">
                    ✨ AI Studio
                  </button>
                </Link>
                <Link href="/quizflow/dashboard">
                  <div className="hard bg-white border-[2.5px] border-[var(--ink)] rounded-full px-4 py-1.5 text-[13px] font-display font-black text-[var(--ink)] flex items-center gap-2 btn-press cursor-pointer">
                    <span>🎓</span>
                    <span className="max-w-[140px] truncate">{user.name}</span>
                    <span className="text-[11px] opacity-60">→</span>
                  </div>
                </Link>
              </div>
            ) : (
              <Link href="/quizflow/auth">
                <button className="hard bg-white text-[var(--ink)] rounded-full px-5 py-2 text-[13px] font-display font-black uppercase tracking-wider btn-press border-[2.5px] border-[var(--ink)]">
                  Teacher Login
                </button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10">
        
        {/* Section 1: Hero */}
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-12 md:py-20 relative flex flex-col items-center text-center">
          
          {/* Asymmetric Memphis Graphic Elements */}
          <div className="interactive-shape absolute top-8 left-6 md:left-16 w-14 h-20 bg-[var(--cherry)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] -rotate-[15deg] hidden md:block"></div>
          <div className="interactive-shape interactive-shape-circle absolute top-28 right-8 md:right-24 w-16 h-16 bg-[var(--mint)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[20deg] rounded-full hidden md:block"></div>
          
          <svg viewBox="0 0 100 100" className="interactive-shape interactive-shape-triangle absolute bottom-8 left-10 md:left-28 w-14 h-14 rotate-[15deg] hidden lg:block filter drop-shadow-[4px_4px_0px_#10100F]">
            <polygon points="50,15 90,85 10,85" fill="var(--sun)" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="miter" />
          </svg>
          
          <div className="interactive-shape interactive-shape-circle absolute top-64 left-4 md:left-8 w-10 h-10 bg-[var(--sky)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rounded-full hidden md:block"></div>
          <div className="interactive-shape absolute bottom-32 right-6 md:right-16 w-14 h-14 bg-[var(--violet)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[-10deg] hidden md:block"></div>

          {/* Premium Pill Badge */}
          <div className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] px-4 py-1.5 rounded-full font-display font-[800] text-[12px] tracking-wider uppercase mb-6 hard shadow-[2.5px_2.5px_0px_var(--violet)]">
            <span>⚡ NEXT-GEN CLASSROOM ENGAGEMENT</span>
          </div>
          
          <h1 className="font-display font-[900] text-[48px] md:text-[80px] lg:text-[100px] leading-[0.88] tracking-[-0.03em] uppercase max-w-[1050px]">
            The Classroom <br />
            <span className="text-[var(--violet)] relative inline-block">
              Battle Arena
              <span className="absolute -bottom-2 left-0 w-full h-[8px] md:h-[12px] bg-[var(--sun)] border-[2.5px] border-[var(--ink)] rounded-full -z-10"></span>
            </span>
          </h1>
          
          <p className="font-body text-[16px] md:text-[21px] font-[600] mt-6 max-w-[680px] opacity-90 leading-relaxed">
            Generate custom AI quizzes instantly, host live multiplayer rooms with power-ups, and track student mastery in real time.
          </p>

          {/* Quick Action Widget: Join or Generate Direct Input */}
          <div className="mt-10 w-full max-w-[820px] grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Quick PIN Join Widget */}
            <form onSubmit={handleQuickJoin} className="hard bg-white border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-4 text-left shadow-[5px_5px_0px_#10100F] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-display font-black tracking-widest text-[var(--violet)] uppercase">STUDENTS</span>
                  <span className="text-[11px] font-display font-bold bg-[var(--paper)] border-[1.5px] border-[var(--ink)] px-2 py-0.5 rounded-full">🎮 Instant Join</span>
                </div>
                <h3 className="font-display font-[900] text-[18px] mb-2 uppercase">Enter Live Game PIN</h3>
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  maxLength={6}
                  value={quickPin}
                  onChange={e => setQuickPin(e.target.value.toUpperCase())}
                  placeholder="e.g. 849201"
                  className="flex-1 h-[46px] px-3.5 bg-[var(--paper)] border-[2.5px] border-[var(--ink)] rounded-[10px] font-display text-[18px] font-extrabold tracking-wider outline-none focus:ring-[3px] focus:ring-[#FFE57F]"
                />
                <button type="submit" className="hard btn-press bg-[var(--violet)] text-white font-display font-black px-4 text-[14px] rounded-[10px] border-[2px] border-[var(--ink)] uppercase">
                  Join →
                </button>
              </div>
            </form>

            {/* Quick AI Quiz Generator Widget */}
            <form onSubmit={handleQuickGenerate} className="hard bg-[var(--sun)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-4 text-left shadow-[5px_5px_0px_#10100F] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-display font-black tracking-widest text-[var(--cherry)] uppercase">TEACHERS</span>
                  <span className="text-[11px] font-display font-bold bg-white border-[1.5px] border-[var(--ink)] px-2 py-0.5 rounded-full">✨ AI Generator</span>
                </div>
                <h3 className="font-display font-[900] text-[18px] mb-2 uppercase">Generate Quiz from Topic</h3>
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={demoTopic}
                  onChange={e => setDemoTopic(e.target.value)}
                  placeholder="e.g. Photosynthesis, Quantum Physics..."
                  className="flex-1 h-[46px] px-3.5 bg-white border-[2.5px] border-[var(--ink)] rounded-[10px] font-body text-[13px] font-semibold outline-none focus:ring-[3px] focus:ring-[#7C4DFF]"
                />
                <button type="submit" className="hard btn-press bg-[#10100F] text-white font-display font-black px-4 text-[14px] rounded-[10px] border-[2px] border-[var(--ink)] uppercase">
                  Create →
                </button>
              </div>
            </form>

          </div>

          {/* Interactive Live Quiz Arena Mock Preview */}
          <div className="mt-12 w-full max-w-[920px] hard bg-[#FFF8EB] border-[3.5px] border-[var(--ink)] rounded-[24px] p-5 md:p-8 shadow-[8px_8px_0px_#10100F] relative overflow-hidden text-left">
            
            {/* Top Bar Preview Header */}
            <div className="flex items-center justify-between border-b-[3px] border-[var(--ink)] pb-4 mb-6 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="w-3.5 h-3.5 rounded-full bg-[#FF5252] border-[1.5px] border-[var(--ink)] inline-block"></span>
                <span className="w-3.5 h-3.5 rounded-full bg-[#FFE57F] border-[1.5px] border-[var(--ink)] inline-block"></span>
                <span className="w-3.5 h-3.5 rounded-full bg-[#00E676] border-[1.5px] border-[var(--ink)] inline-block"></span>
                <span className="font-display font-black text-[13px] uppercase ml-2 tracking-wider text-black/70">
                  LIVE DEMO PREVIEW · PIN: <strong className="text-[var(--violet)]">849201</strong>
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="hard bg-[var(--mint)] border-[2px] border-[var(--ink)] text-[var(--ink)] text-[11px] font-display font-extrabold px-3 py-1 rounded-full">
                  🟢 24 Students Active
                </span>
              </div>
            </div>

            {/* Question Card Mock */}
            <div className="bg-white border-[3px] border-[var(--ink)] rounded-[16px] p-5 md:p-6 hard shadow-[4px_4px_0px_#10100F] mb-5">
              <div className="flex items-center justify-between text-[11px] font-display font-extrabold text-[var(--violet)] uppercase tracking-wider mb-2">
                <span>QUESTION 1 OF 5 · RECALL LEVEL</span>
                <span className="bg-[var(--sun)] text-[var(--ink)] px-2.5 py-0.5 rounded-full border-[1.5px] border-[var(--ink)]">⏱️ 15s</span>
              </div>
              <h3 className="font-display font-[900] text-[20px] md:text-[24px] text-[var(--ink)] leading-snug mb-5">
                Which organelle is responsible for hosting photosynthesis in plant cells?
              </h3>

              {/* Interactive Sample Choices */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { text: 'A. Mitochondria', correct: false },
                  { text: 'B. Nucleus', correct: false },
                  { text: 'C. Chloroplast', correct: true },
                  { text: 'D. Ribosome', correct: false }
                ].map((choice, idx) => {
                  const isSelected = selectedDemoAnswer === idx
                  let btnBg = 'bg-[var(--paper)] hover:bg-[#FFF9E6]'
                  if (isSelected) {
                    btnBg = choice.correct ? 'bg-[#00E676] text-[var(--ink)]' : 'bg-[#FF5252] text-white'
                  }
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedDemoAnswer(idx)
                        setShowDemoFeedback(true)
                      }}
                      className={`h-[54px] px-4 border-[2.5px] border-[var(--ink)] rounded-[12px] font-display font-bold text-[15px] flex items-center justify-between transition-all btn-press hard shadow-[3px_3px_0px_#10100F] ${btnBg}`}
                    >
                      <span>{choice.text}</span>
                      {isSelected && (
                        <span className="font-black text-[14px]">
                          {choice.correct ? '✓ CORRECT (+1000 pts)' : '✕ INCORRECT'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Dynamic Feedback Box */}
              {showDemoFeedback && (
                <div className="mt-4 p-3.5 bg-[var(--sun)] border-[2.5px] border-[var(--ink)] rounded-[12px] font-display text-[13px] font-bold flex items-center justify-between animate-scale-in">
                  <span>💡 Chloroplasts contain chlorophyll pigments that absorb light energy to drive photosynthesis!</span>
                  <button 
                    onClick={() => { setSelectedDemoAnswer(null); setShowDemoFeedback(false); }}
                    className="text-[11px] uppercase underline ml-3 shrink-0 font-extrabold cursor-pointer"
                  >
                    Reset Demo 🔄
                  </button>
                </div>
              )}
            </div>

            {/* Floating Live Leaderboard Snippet */}
            <div className="flex items-center justify-between bg-white border-[2.5px] border-[var(--ink)] rounded-[14px] p-3 px-4 hard">
              <div className="flex items-center gap-3">
                <span className="text-[20px]">👑</span>
                <div>
                  <div className="text-[11px] font-display font-black uppercase text-black/50">LEADERBOARD TOP RANK</div>
                  <div className="font-display font-black text-[14px]">1st · Student_Alice (2,850 pts) 🔥 3x Streak!</div>
                </div>
              </div>
              <Link href="/quizflow/studio" className="hidden sm:inline-block">
                <span className="text-[12px] font-display font-black text-[var(--violet)] uppercase hover:underline">Try Full Studio →</span>
              </Link>
            </div>

          </div>

        </section>

        {/* Section 2: Marquee Ticker */}
        <section className="w-full bg-[var(--ink)] text-[var(--paper)] h-[58px] overflow-hidden flex items-center border-y-[3px] border-[var(--ink)] relative">
          <div className="whitespace-nowrap flex animate-[marquee_30s_linear_infinite] will-change-transform max-w-none">
            <span className="font-display font-[800] tracking-widest text-[16px] px-4 uppercase">
              Live Multiplayer Battles · Thinking-Level AI · Co-Op Boss Raids · Spaced-Repetition Decks · Focus Shield Protection · Printable Test Sheets ·
            </span>
            <span className="font-display font-[800] tracking-widest text-[16px] px-4 uppercase">
              Live Multiplayer Battles · Thinking-Level AI · Co-Op Boss Raids · Spaced-Repetition Decks · Focus Shield Protection · Printable Test Sheets ·
            </span>
          </div>
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--ink)] to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--ink)] to-transparent pointer-events-none" />
        </section>

        {/* Section 3: Feature Cards Grid (Bento Style) */}
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center mb-16">
            <span className="text-[11px] font-display font-black tracking-widest text-[var(--violet)] uppercase bg-[var(--paper-2)] border-[2.5px] border-[var(--ink)] px-3 py-1 rounded-full hard shadow-[1.5px_1.5px_0px_#10100F] inline-block mb-3">
              FEATURES
            </span>
            <h2 className="font-display font-[900] text-[42px] md:text-[56px] uppercase tracking-tight leading-none">
              Next-Gen Learning Tools
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1: Live Battles */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200 border-[3px] border-[var(--ink)]">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--sky)] border-[3px] border-[var(--ink)] rounded-full opacity-30 group-hover:scale-110 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--violet)] text-white flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">LIVE</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Live Battles</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Instant WebSocket room synchronization across devices with zero split-brain scoring.</p>
            </div>
            
            {/* Feature 2: AI Studio */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200 border-[3px] border-[var(--ink)]">
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rotate-45 opacity-30 group-hover:rotate-90 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--sun)] text-[var(--ink)] flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">GEN</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">AI Studio</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Generate custom high-order thinking quizzes instantly with adaptive difficulty tiers.</p>
            </div>

            {/* Feature 3: Practice Mode */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200 border-[3px] border-[var(--ink)]">
              <div className="absolute right-10 bottom-4 w-12 h-12 border-[4px] border-[var(--mint)] opacity-30 group-hover:translate-y-1.5 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--mint)] text-[var(--ink)] flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">DECK</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Practice Mode</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Spaced repetition flashcards with interactive audio speech readouts for long-term retention.</p>
            </div>

            {/* Feature 4: Boss Raids */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200 border-[3px] border-[var(--ink)]">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rounded-full opacity-30 group-hover:-translate-x-1.5 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--cherry)] text-white flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">RAID</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Boss Raids</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Turn lessons into epic co-op monster battles where correct answers reduce boss health.</p>
            </div>

          </div>
        </section>

        {/* Section 4: How It Works */}
        <section className="w-full bg-[var(--paper-2)] border-y-[3px] border-[var(--ink)] py-16 md:py-24 relative overflow-hidden">
          <div className="absolute left-0 top-0 w-32 h-32 opacity-[0.03] select-none text-[120px]">〰</div>
          <div className="absolute right-0 bottom-0 w-32 h-32 opacity-[0.03] select-none text-[120px]">◐</div>
          
          <div className="max-w-[1280px] mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <span className="text-[11px] font-display font-black tracking-widest text-[var(--cherry)] uppercase bg-white border-[2.5px] border-[var(--ink)] px-3 py-1 rounded-full hard shadow-[1.5px_1.5px_0px_#10100F] inline-block mb-3">
                GUIDE
              </span>
              <h2 className="font-display font-[900] text-[42px] md:text-[56px] uppercase tracking-tight leading-none">
                How It Works
              </h2>
            </div>
            
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-8 relative z-10">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[4px] bg-[var(--ink)] -z-10 -translate-y-1/2 border-dashed"></div>
              
              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 flex flex-col items-center text-center relative hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full hard bg-[var(--sun)] text-[var(--ink)] font-display font-[900] text-[18px] flex items-center justify-center absolute -top-5">1</div>
                <div className="font-display font-black text-[32px] mb-4 mt-2">CREATE</div>
                <h3 className="font-display font-[900] text-[20px] mb-2 uppercase tracking-tight">Create Quiz</h3>
                <p className="font-body text-[13.5px] leading-relaxed opacity-85">Enter any topic into the AI generator and get a customized quiz deck in seconds.</p>
              </div>

              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 flex flex-col items-center text-center relative hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full hard bg-[var(--sky)] text-[var(--ink)] font-display font-[900] text-[18px] flex items-center justify-center absolute -top-5">2</div>
                <div className="font-display font-black text-[32px] mb-4 mt-2">HOST</div>
                <h3 className="font-display font-[900] text-[20px] mb-2 uppercase tracking-tight">Host Room</h3>
                <p className="font-body text-[13.5px] leading-relaxed opacity-85">Launch a classroom lobby and project the 6-digit PIN code on the main board.</p>
              </div>

              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 flex flex-col items-center text-center relative hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full hard bg-[var(--violet)] text-white font-display font-[900] text-[18px] flex items-center justify-center absolute -top-5">3</div>
                <div className="font-display font-black text-[32px] mb-4 mt-2">BATTLE</div>
                <h3 className="font-display font-[900] text-[20px] mb-2 uppercase tracking-tight">Battle Live</h3>
                <p className="font-body text-[13.5px] leading-relaxed opacity-85">Students choose custom avatars, enter the PIN, and start competing live.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="border-t-[3px] border-[var(--ink)] bg-[var(--paper)] py-12 text-center font-display relative z-10">
        <div className="max-w-[1280px] mx-auto px-4 flex flex-col items-center gap-4">
          <div className="font-display font-[900] text-[22px] tracking-tight">
            ⚡ QuizFlow
          </div>
          <div className="flex gap-4 text-[12px] font-display font-black uppercase tracking-wider text-[var(--violet)]">
            <Link href="/quizflow/join" className="hover:underline">Join Game</Link>
            <span>·</span>
            <Link href="/quizflow/host/new" className="hover:underline">Host Quiz</Link>
            <span>·</span>
            <Link href="/quizflow/studio" className="hover:underline">AI Studio</Link>
            <span>·</span>
            <Link href="/quizflow/dashboard" className="hover:underline">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
