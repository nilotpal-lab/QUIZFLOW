/* ================================================================
   QuizFlow — Comprehensive Standings & Leaderboard CSV Exporter
   Includes full metrics: Rank, Team Name, Code, Roster, Points,
   Coins, Streaks, Accuracy, Timing, Violations, with UTF-8 BOM
   for full Microsoft Excel and Google Sheets compatibility.
   ================================================================ */

export interface ExportTeamRecord {
  rank?: number
  name?: string | null
  code?: string | null
  roster?: string[] | string | null
  points?: number
  coins?: number
  streak?: number
  max_streak?: number
  total_correct?: number
  total_answered?: number
  total_response_time_ms?: number
  violation_count?: number
  frenzy_correct_count?: number
  has_answered?: boolean
}

export function exportLeaderboardToCSV(data: ExportTeamRecord[], filename = 'quizflow_standings.csv') {
  if (!data || data.length === 0) return false

  const headers = [
    'Rank',
    'Team Name',
    'Team Code',
    'Roster Members',
    'Total Points',
    'Coins',
    'Current Streak',
    'Max Streak',
    'Correct Answers',
    'Total Answered',
    'Accuracy %',
    'Avg Response Time (s)',
    'Violation Flags'
  ]

  const rows = data.map((t, idx) => {
    const rank = t.rank || idx + 1
    const name = (t.name || 'Team').replace(/"/g, '""')
    const code = (t.code || '').replace(/"/g, '""')
    
    let rosterStr = ''
    if (Array.isArray(t.roster)) {
      rosterStr = t.roster.join('; ').replace(/"/g, '""')
    } else if (typeof t.roster === 'string') {
      rosterStr = t.roster.replace(/"/g, '""')
    }

    const points = t.points || 0
    const coins = t.coins || 0
    const streak = t.streak || 0
    const maxStreak = t.max_streak || streak
    const correct = t.total_correct || 0
    const answered = t.total_answered || 0
    const accuracy = answered > 0 ? `${Math.round((correct / answered) * 100)}%` : '0%'
    
    const avgResponseTime = answered > 0 && t.total_response_time_ms
      ? (t.total_response_time_ms / answered / 1000).toFixed(2)
      : '0.00'

    const violations = t.violation_count || 0

    return [
      rank,
      `"${name}"`,
      `"${code}"`,
      `"${rosterStr}"`,
      points,
      coins,
      streak,
      maxStreak,
      correct,
      answered,
      `"${accuracy}"`,
      avgResponseTime,
      violations
    ].join(',')
  })

  // Prepend UTF-8 Byte Order Mark (\uFEFF) for Excel compatibility
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  return true
}
