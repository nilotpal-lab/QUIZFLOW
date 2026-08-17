'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSavedQuizzes, saveQuizDraft, type SavedQuizItem } from '@/quizflow/quizStore'
import { createSession } from '@/quizflow/sessionStore'
import type { AIGeneratedQuiz, AIGeneratedQuestion } from '@/quizflow/types'
import type { RoundConfig, TournamentConfig } from '@/quizflow/types'
import QuizFlowLogo from '@/quizflow/QuizFlowLogo'

type Step = 'build' | 'preview' | 'launching'
type QuizSourceMode = 'saved' | 'ai' | 'manual'

interface RoundDraft {
  id: string
  roundNumber: number
  quizTitle: string
  quiz: AIGeneratedQuiz | null
  eliminationRule: string
  sourceMode: QuizSourceMode
  // AI Quick-Gen state
  aiTopic: string
  aiCount: number
  aiDifficulty: 'easy' | 'medium' | 'hard'
  isGeneratingAI?: boolean
  // Manual Quiz state
  manualTitle: string
  manualPrompt: string
  manualChoices: [string, string, string, string]
  manualCorrectIndex: number
  manualQuestions: AIGeneratedQuestion[]
}

const EXAMPLE_RULES = [
  'Bottom 30% by score gets eliminated',
  'Anyone with less than 3 correct answers is out',
  'Only top 5 players survive',
  'Players with score below 500 are eliminated',
  'Bottom 2 players are removed each round',
]

const DEFAULT_PRESET_QUIZZES: SavedQuizItem[] = [
  {
    id: 'preset_general_knowledge',
    title: 'General Knowledge Warm-Up',
    description: '10 quick general knowledge & science trivia questions.',
    language: 'English',
    bloomLevel: 'Recall',
    questionCount: 3,
    isDraft: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    quiz: {
      title: 'General Knowledge Warm-Up',
      description: '10 quick general knowledge & science trivia questions.',
      language: 'English',
      questions: [
        {
          prompt: 'What planet is known as the Red Planet?',
          choices: ['Earth', 'Mars', 'Jupiter', 'Saturn'],
          correct_index: 1,
          difficulty: 'easy',
          explanation: 'Mars appears red due to iron oxide (rust) on its surface.',
          time_limit_ms: 20000
        },
        {
          prompt: 'What element does "O" stand for on the Periodic Table?',
          choices: ['Gold', 'Osmium', 'Oxygen', 'Oxide'],
          correct_index: 2,
          difficulty: 'easy',
          explanation: 'O is the chemical symbol for Oxygen.',
          time_limit_ms: 20000
        },
        {
          prompt: 'Which organ pumps blood throughout the human body?',
          choices: ['Brain', 'Lungs', 'Heart', 'Liver'],
          correct_index: 2,
          difficulty: 'easy',
          explanation: 'The heart pumps blood through the circulatory system.',
          time_limit_ms: 20000
        }
      ]
    }
  },
  {
    id: 'preset_world_history',
    title: 'World History Battle',
    description: 'Challenge your understanding of major world events.',
    language: 'English',
    bloomLevel: 'Analysis',
    questionCount: 2,
    isDraft: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    quiz: {
      title: 'World History Battle',
      description: 'Challenge your understanding of major world events.',
      language: 'English',
      questions: [
        {
          prompt: 'In which year did World War II end?',
          choices: ['1918', '1939', '1945', '1950'],
          correct_index: 2,
          difficulty: 'medium',
          explanation: 'World War II ended in 1945 after Axis forces surrendered.',
          time_limit_ms: 20000
        },
        {
          prompt: 'Who was the first President of the United States?',
          choices: ['Thomas Jefferson', 'George Washington', 'Abraham Lincoln', 'John Adams'],
          correct_index: 1,
          difficulty: 'easy',
          explanation: 'George Washington served as the 1st US president from 1789 to 1797.',
          time_limit_ms: 20000
        }
      ]
    }
  }
]

