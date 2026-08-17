'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import QuizFlowLogo from '@/quizflow/QuizFlowLogo'

interface MeResponse {
  success: boolean
  team?: {
    id: string
    name: string
    code: string
    roster: string[]
    status: string
    claimed_by: string | null
  }
  member_name?: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [gate, setGate] = useState<{ gate_state: string; message: string } | null>(null)
  const [gameState, setGameState] = useState<'waiting' | 'lobby' | 'live' | 'ended' | 'none'>('waiting')

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Validate session — middleware also guards, but a direct check is safer.
      const res = await fetch('/api/session/me')
      const data = await res.json()
      if (!cancelled) {
        if (res.ok && data?.success) {
          setMe(data)
        } else {
          router.push('/quizflow/student/login')
          return
        }
      }
      // Gate + game status strip
      try {
        const g = await fetch('/api/event/config').then(r => r.json())
        if (!cancelled && g?.success) setGate({ gate_state: g.gate_state, message: g.message })
      } catch { /* ignore */ }

      try {
        const stRes = await fetch('/api/quiz/game/state')
        const st = await stRes.json().catch(() => null)
        if (!cancelled) {
          if (stRes.status === 404) {
            setGameState('none')
          } else if (st?.success) {
            setGameState(st.game?.status === 'ended' ? 'ended' : st.game?.status === 'lobby' ? 'lobby' : 'live')
          } else {
            setGameState('waiting')
          }
        }
      } catch {
        if (!cancelled) setGameState('none')
      }
    }
    load()
    return () => { cancelled = true }
  }, [router])

  const handleLogout = async () => {
    await fetch('/api/student/logout', { method: 'POST' })
    router.push('/quizflow/student/login')
  }

  const roster = me?.team?.roster || []

  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col text-[var(--ink)] overflow-x-hidden">
      {/* Top nav — wraps on phones so team badge + logout never collide */}
      <nav className="w-full bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-3 md:px-6 min-h-[60px] py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <Link href="/quizflow" className="font-display font-[900] text-[20px] md:text-[22px] tracking-tight flex items-center gap-1.5 shrink-0">
            <QuizFlowLogo size={24} className="md:w-[26px] md:h-[26px]" alt="QuizFlow" /> QuizFlow
          </Link>
          <div className="flex items-center gap-2.5 min-w-0">
            {me?.team && (
              <span className="badge badge-sun truncate max-w-[140px] sm:max-w-[180px]" title={me.team.name}>
                👥 {me.team.name}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="hard bg-white text-[var(--ink)] rounded-full px-4 py-2 text-[11px] sm:text-[12px] font-display font-bold uppercase tracking-wider border-[2px] border-[var(--ink)] btn-press shrink-0"
              style={{ minHeight: 36 }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-[760px] mx-auto px-3 md:px-6 py-6 md:py-12 flex flex-col gap-6 pb-[max(20px,env(safe-area-inset-bottom))]">

        {/* Team identity */}
        <div className="hard bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 shadow-[5px_5px_0px_#10100F] animate-scale-in">
          <div className="inline-flex items-center gap-2 hard bg-[var(--mint)] px-4 py-1.5 rounded-full font-display font-[800] text-[11px] uppercase tracking-widest border-[2px] border-[var(--ink)] mb-4">
            ✅ LOGGED IN
          </div>
          <h1 className="font-display font-[900] text-[clamp(24px,7vw,38px)] uppercase tracking-tight leading-none mb-2">
            {me?.team?.name || 'Your Team'}
          </h1>
          <div className="font-body text-[14px] font-semibold opacity-70 mb-4">
            {me?.member_name ? `Logged in as ${me.member_name}` : 'Ready to compete'} · Team code {me?.team?.code || '—'}
          </div>
          {roster.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {roster.map((m, i) => (
                <span key={i} className="hard bg-white border-[2px] border-[var(--ink)] rounded-full px-3.5 py-1 text-[12px] font-display font-[700]">
                  {i === 0 ? '👑 ' : ''}{m}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Status strip */}
        <div className="hard bg-white border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] px-5 py-3.5 flex items-center gap-3 shadow-[4px_4px_0px_#10100F]">
          <span className="relative flex w-3 h-3 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60 ${gameState === 'live' ? 'bg-[var(--cherry)]' : gameState === 'ended' ? 'bg-[var(--violet)]' : 'bg-[var(--sun)]'}`}></span>
            <span className={`relative inline-flex rounded-full w-3 h-3 ${gameState === 'live' ? 'bg-[var(--cherry)]' : gameState === 'ended' ? 'bg-[var(--violet)]' : 'bg-[var(--sun)]'}`}></span>
          </span>
          <span className="font-display font-[800] text-[14px]">
            {gameState === 'live' ? 'Game is LIVE — join now!' : gameState === 'lobby' ? 'Game is open — waiting in lobby.' : gameState === 'ended' ? 'Game ended — see final standings.' : gameState === 'none' ? 'No active game yet — waiting for the admin.' : 'Checking game status…'}
          </span>
        </div>

        {/* THE one feature: Join Game */}
        <button
          onClick={() => router.push('/quizflow/student/lobby')}
          className="group w-full hard bg-[var(--violet)] hover:bg-[#8f66ff] text-white rounded-[var(--radius-card)] p-6 md:p-10 flex items-center justify-between gap-4 btn-press shadow-[6px_6px_0px_#10100F] transition-all hover:shadow-[8px_8px_0px_#10100F] cursor-pointer"
          aria-label="Join game"
          style={{ minHeight: 120 }}
        >
          <div className="flex flex-col items-start gap-2 min-w-0">
            <span className="font-display font-[900] text-[clamp(24px,7vw,36px)] uppercase tracking-tight leading-none">Join Game</span>
            <span className="text-[12px] md:text-[13px] font-display font-[700] uppercase tracking-wider opacity-85">Enter the arena &amp; compete with your team</span>
          </div>
          <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-[var(--ink)] flex items-center justify-center font-display font-black text-[22px] md:text-[24px] hard border-[2px] border-[var(--ink)] shrink-0 group-hover:translate-x-1 transition-transform">
            →
          </div>
        </button>

        {gate && gate.gate_state !== 'open' && (
          <div className="text-center text-[12px] font-display font-bold uppercase tracking-wider opacity-60">
            {gate.message}
          </div>
        )}
      </main>
    </div>
  )
}
