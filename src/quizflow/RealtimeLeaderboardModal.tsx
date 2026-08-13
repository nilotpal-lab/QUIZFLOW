'use client'
import React from 'react'
import type { Player } from '@/quizflow/sessionStore'
import { getTacticsRankings, getMasteryRankings } from '@/quizflow/sessionStore'
import { buildAvatarUrl } from '@/quizflow/utils'

interface RealtimeLeaderboardModalProps {
  isOpen: boolean
  onClose: () => void
  players: Player[]
  activeBoard: 'tactics' | 'mastery'
  setActiveBoard: (board: 'tactics' | 'mastery') => void
  isAliasMode: boolean
  toggleAliasMode: () => void
  pin: string
  quizTitle?: string
}

const ANONYMOUS_ALIASES = [
  '🕵️ Agent Falcon', '🥷 Stealth Ninja', '🦊 Clever Fox', '🚀 Cosmic Rover',
  '🦁 Brave Lion', '🦉 Wise Owl', '⚡ Turbo Cheetah', '🐬 Swift Dolphin',
  '🐼 Gentle Panda', '🐯 Mighty Tiger', '🦅 Sharp Eagle', '🐻 Bear Cub',
  '🦄 Magic Pony', '🐲 Dragon Flame', '🐺 Lone Wolf', '🦈 Star Shark'
]

function getDisplayName(player: { id: string; nickname: string }, index: number, isAliasMode: boolean) {
  if (!isAliasMode) return player.nickname
  const charSum = player.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ANONYMOUS_ALIASES[(charSum + index) % ANONYMOUS_ALIASES.length]
}

