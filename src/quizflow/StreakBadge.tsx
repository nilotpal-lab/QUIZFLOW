'use client'

import { useEffect, useState } from 'react'

interface StreakBadgeProps {
  streak: number
  lastPointsEarned: number
  lastAnswerCorrect: boolean | null
  responseMs?: number
  totalCorrect?: number
  totalAnswered?: number
}

interface BadgeToast {
  id: string
  emoji: string
  label: string
  color: string
  size: 'big' | 'normal'
}

export default function StreakBadge({
  streak,
  lastPointsEarned,
  lastAnswerCorrect,
  responseMs,
  totalCorrect,
  totalAnswered,
}: StreakBadgeProps) {
  const [badges, setBadges] = useState<BadgeToast[]>([])
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (lastAnswerCorrect !== true) return

    const newBadges: BadgeToast[] = []

    // Streak badges — only one streak badge, escalating
    if (streak >= 7) {
      newBadges.push({
        id: `${Date.now()}-${Math.random()}`,
        emoji: '👑',
        label: 'GOD MODE',
        color: '#fbbf24',
        size: 'big',
      })
    } else if (streak >= 5) {
      newBadges.push({
        id: `${Date.now()}-${Math.random()}`,
        emoji: '⚡',
        label: 'Unstoppable!',
        color: '#a78bfa',
        size: 'big',
      })
    } else if (streak >= 3) {
      newBadges.push({
        id: `${Date.now()}-${Math.random()}`,
        emoji: '🔥🔥',
        label: 'On Fire!',
        color: '#f97316',
        size: 'normal',
      })
    } else if (streak >= 2) {
      newBadges.push({
        id: `${Date.now()}-${Math.random()}`,
        emoji: '🔥',
        label: 'Double!',
        color: '#fbbf24',
        size: 'normal',
      })
    }

    // Speed badge
    if (responseMs !== undefined && responseMs < 1500) {
      newBadges.push({
        id: `${Date.now()}-${Math.random()}`,
        emoji: '⚡',
        label: 'Speed Demon!',
        color: '#60a5fa',
        size: 'normal',
      })
    }

    // Perfect score badge
    if (
      totalAnswered !== undefined &&
      totalCorrect !== undefined &&
      totalAnswered >= 3 &&
      totalCorrect === totalAnswered
    ) {
      newBadges.push({
        id: `${Date.now()}-${Math.random()}`,
        emoji: '💎',
        label: 'Perfect!',
        color: '#34d399',
        size: 'normal',
      })
    }

    if (newBadges.length === 0) return

    setBadges((prev) => [...prev, ...newBadges])

    // Auto-remove each badge after 2500ms
    newBadges.forEach((badge) => {
      setTimeout(() => {
        setRemovingIds((prev) => new Set(prev).add(badge.id))
        setTimeout(() => {
          setBadges((prev) => prev.filter((b) => b.id !== badge.id))
          setRemovingIds((prev) => {
            const next = new Set(prev)
            next.delete(badge.id)
            return next
          })
        }, 300) // allow fade-out transition before removal
      }, 2500)
    })
  }, [streak, lastAnswerCorrect, lastPointsEarned, responseMs])

  if (badges.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes badgeSlideIn {
          from {
            transform: translateX(120px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      <div
        style={{
          position: 'fixed',
          top: 80,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 200,
          pointerEvents: 'none',
        }}
      >
        {badges.map((badge) => {
          const isRemoving = removingIds.has(badge.id)
          return (
            <div
              key={badge.id}
              style={{
                background: badge.color,
                border: '2px solid #10100F',
                borderRadius: 14,
                boxShadow: '3px 3px 0 #10100F',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 800,
                fontSize: badge.size === 'big' ? 18 : 14,
                color: '#10100F',
                animation: isRemoving ? undefined : 'badgeSlideIn 0.3s ease forwards',
                transition: 'opacity 0.3s ease, transform 0.3s ease',
                opacity: isRemoving ? 0 : 1,
                transform: isRemoving ? 'translateX(120px)' : 'translateX(0)',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{badge.emoji}</span>
              <span>{badge.label}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}
