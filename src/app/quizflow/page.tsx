import Link from 'next/link'

export default function MarketingHomepage() {
  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col overflow-x-hidden text-[var(--ink)] relative">
      
      {/* High-End Dotted Grid Texture Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.25]"
        style={{
          backgroundImage: `radial-gradient(var(--ink) 1.5px, transparent 1.5px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Top Navigation */}
      <nav className="sticky top-0 z-50 bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[68px] flex items-center justify-between">
          <div className="font-display font-[900] text-[26px] tracking-tight flex items-center gap-1.5 cursor-default select-none">
            <span className="text-[var(--violet)] drop-shadow-[1px_1px_0px_var(--ink)]">⚡</span> QuizFlow
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth">
              <button className="hard bg-white text-[var(--ink)] rounded-full px-5 py-2 text-[13px] font-display font-black uppercase tracking-wider btn-press">
                Login
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center relative z-10">
        
        {/* Section 1: Hero */}
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-16 md:py-24 relative flex flex-col items-center text-center">
          
          {/* Asymmetric Memphis Graphic Elements */}
          <div className="absolute top-8 left-10 md:left-24 w-14 h-20 bg-[var(--cherry)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] -rotate-[15deg] hidden md:block"></div>
          <div className="absolute top-28 right-12 md:right-32 w-16 h-16 bg-[var(--mint)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[20deg] rounded-full hidden md:block"></div>
          <div className="absolute bottom-8 left-16 md:left-40 w-12 h-12 bg-[var(--sun)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[45deg] hidden lg:block"></div>

          {/* Premium Pill Badge */}
          <div className="inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--paper)] px-4 py-1.5 rounded-full font-display font-[800] text-[12px] tracking-wider uppercase mb-6 hard shadow-[2px_2px_0px_var(--violet)]">
            <span>🚀</span> Next-Gen Classroom Engagement
          </div>
          
          <h1 className="font-display font-[900] text-[52px] md:text-[84px] lg:text-[105px] leading-[0.88] tracking-[-0.03em] uppercase max-w-[1050px]">
            The Classroom <br />
            <span className="text-[var(--violet)] relative inline-block">
              Battle Arena
              <span className="absolute -bottom-2 left-0 w-full h-[6px] md:h-[10px] bg-[var(--sun)] border-[2.5px] border-[var(--ink)] rounded-full -z-10"></span>
            </span>
          </h1>
          
          <p className="font-body text-[16px] md:text-[21px] font-[600] mt-8 max-w-[640px] opacity-90 leading-relaxed">
            Generate instant AI quizzes, launch live co-op boss raids, and build long-term mastery with practice decks.
          </p>

          {/* Beautiful Asymmetric Action Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-14 w-full max-w-[840px]">
            
            {/* CTA 1: Join Live Game */}
            <Link href="/quizflow/join" className="group">
              <div className="w-full h-20 md:h-24 hard bg-[var(--violet)] hover:bg-[#8f66ff] text-white rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[5px_5px_0px_#10100F] transition-all hover:shadow-[7px_7px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-[var(--sun)] uppercase block mb-1">🕹️ STUDENTS</span>
                  <span className="font-display font-[900] text-[20px] md:text-[24px] uppercase tracking-tight">Join Live Arena</span>
                </div>
                <div className="w-11 h-11 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[20px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

            {/* CTA 2: Host Game */}
            <Link href="/host/new" className="group">
              <div className="w-full h-20 md:h-24 hard bg-[var(--sky)] hover:bg-[#59d0ff] text-[var(--ink)] rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[5px_5px_0px_#10100F] transition-all hover:shadow-[7px_7px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-[var(--violet)] uppercase block mb-1">📡 TEACHERS</span>
                  <span className="font-display font-[900] text-[20px] md:text-[24px] uppercase tracking-tight">Host Game Room</span>
                </div>
                <div className="w-11 h-11 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[20px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

            {/* CTA 3: AI Quiz Studio */}
            <Link href="/studio" className="group">
              <div className="w-full h-20 md:h-24 hard bg-[var(--sun)] hover:bg-[#ffe799] text-[var(--ink)] rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[5px_5px_0px_#10100F] transition-all hover:shadow-[7px_7px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-[var(--cherry)] uppercase block mb-1">✨ CREATION</span>
                  <span className="font-display font-[900] text-[20px] md:text-[24px] uppercase tracking-tight">AI Quiz Studio</span>
                </div>
                <div className="w-11 h-11 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[20px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

            {/* CTA 4: Login / Dashboard */}
            <Link href="/auth" className="group">
              <div className="w-full h-20 md:h-24 hard bg-[var(--mint)] hover:bg-[#2eff99] text-[var(--ink)] rounded-[var(--radius-card)] p-4 flex items-center justify-between btn-press shadow-[5px_5px_0px_#10100F] transition-all hover:shadow-[7px_7px_0px_#10100F] cursor-pointer">
                <div className="text-left">
                  <span className="text-[10px] font-display font-black tracking-widest text-[var(--ink)] uppercase block mb-1">🔑 DASHBOARD</span>
                  <span className="font-display font-[900] text-[20px] md:text-[24px] uppercase tracking-tight">Login & Stats</span>
                </div>
                <div className="w-11 h-11 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[20px] hard border-[2px] border-[var(--ink)] shrink-0">→</div>
              </div>
            </Link>

          </div>
        </section>

        {/* Section 2: Marquee Ticker */}
        <section className="w-full bg-[var(--ink)] text-[var(--paper)] h-[58px] overflow-hidden flex items-center border-y-[3px] border-[var(--ink)] relative">
          <div className="whitespace-nowrap flex animate-[marquee_30s_linear_infinite] will-change-transform max-w-none">
            <span className="font-display font-[800] tracking-widest text-[16px] px-4 uppercase">
              ⚡ Live Multiplayer Battles · 🧠 Bloom&apos;s Taxonomy AI · 🐉 Co-Op Boss Raids · 🎴 Spaced-Repetition Decks · 🛡️ Focus Shield Protection ·
            </span>
            <span className="font-display font-[800] tracking-widest text-[16px] px-4 uppercase">
              ⚡ Live Multiplayer Battles · 🧠 Bloom&apos;s Taxonomy AI · 🐉 Co-Op Boss Raids · 🎴 Spaced-Repetition Decks · 🛡️ Focus Shield Protection ·
            </span>
          </div>
          <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[var(--ink)] to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[var(--ink)] to-transparent pointer-events-none" />
        </section>

        {/* Section 3: Feature Cards Grid (Bento Style) */}
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center mb-16">
            <span className="text-[11px] font-display font-black tracking-widest text-[var(--violet)] uppercase bg-[var(--paper-2)] border-[2.5px] border-[var(--ink)] px-3 py-1 rounded-full hard shadow-[1.5px_1.5px_0px_#10100F] inline-block mb-3">
              ⚡ FEATURES
            </span>
            <h2 className="font-display font-[900] text-[42px] md:text-[56px] uppercase tracking-tight leading-none">
              Next-Gen Learning Tools
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Feature 1: Live Battles */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--sky)] border-[3px] border-[var(--ink)] rounded-full opacity-30 group-hover:scale-110 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--violet)] text-white flex items-center justify-center text-[24px] mb-6 relative z-10">⚡</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Live Battles</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Instant WebSocket room synchronization across devices with zero split-brain scoring.</p>
            </div>
            
            {/* Feature 2: AI Studio */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rotate-45 opacity-30 group-hover:rotate-90 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--sun)] text-[var(--ink)] flex items-center justify-center text-[24px] mb-6 relative z-10">✨</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">AI Studio</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Generate custom high-order thinking quizzes instantly with adaptive difficulty tiers.</p>
            </div>

            {/* Feature 3: Practice Mode */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute right-10 bottom-4 w-12 h-12 border-[4px] border-[var(--mint)] opacity-30 group-hover:translate-y-1.5 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--mint)] text-[var(--ink)] flex items-center justify-center text-[24px] mb-6 relative z-10">🎴</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Practice Mode</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Spaced repetition flashcards with interactive audio speech readouts for long-term retention.</p>
            </div>

            {/* Feature 4: Boss Raids */}
            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rounded-full opacity-30 group-hover:-translate-x-1.5 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--cherry)] text-white flex items-center justify-center text-[24px] mb-6 relative z-10">🐉</div>
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
                📋 GUIDE
              </span>
              <h2 className="font-display font-[900] text-[42px] md:text-[56px] uppercase tracking-tight leading-none">
                How It Works
              </h2>
            </div>
            
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-8 relative z-10">
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-[4px] bg-[var(--ink)] -z-10 -translate-y-1/2 border-dashed"></div>
              
              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 flex flex-col items-center text-center relative hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full hard bg-[var(--sun)] text-[var(--ink)] font-display font-[900] text-[18px] flex items-center justify-center absolute -top-5">1</div>
                <div className="text-[44px] mb-4 mt-2">✨</div>
                <h3 className="font-display font-[900] text-[20px] mb-2 uppercase tracking-tight">Create Quiz</h3>
                <p className="font-body text-[13.5px] leading-relaxed opacity-85">Enter any topic into the AI generator and get a customized quiz deck in seconds.</p>
              </div>

              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 flex flex-col items-center text-center relative hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full hard bg-[var(--sky)] text-[var(--ink)] font-display font-[900] text-[18px] flex items-center justify-center absolute -top-5">2</div>
                <div className="text-[44px] mb-4 mt-2">📡</div>
                <h3 className="font-display font-[900] text-[20px] mb-2 uppercase tracking-tight">Host Room</h3>
                <p className="font-body text-[13.5px] leading-relaxed opacity-85">Launch a classroom lobby and project the 6-digit PIN code on the main board.</p>
              </div>

              <div className="bg-[var(--paper)] hard border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 flex-1 flex flex-col items-center text-center relative hover:scale-[1.02] transition-transform">
                <div className="w-10 h-10 rounded-full hard bg-[var(--violet)] text-white font-display font-[900] text-[18px] flex items-center justify-center absolute -top-5">3</div>
                <div className="text-[44px] mb-4 mt-2">🎮</div>
                <h3 className="font-display font-[900] text-[20px] mb-2 uppercase tracking-tight">Battle Live</h3>
                <p className="font-body text-[13.5px] leading-relaxed opacity-85">Students choose custom avatars, enter the PIN, and start competing live.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Section 5: Branded Footer */}
      <footer className="border-t-[3px] border-[var(--ink)] bg-[var(--paper)] py-10 text-center font-display relative z-10">
        <div className="max-w-[1280px] mx-auto px-4 flex flex-col items-center gap-4">
          <div className="font-display font-[900] text-[20px] tracking-tight">
            ⚡ QuizFlow
          </div>
          <div className="text-[12px] font-display font-bold uppercase tracking-wider text-[var(--violet)] bg-white border-[2px] border-[var(--ink)] px-3 py-1 rounded-full">
            Designed with Neo-Brutalist Memphis Taste
          </div>
          <div className="text-[13px] font-body font-semibold opacity-70 mt-2">
            © 2026 QuizFlow · The Next-Gen Classroom Platform
          </div>
        </div>
      </footer>
    </div>
  )
}
