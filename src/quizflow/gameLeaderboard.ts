import type { SupabaseClient } from '@supabase/supabase-js'

/* ================================================================
   QuizFlow — Shared Game Leaderboard Read
   Single implementation of the ranking query used by BOTH:
     * GET /api/admin/leaderboard (host)
     * GET /api/quiz/leaderboard   (student-safe)

   Ranking: points desc → max_streak desc → total response time asc
   (matches the existing tactics tie-break convention). The payload is
   safe for students too — it never includes answer keys or correct
   indices, so the same rows can be shown during play and after close.
   ================================================================ */

export interface LeaderboardRow {
  rank: number
  team_id: string
  name: string | null
  code: string | null
  roster: string[] | null
  points: number
  coins: number
  streak: number
  max_streak: number
  total_correct: number
  total_answered: number
  frenzy_correct_count: number
  violation_count: number
}

export async function fetchGameLeaderboard(
  supabase: SupabaseClient,
  gameId: string
): Promise<{ error: { message: string } } | { leaderboard: LeaderboardRow[]; count: number }> {
  const { data: teams, error } = await supabase
    .from('quiz_sessions')
    .select('team_id, points, coins, streak, max_streak, total_correct, total_answered, total_response_time_ms, frenzy_correct_count, violation_count, teams(name, code, roster, status, device_id, claimed_by)')
    .eq('game_id', gameId)
    .order('points', { ascending: false })
    .order('max_streak', { ascending: false })
    .order('total_response_time_ms', { ascending: true })
    .limit(200)

  if (error) return { error }

  // Include active claimed teams or teams with recorded session activity
  const activeSessions = (teams || []).filter((t: any) => {
    const hasDevice = Boolean(t.teams?.device_id || t.teams?.claimed_by || t.teams?.status === 'claimed')
    const hasActivity = (t.points > 0 || t.total_answered > 0 || t.coins > 0)
    return Boolean(t.teams && (hasDevice || hasActivity))
  })

  const listToRank = activeSessions.length > 0
    ? activeSessions
    : (teams || []).filter((t: any) => Boolean(t.teams?.name || t.teams?.code))

  const ranked: LeaderboardRow[] = listToRank.map((t: any, i: number) => ({
    rank: i + 1,
    team_id: t.team_id,
    name: t.teams?.name || null,
    code: t.teams?.code || null,
    roster: t.teams?.roster || null,
    points: t.points,
    coins: t.coins,
    streak: t.streak,
    max_streak: t.max_streak,
    total_correct: t.total_correct,
    total_answered: t.total_answered,
    frenzy_correct_count: t.frenzy_correct_count,
    violation_count: t.violation_count
  }))

  return { leaderboard: ranked, count: ranked.length }
}
