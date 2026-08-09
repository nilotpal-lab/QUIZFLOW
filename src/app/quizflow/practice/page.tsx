'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { speakText, stopSpeech } from '@/quizflow/speech'
import { playClickSound, playCorrectChime, playLevelUpFanfare } from '@/quizflow/sound'

interface PracticeCard {
  bloom: string
  prompt: string
  answer: string
  explain: string
  misconception: string
  color: string
}

const DEFAULT_PRACTICE_DECK: PracticeCard[] = [
  {
    bloom: 'Recall',
    prompt: 'What is the powerhouse organelle of the eukaryotic cell?',
    answer: 'Mitochondria',
    explain: 'Mitochondria generate ATP through cellular respiration, supplying cellular energy.',
    misconception: 'Common confusion: The nucleus controls genetics, while mitochondria produce ATP.',
    color: '#FF5252'
  },
  {
    bloom: 'Comprehension',
    prompt: 'Why does solid ice float on liquid water?',
    answer: 'Hydrogen bonding creates an open hexagonal lattice',
    explain: 'Water molecules expand upon freezing due to stable hydrogen bonds, lowering its density.',
    misconception: 'Ice is not made of lighter molecules — it expands to become less dense.',
    color: '#40C4FF'
  },
  {
    bloom: 'Application',
    prompt: 'If a React component re-renders 60x/sec during state updates, which hook memoizes expensive computations?',
    answer: 'useMemo',
    explain: 'useMemo caches computed values across renders until its dependency array changes.',
    misconception: 'useEffect is for side effects, not synchronous calculation caching.',
    color: '#7C4DFF'
  },
  {
    bloom: 'Analysis',
    prompt: 'A database query experiences an N+1 performance bottleneck. What is the primary architectural cause?',
    answer: 'Executing separate child queries inside a parent loop',
    explain: 'N+1 occurs when fetching related records individually rather than batching with JOINs.',
    misconception: 'Indexes speed up execution, but cannot eliminate unnecessary roundtrips.',
    color: '#FFE57F'
  }
]

