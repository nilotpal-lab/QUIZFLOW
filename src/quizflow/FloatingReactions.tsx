'use client'
import { useEffect, useState } from 'react'
import type { Reaction } from './sessionStore'

// Feature Flag: Set to true to re-enable emoji reaction bar & floating emojis
export const ENABLE_EMOJI_REACTIONS = false

export function FloatingReactions({ reactions }: { reactions?: Reaction[] }) {
  const [activeItems, setActiveItems] = useState<Array<{ id: string; emoji: string; left: number }>>([])

  useEffect(() => {
    if (!ENABLE_EMOJI_REACTIONS || !reactions || reactions.length === 0) {
      setActiveItems([])
      return
    }
    const now = Date.now()
    // Take reactions created in the last 4 seconds
    const recent = reactions.filter(r => now - r.createdAt < 4000)

    setActiveItems(recent.map(r => {
      let hash = 0
      for (let i = 0; i < r.id.length; i++) hash = (hash << 5) - hash + r.id.charCodeAt(i)
      const left = (Math.abs(hash) % 70) + 15 // 15% to 85% width
      return { id: r.id, emoji: r.emoji, left }
    }))
  }, [reactions])

  if (activeItems.length === 0) return null

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      {activeItems.map(item => (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            bottom: '120px',
            left: `${item.left}%`,
            fontSize: '44px',
            animation: 'float-up-emoji 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
            filter: 'drop-shadow(3px 3px 0 var(--ink))',
            userSelect: 'none',
          }}
        >
          {item.emoji}
        </div>
      ))}
      <style>{`
        @keyframes float-up-emoji {
          0% {
            transform: translateY(0) scale(0.4);
            opacity: 0;
          }
          15% {
            transform: translateY(-40px) scale(1.3) rotate(-10deg);
            opacity: 1;
          }
          60% {
            transform: translateY(-180px) scale(1.1) rotate(10deg);
            opacity: 0.9;
          }
          100% {
            transform: translateY(-320px) scale(0.8) rotate(-15deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
