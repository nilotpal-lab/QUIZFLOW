import Link from 'next/link'

export default function MarketingHomepage() {
  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col overflow-x-hidden text-[var(--ink)]">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[64px] flex items-center justify-between">
          <div className="font-display font-[800] text-[24px] tracking-tight flex items-center gap-1">
            <span>⚡</span> QuizFlow
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <button className="hard bg-white text-[var(--ink)] rounded-full px-4 py-1.5 text-[14px] font-display font-bold btn-press">
                Login
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center">
        {/* Section 1: Hero */}
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-16 md:py-24 relative flex flex-col items-center text-center">
          {/* Floating CSS Shapes (Podium hint) */}
          <div className="absolute top-10 left-10 md:left-20 w-16 h-24 bg-[var(--cherry)] border-[3px] border-[var(--ink)] -rotate-12 hidden md:block"></div>
          <div className="absolute top-32 right-10 md:right-32 w-20 h-16 bg-[var(--mint)] border-[3px] border-[var(--ink)] rotate-12 rounded-full hidden md:block"></div>
          
          <h1 className="font-display font-[900] text-[48px] md:text-[80px] lg:text-[100px] leading-[0.9] tracking-[-0.03em] uppercase max-w-[1000px]">
            The Classroom <br />
            <span className="text-[var(--violet)] underline decoration-[6px] md:decoration-[10px] underline-offset-8">Battle Arena</span>
          </h1>
          
          <p className="font-body text-[16px] md:text-[20px] font-[500] mt-8 max-w-[600px] opacity-80">
            AI-Powered Live Quizzes · Real-Time Battles · Spaced Repetition Practice
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 w-full max-w-[800px]">
            <Link href="/quizflow/join" className="w-full">
              <button className="w-full h-16 md:h-20 hard bg-[var(--violet)] text-white rounded-[var(--radius-btn)] font-display font-[800] text-[18px] md:text-[22px] btn-press transition-transform">
                🎮 Join Live Game
              </button>
            </Link>
            <Link href="/host/new" className="w-full">
              <button className="w-full h-16 md:h-20 hard bg-[var(--sky)] text-[var(--ink)] rounded-[var(--radius-btn)] font-display font-[800] text-[18px] md:text-[22px] btn-press transition-transform">
                📡 Host a Game
              </button>
            </Link>
            <Link href="/studio" className="w-full">
              <button className="w-full h-16 md:h-20 hard bg-[var(--sun)] text-[var(--ink)] rounded-[var(--radius-btn)] font-display font-[800] text-[18px] md:text-[22px] btn-press transition-transform">
                ✨ AI Quiz Studio
              </button>
            </Link>
            <Link href="/auth" className="w-full">
              <button className="w-full h-16 md:h-20 hard bg-[var(--mint)] text-[var(--ink)] rounded-[var(--radius-btn)] font-display font-[800] text-[18px] md:text-[22px] btn-press transition-transform">
                🔑 Login / Dashboard
              </button>
            </Link>
          </div>
        </section>

        {/* Section 2: Marquee Ticker */}
        <section className="w-full bg-[var(--ink)] text-[var(--paper)] h-[56px] overflow-hidden flex items-center border-y-[3px] border-[var(--ink)] relative">
          <div className="whitespace-nowrap flex animate-[marquee_30s_linear_infinite] will-change-transform max-w-none">
            <span className="font-display font-[800] tracking-widest text-[16px] px-4">
              Quantum Mechanics · Ancient Rome · Cell Biology · World Geography · Web Engineering · Photosynthesis · World War II · React Hooks ·
            </span>
            <span className="font-display font-[800] tracking-widest text-[16px] px-4">
              Quantum Mechanics · Ancient Rome · Cell Biology · World Geography · Web Engineering · Photosynthesis · World War II · React Hooks ·
            </span>
            <span className="font-display font-[800] tracking-widest text-[16px] px-4">
              Quantum Mechanics · Ancient Rome · Cell Biology · World Geography · Web Engineering · Photosynthesis · World War II · React Hooks ·
            </span>
          </div>
        </section>

        {/* Section 3: Feature Cards Grid */}
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center mb-12">
            <h2 className="font-display font-[900] text-[36px] md:text-[48px]">Next-Gen Learning Tools</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--sky)] border-[3px] border-[var(--ink)] rounded-full opacity-50 group-hover:scale-110 transition-transform duration-300"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--violet)] text-white flex items-center justify-center text-[24px] mb-6 relative z-10">⚡</div>
              <h3 className="font-display font-[800] text-[20px] mb-2 relative z-10">Live Battles</h3>
              <p className="font-body text-[15px] opacity-80 relative z-10">Instant WebSocket sync across all laptops and phones with real-time leaderboards.</p>
            </div>
            
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group">
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rotate-45 opacity-50 group-hover:rotate-90 transition-transform duration-300"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--sun)] text-[var(--ink)] flex items-center justify-center text-[24px] mb-6 relative z-10">✨</div>
              <h3 className="font-display font-[800] text-[20px] mb-2 relative z-10">AI Studio</h3>
              <p className="font-body text-[15px] opacity-80 relative z-10">Questions automatically tiered from Recall to Analysis using Bloom&apos;s Taxonomy.</p>
            </div>

            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group">
              <div className="absolute right-10 bottom-4 w-12 h-12 border-[4px] border-[var(--mint)] opacity-50 group-hover:translate-y-2 transition-transform duration-300"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--mint)] text-[var(--ink)] flex items-center justify-center text-[24px] mb-6 relative z-10">🎴</div>
              <h3 className="font-display font-[800] text-[20px] mb-2 relative z-10">Practice Mode</h3>
              <p className="font-body text-[15px] opacity-80 relative z-10">Spaced repetition flashcards and solo practice to master any subject at your own pace.</p>
            </div>

            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rounded-full opacity-50 group-hover:-translate-x-2 transition-transform duration-300"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--cherry)] text-white flex items-center justify-center text-[24px] mb-6 relative z-10">🐉</div>
              <h3 className="font-display font-[800] text-[20px] mb-2 relative z-10">Boss Raids</h3>
              <p className="font-body text-[15px] opacity-80 relative z-10">Transform learning into a shared team battle where the entire classroom fights a boss monster.</p>
            </div>
          </div>
        </section>

        {/* Section 4: How It Works */}
        <section className="w-full bg-[var(--paper-2)] border-y-[3px] border-[var(--ink)] py-16 md:py-24">
          <div className="max-w-[1280px] mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="font-display font-[900] text-[36px] md:text-[48px]">How It Works</h2>
            </div>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[3px] bg-[var(--ink)] -z-10 -translate-y-1/2 border-dashed"></div>
              
              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 w-full max-w-[320px] flex flex-col items-center text-center relative">
                <div className="w-10 h-10 rounded-full hard bg-[var(--sun)] text-[var(--ink)] font-display font-[900] text-[20px] flex items-center justify-center absolute -top-5">1</div>
                <div className="text-[40px] mb-4 mt-2">✨</div>
                <h3 className="font-display font-[800] text-[22px] mb-2">Create Quiz</h3>
                <p className="font-body text-[14px] opacity-80">Generate content instantly with AI or build custom questions from scratch.</p>
              </div>

              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 w-full max-w-[320px] flex flex-col items-center text-center relative">
                <div className="w-10 h-10 rounded-full hard bg-[var(--sky)] text-[var(--ink)] font-display font-[900] text-[20px] flex items-center justify-center absolute -top-5">2</div>
                <div className="text-[40px] mb-4 mt-2">📡</div>
                <h3 className="font-display font-[800] text-[22px] mb-2">Host Room</h3>
                <p className="font-body text-[14px] opacity-80">Launch a live lobby. Students join instantly with a 6-digit PIN on any device.</p>
              </div>

              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 w-full max-w-[320px] flex flex-col items-center text-center relative">
                <div className="w-10 h-10 rounded-full hard bg-[var(--violet)] text-white font-display font-[900] text-[20px] flex items-center justify-center absolute -top-5">3</div>
                <div className="text-[40px] mb-4 mt-2">🎮</div>
                <h3 className="font-display font-[800] text-[22px] mb-2">Battle Live</h3>
                <p className="font-body text-[14px] opacity-80">Compete on real-time leaderboards or cooperate to defeat raid bosses.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Section 5: Clean Footer */}
      <footer className="border-t-[3px] border-[var(--ink)] bg-[var(--paper)] py-8 text-center font-display text-[14px] font-[700] tracking-wide opacity-80">
        © 2026 QuizFlow · The Next-Gen Classroom Platform
      </footer>
    </div>
  )
}
