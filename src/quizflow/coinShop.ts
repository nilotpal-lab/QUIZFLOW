/* ================================================================
   QuizFlow — Coin Shop Definitions
   Prices derive from src/quizflow/scoring.ts (POWERUP_COSTS) — the
   single source of truth. The server enforces these exact costs in
   qf_buy_powerup (games.config snapshot), so the UI can never drift
   from the server.
   ================================================================ */

import type { CoinShopItem, CoinPowerUpType } from './types'
import { POWERUP_COSTS } from './scoring'

export const SHOP_ITEMS: CoinShopItem[] = [
  {
    type: 'freeze_player',
    label: 'Freeze Player',
    emoji: '🧊',
    description: 'Freeze a specific team for 6 seconds — they cannot answer.',
    cost: POWERUP_COSTS.freeze_player,
    requiresTarget: true
  },
  {
    type: 'freeze_all',
    label: 'Blizzard',
    emoji: '❄️',
    description: 'Freeze ALL other teams for 4 seconds.',
    cost: POWERUP_COSTS.freeze_all,
    requiresTarget: false
  },
  {
    type: 'bid_2x',
    label: '2× Multiplier',
    emoji: '⚡',
    description: 'Double your points on the next question.',
    cost: POWERUP_COSTS.bid_2x,
    requiresTarget: false
  },
  {
    type: 'bid_3x',
    label: '3× Multiplier',
    emoji: '🔥',
    description: 'Triple your points on the next question.',
    cost: POWERUP_COSTS.bid_3x,
    requiresTarget: false
  },
  {
    type: 'bid_4x',
    label: '4× Multiplier',
    emoji: '💥',
    description: 'Quadruple your points on the next question.',
    cost: POWERUP_COSTS.bid_4x,
    requiresTarget: false
  }
]

export const COIN_COSTS: Record<CoinPowerUpType, number> = Object.fromEntries(
  SHOP_ITEMS.map(item => [item.type, item.cost])
) as Record<CoinPowerUpType, number>
