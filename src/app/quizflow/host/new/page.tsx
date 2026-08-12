'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createSession } from '@/quizflow/sessionStore'
import { getSavedQuizzes, type SavedQuizItem } from '@/quizflow/quizStore'
import type { AIGeneratedQuiz } from '@/quizflow/types'
import { useRouter } from 'next/navigation'


export default function HostNewPage() {
  const router = useRouter()
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuizItem[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState<AIGeneratedQuiz | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>('')
  const [gameMode, setGameModeState] = useState<'classic' | 'boss_raid'>('classic')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const saved = getSavedQuizzes()
    setSavedQuizzes(saved)
    // Auto-select first quiz if available
    if (saved.length > 0) {
      setSelectedQuiz(saved[0].quiz)
      setSelectedKey(`saved_${saved[0].id}`)
    }
  }, [])

  const launchQuiz = (quiz: AIGeneratedQuiz) => {
    if (!quiz || !quiz.questions || quiz.questions.length === 0) {
      alert('Cannot host a quiz with 0 questions. Please add questions first.')
      return
    }
    setCreating(true)
    const state = createSession(quiz, 'host-' + Date.now(), gameMode)
    const hostPath = '/quizflow/host'
    setTimeout(() => {
      router.push(`${hostPath}?pin=${state.pin}`)
    }, 250)
  }

  const handleStart = () => {
    if (!selectedQuiz) return
    launchQuiz(selectedQuiz)
  }

  return (
    <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800 }}>⚡ QuizFlow</span>
          <span className="badge badge-sun">📡 HOST COMMAND</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/quizflow/dashboard"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>📊 Dashboard</button></Link>
          <Link href="/quizflow"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>← Home</button></Link>
        </div>
      </div>

      <div style={{ maxWidth: 1000, width: '100%', margin: '0 auto', padding: '32px 20px', flex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <div className="badge badge-cherry" style={{ marginBottom: 10, fontSize: 12 }}>🎮 SELECT OR CREATE QUIZ</div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 900, marginBottom: 6 }}>
            Host a Live Game
          </h1>
          <p style={{ color: '#555', fontSize: 15, fontFamily: 'Inter' }}>
            Choose how you want to create your quiz, or pick from ready-to-play decks below.
          </p>
        </div>

        {/* TOP SECTION: CHOOSE HOW TO CREATE QUIZ */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <span className="badge badge-sun" style={{ fontSize: 11, marginBottom: 8, display: 'inline-block' }}>
              ⚡ CHOOSE CREATION METHOD
            </span>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
              How would you like to create your quiz?
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            
            {/* OPTION 1: CREATE WITH AI */}
            <Link href="/quizflow/studio" style={{ textDecoration: 'none' }}>
              <div
                className="btn-press card"
                style={{
                  padding: 24,
                  border: '3px solid var(--ink)',
                  borderRadius: 18,
                  background: 'var(--sun)',
                  boxShadow: '5px 5px 0px #10100F',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="badge badge-ink" style={{ fontSize: 11 }}>🤖 10-SEC GENERATOR</span>
                    <span style={{ fontSize: 28 }}>✨</span>
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 900, color: 'var(--ink)', marginBottom: 8 }}>
                    Create with AI
                  </div>
                  <p style={{ fontFamily: 'Inter', fontSize: 13.5, color: 'var(--ink)', opacity: 0.85, lineHeight: 1.5, marginBottom: 18 }}>
                    Enter any topic, paste textbook notes, documents, or YouTube URLs. QuizFlow AI instantly generates questions with Bloom's levels and explanations.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
                  <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
                    Launch AI Studio
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'white', border: '2px solid var(--ink)', display: 'grid', placeItems: 'center', fontWeight: 900 }}>
                    →
                  </div>
                </div>
              </div>
            </Link>

            {/* OPTION 2: CREATE MANUALLY */}
            <Link href="/quizflow/studio?mode=manual" style={{ textDecoration: 'none' }}>
              <div
                className="btn-press card"
                style={{
                  padding: 24,
                  border: '3px solid var(--ink)',
                  borderRadius: 18,
                  background: 'var(--mint)',
                  boxShadow: '5px 5px 0px #10100F',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  height: '100%',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className="badge badge-ink" style={{ fontSize: 11 }}>✍️ CUSTOM BUILDER</span>
                    <span style={{ fontSize: 28 }}>📝</span>
                  </div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 900, color: 'var(--ink)', marginBottom: 8 }}>
                    Create Manually
                  </div>
                  <p style={{ fontFamily: 'Inter', fontSize: 13.5, color: 'var(--ink)', opacity: 0.85, lineHeight: 1.5, marginBottom: 18 }}>
                    Type your own custom questions, answer choices (A, B, C, D), mark correct answers, customize timers, and add your own teaching explanations.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
                  <span style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14, color: 'var(--ink)' }}>
                    Start Manual Quiz Builder
                  </span>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'white', border: '2px solid var(--ink)', display: 'grid', placeItems: 'center', fontWeight: 900 }}>
                    →
                  </div>
                </div>
              </div>
            </Link>

          </div>
        </div>

        {/* SECTION 1: YOUR SAVED & CREATED QUIZZES */}
        {savedQuizzes.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>
                📂 Your Saved Quizzes ({savedQuizzes.length})
              </h2>
              <Link href="/quizflow/studio">
                <button className="btn btn-sm btn-violet" style={{ fontSize: 12 }}>✨ + Create in Studio</button>
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {savedQuizzes.map((item) => {
                const isSelected = selectedKey === `saved_${item.id}`
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedQuiz(item.quiz)
                      setSelectedKey(`saved_${item.id}`)
                    }}
                    style={{
                      textAlign: 'left', padding: 20,
                      border: '2px solid var(--ink)',
                      borderRadius: 16,
                      background: isSelected ? 'var(--sun)' : 'var(--paper)',
                      boxShadow: isSelected ? '5px 5px 0 var(--ink)' : '3px 3px 0 var(--ink)',
                      transform: isSelected ? 'translate(-2px,-2px)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span className={`badge ${item.isDraft ? 'badge-cherry' : 'badge-mint'}`} style={{ fontSize: 10 }}>
                          {item.isDraft ? '📝 Draft' : '✅ Saved'}
                        </span>
                        <span style={{ fontSize: 11, color: '#666', fontFamily: 'Inter' }}>
                          {item.quiz.questions?.length || 0} Qs
                        </span>
                      </div>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 17, fontWeight: 800, marginBottom: 4, color: 'var(--ink)' }}>
                        {item.title}
                      </div>
                      <div style={{ color: '#555', fontSize: 12, fontFamily: 'Inter', marginBottom: 14, lineHeight: 1.4 }}>
                        {item.description || 'AI Created Quiz'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1.5px solid var(--ink)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-ink" style={{ fontSize: 10 }}>{item.language || 'English'}</span>
                        <span className="badge badge-sky" style={{ fontSize: 10 }}>{item.bloomLevel || 'Recall'}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          launchQuiz(item.quiz)
                        }}
                        className="btn btn-sm btn-primary"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                      >
                        🚀 Host Now
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* SECTION 2: QUICK-START AI STUDIO CTA */}
        {savedQuizzes.length === 0 && (
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>
              🌟 Get Started
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <Link href="/quizflow/studio" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    height: '100%', minHeight: 180, padding: 22,
                    border: '2px dashed var(--ink)',
                    borderRadius: 16,
                    background: 'var(--paper-2)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, cursor: 'pointer',
                    boxShadow: '3px 3px 0 var(--ink)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px,-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '5px 5px 0 var(--ink)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '3px 3px 0 var(--ink)'; }}
                >
                  <div style={{ fontSize: 36 }}>✨</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: 'var(--violet)' }}>Create with AI Studio</div>
                  <div style={{ color: '#666', fontSize: 12, textAlign: 'center', fontFamily: 'Inter' }}>Generate on any custom topic in seconds</div>
                </div>
              </Link>
              <Link href="/quizflow/practice" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    height: '100%', minHeight: 180, padding: 22,
                    border: '2px solid var(--ink)',
                    borderRadius: 16,
                    background: 'var(--sun)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, cursor: 'pointer',
                    boxShadow: '3px 3px 0 var(--ink)',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px,-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '5px 5px 0 var(--ink)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '3px 3px 0 var(--ink)'; }}
                >
                  <div style={{ fontSize: 36 }}>📚</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Browse Quiz Library</div>
                  <div style={{ color: '#555', fontSize: 12, textAlign: 'center', fontFamily: 'Inter' }}>Host from 6+ verified community decks</div>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* SECTION 3: GAME MODE SELECTOR & LAUNCH */}
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase' }}>
              ROOM GAME MODE:
            </span>
            <button
              onClick={() => setGameModeState('classic')}
              className={`btn btn-sm ${gameMode === 'classic' ? 'btn-sun' : ''}`}
              style={{ padding: '8px 18px', background: gameMode === 'classic' ? undefined : 'var(--paper-2)', color: 'var(--ink)', fontWeight: 800 }}
            >
              🎯 Classic Mode (Leaderboard)
            </button>
            <button
              onClick={() => setGameModeState('boss_raid')}
              className={`btn btn-sm ${gameMode === 'boss_raid' ? 'btn-cherry' : ''}`}
              style={{ padding: '8px 18px', background: gameMode === 'boss_raid' ? undefined : 'var(--paper-2)', color: 'var(--ink)', fontWeight: 800 }}
            >
              🐉 Boss Raid Mode (Co-Op Battle)
            </button>
          </div>

          {/* Launch Room Button */}
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={!selectedQuiz || creating}
            style={{ width: '100%', maxWidth: 450, fontSize: 18, padding: '16px' }}
          >
            {creating
              ? '🚀 Creating Room...'
              : selectedQuiz
                ? `🚀 Launch Room: ${selectedQuiz.title.slice(0, 26)}...`
                : '← Select a Quiz Above'}
          </button>
        </div>

      </div>
    </div>
  )
}

