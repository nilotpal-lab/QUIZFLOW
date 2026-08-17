'use client'
import Link from 'next/link'
import QuizFlowLogo from '@/quizflow/QuizFlowLogo'

export default function MarketingHomepage() {
  return (
    <div className="h-dvh w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col overflow-hidden text-[var(--ink)] relative">
      
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
        /* Compact scale for very short screens (e.g. landscape phones) so the
           one-screen layout never clips the login cards */
        @media (max-height: 520px) {
          main section {
            padding-top: 0.25rem;
            padding-bottom: 0.25rem;
          }
          main section .inline-flex {
            margin-bottom: 0.75rem;
          }
          main section h1 {
            font-size: 28px;
          }
          main section p {
            margin-top: 0.5rem;
          }
          main section .landing-cta-grid {
            margin-top: 0.75rem;
          }
          .landing-cta-grid .landing-card {
            height: 64px;
          }
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

      {/* Top Navigation — logo + title only (top-left), not a link */}
      <nav className="bg-[var(--paper)] border-b-[3px] border-[var(--ink)] shrink-0">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 min-h-[72px] py-3 flex items-center gap-2">
          <div className="font-display font-[900] text-[24px] md:text-[26px] tracking-tight flex items-center gap-2 select-none shrink-0">
            <QuizFlowLogo size={36} className="md:w-[42px] md:h-[42px]" alt="QuizFlow" /> QuizFlow
          </div>
        </div>
      </nav>

      {/* Main Content — single-screen front page (no scrolling) */}
      <main className="flex-1 flex flex-col items-center justify-center relative z-10">
        
        {/* Hero */}
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-8 relative flex flex-col items-center text-center overflow-x-hidden">
          
          {/* Asymmetric Memphis Graphic Elements */}
          <div className="interactive-shape absolute top-8 left-10 md:left-24 w-14 h-20 bg-[var(--cherry)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] -rotate-[15deg] hidden md:block"></div>
          <div className="interactive-shape interactive-shape-circle absolute top-28 right-12 md:right-32 w-16 h-16 bg-[var(--mint)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[20deg] rounded-full hidden md:block"></div>
          
          {/* Actual Yellow Triangle */}
          <svg viewBox="0 0 100 100" className="interactive-shape interactive-shape-triangle absolute bottom-8 left-16 md:left-40 w-14 h-14 rotate-[15deg] hidden lg:block filter drop-shadow-[4px_4px_0px_#10100F]">
            <polygon points="50,15 90,85 10,85" fill="var(--sun)" stroke="var(--ink)" strokeWidth="6" strokeLinejoin="miter" />
          </svg>
          
          {/* New Additional Graphic Elements */}
          <div className="interactive-shape interactive-shape-circle absolute top-64 left-4 md:left-12 w-10 h-10 bg-[var(--sky)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rounded-full hidden md:block"></div>
          
          {/* Actual Small Yellow Triangle */}
          <svg viewBox="0 0 100 100" className="interactive-shape interactive-shape-triangle absolute top-8 right-8 w-10 h-10 rotate-[45deg] hidden lg:block filter drop-shadow-[2px_2px_0px_#10100F]">
            <polygon points="50,15 90,85 10,85" fill="var(--sun)" stroke="var(--ink)" strokeWidth="8" strokeLinejoin="miter" />
          </svg>
          
          <div className="interactive-shape absolute top-48 right-8 md:right-16 w-8 h-20 bg-[var(--cherry)] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] rotate-[80deg] hidden lg:block"></div>

          {/* Premium Pill Badge */}
          <div className="inline-flex items-center gap-2.5 bg-[var(--ink)] text-[var(--paper)] px-7 py-3 rounded-full font-display font-[900] text-[15px] md:text-[18px] tracking-[0.08em] uppercase mb-6 hard shadow-[3px_3px_0px_var(--violet)] border-[2.5px] border-white/20">
            <span>⚡</span> Classroom Engagement Redefined
          </div>
          
          <h1 className="hero-title font-display font-[900] text-[34px] xs:text-[38px] sm:text-[46px] md:text-[72px] lg:text-[80px] leading-[0.98] sm:leading-[0.88] tracking-[-0.03em] uppercase max-w-[1050px] px-2">
            The Classroom <br />
            <span className="text-[var(--violet)] relative inline-block mt-2 sm:mt-0">
              Battle Arena
              <span className="absolute -bottom-1.5 sm:-bottom-2 left-0 w-full h-[6px] md:h-[10px] bg-[var(--sun)] border-[2.5px] border-[var(--ink)] rounded-full -z-10"></span>
            </span>
          </h1>
          
          <p className="font-body text-[15px] md:text-[18px] font-[600] mt-6 max-w-[640px] opacity-90 leading-relaxed px-4">
            Join the live quiz battle arena.
          </p>

          {/* Action Grid — two role entries (Admin | Student) */}
          <div className="landing-cta-grid grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 md:mt-8 w-full max-w-[760px] relative z-20">

            {/* CTA 1: Admin / Organizer */}
            <Link href="/quizflow/auth" className="group">
              <div className="landing-card w-full h-24 hard bg-[var(--violet)] hover:bg-[#8f66ff] text-white rounded-[var(--radius-card)] px-6 flex items-center justify-between btn-press shadow-[4px_4px_0px_#10100F] transition-all hover:shadow-[6px_6px_0px_#10100F] cursor-pointer">
                <div className="flex flex-col items-start gap-1">
                  <span className="font-display font-[900] text-[22px] sm:text-[26px] uppercase tracking-tight">Admin Login</span>
                  <span className="text-[12px] font-display font-[700] uppercase tracking-wider opacity-85">Organizer · Create &amp; host</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[18px] hard border-[2px] border-[var(--ink)] shrink-0">🛡️</div>
              </div>
            </Link>

            {/* CTA 2: Student / Contestant */}
            <Link href="/quizflow/student/login" className="group">
              <div className="landing-card w-full h-24 hard bg-[var(--sun)] hover:bg-[#ffe799] text-[var(--ink)] rounded-[var(--radius-card)] px-6 flex items-center justify-between btn-press shadow-[4px_4px_0px_#10100F] transition-all hover:shadow-[6px_6px_0px_#10100F] cursor-pointer">
                <div className="flex flex-col items-start gap-1">
                  <span className="font-display font-[900] text-[22px] sm:text-[26px] uppercase tracking-tight">Student Login</span>
                  <span className="text-[12px] font-display font-[700] uppercase tracking-wider opacity-75">Contestant · Play on the day</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[18px] hard border-[2px] border-[var(--ink)] shrink-0">🎮</div>
              </div>
            </Link>

          </div>
        </section>

        {/* ================================================================
            REMOVED MARKETING SECTIONS (simplified landing page, 2026)
            Restore by uncommenting — Marquee ticker, Feature bento grid,
            How It Works, FAQ accordions (kept in sync with the FAQPage
            JSON-LD schema in src/quizflow/JsonLd.tsx).
            ================================================================ */}

        {/* Section 2: Marquee Ticker
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
        </section> */}

        {/* Section 3: Feature Cards Grid (Bento Style)
        <section className="w-full max-w-[1280px] mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center mb-16">
            <span className="text-[15px] md:text-[17px] font-display font-[900] tracking-[0.12em] text-[var(--violet)] uppercase bg-[var(--paper-2)] border-[3px] border-[var(--ink)] px-6 py-2 rounded-full hard shadow-[3px_3px_0px_#10100F] inline-block mb-4">
              FEATURES
            </span>
            <h2 className="font-display font-[900] text-[42px] md:text-[56px] uppercase tracking-tight leading-none">
              Next-Gen Learning Tools
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-[var(--sky)] border-[3px] border-[var(--ink)] rounded-full opacity-30 group-hover:scale-110 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--violet)] text-white flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">LIVE</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Live Battles</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Instant WebSocket room synchronization across devices with zero split-brain scoring.</p>
            </div>

            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rotate-45 opacity-30 group-hover:rotate-90 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--sun)] text-[var(--ink)] flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">GEN</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">AI Studio</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Generate custom high-order thinking quizzes instantly with adaptive difficulty tiers.</p>
            </div>

            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute right-10 bottom-4 w-12 h-12 border-[4px] border-[var(--mint)] opacity-30 group-hover:translate-y-1.5 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--mint)] text-[var(--ink)] flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">LIB</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Quiz Library</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Explore AI-categorized quizzes across Sports, Biology, Maths & History. Host live or practice solo!</p>
            </div>

            <div className="hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 relative overflow-hidden group hover:-translate-y-1.5 transition-all duration-200">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-[var(--cherry)] border-[3px] border-[var(--ink)] rounded-full opacity-30 group-hover:-translate-x-1.5 transition-transform"></div>
              <div className="w-12 h-12 rounded-[12px] hard bg-[var(--cherry)] text-white flex items-center justify-center text-[22px] font-display font-bold mb-6 relative z-10">RAID</div>
              <h3 className="font-display font-[900] text-[22px] mb-2 relative z-10 uppercase tracking-tight">Boss Raids</h3>
              <p className="font-body text-[14px] leading-relaxed opacity-85 relative z-10">Turn lessons into epic co-op monster battles where correct answers reduce boss health.</p>
            </div>

          </div>
        </section> */}

        {/* Section 4: How It Works
        <section className="w-full bg-[var(--paper-2)] border-y-[3px] border-[var(--ink)] py-16 md:py-24 relative overflow-hidden">
          <div className="absolute left-0 top-0 w-32 h-32 opacity-[0.03] select-none text-[120px]">〰</div>
          <div className="absolute right-0 bottom-0 w-32 h-32 opacity-[0.03] select-none text-[120px]">◐</div>

          <div className="max-w-[1280px] mx-auto px-4 md:px-6">
            <div className="text-center mb-16">
              <span className="text-[15px] md:text-[17px] font-display font-[900] tracking-[0.12em] text-[var(--cherry)] uppercase bg-white border-[3px] border-[var(--ink)] px-6 py-2 rounded-full hard shadow-[3px_3px_0px_#10100F] inline-block mb-4">
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
        </section> */}

        {/* Section 5: SEO FAQ Section (Matches JSON-LD FAQPage Schema)
        <section className="w-full max-w-[1080px] mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-center mb-12">
            <span className="text-[15px] md:text-[17px] font-display font-[900] tracking-[0.12em] text-[var(--violet)] uppercase bg-[var(--paper-2)] border-[3px] border-[var(--ink)] px-6 py-2 rounded-full hard shadow-[3px_3px_0px_#10100F] inline-block mb-4">
              FAQ
            </span>
            <h2 className="font-display font-[900] text-[36px] md:text-[48px] uppercase tracking-tight leading-none">
              Frequently Asked Questions
            </h2>
            <p className="font-body text-[15px] md:text-[17px] font-semibold mt-3 opacity-80">
              Everything you need to know about QuizFlow, AI quiz generation, and classroom battle arenas.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <details className="group bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-5 md:p-6 hard open:bg-white transition-colors cursor-pointer">
              <summary className="font-display font-[900] text-[18px] md:text-[20px] uppercase flex items-center justify-between list-none select-none">
                <span>What is QuizFlow?</span>
                <span className="w-8 h-8 rounded-full border-[2px] border-[var(--ink)] grid place-items-center bg-[var(--sun)] text-[16px] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="font-body text-[14px] md:text-[15px] leading-relaxed mt-4 opacity-90">
                QuizFlow is a premier AI-powered classroom quiz competition platform designed for teachers, educators, and students. It allows anyone to instantly generate high-order thinking quizzes aligned with Bloom's Taxonomy, host real-time multiplayer classroom competitions with 6-digit game PINs, and master academic subjects through curated practice decks.
              </p>
            </details>

            <details className="group bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-5 md:p-6 hard open:bg-white transition-colors cursor-pointer">
              <summary className="font-display font-[900] text-[18px] md:text-[20px] uppercase flex items-center justify-between list-none select-none">
                <span>How does QuizFlow AI generate questions?</span>
                <span className="w-8 h-8 rounded-full border-[2px] border-[var(--ink)] grid place-items-center bg-[var(--mint)] text-[16px] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="font-body text-[14px] md:text-[15px] leading-relaxed mt-4 opacity-90">
                QuizFlow utilizes advanced educational AI to turn any topic, text notes, or curriculum prompt into structured multiple-choice questions. It provides adaptive Bloom’s Taxonomy difficulty levels, automatic Google image fetching for question diagrams, distractor misconception explanations, and customizable countdown timers.
              </p>
            </details>

            <details className="group bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-5 md:p-6 hard open:bg-white transition-colors cursor-pointer">
              <summary className="font-display font-[900] text-[18px] md:text-[20px] uppercase flex items-center justify-between list-none select-none">
                <span>How do students join a live QuizFlow battle?</span>
                <span className="w-8 h-8 rounded-full border-[2px] border-[var(--ink)] grid place-items-center bg-[var(--sky)] text-[16px] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="font-body text-[14px] md:text-[15px] leading-relaxed mt-4 opacity-90">
                Students do not need an account to play! They simply go to the Join Game page on any phone, tablet, or computer, type in the 6-digit room PIN displayed on the teacher's screen, pick a nickname and custom avatar, and compete in real-time.
              </p>
            </details>

            <details className="group bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-5 md:p-6 hard open:bg-white transition-colors cursor-pointer">
              <summary className="font-display font-[900] text-[18px] md:text-[20px] uppercase flex items-center justify-between list-none select-none">
                <span>Is QuizFlow free for teachers and schools?</span>
                <span className="w-8 h-8 rounded-full border-[2px] border-[var(--ink)] grid place-items-center bg-[#FFE0B2] text-[16px] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="font-body text-[14px] md:text-[15px] leading-relaxed mt-4 opacity-90">
                Yes! QuizFlow is 100% free for teachers and classrooms to generate quizzes with AI, host live multiplayer games, export printable PDF worksheets, and study with spaced-repetition flashcards.
              </p>
            </details>

            <details className="group bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-5 md:p-6 hard open:bg-white transition-colors cursor-pointer">
              <summary className="font-display font-[900] text-[18px] md:text-[20px] uppercase flex items-center justify-between list-none select-none">
                <span>What topics are available in the QuizFlow Library?</span>
                <span className="w-8 h-8 rounded-full border-[2px] border-[var(--ink)] grid place-items-center bg-[#EDE7FF] text-[16px] group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="font-body text-[14px] md:text-[15px] leading-relaxed mt-4 opacity-90">
                The QuizFlow Library features verified quizzes across Sports & Athletics, Biology & Life Sciences, Mathematics & Logic, Technology & Code, World History, Cosmology & Physics, and General Knowledge. You can practice solo with audio text-to-speech or host any deck live.
              </p>
            </details>
          </div>
        </section> */}

      </main>

    </div>
  )
}
