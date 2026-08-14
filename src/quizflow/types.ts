/* ================================================================
   QuizFlow — Core Type Definitions
   ================================================================ */

export type Difficulty = 'easy' | 'medium' | 'hard'
export type SessionStatus = 'lobby' | 'question_active' | 'question_reveal' | 'leaderboard' | 'ended'

/* ---------- Quiz & Questions ----------------------------------- */
export interface Quiz {
  id: string
  owner_id: string
  title: string
  description?: string
  language: string
  difficulty: Difficulty
  created_at: string
  updated_at: string
}

export interface QuestionChoice {
  id: string
  text: string
}

export interface Question {
  id: string
  quiz_id: string
  position: number
  prompt: string
  choices: QuestionChoice[]
  media_url?: string
  time_limit_ms: number
  explanation?: string
}

export interface QuestionKey {
  question_id: string
  correct_answer_index: number
}

/* ---------- Game Session --------------------------------------- */
export interface GameSession {
  id: string
  quiz_id: string
  host_user_id: string
  pin_code: string
  status: SessionStatus
  current_question_index: number
  current_question_started_at?: string
  current_question_ends_at?: string
  created_at: string
  ended_at?: string
}

/* ---------- Participants --------------------------------------- */
export type AvatarStyle = 'adventurer' | 'lorelei' | 'pixel-art' | 'fun-emoji'

export interface Participant {
  id: string
  session_id: string
  nickname: string
  avatar_seed: string
  avatar_style: AvatarStyle
  score: number
  streak_count: number
  connected: boolean
  joined_at: string
}

/* ---------- Submissions --------------------------------------- */
export interface Submission {
  id: string
  session_id: string
  participant_id: string
  question_id: string
  selected_index: number
  is_correct: boolean
  response_ms: number
  points_awarded: number
  submitted_at: string
}

/* ---------- Power-Ups (Legacy — free per-game) ---------------- */
export type PowerUpType = 'fifty_fifty' | 'time_freeze' | 'double_points'

export interface PowerUp {
  type: PowerUpType
  emoji: string
  label: string
  used: boolean
}

/* ---------- Coin Shop Power-Ups ------------------------------- */
export type CoinPowerUpType =
  | 'freeze_player'   // freeze a specific player for 6s
  | 'freeze_all'      // freeze all players for 4s
  | 'bid_2x'          // 2× points on next question
  | 'bid_3x'          // 3× points on next question
  | 'bid_4x'          // 4× points on next question

export interface CoinShopItem {
  type: CoinPowerUpType
  label: string
  emoji: string
  description: string
  cost: number
  requiresTarget: boolean  // true = freeze_player needs a targetId
}

export interface ActiveCoinPowerUp {
  type: CoinPowerUpType
  activatedAt: number
  expiresAt?: number
  targetId?: string   // for freeze_player
  multiplier?: number // for bid_*
}

/* ---------- Leaderboard --------------------------------------- */
export interface LeaderboardEntry {
  rank: number
  participant: Participant
  points_this_question?: number
  is_correct?: boolean
}

/* ---------- AI Generation ------------------------------------ */
export type BloomLevel = 'Recall' | 'Comprehension' | 'Application' | 'Analysis'

export interface AIGeneratedQuestion {
  prompt: string
  choices: string[]
  correct_index: number
  difficulty: Difficulty
  explanation?: string
  time_limit_ms: number
  bloom_level?: BloomLevel | string
  misconceptions?: string[]
  imageUrl?: string
  media_url?: string
}

export interface AIGeneratedQuiz {
  title: string
  description?: string
  language: string
  bloomLevel?: BloomLevel | string
  questions: AIGeneratedQuestion[]
}

/* ---------- Scoring ------------------------------------------- */
export interface ScoreResult {
  points: number
  speed_bonus: number
  streak_bonus: number
  power_up_multiplier: number
}

/* ---------- Multi-Round Tournament ----------------------------- */
export interface RoundConfig {
  roundNumber: number
  quizId?: string
  quizTitle: string
  quiz: import('./types').AIGeneratedQuiz
  eliminationRule: string   // raw host input, e.g. "bottom 30% by score"
}

export type EliminationCriteria =
  | 'bottom_score_percent'   // e.g. bottom 30% by score
  | 'bottom_score_count'     // e.g. bottom 3 players
  | 'min_correct'            // e.g. less than 3 correct
  | 'min_score'              // e.g. score below 500
  | 'all_but_top'            // e.g. only top 5 survive
  | 'custom'                 // AI-parsed freeform

export interface TournamentConfig {
  rounds: RoundConfig[]
  parsedRules: string        // AI-simplified markdown bullet list
  currentRoundIndex: number
  eliminations: Record<number, string[]>  // roundNumber -> eliminated player IDs
}

/* ---------- Boss Frenzy --------------------------------------- */
export interface BossFrenzyState {
  active: boolean
  endsAt: number               // absolute ms timestamp when 60s is up
  questionIndices: number[]    // indices into quiz.questions for the 10 rapid-fire Qs
  currentFrenzyIndex: number   // which rapid-fire Q we're on (0-9)
  questionStartedAt: number    // when current frenzy Q started
  frenzyScores: Record<string, number>  // playerId -> correct answers in frenzy
}
