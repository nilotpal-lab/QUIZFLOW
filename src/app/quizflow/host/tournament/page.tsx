'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSavedQuizzes, type SavedQuizItem } from '@/quizflow/quizStore'
import { createSession } from '@/quizflow/sessionStore'
import type { AIGeneratedQuiz } from '@/quizflow/types'
import type { RoundConfig, TournamentConfig } from '@/quizflow/types'

type Step = 'build' | 'preview' | 'launching'

interface RoundDraft {
  id: string
  roundNumber: number
  quizTitle: string
  quiz: AIGeneratedQuiz | null
  eliminationRule: string
}

const EXAMPLE_RULES = [
  'Bottom 30% by score gets eliminated',
  'Anyone with less than 3 correct answers is out',
  'Only top 5 players survive',
  'Players with score below 500 are eliminated',
  'Bottom 2 players are removed each round',
]

export default function TournamentPage() {
  const router = useRouter()
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuizItem[]>([])
  const [rounds, setRounds] = useState<RoundDraft[]>([
    { id: 'r1', roundNumber: 1, quizTitle: '', quiz: null, eliminationRule: '' },
    { id: 'r2', roundNumber: 2, quizTitle: '', quiz: null, eliminationRule: '' },
  ])
  const [step, setStep] = useState<Step>('build')
  const [parsedRules, setParsedRules] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')

  useEffect(() => {
    const saved = getSavedQuizzes()
    setSavedQuizzes(saved)
  }, [])

  const addRound = () => {
    const n = rounds.length + 1
    setRounds(prev => [...prev, { id: `r${Date.now()}`, roundNumber: n, quizTitle: '', quiz: null, eliminationRule: '' }])
  }

  const removeRound = (id: string) => {
    setRounds(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, roundNumber: i + 1 })))
  }

  const updateRound = (id: string, field: keyof RoundDraft, value: string | AIGeneratedQuiz | null) => {
    setRounds(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const selectQuizForRound = (id: string, quizItem: SavedQuizItem | null) => {
    if (!quizItem) {
      updateRound(id, 'quiz', null)
      updateRound(id, 'quizTitle', '')
    } else {
      updateRound(id, 'quiz', quizItem.quiz)
      updateRound(id, 'quizTitle', quizItem.quiz.title || 'Untitled Quiz')
    }
  }

  const canPreview = rounds.every(r => r.quiz && r.eliminationRule.trim().length > 0)

  const handlePreview = async () => {
    if (!canPreview) return
    setParsing(true)
    setParseError('')
    try {
      const res = await fetch('/api/quizflow/parse-tournament-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rounds: rounds.map(r => ({
            roundNumber: r.roundNumber,
            quizTitle: r.quizTitle,
            eliminationRule: r.eliminationRule
          }))
        })
      })
      const data = await res.json()
      setParsedRules(data.simplified || rounds.map(r => `- Round ${r.roundNumber}: ${r.eliminationRule}`).join('\n'))
      setStep('preview')
    } catch {
      setParsedRules(rounds.map(r => `- Round ${r.roundNumber}: ${r.eliminationRule}`).join('\n'))
      setStep('preview')
    } finally {
      setParsing(false)
    }
  }

  const handleLaunch = () => {
    const firstRound = rounds[0]
    if (!firstRound?.quiz) return
    setStep('launching')

    const tc: TournamentConfig = {
      rounds: rounds.map(r => ({
        roundNumber: r.roundNumber,
        quizTitle: r.quizTitle,
        quiz: r.quiz!,
        eliminationRule: r.eliminationRule,
      })),
      parsedRules,
      currentRoundIndex: 0,
      eliminations: {},
    }

    const state = createSession(firstRound.quiz, 'host-' + Date.now(), 'classic')
    // Inject tournament config into state via localStorage patch
    try {
      const key = `qf_session_${state.pin}`
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        parsed.tournamentConfig = tc
        parsed.currentRound = 1
        parsed.tournamentRoundLabel = `Round 1 of ${rounds.length}`
        localStorage.setItem(key, JSON.stringify(parsed))
      }
    } catch {}

    setTimeout(() => {
      router.push(`/quizflow/host?pin=${state.pin}`)
    }, 300)
  }

  return (
    <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800 }}>⚡ QuizFlow</span>
          <span className="badge badge-cherry">🏆 TOURNAMENT MODE</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/quizflow/host/new"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>← Back</button></Link>
        </div>
      </div>

      <div style={{ maxWidth: 860, width: '100%', margin: '0 auto', padding: '32px 20px', flex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="badge badge-sun" style={{ marginBottom: 10, fontSize: 12 }}>🏆 MULTI-ROUND ELIMINATION</div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
            Tournament Builder
          </h1>
          <p style={{ color: '#555', fontSize: 15, fontFamily: 'Inter', maxWidth: 520, margin: '0 auto' }}>
            Create multiple rounds with custom elimination rules. AI will parse your rules and show you exactly what will happen.
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 40 }}>
          {(['build', 'preview', 'launching'] as Step[]).map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: step === s ? 'var(--ink)' : (
                  (step === 'preview' && s === 'build') || (step === 'launching') ? 'var(--mint)' : 'var(--paper-2)'
                ),
                border: '2px solid var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14,
                color: step === s ? 'var(--paper)' : 'var(--ink)',
              }}>
                {(step === 'preview' && s === 'build') || step === 'launching' && s !== 'launching' ? '✓' : i + 1}
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700, marginLeft: 6, color: step === s ? 'var(--ink)' : '#888', textTransform: 'uppercase' }}>
                {s === 'build' ? 'Build Rounds' : s === 'preview' ? 'AI Review' : 'Launch'}
              </div>
              {i < 2 && <div style={{ width: 40, height: 2, background: 'var(--ink)', margin: '0 12px', opacity: 0.2 }} />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: BUILD ── */}
        {step === 'build' && (
          <div>
            <div style={{ marginBottom: 24 }}>
              {rounds.map((round, idx) => {
                const selectedQuiz = savedQuizzes.find(q => q.quiz === round.quiz)
                return (
                  <div key={round.id} className="card" style={{ padding: '24px 20px', marginBottom: 16, border: '2.5px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', background: 'var(--sun)',
                          border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 16, flexShrink: 0
                        }}>
                          {round.roundNumber}
                        </div>
                        <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, margin: 0 }}>
                          Round {round.roundNumber}
                          {idx === rounds.length - 1 && <span className="badge badge-mint" style={{ marginLeft: 8, fontSize: 10 }}>FINAL</span>}
                        </h3>
                      </div>
                      {rounds.length > 2 && (
                        <button
                          onClick={() => removeRound(round.id)}
                          style={{ background: 'var(--cherry)', color: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 12 }}
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    {/* Quiz selector */}
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        📚 Quiz for this round
                      </label>
                      {savedQuizzes.length === 0 ? (
                        <div style={{ padding: '12px 14px', background: '#FFF8D6', border: '1.5px solid var(--ink)', borderRadius: 10, fontFamily: 'Inter', fontSize: 13, color: '#666' }}>
                          No saved quizzes yet. <Link href="/quizflow/studio" style={{ color: 'var(--violet)', fontWeight: 700 }}>Create one in Studio →</Link>
                        </div>
                      ) : (
                        <select
                          value={selectedQuiz?.id || ''}
                          onChange={e => {
                            const q = savedQuizzes.find(sq => sq.id === e.target.value) || null
                            selectQuizForRound(round.id, q)
                          }}
                          style={{
                            width: '100%', padding: '10px 12px', border: '2px solid var(--ink)', borderRadius: 10,
                            fontFamily: 'Inter', fontSize: 14, fontWeight: 600, background: 'var(--paper)',
                            cursor: 'pointer', outline: 'none'
                          }}
                        >
                          <option value="">— Select a quiz —</option>
                          {savedQuizzes.map(q => (
                            <option key={q.id} value={q.id}>
                              {q.quiz.title || 'Untitled'} ({q.quiz.questions?.length || 0} questions)
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Elimination rule */}
                    <div>
                      <label style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        ⚔️ Elimination Rule <span style={{ opacity: 0.5, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(in plain English)</span>
                      </label>
                      <textarea
                        value={round.eliminationRule}
                        onChange={e => updateRound(round.id, 'eliminationRule', e.target.value)}
                        placeholder={EXAMPLE_RULES[idx % EXAMPLE_RULES.length]}
                        rows={2}
                        style={{
                          width: '100%', padding: '10px 12px', border: '2px solid var(--ink)', borderRadius: 10,
                          fontFamily: 'Inter', fontSize: 14, resize: 'none', background: 'var(--paper)',
                          outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {EXAMPLE_RULES.slice(0, 3).map(ex => (
                          <button
                            key={ex}
                            onClick={() => updateRound(round.id, 'eliminationRule', ex)}
                            style={{
                              padding: '3px 9px', background: 'var(--paper-2)', border: '1.5px solid var(--ink)',
                              borderRadius: 20, fontFamily: 'Inter', fontSize: 11, cursor: 'pointer',
                              color: 'var(--ink)', fontWeight: 600
                            }}
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Add round */}
            <button
              onClick={addRound}
              style={{
                width: '100%', padding: '14px', border: '2.5px dashed var(--ink)', borderRadius: 14,
                background: 'transparent', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15,
                color: 'var(--ink)', cursor: 'pointer', marginBottom: 24,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              + Add Another Round
            </button>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Link href="/quizflow/host/new">
                <button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>Cancel</button>
              </Link>
              <button
                className="btn"
                onClick={handlePreview}
                disabled={!canPreview || parsing}
                style={{
                  background: canPreview ? 'var(--ink)' : 'var(--paper-2)', color: canPreview ? 'var(--paper)' : '#aaa',
                  border: '2px solid var(--ink)', padding: '12px 28px', fontFamily: 'Space Grotesk',
                  fontWeight: 800, fontSize: 15, cursor: canPreview ? 'pointer' : 'not-allowed',
                  boxShadow: canPreview ? '3px 3px 0 var(--cherry)' : 'none'
                }}
              >
                {parsing ? '🤖 AI Parsing Rules…' : '🤖 Preview AI Rules →'}
              </button>
            </div>
            {!canPreview && (
              <div style={{ textAlign: 'right', fontFamily: 'Inter', fontSize: 12, color: '#888', marginTop: 8 }}>
                Select a quiz and add elimination rule for every round to continue.
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: AI PREVIEW ── */}
        {step === 'preview' && (
          <div>
            <div className="card anim-scale-in" style={{ padding: '28px 24px', border: '2.5px solid var(--ink)', boxShadow: '5px 5px 0 var(--ink)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ fontSize: 36 }}>🤖</div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                    Here's what the AI understood:
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13, color: '#555', marginTop: 2 }}>
                    Review these rules before launching. Edit if anything looks wrong.
                  </div>
                </div>
              </div>

              <div style={{
                padding: '18px 20px', background: '#F8F7FF', border: '2px solid var(--violet)',
                borderRadius: 14, boxShadow: '3px 3px 0 var(--violet)',
                fontFamily: 'Inter', fontSize: 15, lineHeight: 1.7, color: 'var(--ink)'
              }}>
                {parsedRules.split('\n').map((line, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    {line.startsWith('-') ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--violet)', fontWeight: 800, flexShrink: 0 }}>•</span>
                        <span dangerouslySetInnerHTML={{ __html: line.slice(1).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Round summary chips */}
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {rounds.map(r => (
                  <div key={r.id} style={{
                    padding: '6px 12px', background: 'var(--sun)', border: '1.5px solid var(--ink)',
                    borderRadius: 20, fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 700
                  }}>
                    Round {r.roundNumber}: {r.quizTitle} • {r.quiz?.questions?.length || 0}Q
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
              <button
                className="btn btn-sm"
                onClick={() => setStep('build')}
                style={{ background: 'var(--paper)', color: 'var(--ink)', border: '2px solid var(--ink)' }}
              >
                ✏️ Edit Rules
              </button>
              <button
                className="btn"
                onClick={handleLaunch}
                style={{
                  background: 'var(--mint)', color: 'var(--ink)', border: '2px solid var(--ink)',
                  padding: '12px 32px', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 16,
                  boxShadow: '4px 4px 0 var(--ink)', cursor: 'pointer'
                }}
              >
                ✅ Looks Good — Launch Tournament! 🏆
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: LAUNCHING ── */}
        {step === 'launching' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 64, marginBottom: 20 }}>🚀</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 900, marginBottom: 8 }}>
              Launching Tournament…
            </div>
            <div style={{ fontFamily: 'Inter', fontSize: 15, color: '#555' }}>
              Setting up Round 1 of {rounds.length}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
