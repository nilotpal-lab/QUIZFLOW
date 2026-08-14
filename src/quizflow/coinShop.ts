/* ================================================================
   QuizFlow — Coin Shop Definitions
   ================================================================ */

import type { CoinShopItem, CoinPowerUpType } from './types'

export const SHOP_ITEMS: CoinShopItem[] = [
  {
    type: 'freeze_player',
    label: 'Freeze Player',
    emoji: '🧊',
    description: 'Freeze a specific player for 6 seconds — they cannot answer.',
    cost: 15,
    requiresTarget: true
  },
  {
    type: 'freeze_all',
    label: 'Blizzard',
    emoji: '❄️',
    description: 'Freeze ALL other players for 4 seconds.',
    cost: 25,
    requiresTarget: false
  },
  {
    type: 'bid_2x',
    label: '2× Multiplier',
    emoji: '⚡',
    description: 'Double your points on the next question.',
    cost: 10,
    requiresTarget: false
  },
  {
    type: 'bid_3x',
    label: '3× Multiplier',
    emoji: '🔥',
    description: 'Triple your points on the next question.',
    cost: 20,
    requiresTarget: false
  },
  {
    type: 'bid_4x',
    label: '4× Multiplier',
    emoji: '💥',
    description: 'Quadruple your points on the next question.',
    cost: 35,
    requiresTarget: false
  }
]

export const COIN_COSTS: Record<CoinPowerUpType, number> = Object.fromEntries(
  SHOP_ITEMS.map(item => [item.type, item.cost])
) as Record<CoinPowerUpType, number>
