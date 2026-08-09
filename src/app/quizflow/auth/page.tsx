'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  getHostUser,
  loginAsDemoHost,
  signUpHostAsync,
  loginHostAsync,
  initAuthSync,
  type HostUser
} from '@/quizflow/authStore'

export default function TeacherAuthPage() {
  const router = useRouter()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [school, setSchool]     = useState('')
  const [user, setUser]         = useState<HostUser | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [authError, setAuthError]     = useState('')
  const [authNotice, setAuthNotice]   = useState('')

  useEffect(() => {
    const existing = getHostUser()
    if (existing) {
      setUser(existing)
    }

    const unsubscribe = initAuthSync(updatedUser => {
      setUser(updatedUser)
    })
    return () => unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return

    setAuthError('')
    setAuthNotice('')
    setIsSubmitting(true)

    try {
      if (isSignUp) {
        const res = await signUpHostAsync(email.trim(), password, name.trim(), school.trim())
        setUser(res.user)
        if (res.message) {
          setAuthNotice(res.message)
        } else {
          router.push('/quizflow/dashboard')
        }
      } else {
        const loggedIn = await loginHostAsync(email.trim(), password)
        setUser(loggedIn)
        router.push('/quizflow/dashboard')
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDemoLogin = () => {
    setAuthError('')
    setAuthNotice('')
    const demo = loginAsDemoHost()
    setUser(demo)
    router.push('/quizflow/dashboard')
  }

  return (
    <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      
      {/* BRANDING HEADER */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Link href="/quizflow" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 900, color: 'var(--ink)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 40 }}>⚡</span> QuizFlow Studio
          </div>
        </Link>
        <div style={{ fontFamily: 'Inter', fontSize: 15, color: '#555', marginTop: 4 }}>
          Teacher & Host Command Center
        </div>
      </div>

      {/* ALREADY LOGGED IN CARD */}
      {user ? (
        <div className="card anim-scale-in" style={{ maxWidth: 440, width: '100%', padding: 28, textAlign: 'center' }}>
          <div className="badge badge-mint" style={{ display: 'inline-block', marginBottom: 12 }}>
            ✅ LOGGED IN SESSION
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
            {user.name}
          </h2>
          <div style={{ fontSize: 13, color: '#666', fontFamily: 'Inter', marginBottom: 16 }}>
            {user.email} • {user.school}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-sun btn-lg" onClick={() => router.push('/quizflow/dashboard')}>
              📊 Go to Dashboard →
            </button>
          </div>
        </div>
      ) : (
        /* LOGIN / SIGNUP CARD */
        <div className="card anim-scale-in" style={{ maxWidth: 460, width: '100%', padding: 28 }}>
          
          <div style={{ display: 'flex', borderBottom: '2px solid var(--ink)', marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => { setIsSignUp(false); setAuthError(''); setAuthNotice(''); }}
              style={{
                flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 800,
                border: 'none', background: !isSignUp ? 'var(--sun)' : 'transparent', cursor: 'pointer',
                borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottom: !isSignUp ? '2px solid var(--ink)' : 'none'
              }}
            >
              🔑 Teacher Login
            </button>
            <button
              type="button"
              onClick={() => { setIsSignUp(true); setAuthError(''); setAuthNotice(''); }}
              style={{
                flex: 1, padding: '10px', fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 800,
                border: 'none', background: isSignUp ? 'var(--mint)' : 'transparent', cursor: 'pointer',
                borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottom: isSignUp ? '2px solid var(--ink)' : 'none'
              }}
            >
              ✨ Create Account
            </button>
          </div>

          {/* AUTH ERROR ALERT */}
          {authError && (
            <div className="badge badge-cherry" style={{ width: '100%', padding: 12, marginBottom: 16, textAlign: 'left', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, whiteSpace: 'normal', lineHeight: 1.4 }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <span>{authError}</span>
            </div>
          )}

          {/* AUTH NOTICE ALERT */}
          {authNotice && (
            <div className="badge badge-mint" style={{ width: '100%', padding: 12, marginBottom: 16, textAlign: 'left', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, whiteSpace: 'normal', lineHeight: 1.4 }}>
              <span style={{ fontSize: 18 }}>📩</span>
              <span>{authNotice}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isSignUp && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                  Full Name
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Prof. Alex Mercer"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                Teacher Email
              </label>
              <input
                type="email"
                className="input"
                placeholder="teacher@school.edu"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                Password (min 6 characters)
              </label>
              <input
                type="password"
                className="input"
                placeholder="••••••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {isSignUp && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                  School / Institution
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Oakridge High School"
                  value={school}
                  onChange={e => setSchool(e.target.value)}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-lg"
              style={{ marginTop: 8, width: '100%', padding: '14px', opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting
                ? '⏳ Authenticating...'
                : isSignUp
                ? '✨ Register Account →'
                : '🔑 Sign In →'}
            </button>
          </form>

          <hr className="ink" style={{ margin: '20px 0' }} />

          {/* 1-CLICK DEMO LOGIN */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontFamily: 'Inter', color: '#666', marginBottom: 10 }}>
              Testing or demonstrating QuizFlow?
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="btn btn-sun"
              style={{ width: '100%', padding: '12px', fontSize: 14, fontWeight: 800 }}
            >
              🎓 Instant Demo Teacher Login (Prof. Alex)
            </button>
          </div>

        </div>
      )}

      {/* BACK TO HOME */}
      <div style={{ marginTop: 20 }}>
        <Link href="/quizflow" style={{ textDecoration: 'none', fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--ink)' }}>
          ← Back to Main Page
        </Link>
      </div>

    </div>
  )
}