export function RealtimeLeaderboardModal({
  isOpen,
  onClose,
  players,
  activeBoard,
  setActiveBoard,
  isAliasMode,
  toggleAliasMode,
  pin,
  quizTitle = 'Live Quiz Competition'
}: RealtimeLeaderboardModalProps) {
  if (!isOpen) return null

  const rankedPlayers = activeBoard === 'mastery'
    ? getMasteryRankings(players)
    : getTacticsRankings(players)

  const top3 = [
    rankedPlayers[0] || null, // 1st
    rankedPlayers[1] || null, // 2nd
    rankedPlayers[2] || null, // 3rd
  ]

  const top4To20 = rankedPlayers.slice(3, 20)

  return (
    <div className="fixed inset-0 z-[100] bg-[#10100F]/90 backdrop-blur-md p-4 md:p-8 overflow-y-auto flex flex-col items-center justify-start text-[#10100F] select-none">
      
      {/* Top Action Header */}
      <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-white/20 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFE57F] text-[#10100F] border-2 border-white grid place-items-center text-xl font-black shadow-[3px_3px_0px_#000]">
            🏆
          </div>
          <div>
            <h2 className="font-display font-black text-xl md:text-2xl text-white tracking-tight">
              Real-Time Leaderboard
            </h2>
            <p className="text-xs text-white/70 font-semibold font-body">
              PIN: <span className="text-[#FFE57F] font-bold">{pin}</span> • {quizTitle} ({players.length} Players)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Dual Board Switcher */}
          <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/20">
            <button
              onClick={() => setActiveBoard('tactics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all ${
                activeBoard === 'tactics'
                  ? 'bg-[#FFE57F] text-[#10100F] border border-black shadow-[2px_2px_0px_#000]'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              ⚡ Score Board
            </button>
            <button
              onClick={() => setActiveBoard('mastery')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all ${
                activeBoard === 'mastery'
                  ? 'bg-[#00E676] text-[#10100F] border border-black shadow-[2px_2px_0px_#000]'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              🎯 Accuracy Board
            </button>
          </div>

          {/* Alias Mode */}
          <button
            onClick={toggleAliasMode}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-display border-2 border-white/30 transition ${
              isAliasMode ? 'bg-[#9C27B0] text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isAliasMode ? '🕵️ Alias: ON' : '🕵️ Alias: OFF'}
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white text-[#10100F] border-2 border-black font-black text-lg flex items-center justify-center hover:bg-[#FF5252] hover:text-white transition shadow-[3px_3px_0px_#000] cursor-pointer"
            title="Close Leaderboard View"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Leaderboard Content Box */}
      <div className="w-full max-w-5xl bg-[#FFFCF5] border-[4px] border-[#10100F] rounded-[24px] p-6 md:p-8 shadow-[8px_8px_0px_#10100F] flex flex-col gap-8">
        
        {/* ========================================================= */}
        {/* PODIUM SECTION (TOP 3 PLAYERS)                           */}
        {/* ========================================================= */}
        <div className="w-full">
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1 rounded-full bg-[#FFE57F] border-2 border-[#10100F] text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#10100F]">
              🥇 TOP 3 PODIUM CHAMPIONS 🥇
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-6 items-end justify-center min-h-[220px]">
            
            {/* 🥈 2ND PLACE (SILVER - LEFT) */}
            <div className="flex flex-col items-center">
              {top3[1] ? (
                <div className="w-full bg-[#F5F5F5] border-[3px] border-[#10100F] rounded-[18px] p-4 text-center shadow-[4px_4px_0px_#10100F] flex flex-col items-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-[3px] border-[#10100F] overflow-hidden bg-white mb-2 shadow-[2px_2px_0px_#10100F]">
                    <img
                      src={buildAvatarUrl(top3[1].avatarSeed, top3[1].avatarStyle as any, 64)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="inline-block px-2 py-0.5 rounded-md bg-[#E0E0E0] border border-[#10100F] text-[11px] font-black mb-1">
                    🥈 2ND PLACE
                  </div>
                  <div className="font-display font-black text-sm md:text-base text-[#10100F] truncate max-w-full">
                    {getDisplayName(top3[1], 1, isAliasMode)}
                  </div>
                  <div className="text-xs font-black text-[#00838F] font-display mt-1">
                    {activeBoard === 'mastery'
                      ? `${top3[1].totalAnswered ? Math.round(((top3[1].totalCorrect || 0) / top3[1].totalAnswered) * 100) : 0}% Acc`
                      : `${top3[1].score.toLocaleString()} pts`}
                  </div>
                </div>
              ) : (
                <div className="w-full bg-black/5 border-2 border-dashed border-black/20 rounded-[18px] p-6 text-center text-xs font-bold text-black/40">
                  🥈 2nd Place Empty
                </div>
              )}
            </div>

            {/* 🥇 1ST PLACE (GOLD - CENTER - ELEVATED) */}
            <div className="flex flex-col items-center -translate-y-4">
              {top3[0] ? (
                <div className="w-full bg-[#FFE57F] border-[4px] border-[#10100F] rounded-[20px] p-5 text-center shadow-[6px_6px_0px_#10100F] flex flex-col items-center relative">
                  <div className="absolute -top-5 text-2xl animate-bounce">👑</div>
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-[3px] border-[#10100F] overflow-hidden bg-white mb-2 shadow-[3px_3px_0px_#10100F]">
                    <img
                      src={buildAvatarUrl(top3[0].avatarSeed, top3[0].avatarStyle as any, 80)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="inline-block px-2.5 py-0.5 rounded-md bg-[#FFD54F] border border-[#10100F] text-xs font-black mb-1">
                    🥇 1ST CHAMPION
                  </div>
                  <div className="font-display font-black text-base md:text-lg text-[#10100F] truncate max-w-full">
                    {getDisplayName(top3[0], 0, isAliasMode)}
                  </div>
                  <div className="text-sm font-black text-[#10100F] font-display mt-1 bg-white/80 px-3 py-0.5 rounded-full border border-black">
                    {activeBoard === 'mastery'
                      ? `${top3[0].totalAnswered ? Math.round(((top3[0].totalCorrect || 0) / top3[0].totalAnswered) * 100) : 0}% Acc`
                      : `${top3[0].score.toLocaleString()} pts`}
                  </div>
                </div>
              ) : (
                <div className="w-full bg-black/5 border-2 border-dashed border-black/20 rounded-[20px] p-8 text-center text-xs font-bold text-black/40">
                  🥇 1st Place Empty
                </div>
              )}
            </div>

            {/* 🥉 3RD PLACE (BRONZE - RIGHT) */}
            <div className="flex flex-col items-center">
              {top3[2] ? (
                <div className="w-full bg-[#FFE0B2] border-[3px] border-[#10100F] rounded-[18px] p-4 text-center shadow-[4px_4px_0px_#10100F] flex flex-col items-center">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-[3px] border-[#10100F] overflow-hidden bg-white mb-2 shadow-[2px_2px_0px_#10100F]">
                    <img
                      src={buildAvatarUrl(top3[2].avatarSeed, top3[2].avatarStyle as any, 64)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="inline-block px-2 py-0.5 rounded-md bg-[#FFCC80] border border-[#10100F] text-[11px] font-black mb-1">
                    🥉 3RD PLACE
                  </div>
                  <div className="font-display font-black text-sm md:text-base text-[#10100F] truncate max-w-full">
                    {getDisplayName(top3[2], 2, isAliasMode)}
                  </div>
                  <div className="text-xs font-black text-[#E65100] font-display mt-1">
                    {activeBoard === 'mastery'
                      ? `${top3[2].totalAnswered ? Math.round(((top3[2].totalCorrect || 0) / top3[2].totalAnswered) * 100) : 0}% Acc`
                      : `${top3[2].score.toLocaleString()} pts`}
                  </div>
                </div>
              ) : (
                <div className="w-full bg-black/5 border-2 border-dashed border-black/20 rounded-[18px] p-6 text-center text-xs font-bold text-black/40">
                  🥉 3rd Place Empty
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ========================================================= */}
        {/* TOP 4 TO 20 LINE-WISE LIST SECTION                       */}
        {/* ========================================================= */}
        <div className="w-full border-t-2 border-black/10 pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-display font-black text-sm text-[#10100F] uppercase tracking-wider">
              📊 Ranks #4 to #20 ({rankedPlayers.length} Total Players)
            </span>
            <span className="text-xs font-bold text-black/50">
              Live Real-Time Leaderboard
            </span>
          </div>

          {top4To20.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {top4To20.map((player, idx) => {
                const rankNum = idx + 4
                const pAcc = player.totalAnswered ? Math.round(((player.totalCorrect || 0) / player.totalAnswered) * 100) : 0
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between bg-white border-[2px] border-[#10100F] rounded-[14px] p-3 shadow-[2px_2px_0px_#10100F]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[#F0F0F0] border border-[#10100F] font-display font-black text-xs grid place-items-center shrink-0">
                        #{rankNum}
                      </div>
                      <div className="w-9 h-9 rounded-full border border-[#10100F] overflow-hidden bg-white shrink-0">
                        <img
                          src={buildAvatarUrl(player.avatarSeed, player.avatarStyle as any, 36)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold text-xs md:text-sm text-[#10100F] truncate">
                          {getDisplayName(player, rankNum - 1, isAliasMode)}
                        </div>
                        {player.streak > 1 && (
                          <div className="text-[10px] font-black text-[#FF6D00]">
                            🔥 {player.streak} Streak
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-display font-black text-xs md:text-sm text-[#10100F]">
                        {activeBoard === 'mastery'
                          ? `${pAcc}% Acc`
                          : `${player.score.toLocaleString()} pts`}
                      </div>
                      <div className="text-[10px] font-bold text-black/50">
                        {player.totalCorrect || 0} Correct
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="p-8 text-center bg-black/5 border-2 border-dashed border-black/15 rounded-[16px] text-xs font-bold text-black/50">
              No additional players yet (Ranks #4–#20 will appear here when more join).
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