export default function PracticeHubPage() {
  const router = useRouter()
  const [deck] = useState<PracticeCard[]>(DEFAULT_PRACTICE_DECK)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [mastery, setMastery] = useState(75)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // Keyboard navigation & spacebar to flip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        playClickSound()
        setIsFlipped(prev => !prev)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [deck.length])

  const handleNext = () => {
    playClickSound()
    setIsFlipped(false)
    stopSpeech()
    setTimeout(() => {
      setCurrentIndex(prev => (prev + 1) % deck.length)
    }, 150)
  }

  const handlePrev = () => {
    playClickSound()
    setIsFlipped(false)
    stopSpeech()
    setCurrentIndex(prev => (prev - 1 + deck.length) % deck.length)
  }

  const handleGrade = (rating: 'again' | 'hard' | 'good' | 'easy', label: string) => {
    if (rating === 'good' || rating === 'easy') {
      playCorrectChime()
      setMastery(prev => Math.min(100, prev + 5))
    } else {
      playClickSound()
    }
    showToast(`🎴 FSRS Scheduled: ${label}`)
    handleNext()
  }

  const handleListen = () => {
    playClickSound()
    const card = deck[currentIndex]
    speakText(isFlipped ? `${card.answer}. ${card.explain}` : card.prompt)
    showToast('🔊 Reading card aloud...')
  }

  const currentCard = deck[currentIndex]

  return (
    <div className="min-h-screen bg-[var(--paper)] selection:bg-[#FFE57F] flex flex-col">
      {/* Top Bar */}
      <nav className="sticky top-0 z-40 bg-[var(--paper)] border-b-[3px] border-[var(--ink)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 h-[64px] flex items-center justify-between">
          <div className="font-display font-[800] text-[24px] tracking-tight flex items-center gap-1 cursor-pointer" onClick={() => router.push('/quizflow')}>
            <span>⚡</span> QuizFlow
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/quizflow')} className="hard bg-white rounded-full px-3.5 py-1.5 text-[12px] font-display font-bold">
              🏠 Home
            </button>
            <button onClick={() => router.push('/quizflow/host/new')} className="hard bg-[var(--violet)] text-white rounded-full px-3.5 py-1.5 text-[12px] font-display font-bold">
              🎮 Live Arena
            </button>
          </div>
        </div>
      </nav>

      {/* Main Practice Deck */}
      <main className="max-w-[720px] w-full mx-auto px-4 md:px-6 py-8 flex-1 flex flex-col justify-center">
        {/* Header with Progress */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display font-[800] text-[28px] md:text-[36px]">
            Practice Hub
          </h1>
          <div className="font-display text-[11px] font-[700] hard bg-white rounded-full px-3 py-1">
            Card {currentIndex + 1} of {deck.length} Reviewed · {mastery}% Mastery
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-[12px] rounded-full border-[3px] border-[var(--ink)] bg-[var(--ink)] overflow-hidden relative mb-6">
          <div
            className="h-full bg-[var(--mint)] transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / deck.length) * 100}%` }}
          />
        </div>

        {/* 3D Flip Card */}
        <div className="persp w-full">
          <div
            onClick={() => {
              playClickSound()
              setIsFlipped(prev => !prev)
            }}
            className="relative w-full max-w-[600px] mx-auto h-[380px] preserve transition-transform duration-[600ms] cursor-pointer"
            style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            {/* FRONT OF CARD */}
            <div
              className="absolute inset-0 backface hard bg-[var(--paper-2)] rounded-[var(--radius-card)] p-6 flex flex-col justify-between"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-display text-[12px] font-[800] tracking-wide text-white px-2.5 py-1 rounded-[8px] border-[2px] border-[var(--ink)]"
                  style={{ background: currentCard.color }}
                >
                  {currentCard.bloom} Level
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation()
                    handleListen()
                  }}
                  className="hard bg-[var(--sky)] rounded-full px-3 py-1 font-display text-[11px] font-[800]"
                >
                  🔊 Listen
                </button>
              </div>

              <div className="flex-1 flex items-center justify-center my-4">
                <p className="text-[20px] md:text-[22px] font-[500] leading-[1.3] text-center">
                  {currentCard.prompt}
                </p>
              </div>

              <div className="text-[12px] opacity-50 text-center font-display">
                Tap card or press Spacebar to flip
              </div>
            </div>

            {/* BACK OF CARD */}
            <div
              className="absolute inset-0 backface hard bg-[#E8F5E9] rounded-[var(--radius-card)] p-6 flex flex-col justify-between border-[3px] border-[#00C853]"
              style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#00C853] text-white flex items-center justify-center font-bold">
                    ✓
                  </span>
                  <span className="font-display font-[800] text-[20px] md:text-[22px] text-[#00701A]">
                    {currentCard.answer}
                  </span>
                </div>
                <p className="mt-4 text-[14px] leading-[1.5]">
                  {currentCard.explain}
                </p>
              </div>

              <div className="mt-4 flex gap-2 text-[12px] italic bg-white border-[2px] border-[var(--ink)] rounded-[10px] p-2.5">
                <span className="w-2 h-2 rounded-full bg-[var(--cherry)] mt-1.5 shrink-0" />
                <span>{currentCard.misconception}</span>
              </div>
            </div>
          </div>
        </div>

        {/* FSRS Grading Buttons */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 max-w-[600px] mx-auto w-full">
          {[
            { l: '🔴 Again', d: 'Reset', bg: 'var(--cherry)', r: 'again' as const },
            { l: '🟡 Hard', d: '+1 day', bg: 'var(--sun)', r: 'hard' as const },
            { l: '🟢 Good', d: '+3 days', bg: 'var(--mint)', r: 'good' as const },
            { l: '🔵 Easy', d: '+7 days', bg: 'var(--sky)', r: 'easy' as const }
          ].map(btn => (
            <button
              key={btn.l}
              onClick={() => handleGrade(btn.r, btn.d)}
              className="h-[56px] hard btn-press rounded-[12px] font-display font-[800] text-[13px] flex flex-col items-center justify-center"
              style={{ background: btn.bg }}
            >
              <span>{btn.l}</span>
              <span className="text-[10px] font-[600] opacity-70">{btn.d}</span>
            </button>
          ))}
        </div>

        {/* Prev / Next Navigation */}
        <div className="mt-5 flex items-center justify-between max-w-[600px] mx-auto w-full">
          <button
            onClick={handlePrev}
            className="hard bg-white rounded-[12px] px-4 py-2 font-display font-[800] text-[13px]"
          >
            ‹ Prev
          </button>
          <div className="font-display text-[12px] opacity-60">
            Space to flip · {currentIndex + 1} / {deck.length}
          </div>
          <button
            onClick={handleNext}
            className="hard bg-[var(--ink)] text-white rounded-[12px] px-4 py-2 font-display font-[800] text-[13px]"
          >
            Next ›
          </button>
        </div>
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 hard bg-[var(--ink)] text-white rounded-[14px] px-5 py-3 font-display font-[700] text-[13px] shadow-[6px_6px_0px_#10100F] animate-[float_0.3s_ease] max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t-[3px] border-[var(--ink)] bg-[var(--paper-2)] py-3 text-center font-display text-[11px] tracking-wide opacity-60">
        ⚡ QuizFlow Practice Deck · FSRS Spaced-Repetition Algorithm · Space Grotesk + Inter
      </footer>
    </div>
  )
}
