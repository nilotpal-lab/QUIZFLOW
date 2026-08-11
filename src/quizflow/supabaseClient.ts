/* ================================================================
   QuizFlow — Supabase Cloud Database Client & Hybrid Sync Adapter
   Supports direct Supabase PostgreSQL Cloud DB sync with fallback.
   ================================================================ */

import { createClient } from '@supabase/supabase-js'
import type { HostUser } from './authStore'
import type { SavedQuizItem } from './quizStore'
import type { SessionHistoryRecord } from './historyStore'

const DEFAULT_SUPABASE_URL = 'https://ogciyskjrefwmazzckfg.supabase.co'
const DEFAULT_SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nY2l5c2tqcmVmd21henpja2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYwMjgxMTgsImV4cCI6MjEwMTYwNDExOH0.JwBvcMMESPGo_4qcFHcreuUVVmdSk8RRq9jtGPIjm7I'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
  )
}

export const supabase = isSupabaseConfigured()
  ? (() => {
      try {
        // Test if localStorage is accessible in this environment
        if (typeof window !== 'undefined') {
          const testKey = '__storage_test__'
          window.localStorage.setItem(testKey, testKey)
          window.localStorage.removeItem(testKey)
        }
        return createClient(supabaseUrl, supabaseAnonKey, {
          realtime: {
            params: {
              eventsPerSecond: 20
            }
          }
        })
      } catch (err) {
        console.warn('[QuizFlow Supabase] LocalStorage is blocked or disabled in this browser. Initializing with in-memory auth fallback.', err)
        return createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false, // Fallback to in-memory storage to prevent crash
            detectSessionInUrl: false
          },
          realtime: {
            params: {
              eventsPerSecond: 20
            }
          }
        })
      }
    })()
  : null

/* ================================================================
   SQL DDL SCHEMA (Run this in Supabase SQL Editor if creating tables)
   ================================================================
   
   CREATE TABLE IF NOT EXISTS hosts (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT NOT NULL UNIQUE,
     school TEXT,
     avatar_seed TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS quizzes (
     id TEXT PRIMARY KEY,
     host_id TEXT,
     title TEXT NOT NULL,
     description TEXT,
     language TEXT DEFAULT 'English',
     bloom_level TEXT DEFAULT 'Recall',
     question_count INT DEFAULT 0,
     quiz_data JSONB NOT NULL,
     is_draft BOOLEAN DEFAULT false,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS session_history (
     id TEXT PRIMARY KEY,
     pin TEXT NOT NULL,
     quiz_title TEXT NOT NULL,
     language TEXT,
     bloom_level TEXT,
     total_questions INT,
     total_players INT,
     winner_name TEXT,
     winner_score INT,
     class_accuracy_percent INT,
     completed_at TIMESTAMPTZ DEFAULT NOW(),
     players_summary JSONB,
     question_stats JSONB
   );
   ================================================================ */

// ── Supabase Cloud Sync Helpers ──────────────────────────────────

export async function syncHostUserToSupabase(user: HostUser) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('hosts').upsert({
      id: user.id,
      name: user.name,
      email: user.email,
      school: user.school,
      avatar_seed: user.avatarSeed
    })
    if (error) console.warn('Supabase Host Sync Warning:', error.message)
    return data
  } catch (err) {
    console.warn('Supabase Host Sync Exception:', err)
    return null
  }
}

export async function syncQuizToSupabase(item: SavedQuizItem, hostId?: string) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('quizzes').upsert({
      id: item.id,
      host_id: hostId || 'host_demo',
      title: item.title,
      description: item.description,
      language: item.language,
      bloom_level: item.bloomLevel,
      question_count: item.questionCount,
      quiz_data: item.quiz,
      is_draft: item.isDraft,
      updated_at: new Date(item.updatedAt).toISOString()
    })
    if (error) console.warn('Supabase Quiz Sync Warning:', error.message)
    return data
  } catch (err) {
    console.warn('Supabase Quiz Sync Exception:', err)
    return null
  }
}

export async function syncSessionHistoryToSupabase(rec: SessionHistoryRecord) {
  if (!supabase) return null
  try {
    const { data, error } = await supabase.from('session_history').upsert({
      id: rec.id,
      pin: rec.pin,
      quiz_title: rec.quizTitle,
      language: rec.language,
      bloom_level: rec.bloomLevel,
      total_questions: rec.totalQuestions,
      total_players: rec.totalPlayers,
      winner_name: rec.winnerName,
      winner_score: rec.winnerScore,
      class_accuracy_percent: rec.classAccuracyPercent,
      completed_at: new Date(rec.completedAt).toISOString(),
      players_summary: rec.playersSummary,
      question_stats: rec.questionStats
    })
    if (error) console.warn('Supabase History Sync Warning:', error.message)
    return data
  } catch (err) {
    console.warn('Supabase History Sync Exception:', err)
    return null
  }
}
