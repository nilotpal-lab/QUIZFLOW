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

/* ---------- Power-Ups ---------------------------------------- */
export type PowerUpType = 'fifty_fifty' | 'time_freeze' | 'double_points'

export interface PowerUp {
  type: PowerUpType
  emoji: string
  label: string
  used: boolean
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
