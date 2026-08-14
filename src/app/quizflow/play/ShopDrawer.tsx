'use client'
import { useState } from 'react'
import { getShopItems, ShopItemId } from '../../lib/coins'
import type { SessionPlayer } from '../../lib/sessionEngine'

interface ShopDrawerProps {
  open: boolean
  coins: number
  players: SessionPlayer[]
  meId: string
  bidActive: number | null
  frozenUntil: number | null
  onClose: () => void
  onBuy: (itemId: ShopItemId, targetId?: string) => void
}

export default function ShopDrawer({
  open,
  coins,
  players,
  meId,
  bidActive,
  frozenUntil,
  onClose,
  onBuy,
}: ShopDrawerProps) {
  const [pickingTarget, setPickingTarget] = useState(false)
  const [notice, setNotice] = useState('')

  if (!open) return null

  const items = getShopItems()
  const rivals = players.filter(p => p.id !== meId)

  const handleItem = (itemId: ShopItemId) => {
    if (itemId === 'freeze_player') {
      setPickingTarget(true)
      return
    }
    onBuy(itemId)
  }

  const handleTarget = (targetId: string) => {
    setPickingTarget(false)
    onBuy('freeze_player', targetId)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', justifyContent: 'flex-end' }}>
      {/* Backdrop */}
      <div
        onClick={() => { setPickingTarget(false); onClose() }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(16, 16, 15, 0.6)' }}
      />

      {/* Drawer Panel */}
      <div
        className="card-paper-lg anim-spring"
        style={{
          position: 'relative',
          zIndex: 10,
          width: 'min(420px, 92vw)',
          height: '100%',
          background: 'var(--paper)',
          borderRadius: '24px 0 0 24px',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900 }}>
            🛒 COIN SHOP
          </h3>
          <button className="btn-stadium" style={{ padding: '6px 14px', fontSize: 12, background: 'var(--paper-2)', color: 'var(--ink)' }} onClick={() => { setPickingTarget(false); onClose() }}>
            ✕ CLOSE
          </button>
        </div>

        <div className="card-paper-sm" style={{ padding: '10px 16px', background: 'var(--sun)', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>🪙</span>
          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 20 }}>{coins.toLocaleString()}</span>
          <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>COINS AVAILABLE</span>
        </div>

        {notice && (
          <div className="card-paper-sm" style={{ padding: '8px 12px', background: 'var(--mint)', marginBottom: 12, fontSize: 12, fontWeight: 800 }}>
            {notice}
          </div>
        )}

        {pickingTarget ? (
          <div>
            <div style={{ fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, marginBottom: 12 }}>
              🎯 CHOOSE A PLAYER TO FREEZE (5s)
            </div>
            {rivals.length === 0 ? (
              <div className="card-paper-sm" style={{ padding: 16, textAlign: 'center', fontSize: 13, fontWeight: 700, opacity: 0.6 }}>
                No rivals in the room yet!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rivals.map(p => (
                  <button
                    key={p.id}
                    className="card-paper-sm"
                    style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', cursor: 'pointer', fontSize: 14, fontWeight: 800 }}
                    onClick={() => handleTarget(p.id)}
                  >
                    <span>🧊 {p.nickname}</span>
                    <span className="card-paper-sm" style={{ padding: '2px 8px', fontSize: 10, background: 'var(--paper-2)' }}>
                      {p.score.toLocaleString()} pts
                    </span>
                  </button>
                ))}
              </div>
            )}
            <button className="btn-stadium" style={{ marginTop: 16, width: '100%', padding: 12, background: 'var(--paper-2)', color: 'var(--ink)' }} onClick={() => setPickingTarget(false)}>
              ← BACK TO SHOP
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map(item => {
              const isBid = !!item.bidMultiplier
              const isBidActive = isBid && bidActive === item.bidMultiplier
              const isFrozen = item.id === 'freeze_self' && !!frozenUntil && frozenUntil > Date.now()
              const affordable = coins >= item.cost

              return (
                <div key={item.id} className="card-paper" style={{ padding: 14, background: '#FFFFFF', opacity: isBidActive ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="card-paper-sm" style={{ width: 46, height: 46, display: 'grid', placeItems: 'center', fontSize: 22, background: isBid ? 'var(--sky)' : 'var(--paper-2)' }}>
                      {item.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 15 }}>
                        {item.label}
                        {isBidActive && <span className="card-paper-sm" style={{ marginLeft: 8, padding: '1px 6px', fontSize: 9, background: 'var(--mint)' }}>ACTIVE</span>}
                        {isFrozen && <span className="card-paper-sm" style={{ marginLeft: 8, padding: '1px 6px', fontSize: 9, background: 'var(--cherry)', color: '#fff' }}>FROZEN NOW</span>}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.7, lineHeight: 1.35 }}>{item.description}</div>
                    </div>
                    <button
                      className="btn-stadium"
                      style={{ padding: '8px 14px', fontSize: 12, background: affordable ? 'var(--ink)' : 'var(--paper-2)', color: affordable ? '#fff' : 'var(--ink)', whiteSpace: 'nowrap' }}
                      onClick={() => {
                        if (!affordable) {
                          setNotice('❌ Not enough coins! Answer more questions to earn 🪙.')
                          return
                        }
                        setNotice('')
                        handleItem(item.id)
                      }}
                    >
                      🪙 {item.cost}
                    </button>
                  </div>
                </div>
              )
            })}

            <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.55, marginTop: 4, lineHeight: 1.5 }}>
              💡 Coins are earned by answering (more for HARD questions, double for answers under 5s). Coins are separate from points — they don't affect the leaderboard, only power-ups.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