export default function TournamentPage() {
  const router = useRouter()
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuizItem[]>([])
  const [rounds, setRounds] = useState<RoundDraft[]>([
    {
      id: 'r1', roundNumber: 1, quizTitle: '', quiz: null, eliminationRule: 'Bottom 30% by score gets eliminated',
      sourceMode: 'saved', aiTopic: '', aiCount: 5, aiDifficulty: 'medium',
      manualTitle: 'Round 1 Quiz', manualPrompt: '', manualChoices: ['', '', '', ''], manualCorrectIndex: 0, manualQuestions: []
    },
    {
      id: 'r2', roundNumber: 2, quizTitle: '', quiz: null, eliminationRule: 'Only top 3 players survive',
      sourceMode: 'saved', aiTopic: '', aiCount: 5, aiDifficulty: 'hard',
      manualTitle: 'Round 2 Finals', manualPrompt: '', manualChoices: ['', '', '', ''], manualCorrectIndex: 0, manualQuestions: []
    },
  ])
  const [step, setStep] = useState<Step>('build')
  const [parsedRules, setParsedRules] = useState('')
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    const saved = getSavedQuizzes()
    if (saved && saved.length > 0) {
      setSavedQuizzes(saved)
    } else {
      setSavedQuizzes(DEFAULT_PRESET_QUIZZES)
    }
  }, [])

  const addRound = () => {
    const n = rounds.length + 1
    setRounds(prev => [
      ...prev,
      {
        id: `r${Date.now()}`,
        roundNumber: n,
        quizTitle: '',
        quiz: null,
        eliminationRule: EXAMPLE_RULES[n % EXAMPLE_RULES.length],
        sourceMode: 'saved',
        aiTopic: '',
        aiCount: 5,
        aiDifficulty: 'medium',
        manualTitle: `Round ${n} Quiz`,
        manualPrompt: '',
        manualChoices: ['', '', '', ''],
        manualCorrectIndex: 0,
        manualQuestions: []
      }
    ])
  }

  const removeRound = (id: string) => {
    setRounds(prev => prev.filter(r => r.id !== id).map((r, i) => ({ ...r, roundNumber: i + 1 })))
  }

  const updateRound = (id: string, patch: Partial<RoundDraft>) => {
    setRounds(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const selectQuizForRound = (id: string, quizItem: SavedQuizItem | null) => {
    if (!quizItem) {
      updateRound(id, { quiz: null, quizTitle: '' })
    } else {
      updateRound(id, { quiz: quizItem.quiz, quizTitle: quizItem.quiz.title || 'Untitled Quiz' })
    }
  }

  // ── AI Quick-Gen per Round ─────────────────────────────────────
  const generateAIQuizForRound = async (roundId: string) => {
    const targetRound = rounds.find(r => r.id === roundId)
    if (!targetRound || !targetRound.aiTopic.trim()) return

    updateRound(roundId, { isGeneratingAI: true })
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: targetRound.aiTopic,
          count: targetRound.aiCount,
          difficulty: targetRound.aiDifficulty,
          language: 'English',
          bloomLevel: 'Analysis'
        })
      })

      if (!res.ok) throw new Error('AI Generation failed')
      const quizData: AIGeneratedQuiz = await res.json()
      
      const title = quizData.title || `Round ${targetRound.roundNumber}: ${targetRound.aiTopic}`
      const fullQuiz = { ...quizData, title }

      // Also save to localStorage quizStore
      saveQuizDraft(fullQuiz, false)
      setSavedQuizzes(getSavedQuizzes())

      updateRound(roundId, {
        quiz: fullQuiz,
        quizTitle: title,
        isGeneratingAI: false
      })
    } catch (e) {
      console.error('[Generate AI for Round Error]', e)
      alert('Failed to generate AI quiz. Please check internet connection or try a different topic.')
      updateRound(roundId, { isGeneratingAI: false })
    }
  }

  // ── Manual Quiz Builder per Round ──────────────────────────────
  const addManualQuestion = (roundId: string) => {
    const round = rounds.find(r => r.id === roundId)
    if (!round) return
    if (!round.manualPrompt.trim() || round.manualChoices.some(c => !c.trim())) {
      alert('Please fill in the question prompt and all 4 choices.')
      return
    }

    const newQ: AIGeneratedQuestion = {
      prompt: round.manualPrompt,
      choices: [...round.manualChoices],
      correct_index: round.manualCorrectIndex,
      difficulty: 'medium',
      time_limit_ms: 20000,
      explanation: `Correct choice is ${round.manualChoices[round.manualCorrectIndex]}`
    }

    const updatedQuestions = [...round.manualQuestions, newQ]
    const title = round.manualTitle || `Round ${round.roundNumber} Custom Quiz`
    const generatedQuiz: AIGeneratedQuiz = {
      title,
      description: 'Custom created round quiz',
      language: 'English',
      questions: updatedQuestions
    }

    updateRound(roundId, {
      manualQuestions: updatedQuestions,
      manualPrompt: '',
      manualChoices: ['', '', '', ''],
      manualCorrectIndex: 0,
      quiz: generatedQuiz,
      quizTitle: title
    })
  }

  const canPreview = rounds.every(r => r.quiz && r.quiz.questions?.length > 0 && r.eliminationRule.trim().length > 0)

  const handlePreview = async () => {
    if (!canPreview) return
    setParsing(true)
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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800 }}>
            <QuizFlowLogo size={22} alt="QuizFlow" /> QuizFlow
          </span>
          <span className="badge badge-cherry">🏆 TOURNAMENT BUILDER</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/quizflow/host/new"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>← Back</button></Link>
        </div>
      </div>

      <div style={{ maxWidth: 900, width: '100%', margin: '0 auto', padding: '32px 20px', flex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div className="badge badge-sun" style={{ marginBottom: 10, fontSize: 12 }}>🏆 MULTI-ROUND ELIMINATION</div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
            Multi-Round Quiz Tournament
          </h1>
          <p style={{ color: '#555', fontSize: 15, fontFamily: 'Inter', maxWidth: 580, margin: '0 auto' }}>
            Configure quizzes for each round (Select Existing, Generate with AI, or Build Custom) and set custom elimination rules.
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: 36 }}>
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
                {s === 'build' ? 'Build Rounds' : s === 'preview' ? 'AI Rule Review' : 'Launch'}
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
                const isSelected = !!round.quiz
                return (
                  <div key={round.id} className="card" style={{ padding: '24px 22px', marginBottom: 20, border: '2.5px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)' }}>
                    {/* Round Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 38, height: 38, borderRadius: '50%', background: 'var(--sun)',
                          border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, flexShrink: 0
                        }}>
                          {round.roundNumber}
                        </div>
                        <div>
                          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 900, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            Round {round.roundNumber}
                            {idx === rounds.length - 1 && <span className="badge badge-mint" style={{ fontSize: 10 }}>FINAL ROUND</span>}
                          </h3>
                          {isSelected ? (
                            <div style={{ fontSize: 12, color: 'var(--mint)', fontFamily: 'Space Grotesk', fontWeight: 800, marginTop: 2 }}>
                              ✅ Attached: {round.quizTitle} ({round.quiz?.questions?.length} Questions)
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: 'var(--cherry)', fontFamily: 'Space Grotesk', fontWeight: 700, marginTop: 2 }}>
                              ⚠️ No quiz attached to this round yet
                            </div>
                          )}
                        </div>
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

                    {/* SOURCE MODE TABS */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                        🛠️ Select Quiz Creation Method for Round {round.roundNumber}:
                      </label>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => updateRound(round.id, { sourceMode: 'saved' })}
                          style={{
                            padding: '8px 14px', borderRadius: 8, border: '2px solid var(--ink)',
                            fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                            background: round.sourceMode === 'saved' ? 'var(--sun)' : 'var(--paper-2)',
                            boxShadow: round.sourceMode === 'saved' ? '2px 2px 0 var(--ink)' : 'none',
                            color: 'var(--ink)'
                          }}
                        >
                          📂 Choose Saved / Preset
                        </button>

                        <button
                          onClick={() => updateRound(round.id, { sourceMode: 'ai' })}
                          style={{
                            padding: '8px 14px', borderRadius: 8, border: '2px solid var(--ink)',
                            fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                            background: round.sourceMode === 'ai' ? 'var(--violet)' : 'var(--paper-2)',
                            color: round.sourceMode === 'ai' ? 'var(--paper)' : 'var(--ink)',
                            boxShadow: round.sourceMode === 'ai' ? '2px 2px 0 var(--ink)' : 'none'
                          }}
                        >
                          ✨ Generate with AI
                        </button>

                        <button
                          onClick={() => updateRound(round.id, { sourceMode: 'manual' })}
                          style={{
                            padding: '8px 14px', borderRadius: 8, border: '2px solid var(--ink)',
                            fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                            background: round.sourceMode === 'manual' ? 'var(--mint)' : 'var(--paper-2)',
                            boxShadow: round.sourceMode === 'manual' ? '2px 2px 0 var(--ink)' : 'none',
                            color: 'var(--ink)'
                          }}
                        >
                          ✍️ Build Custom Questions
                        </button>
                      </div>
                    </div>

                    {/* ── MODE 1: CHOOSE SAVED ── */}
                    {round.sourceMode === 'saved' && (
                      <div style={{ background: 'var(--paper)', padding: 16, border: '1.5px solid var(--ink)', borderRadius: 12, marginBottom: 16 }}>
                        <select
                          value={savedQuizzes.find(sq => sq.quiz === round.quiz)?.id || ''}
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
                          <option value="">— Select a saved or preset quiz —</option>
                          {savedQuizzes.map(q => (
                            <option key={q.id} value={q.id}>
                              {q.quiz.title || 'Untitled'} ({q.quiz.questions?.length || 0} questions)
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* ── MODE 2: AI QUICK-GEN ── */}
                    {round.sourceMode === 'ai' && (
                      <div style={{ background: '#F8F7FF', padding: 18, border: '2px solid var(--violet)', borderRadius: 12, marginBottom: 16, boxShadow: '3px 3px 0 var(--violet)' }}>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: 'var(--violet)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>✨ AI Quiz Generator for Round {round.roundNumber}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', gap: 10, marginBottom: 12 }}>
                          <div>
                            <label style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                              Topic / Subject
                            </label>
                            <input
                              type="text"
                              value={round.aiTopic}
                              onChange={e => updateRound(round.id, { aiTopic: e.target.value })}
                              placeholder="e.g. World War 2, Organic Chemistry, Calculus"
                              style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--ink)', borderRadius: 8, fontFamily: 'Inter', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                            />
                          </div>

                          <div>
                            <label style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                              Questions
                            </label>
                            <select
                              value={round.aiCount}
                              onChange={e => updateRound(round.id, { aiCount: parseInt(e.target.value) })}
                              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--ink)', borderRadius: 8, fontFamily: 'Inter', fontSize: 13, background: 'white' }}
                            >
                              <option value={3}>3 Questions</option>
                              <option value={5}>5 Questions</option>
                              <option value={8}>8 Questions</option>
                              <option value={10}>10 Questions</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 4 }}>
                              Difficulty
                            </label>
                            <select
                              value={round.aiDifficulty}
                              onChange={e => updateRound(round.id, { aiDifficulty: e.target.value as any })}
                              style={{ width: '100%', padding: '8px 10px', border: '1.5px solid var(--ink)', borderRadius: 8, fontFamily: 'Inter', fontSize: 13, background: 'white' }}
                            >
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                        </div>

                        <button
                          onClick={() => generateAIQuizForRound(round.id)}
                          disabled={!round.aiTopic.trim() || round.isGeneratingAI}
                          style={{
                            padding: '10px 20px', background: round.aiTopic.trim() ? 'var(--violet)' : 'var(--paper-2)',
                            color: round.aiTopic.trim() ? 'var(--paper)' : '#888',
                            border: '2px solid var(--ink)', borderRadius: 8, fontFamily: 'Space Grotesk',
                            fontWeight: 800, fontSize: 13, cursor: round.aiTopic.trim() ? 'pointer' : 'not-allowed',
                            boxShadow: round.aiTopic.trim() ? '2px 2px 0 var(--ink)' : 'none'
                          }}
                        >
                          {round.isGeneratingAI ? '⚡ Generating AI Quiz...' : '⚡ Generate Quiz for Round ' + round.roundNumber}
                        </button>
                      </div>
                    )}

                    {/* ── MODE 3: CUSTOM BUILDER ── */}
                    {round.sourceMode === 'manual' && (
                      <div style={{ background: '#E6FFFA', padding: 18, border: '2px solid var(--mint)', borderRadius: 12, marginBottom: 16, boxShadow: '3px 3px 0 var(--mint)' }}>
                        <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>
                          ✍️ Build Custom Questions ({round.manualQuestions.length} added)
                        </div>

                        {/* List of created questions */}
                        {round.manualQuestions.length > 0 && (
                          <div style={{ marginBottom: 14 }}>
                            {round.manualQuestions.map((q, qIdx) => (
                              <div key={qIdx} style={{ padding: '8px 12px', background: 'white', border: '1.5px solid var(--ink)', borderRadius: 8, marginBottom: 6, fontSize: 13, fontFamily: 'Inter' }}>
                                <strong>Q{qIdx + 1}:</strong> {q.prompt} <span style={{ color: 'var(--mint)', fontWeight: 700 }}>(Ans: {q.choices[q.correct_index]})</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ marginBottom: 10 }}>
                          <input
                            type="text"
                            placeholder="Enter Question Prompt..."
                            value={round.manualPrompt}
                            onChange={e => updateRound(round.id, { manualPrompt: e.target.value })}
                            style={{ width: '100%', padding: '8px 12px', border: '1.5px solid var(--ink)', borderRadius: 8, fontFamily: 'Inter', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
                          />

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                            {round.manualChoices.map((choice, cIdx) => (
                              <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'white', padding: '4px 8px', border: '1.5px solid var(--ink)', borderRadius: 6 }}>
                                <input
                                  type="radio"
                                  name={`correct_${round.id}`}
                                  checked={round.manualCorrectIndex === cIdx}
                                  onChange={() => updateRound(round.id, { manualCorrectIndex: cIdx })}
                                />
                                <input
                                  type="text"
                                  placeholder={`Option ${['A','B','C','D'][cIdx]}`}
                                  value={choice}
                                  onChange={e => {
                                    const newChoices = [...round.manualChoices] as [string, string, string, string]
                                    newChoices[cIdx] = e.target.value
                                    updateRound(round.id, { manualChoices: newChoices })
                                  }}
                                  style={{ border: 'none', outline: 'none', width: '100%', fontFamily: 'Inter', fontSize: 12 }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => addManualQuestion(round.id)}
                          style={{
                            padding: '8px 16px', background: 'var(--mint)', color: 'var(--ink)',
                            border: '2px solid var(--ink)', borderRadius: 8, fontFamily: 'Space Grotesk',
                            fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: '2px 2px 0 var(--ink)'
                          }}
                        >
                          + Add Question to Round {round.roundNumber}
                        </button>
                      </div>
                    )}

                    {/* Elimination rule */}
                    <div>
                      <label style={{ fontFamily: 'Space Grotesk', fontSize: 12, fontWeight: 700, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                        ⚔️ Elimination Rule <span style={{ opacity: 0.5, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(in plain English)</span>
                      </label>
                      <textarea
                        value={round.eliminationRule}
                        onChange={e => updateRound(round.id, { eliminationRule: e.target.value })}
                        placeholder={EXAMPLE_RULES[idx % EXAMPLE_RULES.length]}
                        rows={2}
                        style={{
                          width: '100%', padding: '10px 12px', border: '2px solid var(--ink)', borderRadius: 10,
                          fontFamily: 'Inter', fontSize: 14, resize: 'none', background: 'var(--paper)',
                          outline: 'none', boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {EXAMPLE_RULES.slice(0, 4).map(ex => (
                          <button
                            key={ex}
                            onClick={() => updateRound(round.id, { eliminationRule: ex })}
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

            {/* Sticky Floating Bottom Action Bar */}
            <div style={{
              position: 'sticky', bottom: 20, zIndex: 90, marginTop: 32,
              background: 'var(--paper)', border: '3px solid var(--ink)', borderRadius: 16,
              boxShadow: '6px 6px 0 var(--ink)', padding: '16px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap'
            }}>
              <div>
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>
                  Tournament Setup: {rounds.length} Rounds Configured
                </div>
                <div style={{ fontFamily: 'Inter', fontSize: 12, color: canPreview ? 'var(--mint)' : '#777', fontWeight: 600 }}>
                  {canPreview ? '✅ All rounds have quizzes & rules attached' : '⚠️ Please attach a quiz & rule to all rounds to continue'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Link href="/quizflow/host/new">
                  <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '2px solid var(--ink)', padding: '10px 18px' }}>Cancel</button>
                </Link>
                <button
                  className="btn"
                  onClick={handlePreview}
                  disabled={!canPreview || parsing}
                  style={{
                    background: canPreview ? 'linear-gradient(135deg, #a78bfa 0%, #7C4DFF 100%)' : 'var(--paper-2)',
                    color: canPreview ? 'white' : '#aaa',
                    border: '2.5px solid var(--ink)', padding: '12px 28px', fontFamily: 'Space Grotesk',
                    fontWeight: 900, fontSize: 15, cursor: canPreview ? 'pointer' : 'not-allowed',
                    boxShadow: canPreview ? '4px 4px 0 var(--ink)' : 'none'
                  }}
                >
                  {parsing ? '🤖 AI Parsing Rules…' : '🤖 Review Rules & Preview Tournament →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: AI PREVIEW ── */}
        {step === 'preview' && (
          <div>
            <div className="card anim-scale-in" style={{ padding: '28px 24px', border: '3px solid var(--ink)', boxShadow: '6px 6px 0 var(--ink)', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ fontSize: 40 }}>🤖</div>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 900, color: 'var(--ink)' }}>
                    AI Tournament Rule Engine
                  </div>
                  <div style={{ fontFamily: 'Inter', fontSize: 13.5, color: '#555', marginTop: 2 }}>
                    Review the simplified elimination rules generated for your tournament rounds before starting.
                  </div>
                </div>
              </div>

              <div style={{
                padding: '20px 22px', background: '#F8F7FF', border: '2.5px solid var(--violet)',
                borderRadius: 14, boxShadow: '4px 4px 0 var(--violet)',
                fontFamily: 'Inter', fontSize: 15, lineHeight: 1.7, color: 'var(--ink)'
              }}>
                {parsedRules.split('\n').map((line, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    {line.startsWith('-') ? (
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ color: 'var(--violet)', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>•</span>
                        <span dangerouslySetInnerHTML={{ __html: line.slice(1).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                      </div>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Round summary chips */}
              <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {rounds.map(r => (
                  <div key={r.id} style={{
                    padding: '8px 14px', background: 'var(--sun)', border: '2px solid var(--ink)',
                    borderRadius: 20, fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800,
                    boxShadow: '2px 2px 0 var(--ink)'
                  }}>
                    Round {r.roundNumber}: {r.quizTitle} • {r.quiz?.questions?.length || 0} Questions
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky Floating Launch Bar */}
            <div style={{
              position: 'sticky', bottom: 20, zIndex: 90,
              background: 'var(--paper)', border: '3px solid var(--ink)', borderRadius: 16,
              boxShadow: '6px 6px 0 var(--ink)', padding: '16px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16
            }}>
              <button
                className="btn btn-sm"
                onClick={() => setStep('build')}
                style={{ background: 'var(--paper-2)', color: 'var(--ink)', border: '2px solid var(--ink)', padding: '10px 18px', fontWeight: 800 }}
              >
                ✏️ Edit Round Rules
              </button>
              <button
                className="btn"
                onClick={handleLaunch}
                style={{
                  background: 'var(--mint)', color: 'var(--ink)', border: '3px solid var(--ink)',
                  padding: '14px 36px', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 17,
                  boxShadow: '4px 4px 0 var(--ink)', cursor: 'pointer'
                }}
              >
                ✅ Looks Good — Launch Tournament Now! 🏆
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
