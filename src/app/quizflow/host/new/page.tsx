'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createSession } from '@/quizflow/sessionStore'
import { getSavedQuizzes, type SavedQuizItem } from '@/quizflow/quizStore'
import type { AIGeneratedQuiz } from '@/quizflow/types'
import { useRouter } from 'next/navigation'

const DEFAULT_PRESETS: AIGeneratedQuiz[] = [
  {
    title: '🔬 Science — Photosynthesis',
    description: 'Plants, sunlight and cellular biology',
    language: 'English',
    bloomLevel: 'Recall',
    questions: [
      { prompt: 'What is the process by which plants convert sunlight into food?', choices: ['Cellular Respiration', 'Photosynthesis', 'Fermentation', 'Transpiration'], correct_index: 1, difficulty: 'easy', explanation: 'Photosynthesis occurs in chloroplasts using chlorophyll.', time_limit_ms: 20000 },
      { prompt: 'Which organelle hosts photosynthesis in plant cells?', choices: ['Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome'], correct_index: 2, difficulty: 'medium', explanation: 'Chloroplasts contain chlorophyll to absorb light.', time_limit_ms: 15000 },
      { prompt: 'What are the main outputs of photosynthesis?', choices: ['CO₂ & Water', 'Glucose & Oxygen', 'Nitrogen & ATP', 'Lactic Acid & CO₂'], correct_index: 1, difficulty: 'easy', explanation: '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂', time_limit_ms: 20000 },
      { prompt: 'Which pigment gives plants their green colour?', choices: ['Carotene', 'Xanthophyll', 'Chlorophyll', 'Anthocyanin'], correct_index: 2, difficulty: 'medium', explanation: 'Chlorophyll absorbs red and blue light, reflecting green.', time_limit_ms: 20000 },
      { prompt: 'Where does the light-dependent reaction of photosynthesis occur?', choices: ['Stroma', 'Thylakoid membrane', 'Cell wall', 'Cytoplasm'], correct_index: 1, difficulty: 'hard', explanation: 'The thylakoid membrane houses the photosystems.', time_limit_ms: 25000 },
    ],
  },
  {
    title: '🌍 Geography — World Capitals',
    description: 'Test your knowledge of world capitals',
    language: 'English',
    bloomLevel: 'Recall',
    questions: [
      { prompt: 'What is the capital of Australia?', choices: ['Sydney', 'Melbourne', 'Canberra', 'Brisbane'], correct_index: 2, difficulty: 'medium', explanation: 'Canberra became the capital in 1927, not Sydney.', time_limit_ms: 20000 },
      { prompt: 'Which city is the capital of Brazil?', choices: ['Rio de Janeiro', 'São Paulo', 'Salvador', 'Brasília'], correct_index: 3, difficulty: 'medium', explanation: 'Brasília replaced Rio de Janeiro as capital in 1960.', time_limit_ms: 20000 },
      { prompt: 'What is the capital of Canada?', choices: ['Toronto', 'Vancouver', 'Ottawa', 'Montréal'], correct_index: 2, difficulty: 'easy', explanation: 'Ottawa has been Canada\'s capital since 1857.', time_limit_ms: 15000 },
      { prompt: 'Which is the capital of Japan?', choices: ['Osaka', 'Kyoto', 'Hiroshima', 'Tokyo'], correct_index: 3, difficulty: 'easy', explanation: 'Tokyo (formerly Edo) became the capital in 1869.', time_limit_ms: 15000 },
      { prompt: 'What is the capital of South Africa?', choices: ['Cape Town', 'Johannesburg', 'Pretoria', 'Durban'], correct_index: 2, difficulty: 'hard', explanation: 'Pretoria is the executive capital; Cape Town is the legislative capital.', time_limit_ms: 25000 },
    ],
  },
  {
    title: '⚽ Sports — Football Legends',
    description: 'The beautiful game — facts & legends',
    language: 'English',
    bloomLevel: 'Recall',
    questions: [
      { prompt: 'How many players are on a football (soccer) team on the pitch?', choices: ['9', '10', '11', '12'], correct_index: 2, difficulty: 'easy', explanation: 'Each team has 11 players including the goalkeeper.', time_limit_ms: 15000 },
      { prompt: 'Which country has won the most FIFA World Cups?', choices: ['Germany', 'Brazil', 'Argentina', 'France'], correct_index: 1, difficulty: 'easy', explanation: 'Brazil has won 5 World Cups (1958, 62, 70, 94, 2002).', time_limit_ms: 20000 },
      { prompt: 'In which year was the first FIFA World Cup held?', choices: ['1926', '1930', '1934', '1938'], correct_index: 1, difficulty: 'medium', explanation: 'Uruguay hosted and won the first World Cup in 1930.', time_limit_ms: 20000 },
      { prompt: 'Which player is known as "The Egyptian King"?', choices: ['Sadio Mané', 'Mohamed Salah', 'Naby Keïta', 'Riyad Mahrez'], correct_index: 1, difficulty: 'easy', explanation: 'Mohamed Salah plays for Liverpool and the Egyptian national team.', time_limit_ms: 15000 },
      { prompt: 'What is the maximum duration of a standard football match?', choices: ['80 minutes', '90 minutes', '100 minutes', '120 minutes'], correct_index: 1, difficulty: 'easy', explanation: '90 minutes (two 45-minute halves), extra time is separate.', time_limit_ms: 15000 },
    ],
  },
]

export default function HostNewPage() {
  const router = useRouter()
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuizItem[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState<AIGeneratedQuiz | null>(DEFAULT_PRESETS[0])
  const [selectedKey, setSelectedKey] = useState<string>('preset_0')
  const [gameMode, setGameModeState] = useState<'classic' | 'boss_raid'>('classic')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const saved = getSavedQuizzes()
    setSavedQuizzes(saved)
  }, [])

  const launchQuiz = (quiz: AIGeneratedQuiz) => {
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
            Pick Your Quiz
          </h1>
          <p style={{ color: '#555', fontSize: 15, fontFamily: 'Inter' }}>
            Choose a preset quiz, pick from your saved teacher drafts, or create a brand new one with AI.
          </p>
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

        {/* SECTION 2: FEATURED PRESET QUIZZES */}
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>
            🌟 Featured Preset Quizzes
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {DEFAULT_PRESETS.map((quiz, idx) => {
              const isSelected = selectedKey === `preset_${idx}`
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedQuiz(quiz)
                    setSelectedKey(`preset_${idx}`)
                  }}
                  style={{
                    textAlign: 'left', padding: 22,
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
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 17, fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>
                      {quiz.title}
                    </div>
                    <div style={{ color: '#555', fontSize: 13, fontFamily: 'Inter', marginBottom: 14 }}>
                      {quiz.description}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1.5px solid var(--ink)', paddingTop: 12 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span className="badge badge-ink" style={{ fontSize: 10 }}>{quiz.questions.length} Questions</span>
                      <span className="badge badge-sky" style={{ fontSize: 10 }}>{quiz.language}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        launchQuiz(quiz)
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

            {/* AI Studio card */}
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
                <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: 'var(--violet)' }}>Create with AI</div>
                <div style={{ color: '#666', fontSize: 12, textAlign: 'center', fontFamily: 'Inter' }}>Generate on any custom topic in seconds</div>
              </div>
            </Link>
          </div>
        </div>

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

