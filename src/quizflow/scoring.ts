/* ================================================================
   QuizFlow — Scoring Constants (single source of truth)
   Live-play game engine (team-login event flow).

   RULE: route handlers must import these constants — never inline
   magic numbers. Flag this file for balance review before launch;
   the numbers are proposed defaults, not final balance.
   ================================================================ */

import type { Difficulty } from './types'

/** Points awarded for a correct answer, by question difficulty. */
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 100,
  medium: 200,
  hard: 300,
}

/** Coins awarded for a correct answer, by question difficulty. */
export const DIFFICULTY_COINS: Record<Difficulty, number> = {
  easy: 5,
  medium: 10,
  hard: 20,
}

/** Default time limit per question (30 seconds). */
export const DEFAULT_QUESTION_TIME_LIMIT_MS = 30000

/** Answers under this server-computed elapsed time count as "fast". */
export const FAST_ANSWER_THRESHOLD_MS = 5000

/** Points bonus multiplier for fast answers — hard questions only. */
export const FAST_ANSWER_BONUS_MULTIPLIER = 1.5

/** Streak scaling: +10% points per consecutive correct answer. */
export const STREAK_MULTIPLIER_PER_STEP = 0.1

/** Streak scaling cap: at most +50% from streaks. */
export const STREAK_MULTIPLIER_CAP = 0.5

/** Points lost for a wrong answer in boss_raid / boss mode (floor 0). */
export const BOSS_DAMAGE_WRONG_POINTS = 5

/** Sub-this server-computed elapsed time → flagged suspicious-bot (0 pts). */
export const MIN_RESPONSE_MS = 100

/** Coin costs for the power-up shop (server-enforced). */
export const POWERUP_COSTS = {
  freeze_player: 15,
  freeze_all: 30,
  bid_2x: 20,
  bid_3x: 35,
  bid_4x: 50,
  coin_boost_2x: 15,
  coin_boost_3x: 25,
} as const

export type PowerUpItem = keyof typeof POWERUP_COSTS

/** Freeze durations per item type (ms). */
export const FREEZE_DURATION_MS: Record<'freeze_player' | 'freeze_all', number> = {
  freeze_player: 6000,
  freeze_all: 4000,
}

/** Boss finale tuning (server-timed, never client-timed). */
export const BOSS_MODE = {
  question_count: 10,
  duration_seconds: 60,
  per_question_cap_ms: 8000,      // advance the shared question if this elapses
  advance_when_pct_answered: 0.6, // ...or once ≥60% of registered teams answered
  points_per_correct: 200,        // frenzy points per correct answer (existing behavior, now named)
}

/** Rank bonus awarded at boss window close (index = rank - 1). */
export const BOSS_RANK_BONUS = [500, 300, 200, 100]

/**
 * Compute the points for a correct answer in a NORMAL round.
 * Continuous fair speed bonus (up to +50% base points) + streak + point multiplier.
 * Returns 0 for anything that shouldn't score.
 */
export function computePoints(
  difficulty: Difficulty,
  elapsedMs: number,
  streak: number,
  bidMultiplier: number,
  timeLimitMs = DEFAULT_QUESTION_TIME_LIMIT_MS,
  suspiciousBot = false
): number {
  if (suspiciousBot || (elapsedMs > 0 && elapsedMs < MIN_RESPONSE_MS)) return 0

  const base = DIFFICULTY_POINTS[difficulty] ?? DIFFICULTY_POINTS.medium
  const timeLimit = Math.max(5000, timeLimitMs)
  const remaining = Math.max(0, timeLimit - elapsedMs)
  const speedRatio = Math.min(1, Math.max(0, remaining / timeLimit))
  
  // Fair continuous speed bonus: up to +50% of base points for fast answers
  const speedBonus = Math.round(base * 0.5 * speedRatio)

  const streakMultiplier = 1 + Math.min(streak * STREAK_MULTIPLIER_PER_STEP, STREAK_MULTIPLIER_CAP)
  const multiplier = Math.max(1, bidMultiplier)
  return Math.round((base + speedBonus) * streakMultiplier * multiplier)
}

/** Coins earned for a correct answer (difficulty-scaled, correct-only). */
export function coinReward(difficulty: Difficulty): number {
  return DIFFICULTY_COINS[difficulty] ?? DIFFICULTY_COINS.medium
}

/**
 * The tunables snapshot stored on `games.config` at game creation.
 * The DB scoring functions read their numbers from here — this is the
 * single source of truth they are seeded from, so tuning the game
 * means editing this file (and re-creating games), never SQL.
 */
export function buildGameConfig() {
  return {
    difficulty_points: DIFFICULTY_POINTS,
    difficulty_coins: DIFFICULTY_COINS,
    fast_threshold_ms: FAST_ANSWER_THRESHOLD_MS,
    fast_multiplier: FAST_ANSWER_BONUS_MULTIPLIER,
    streak_step: STREAK_MULTIPLIER_PER_STEP,
    streak_cap: STREAK_MULTIPLIER_CAP,
    boss_wrong_points: BOSS_DAMAGE_WRONG_POINTS,
    min_response_ms: MIN_RESPONSE_MS,
    powerup_costs: POWERUP_COSTS,
    freeze_duration_ms: FREEZE_DURATION_MS,
    boss_mode: BOSS_MODE,
    rank_bonus: BOSS_RANK_BONUS,
  }
}
