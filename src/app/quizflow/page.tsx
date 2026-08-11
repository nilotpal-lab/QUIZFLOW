'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getHostUser, initAuthSync, type HostUser } from '@/quizflow/authStore'

export default function MarketingHomepage() {
  const router = useRouter()
  const [user, setUser] = useState<HostUser | null>(null)

  useEffect(() => {
    setUser(getHostUser())
    const unsubscribe = initAuthSync(updatedUser => {
      setUser(updatedUser)
    })
    return () => unsubscribe()
  }, [])

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
      <nav className="sticky top-0 z-50 bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[72px] flex items-center justify-between">
          <div 
            className="font-display font-[900] text-[26px] tracking-tight flex items-center gap-2 cursor-pointer select-none"
            onClick={() => router.push('/quizflow')}
          >
            <span className="text-[var(--violet)] drop-shadow-[1px_1px_0px_var(--ink)]">⚡</span> QuizFlow
          </div>
          <div className="flex items-center gap-3">
            <Link href="/quizflow/practice">
              <button className="hard bg-white border-[2.5px] border-[var(--ink)] text-[var(--ink)] rounded-full px-4 py-1.5 text-[12px] font-display font-black uppercase tracking-wider btn-press hidden sm:inline-block">
                📚 Quiz Library
              </button>
            </Link>
            {user ? (
              <div className="flex items-center gap-2.5">
                <Link href="/quizflow/studio">
                  <button className="hard bg-[var(--sun)] text-[var(--ink)] rounded-full px-4 py-1.5 text-[12px] font-display font-black uppercase tracking-wider btn-press hidden sm:inline-block">
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
                <button className="hard bg-white text-[var(--ink)] rounded-full px-5 py-2 text-[13px] font-display font-black uppercase tracking-wider btn-press">
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
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-16 md:py-24 relative flex flex-col items-center text-center">
          
          {/* Asymmetric Memphis Graphic Elements */}
          <div className="interactive-shape absolute top-8 left-10 md:left-24 w-14 h-20 bg-[var(--cherry)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] -rotate-[15deg] hidden md:block"></div>
          <div className="interactive-shape interactive-shape-circle absolute top-28 right-12 md:right-32 w-16 h-16 bg-[var(--mint)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[20deg] rounded-full hidden md:block"></div>
          
          {/* Actual Yellow Triangle */}
          <svg viewBox="0 0 100 100" className="interactive-shape interactive-shape-triangle absolute bottom-8 left-16 md:left-40 w-14 h-14 rotate-[15deg] hidden lg:block filter drop-shadow-[4px_4px_0px_#10100F]">
            <polygon points="50,15 90,85 10,85" fill="var(--sun)" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="miter" />
          </svg>
          
          {/* New Additional Graphic Elements */}
          <div className="interactive-shape interactive-shape-circle absolute top-64 left-4 md:left-12 w-10 h-10 bg-[var(--sky)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rounded-full hidden md:block"></div>
          <div className="interactive-shape absolute bottom-32 right-10 md:right-20 w-14 h-14 bg-[var(--violet)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[-10deg] hidden md:block"></div>
          
          {/* Actual Small Yellow Triangle */}
          <svg viewBox="0 0 100 100" className="interactive-shape interactive-shape-triangle absolute top-12 right-1/3 w-10 h-10 rotate-[45deg] hidden lg:block filter drop-shadow-[2px_2px_0px_#10100F]">
            <polygon points="50,15 90,85 10,85" fill="var(--sun)" stroke="var(--ink)" strokeWidth="8" strokeLinejoin="miter" />
          </svg>
          
          <div className="interactive-shape absolute top-48 right-8 md:right-16 w-8 h-20 bg-[var(--cherry)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[80deg] hidden lg:block"></div>

          {/* Premium Pill Badge */}
          <div className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] px-4 py-1.5 rounded-full font-display font-[800] text-[12px] tracking-wider uppercase mb-6 hard shadow-[2px_2px_0px_var(--violet)]">
            Classroom Engagement Redefined
          </div>
          
          <h1 className="font-display font-[900] text-[52px] md:text-[84px] lg:text-[105px] leading-[0.88] tracking-[-0.03em] uppercase max-w-[1050px]">
            The Classroom <br />
            <span className="text-[var(--violet)] relative inline-block">
              Battle Arena
              <span className="absolute -bottom-2 left-0 w-full h-[6px] md:h-[10px] bg-[var(--sun)] border-[2.5px] border-[var(--ink)] rounded-full -z-10"></span>
            </span>
          </h1>
          
          <p className="font-body text-[16px] md:text-[21px] font-[600] mt-8 max-w-[640px] opacity-90 leading-relaxed">
            Generate custom AI quizzes, host live multiplayer rooms, and build long-term mastery with practice decks.
          </p>

          {/* Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 w-full max-w-[1140px]">
            
            {/* CTA 1: Join Live Game (Students) */}
            <Link href="/quizflow/join" className="group">
              <div className="w-full h-24 hard bg-[var(--violet)] hover:bg-[#8f66ff] text-white rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[4px_4px_0px_#10100F] transition-all hover:shadow-[6px_6px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-white uppercase block mb-1">STUDENTS</span>
                  <span className="font-display font-[900] text-[18px] uppercase tracking-tight">Join Game</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[16px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

            {/* CTA 2: Practice Playing Area & Library */}
            <Link href="/quizflow/practice" className="group">
              <div className="w-full h-24 hard bg-[#FFE0B2] hover:bg-[#FFCC80] text-[var(--ink)] rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[4px_4px_0px_#10100F] transition-all hover:shadow-[6px_6px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-[#E65100] uppercase block mb-1">PRACTICE ARENA</span>
                  <span className="font-display font-[900] text-[18px] uppercase tracking-tight">Play Quizzes</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[16px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

            {/* CTA 3: AI Quiz Studio */}
            <Link href="/quizflow/studio" className="group">
              <div className="w-full h-24 hard bg-[var(--sun)] hover:bg-[#ffe799] text-[var(--ink)] rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[4px_4px_0px_#10100F] transition-all hover:shadow-[6px_6px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-[var(--cherry)] uppercase block mb-1">TEACHERS</span>
                  <span className="font-display font-[900] text-[18px] uppercase tracking-tight">AI Studio</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[16px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

            {/* CTA 4: Teacher Workspace & Host */}
            <Link href="/quizflow/dashboard" className="group">
              <div className="w-full h-24 hard bg-[var(--mint)] hover:bg-[#2eff99] text-[var(--ink)] rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[4px_4px_0px_#10100F] transition-all hover:shadow-[6px_6px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-[var(--ink)] uppercase block mb-1">WORKSPACE</span>
                  <span className="font-display font-[900] text-[18px] uppercase tracking-tight">Dashboard</span>
                </div>
                <div className="w-9 h-9 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[16px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

          </div>
        </section>

        {/* Section 2: Marquee Ticker */}
        <section className="w-full bg-[var(--ink)] text-[var(--paper)] h-[58px] overflow-hidden flex items-center border-y-[3px] border-[var(--ink)] relative">
          <div className="whitespace-nowrap flex animate-[marquee_30s_linear_infinite] will-change-transform max-w-none">
            <span className="font-display font-[800] tracking-widest text-[16px] px-4 uppercase">
              Live Multiplayer Battles · Thinking-Level AI · Co-Op Boss Raids · Spaced-Repetition Decks · Focus Shield Protection ·
            </span>
            <span className="font-display font-[800] tracking-widest text-[16px] px-4 uppercase">
              Live Multiplayer Battles · Thinking-Level AI · Co-Op Boss Raids · Spaced-Repetition Decks · Focus Shield Protection ·
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
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--sky)] border-[3px] border-[var(--ink)] rounded-full opacity-30 group-hover:scale-110 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--violet)] text-white flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">LIVE</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Live Battles</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Instant WebSocket room synchronization across devices with zero split-brain scoring.</p>
            </div>
            
            {/* Feature 2: AI Studio */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rotate-45 opacity-30 group-hover:rotate-90 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--sun)] text-[var(--ink)] flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">GEN</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">AI Studio</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Generate custom high-order thinking quizzes instantly with adaptive difficulty tiers.</p>
            </div>

            {/* Feature 3: Quiz Library & Practice */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute right-10 bottom-4 w-12 h-12 border-[4px] border-[var(--mint)] opacity-30 group-hover:translate-y-1.5 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--mint)] text-[var(--ink)] flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">LIB</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Quiz Library</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Explore AI-categorized quizzes across Sports, Biology, Maths & History. Host live or practice solo!</p>
            </div>

            {/* Feature 4: Boss Raids */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
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
