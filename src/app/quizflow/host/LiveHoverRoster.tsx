'use client'
import type { Participant } from '../../types'

export interface HoverState {
  playerId: string
  answerKey: 'A' | 'B' | 'C' | 'D'
  isLocked: boolean
}

interface LiveHoverRosterProps {
  players: Participant[]
  hovers?: Record<string, HoverState>
}

const CHOICE_COLORS: Record<string, string> = {
  A: 'var(--cherry)',
  B: 'var(--sun)',
  C: 'var(--mint)',
  D: 'var(--sky)'
}

export default function LiveHoverRoster({ players, hovers = {} }: LiveHoverRosterProps) {
  const lockedCount = Object.values(hovers).filter(h => h.isLocked).length
  const hoveringCount = Object.values(hovers).filter(h => !h.isLocked).length
  const thinkingCount = Math.max(0, players.length - Object.keys(hovers).length)

  return (
    <div className="card-paper" style={{ padding: 18, background: '#FFFFFF' }}>
      {/* Roster Header Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800 }}>
            LIVE ROSTER HOVER
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.6 }}>
            {lockedCount} locked • {hoveringCount} hovering • {thinkingCount} thinking
          </div>
        </div>
        <span className="card-paper-sm" style={{ padding: '2px 8px', fontSize: 10, fontWeight: 800, background: 'var(--sky)' }}>
          HOST SUPERPOWER
        </span>
      </div>

      {/* Roster Row Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
        {players.map((p, idx) => {
          const hState = hovers[p.id]
          const isLocked = hState?.isLocked
          const answerKey = hState?.answerKey
          const color = answerKey ? CHOICE_COLORS[answerKey] : 'transparent'

          return (
            <div
              key={p.id || idx}
              className="card-paper-sm"
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: hState ? 'var(--paper)' : '#FFFFFF',
                borderColor: isLocked ? 'var(--ink)' : answerKey ? color : 'var(--ink)',
                borderWidth: isLocked ? 3 : 2
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 50,
                  border: `2.5px solid ${answerKey ? color : 'var(--ink)'}`,
                  background: '#FFFFFF',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 16,
                  position: 'relative'
                }}
              >
                🦊
                {answerKey && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      width: 16,
                      height: 16,
                      borderRadius: 50,
                      background: isLocked ? 'var(--ink)' : color,
                      color: isLocked ? '#fff' : '#000',
                      fontSize: 9,
                      fontWeight: 900,
                      display: 'grid',
                      placeItems: 'center'
                    }}
                  >
                    {isLocked ? '✓' : answerKey}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'Inter', fontSize: 12, fontWeight: 800, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {p.nickname}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: answerKey ? color : 'var(--ink-2)', opacity: 0.8 }}>
                    {isLocked ? `Locked ${answerKey}` : answerKey ? `Hovering ${answerKey}...` : 'Thinking...'}
                  </div>
                  <span className="card-paper-sm" style={{ padding: '0px 5px', fontSize: 9, fontWeight: 800, background: 'var(--sun)' }}>
                    🪙 {p.coins ?? 0}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
