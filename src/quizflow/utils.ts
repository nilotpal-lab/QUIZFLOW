/* ================================================================
   QuizFlow — Scoring Engine
   Implements server-authoritative speed + streak + power-up math
   ================================================================ */

import type { ScoreResult } from './types'

const BASE_POINTS = 1000
const MIN_POINTS_RATIO = 0.5   // Even last-second correct = 500 pts

/**
 * Calculates points for a correct answer.
 * Formula: base * speedFactor * streakMultiplier * powerUpMultiplier
 *
 * @param timeRemainingMs   - Milliseconds remaining when answer was submitted
 * @param totalTimeMs       - Total allowed time for the question
 * @param isCorrect         - Whether the answer was correct
 * @param streakCount       - Number of consecutive correct answers
 * @param powerUpActive     - Whether "Double Points" power-up is active
 */
export function calculatePoints(
  timeRemainingMs: number,
  totalTimeMs: number,
  isCorrect: boolean,
  streakCount: number,
  powerUpActive: boolean = false
): ScoreResult {
  if (!isCorrect) {
    return { points: 0, speed_bonus: 0, streak_bonus: 0, power_up_multiplier: 1 }
  }

  // Speed factor: linear decay from 1.0 (instant) → 0.5 (last second)
  const ratio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs))
  const speedFactor = MIN_POINTS_RATIO + (1 - MIN_POINTS_RATIO) * ratio
  const speedBonus = Math.round(BASE_POINTS * speedFactor)

  // Streak multiplier: +10% per consecutive correct answer, capped at +50%
  const streakMultiplier = 1 + Math.min(streakCount * 0.10, 0.50)
  const streakBonus = Math.round(speedBonus * (streakMultiplier - 1))

  // Power-up: flat 2x if "Double Points" is active
  const powerUpMultiplier = powerUpActive ? 2 : 1

  const raw = (speedBonus + streakBonus) * powerUpMultiplier
  const points = Math.max(50, Math.round(raw))   // Minimum 50 pts for any correct answer

  return { points, speed_bonus: speedBonus, streak_bonus: streakBonus, power_up_multiplier: powerUpMultiplier }
}

/**
 * Formats a point value for display (e.g. 1250 → "+1,250")
 */
export function formatPoints(points: number, prefix = '+'): string {
  return `${prefix}${points.toLocaleString()}`
}

/**
 * Returns the timer color class based on remaining percentage
 */
export function getTimerColorClass(pct: number): string {
  if (pct > 0.5)  return 'text-ans-green'
  if (pct > 0.25) return 'text-ans-yellow'
  return 'text-ans-red'
}

/**
 * Generates a random 6-digit PIN code
 */
export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export type AvatarStyle = 'cartoon' | 'anime' | 'retro' | 'adventurer' | 'lorelei' | 'pixel-art' | 'fun-emoji'

export const LOCAL_AVATARS = [
  '/avatars/clay_1.png',
  '/avatars/custom_cabbage.png',
  '/avatars/custom_boy.png',
  '/avatars/clay_2.png',
  '/avatars/clay_3.png',
  '/avatars/clay_4.png',
  '/avatars/custom_winter_girl.png',
  '/avatars/anime_1.png',
  '/avatars/anime_2.png',
  '/avatars/anime_3.png',
  '/avatars/anime_4.png',
  '/avatars/custom_skeleton.png',
  '/avatars/retro_1.png',
  '/avatars/retro_2.png',
  '/avatars/retro_3.png',
  '/avatars/retro_4.png'
]

export function buildAvatarUrl(
  seed: string,
  style: AvatarStyle | string = 'cartoon',
  size = 80,
  backgroundColor = '0F0926'
): string {
  if (!seed) return LOCAL_AVATARS[0]
  if (seed.startsWith('/avatars/')) return seed
  if (seed.startsWith('clay_') || seed.startsWith('anime_') || seed.startsWith('retro_')) {
    return `/avatars/${seed}.png`
  }
  // Deterministic avatar index based on seed
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  const idx = Math.abs(hash) % LOCAL_AVATARS.length
  return LOCAL_AVATARS[idx]
}

/**
 * Generates a random avatar seed from a list of whimsical Ghibli-style names
 */
export const GHIBLI_SEEDS = [
  'Totoro', 'Kiki', 'Chihiro', 'Howl', 'Sophie', 'Nausicaa', 'Ponyo',
  'Satsuki', 'Mononoke', 'Ashitaka', 'Calcifer', 'Jiji', 'Lin', 'Haku',
  'Yubaba', 'Sheeta', 'Pazu', 'Fio', 'Porco', 'Arrietty', 'Marnie',
  'Taeko', 'Seita', 'Setsuko', 'Yasuko', 'Ursula', 'Gina', 'Futa',
  'LumiStar', 'SpiritOrb', 'StarWitch', 'MoonFox', 'SkyDragon',
  'CozyWizard', 'CatBus', 'DustSprite', 'WoodSpirit', 'CloudFairy'
]

export function randomAvatarSeed(): string {
  return GHIBLI_SEEDS[Math.floor(Math.random() * GHIBLI_SEEDS.length)] +
    Math.floor(Math.random() * 999)
}

/**
 * The 4 answer colors with element themes
 */
export const ANSWER_COLORS = [
  { key: 'red',    glyph: '▲', label: 'A', element: 'Fire',   hex: '#F87171' },
  { key: 'blue',   glyph: '◆', label: 'B', element: 'Water',  hex: '#60A5FA' },
  { key: 'yellow', glyph: '●', label: 'C', element: 'Sun',    hex: '#FBBF24' },
  { key: 'green',  glyph: '■', label: 'D', element: 'Forest', hex: '#34D399' },
] as const

export type AnswerColorKey = typeof ANSWER_COLORS[number]['key']

/**
 * Power-up definitions
 */
export const POWER_UPS = [
  { type: 'fifty_fifty',   emoji: '🧪', label: '50/50',    description: 'Removes 2 wrong answers' },
  { type: 'time_freeze',   emoji: '⏳', label: 'Freeze',   description: 'Pauses the timer for 5s' },
  { type: 'double_points', emoji: '⭐', label: '2× Star',  description: 'Doubles your points' },
] as const

/**
 * Formats milliseconds to a display string (e.g. 12500 → "12.5s")
 */
export function formatTime(ms: number): string {
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
}

/**
 * Calculates server clock offset for client-side cosmetic timer display
 * Call on game start: offset = serverStartMs - Date.now()
 * Then display: timeRemaining = (serverEndsAt - (Date.now() + offset))
 */
export function computeClockOffset(serverTimestampMs: number): number {
  return serverTimestampMs - Date.now()
}



/**
 * Sanitizes input strings to prevent HTML/XSS injection.
 */
export function sanitizeInput(text: string): string {
  if (!text) return ''
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim()
}

