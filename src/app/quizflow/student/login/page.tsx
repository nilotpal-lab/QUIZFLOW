'use client'
import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import QuizFlowLogo from '@/quizflow/QuizFlowLogo'

function getDeviceId(): string {
  try {
    let id = localStorage.getItem('qf_device_id')
    if (!id) {
      id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
      localStorage.setItem('qf_device_id', id)
    }
    return id
  } catch {
    return 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10)
  }
}

function LoginInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || ''

  const [gate, setGate] = useState<{ gate_state: string; message: string; opens_at: string | null } | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/event/config')
      .then(r => r.json())
      .then(data => {
        if (data?.success) {
          setGate({ gate_state: data.gate_state, message: data.message, opens_at: data.config?.opens_at || null })
        }
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const u = username.trim()
    if (!u || !password) {
      setError('Enter your team username and password.')
      return
    }
    setError('')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password, device_id: getDeviceId() })
      })
      const data = await res.json()
      if (res.ok && data?.success) {
        router.push(next || '/quizflow/student/dashboard')
      } else {
        setError(data?.error || 'Login failed. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  /* ── Gate screens (before login) ────────────────────────────── */
  if (gate && gate.gate_state !== 'open') {
    const isAfter = gate.gate_state === 'closed_after'
    return (
      <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col items-center justify-center p-4 text-[var(--ink)] overflow-x-hidden">
        {/* Top nav — same as the login form view, so admins can switch roles even when login is closed. */}
        <nav className="sticky top-0 z-40 w-full bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
          <div className="max-w-[1280px] mx-auto px-3 md:px-6 min-h-[60px] py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <Link href="/quizflow" className="font-display font-[900] text-[20px] md:text-[22px] tracking-tight flex items-center gap-1.5 shrink-0">
              <QuizFlowLogo size={26} alt="QuizFlow" /> QuizFlow
            </Link>
            <Link href="/quizflow/auth">
              <button className="hard bg-white text-[var(--ink)] rounded-full px-4 py-2 text-[11px] sm:text-[12px] font-display font-bold uppercase tracking-wider border-[2px] border-[var(--ink)] btn-press" style={{ minHeight: 36 }}>
                🛡️ Admin
              </button>
            </Link>
          </div>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-center w-full">
        <Link href="/quizflow" className="inline-flex items-center gap-2 font-display font-[900] text-[clamp(22px,7vw,28px)] tracking-tight mb-8">
          <QuizFlowLogo size={26} alt="QuizFlow" /> QuizFlow
        </Link>
        <div className="hard bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-8 max-w-[440px] w-full text-center animate-scale-in shadow-[5px_5px_0px_#10100F]">
          <div className="text-[56px] mb-4">{isAfter ? '🏁' : '🔒'}</div>
          <div className={`inline-flex items-center gap-2 hard px-4 py-1.5 rounded-full font-display font-[800] text-[12px] uppercase tracking-widest mb-4 border-[2px] border-[var(--ink)] ${isAfter ? 'bg-[var(--violet)] text-white' : 'bg-[var(--cherry)] text-white'}`}>
            {isAfter ? 'COMPETITION COMPLETE' : 'LOGIN CLOSED'}
          </div>
          <h1 className="font-display font-[900] text-[26px] uppercase tracking-tight mb-3">
            {isAfter ? 'See You Next Year!' : 'Not Open Yet'}
          </h1>
          <p className="font-body text-[14px] font-semibold opacity-80 leading-relaxed mb-2">
            {isAfter
              ? 'The competition has ended. Final standings are available on the event screen.'
              : gate.message || 'Student login is not open yet.'}
          </p>
          {!isAfter && gate.opens_at && (
            <div className="hard bg-white border-[2.5px] border-[var(--ink)] rounded-[12px] px-4 py-3 mt-4 font-display font-[800] text-[15px]">
              🗓️ {new Date(gate.opens_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}
            </div>
          )}
          <Link href="/quizflow" className="inline-block mt-6">
            <button className="hard btn-press bg-white text-[var(--ink)] font-display font-[800] text-[14px] px-6 py-3 rounded-[12px] border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F] cursor-pointer">
              ← Back to Home
            </button>
          </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col items-center justify-center p-0 text-[var(--ink)] overflow-x-hidden">
      {/* Top nav */}
      <nav className="sticky top-0 z-40 w-full bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-3 md:px-6 min-h-[60px] py-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <Link href="/quizflow" className="font-display font-[900] text-[20px] md:text-[22px] tracking-tight flex items-center gap-1.5 shrink-0">
            <QuizFlowLogo size={26} alt="QuizFlow" /> QuizFlow
          </Link>
          <Link href="/quizflow/auth">
            <button className="hard bg-white text-[var(--ink)] rounded-full px-4 py-2 text-[11px] sm:text-[12px] font-display font-bold uppercase tracking-wider border-[2px] border-[var(--ink)] btn-press" style={{ minHeight: 36 }}>
              🛡️ Admin
            </button>
          </Link>
        </div>
      </nav>

      <main className="w-full max-w-[460px] px-4 py-8 md:py-14 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="hard bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 shadow-[5px_5px_0px_#10100F] animate-scale-in">
          <div className="inline-flex items-center gap-2 hard bg-[var(--sun)] px-4 py-1.5 rounded-full font-display font-[800] text-[11px] uppercase tracking-widest border-[2px] border-[var(--ink)] mb-4">
            🎮 STUDENT LOGIN
          </div>
          <h1 className="font-display font-[900] text-[clamp(24px,7vw,28px)] uppercase tracking-tight leading-none mb-1">
            Competition Day
          </h1>
          <p className="font-body text-[13px] font-semibold opacity-70 mb-6">
            Use the username &amp; password your admin gave your team. One device per team.
          </p>

          {error && (
            <div className="mb-4 text-[13px] font-[700] text-[var(--cherry)] bg-red-100 border-[3px] border-[var(--cherry)] p-3 rounded-[8px]">
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="student-username" className="block text-[11px] font-display font-[800] tracking-widest uppercase opacity-75 mb-1.5">
                Team Username
              </label>
              <input
                id="student-username"
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. Phoenix Squad"
                className="w-full h-[50px] px-4 bg-white border-[3px] border-[var(--ink)] rounded-[12px] font-body text-[15px] font-semibold outline-none focus:ring-[3px] focus:ring-[#FFE57F] shadow-[3px_3px_0px_#10100F]"
                aria-label="Team username"
              />
            </div>
            <div>
              <label htmlFor="student-password" className="block text-[11px] font-display font-[800] tracking-widest uppercase opacity-75 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="student-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-[50px] px-4 bg-white border-[3px] border-[var(--ink)] rounded-[12px] font-body text-[15px] font-semibold outline-none focus:ring-[3px] focus:ring-[#FFE57F] shadow-[3px_3px_0px_#10100F]"
                  aria-label="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-display font-bold uppercase tracking-wider opacity-60 hover:opacity-100"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? '🙈 Hide' : '👁 Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-[54px] hard btn-press bg-[var(--violet)] text-white font-display font-[900] text-[16px] uppercase tracking-wide rounded-[12px] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? '⏳ Logging in…' : '🚀 Enter Team Arena →'}
            </button>
          </form>

          {gate && gate.gate_state === 'open' && (
            <div className="mt-4 text-center text-[11px] font-display font-bold uppercase tracking-wider text-[var(--mint)]">
              ● Login is open
            </div>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/quizflow" className="font-display font-[800] text-[13px] hover:underline">
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  )
}

export default function StudentLoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', fontFamily: 'Space Grotesk', color: 'var(--ink)', fontSize: 18, fontWeight: 700 }}>
        Loading…
      </div>
    }>
      <LoginInner />
    </Suspense>
  )
}
