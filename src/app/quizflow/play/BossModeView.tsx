'use client'
import { BossState } from '../../types'
import { BOSS_QUESTION_MS } from '../../lib/coins'

interface BossModeViewProps {
  boss: BossState
  now: number
  meId: string
  myCorrect: number
  selected: number | null
  revealed: boolean
  revealedCorrectIndex: number | null
  frozen: boolean
  onAnswer: (idx: number) => void
}

const MEMPHIS_CHOICES = [
  { key: 'A', name: 'SATURN', color: 'var(--cherry)', icon: '▲', className: 'answer-btn-saturn' },
  { key: 'B', name: 'JUPITER', color: 'var(--sun)', icon: '◆', className: 'answer-btn-jupiter' },
  { key: 'C', name: 'URANUS', color: 'var(--mint)', icon: '●', className: 'answer-btn-uranus' },
  { key: 'D', name: 'NEPTUNE', color: 'var(--sky)', icon: '■', className: 'answer-btn-neptune' },
]

export default function BossModeView({
  boss,
  now,
  meId,
  myCorrect,
  selected,
  revealed,
  revealedCorrectIndex,
  frozen,
  onAnswer,
}: BossModeViewProps) {
  const question = boss.questions[boss.index]
  const total = boss.questions.length

  const globalElapsed = now - boss.startedAt
  const globalLeft = Math.max(0, boss.durationMs - globalElapsed)
  const globalPct = Math.max(0, Math.min(1, globalLeft / boss.durationMs))

  const qStart = boss.startedAt + boss.index * BOSS_QUESTION_MS
  const qLeft = Math.max(0, qStart + BOSS_QUESTION_MS - now)
  const qPct = Math.max(0, Math.min(1, qLeft / BOSS_QUESTION_MS))

  if (!question) return null

  const isCorrect = revealed && selected !== null && selected === revealedCorrectIndex

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      {/* BOSS HUD BAR */}
      <div style={{ background: 'var(--ink)', color: '#fff', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: 'var(--line)' }}>
        <div>
          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18, color: 'var(--sun)' }}>
            ⚔️ BOSS MODE
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>
            {boss.index + 1} / {total} RAPID QUESTIONS
          </div>
        </div>

        {/* Global 60s progress */}
        <div style={{ flex: 1, maxWidth: 380 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, marginBottom: 4 }}>
            <span style={{ opacity: 0.7 }}>⏱ GLOBAL TIMER</span>
            <span style={{ color: globalLeft <= 10 ? 'var(--cherry)' : 'var(--mint)' }}>{(globalLeft / 1000).toFixed(1)}s</span>
          </div>
          <div style={{ height: 14, background: '#2a2a2a', border: '2px solid #fff', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: globalLeft <= 10 ? 'var(--cherry)' : 'var(--mint)', width: `${globalPct * 100}%`, transition: 'width 0.25s linear' }} />
          </div>
        </div>

        <div className="card-paper-sm" style={{ padding: '6px 14px', background: 'var(--sun)', color: 'var(--ink)', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 15 }}>
          ✅ {myCorrect} CORRECT
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', width: '100%', padding: '32px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Per-question countdown */}
        <div className="card-paper-sm" style={{ padding: '8px 16px', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800 }}>QUESTION TIMER</span>
          <div style={{ flex: 1, height: 10, background: '#fff', border: '2px solid var(--ink)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: qLeft <= 2 ? 'var(--cherry)' : 'var(--sky)', width: `${qPct * 100}%`, transition: 'width 0.25s linear' }} />
          </div>
          <span style={{ fontWeight: 900, fontSize: 14 }}>{(qLeft / 1000).toFixed(1)}s</span>
        </div>

        <div className="card-paper-lg" style={{ padding: 28 }}>
          <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, color: 'var(--cherry)', letterSpacing: '0.08em', marginBottom: 8 }}>
            ⚡ BOSS QUESTION {boss.index + 1} — GO GO GO!
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 26, fontWeight: 800, lineHeight: 1.25 }}>
            {question.prompt}
          </h2>
        </div>

        <div className="answer-grid" style={{ flex: 1 }}>
          {question.choices.map((choiceText, idx) => {
            const memphis = MEMPHIS_CHOICES[idx % MEMPHIS_CHOICES.length]
            const isSelected = selected === idx
            const isCorrectChoice = revealed && idx === revealedCorrectIndex
            let outlineStyle = 'none'
            if (revealed) {
              if (isCorrectChoice) outlineStyle = '4px solid var(--mint)'
              else if (isSelected && !isCorrectChoice) outlineStyle = '4px solid var(--cherry)'
            }

            return (
              <button
                key={idx}
                className={`card-paper ${memphis.className} press`}
                onClick={() => onAnswer(idx)}
                disabled={selected !== null || revealed || frozen}
                style={{
                  padding: 20,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  outline: outlineStyle,
                  minHeight: 90,
                  opacity: frozen ? 0.6 : 1,
                }}
              >
                <div style={{ width: 40, height: 40, borderRadius: 50, background: 'var(--ink)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 14, border: '2px solid #fff' }}>
                  {memphis.key}
                </div>
                <span style={{ flex: 1, fontFamily: 'Inter', fontSize: 16, fontWeight: 800 }}>{choiceText}</span>
                <span style={{ fontSize: 18 }}>{memphis.icon}</span>
              </button>
            )
          })}
        </div>

        {revealed && (
          <div className={`card-paper-sm anim-spring`} style={{ padding: 16, textAlign: 'center', background: isCorrect ? 'var(--mint)' : 'var(--cherry)', color: isCorrect ? 'var(--ink)' : '#fff', fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 18 }}>
            {isCorrect ? '✅ CORRECT! KEEP RIDING!' : selected === null ? '⏰ TIME UP — NEXT!' : '❌ WRONG — NEXT!'}
          </div>
        )}
      </main>
    </div>
  )
}
