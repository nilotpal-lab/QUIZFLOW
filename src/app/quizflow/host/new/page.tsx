'use client'
import { useState } from 'react'
import { createSession } from '@/quizflow/sessionStore'
import type { AIGeneratedQuiz } from '@/quizflow/types'
import { useRouter } from 'next/navigation'

const PRESET_QUIZZES: AIGeneratedQuiz[] = [
  {
    title: '🔬 Science — Photosynthesis',
    description: 'Plants, sunlight and cellular biology',
    language: 'English',
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
  const [selectedQuizIdx, setSelectedQuizIdx] = useState<number | null>(null)
  const [gameMode, setGameModeState] = useState<'classic' | 'boss_raid'>('classic')
  const [creating, setCreating] = useState(false)
  const [hostName] = useState('Teacher')

  const handleStart = () => {
    if (selectedQuizIdx === null) return
    setCreating(true)
    const quiz = PRESET_QUIZZES[selectedQuizIdx]
    const state = createSession(quiz, 'host-' + Date.now(), gameMode)
    setTimeout(() => {
      router.push(`/quizflow/host?pin=${state.pin}`)
    }, 400)
  }

  return (
    <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <div className="top-bar">
        <span style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800 }}>⚡ QuizFlow</span>
        <a href="/"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>← Back</button></a>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: 'center' }}>
          <div className="badge badge-ink" style={{ marginBottom: 12, fontSize: 12 }}>📡 HOST A GAME</div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 36, fontWeight: 900, marginBottom: 8 }}>
            Pick Your Quiz
          </h1>
          <p style={{ color: '#666', fontSize: 15 }}>Select a quiz below, or create a custom one with AI</p>
        </div>

        {/* Quiz cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 32 }}>
          {PRESET_QUIZZES.map((quiz, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedQuizIdx(idx)}
              style={{
                textAlign: 'left', padding: 24,
                border: `2px solid var(--ink)`,
                borderRadius: 16,
                background: selectedQuizIdx === idx ? 'var(--sun)' : 'var(--paper)',
                boxShadow: selectedQuizIdx === idx ? '5px 5px 0 var(--ink)' : '4px 4px 0 var(--ink)',
                transform: selectedQuizIdx === idx ? 'translate(-2px,-2px)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, marginBottom: 6, color: 'var(--ink)' }}>{quiz.title}</div>
              <div style={{ color: '#666', fontSize: 13, fontFamily: 'Inter', marginBottom: 14 }}>{quiz.description}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-ink">{quiz.questions.length} Questions</span>
                <span className="badge badge-sky">{quiz.language}</span>
              </div>
            </button>
          ))}

          {/* AI Studio card */}
          <a href="/studio" style={{ textDecoration: 'none' }}>
            <div style={{
              height: '100%', minHeight: 150, padding: 24,
              border: '2px dashed var(--ink)',
              borderRadius: 16,
              background: 'var(--paper-2)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, cursor: 'pointer',
              boxShadow: '4px 4px 0 var(--ink)',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translate(-2px,-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '6px 6px 0 var(--ink)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '4px 4px 0 var(--ink)'; }}
            >
              <div style={{ fontSize: 36 }}>✨</div>
              <div style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 800, color: 'var(--violet)' }}>Create with AI</div>
              <div style={{ color: '#888', fontSize: 12, textAlign: 'center', fontFamily: 'Inter' }}>Generate on any topic in seconds</div>
            </div>
          </a>
        </div>

        {/* Game Mode Selector */}
        <div className="card" style={{ padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', opacity: 0.7 }}>
            SELECT GAME MODE
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => setGameModeState('classic')}
              className={`btn ${gameMode === 'classic' ? 'btn-sun' : ''}`}
              style={{ padding: '10px 20px', background: gameMode === 'classic' ? undefined : 'var(--paper-2)', color: 'var(--ink)' }}
            >
              🎯 Classic Mode
            </button>
            <button
              onClick={() => setGameModeState('boss_raid')}
              className={`btn ${gameMode === 'boss_raid' ? 'btn-cherry' : ''}`}
              style={{ padding: '10px 20px', background: gameMode === 'boss_raid' ? undefined : 'var(--paper-2)', color: 'var(--ink)' }}
            >
              🐉 Boss Raid Mode (Co-Op)
            </button>
          </div>
        </div>

        {/* Start button */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStart}
            disabled={selectedQuizIdx === null || creating}
            style={{ minWidth: 300, fontSize: 18 }}
          >
            {creating ? '🚀 Creating Room...' : selectedQuizIdx !== null
              ? `🎮 Start (${gameMode === 'boss_raid' ? '🐉 Boss Raid' : '🎯 Classic'})` 
              : '← Select a Quiz First'}
          </button>
        </div>
      </div>
    </div>
  )
}
