'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getHostUser,
  loginHostAsync,
  loginHost,
  logoutHost,
  resendConfirmationEmailAsync,
  initAuthSync,
  type HostUser
} from '@/quizflow/authStore'
import { verifyAdminCredential } from '@/quizflow/adminCredentials'
import QuizFlowLogo from '@/quizflow/QuizFlowLogo'

export default function AdminAuthPage() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser]         = useState<HostUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError]     = useState('')
  const [authNotice, setAuthNotice]   = useState('')

  useEffect(() => {
    // Do NOT auto-redirect to the dashboard: this page doubles as the
    // account hub. When a session already exists we show the logged-in
    // card with "Go to Dashboard" and "Switch Account".
    const existing = getHostUser()
    if (existing) {
      setUser(existing)
    }

    const unsubscribe = initAuthSync(updatedUser => {
      if (updatedUser) {
        setUser(updatedUser)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password.trim()) return

    setAuthError('')
    setAuthNotice('')
    setIsSubmitting(true)

    try {
      // 1) Local admin credential (name + password, e.g. Sanchit / 123456)
      const cred = verifyAdminCredential(identifier.trim(), password)
      if (cred) {
        const adminEmail = cred.name.trim().toLowerCase().replace(/\s+/g, '.') + '@quizflow.local'
        const localUser = loginHost(adminEmail, cred.name, cred.school || 'QuizFlow Admin')
        setUser(localUser)
        // Issue the signed admin cookie so the event tools (teams,
        // controls, game) work without a Supabase account.
        await fetch('/api/admin/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: cred.name, password })
        }).catch(() => {})
        router.push('/quizflow/dashboard')
        return
      }
      // 2) Fallback: Supabase email+password admin accounts (type the email)
      const loggedIn = await loginHostAsync(identifier.trim(), password)
      setUser(loggedIn)
      router.push('/quizflow/dashboard')
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendEmail = async () => {
    if (!identifier.trim()) {
      setAuthError('Please enter your email address above to resend the confirmation link.')
      return
    }
    setAuthError('')
    setIsSubmitting(true)
    try {
      const msg = await resendConfirmationEmailAsync(identifier.trim())
      setAuthNotice(msg)
    } catch (err: any) {
      setAuthError(err.message || 'Failed to resend confirmation email.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLocalBypassLogin = () => {
    if (!identifier.trim()) return
    setAuthError('')
    setAuthNotice('')
    const localUser = loginHost(identifier.trim())
    setUser(localUser)
    router.push('/quizflow/dashboard')
  }

  return (
    <div className="min-h-screen w-full bg-[var(--paper)] selection:bg-[var(--sun)] flex flex-col items-center justify-center p-4 md:p-6 text-[var(--ink)] relative">
      
      {/* BRANDING HEADER */}
      <div className="text-center mb-6">
        <Link href="/quizflow" className="inline-flex items-center gap-2.5 font-display font-[900] text-[32px] md:text-[38px] tracking-tight hover:opacity-90 transition-opacity">
          <QuizFlowLogo size={40} className="md:w-[46px] md:h-[46px]" alt="QuizFlow" /> QuizFlow Studio
        </Link>
        <div className="font-body text-[14px] md:text-[15px] font-semibold text-[var(--ink)] opacity-75 mt-1">
          Admin &amp; Competition Command Center
        </div>
      </div>

      {/* ALREADY LOGGED IN CARD */}
      {user ? (
        <div className="w-full max-w-[460px] hard bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 text-center animate-scale-in">
          <div className="hard bg-[var(--mint)] text-[var(--ink)] font-display font-bold text-[12px] uppercase px-3.5 py-1 rounded-full inline-block mb-3 border-[2px] border-[var(--ink)]">
            ✅ LOGGED IN SESSION
          </div>
          <h2 className="font-display font-[900] text-[24px] text-[var(--ink)] mb-1">
            {user.name}
          </h2>
          <div className="font-body text-[13px] font-semibold text-[var(--ink)] opacity-70 mb-6">
            {user.email} • {user.school}
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button className="hard btn-press bg-[var(--sun)] text-[var(--ink)] font-display font-[900] text-[15px] px-6 py-3 rounded-[12px] border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F] cursor-pointer" onClick={() => router.push('/quizflow/dashboard')}>
              📊 Go to Dashboard →
            </button>
            <button
              className="hard btn-press bg-white text-[var(--ink)] font-display font-[900] text-[15px] px-6 py-3 rounded-[12px] border-[2.5px] border-[var(--ink)] shadow-[3px_3px_0px_#10100F] cursor-pointer"
              onClick={() => {
                // Clear the local session so the admin login form shows again.
                logoutHost()
                setUser(null)
                setAuthError('')
                setAuthNotice('')
              }}
            >
              🔑 Switch Account
            </button>
          </div>
        </div>
      ) : (
        /* LOGIN CARD */
        <div className="w-full max-w-[480px] hard bg-[var(--paper-2)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] p-6 md:p-8 shadow-[5px_5px_0px_#10100F] animate-scale-in">
          <div className="inline-flex items-center gap-2 hard bg-[var(--violet)] text-white px-4 py-1.5 rounded-full font-display font-[800] text-[12px] uppercase tracking-widest border-[2px] border-[var(--ink)] mb-6">
            🔑 ADMIN LOGIN
          </div>

          {/* AUTH ERROR ALERT */}
          {authError && (
            <div className="hard bg-[var(--cherry)] text-white p-4 mb-5 rounded-[12px] border-[2.5px] border-[var(--ink)] flex flex-col gap-2 text-[13px] font-display font-bold leading-snug">
              <div className="flex items-start gap-2.5">
                <span className="text-[18px] shrink-0">⚠️</span>
                <div>
                  <div>{authError}</div>
                  {authError.toLowerCase().includes('email not confirmed') && (
                    <div className="mt-1 font-body text-[12px] opacity-90">
                      Supabase requires email verification link confirmation before signing in on a new browser.
                    </div>
                  )}
                </div>
              </div>

              {authError.toLowerCase().includes('email not confirmed') && (
                <div className="flex flex-col sm:flex-row gap-2 mt-2 pt-2 border-t border-white/20">
                  <button
                    type="button"
                    onClick={handleResendEmail}
                    className="hard btn-press bg-[var(--sun)] text-[var(--ink)] px-3 py-1.5 rounded-[8px] text-[12px] font-display font-extrabold border-[1.5px] border-[var(--ink)]"
                  >
                    📩 Resend Verification Link
                  </button>
                  <button
                    type="button"
                    onClick={handleLocalBypassLogin}
                    className="hard btn-press bg-white text-[var(--ink)] px-3 py-1.5 rounded-[8px] text-[12px] font-display font-extrabold border-[1.5px] border-[var(--ink)]"
                  >
                    🔓 Continue Session on Device →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* AUTH NOTICE ALERT */}
          {authNotice && (
            <div className="hard bg-[var(--mint)] text-[var(--ink)] p-3.5 mb-5 rounded-[12px] border-[2.5px] border-[var(--ink)] flex items-start gap-2.5 text-[13px] font-display font-bold leading-snug">
              <span className="text-[16px] shrink-0">📩</span>
              <span>{authNotice}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-display font-[800] tracking-widest text-[var(--ink)] uppercase opacity-75 mb-1.5">
                Admin Name
              </label>
              <input
                type="text"
                placeholder="e.g. Sanchit"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                className="w-full h-[48px] px-4 bg-white border-[3px] border-[var(--ink)] rounded-[12px] font-body text-[14px] font-semibold outline-none focus:ring-[3px] focus:ring-[#FFE57F] shadow-[3px_3px_0px_#10100F]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-display font-[800] tracking-widest text-[var(--ink)] uppercase opacity-75 mb-1.5">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
                className="w-full h-[48px] px-4 bg-white border-[3px] border-[var(--ink)] rounded-[12px] font-body text-[14px] font-semibold outline-none focus:ring-[3px] focus:ring-[#FFE57F] shadow-[3px_3px_0px_#10100F]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 w-full h-[52px] hard btn-press bg-[var(--violet)] text-white font-display font-[900] text-[16px] uppercase tracking-wide rounded-[12px] border-[3px] border-[var(--ink)] shadow-[4px_4px_0px_#10100F] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting ? '⏳ Authenticating...' : '🔑 Sign In →'}
            </button>
          </form>
        </div>
      )}

      {/* BACK TO HOME */}
      <div className="mt-6">
        <Link href="/quizflow" className="font-display font-[800] text-[13px] text-[var(--ink)] hover:underline">
          ← Back to Main Page
        </Link>
      </div>

    </div>
  )
}

