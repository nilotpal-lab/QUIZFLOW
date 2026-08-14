import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/* ================================================================
   QuizFlow — Global Community Quiz Registry API
   Stores user-published community quizzes globally in server memory
   and Supabase cloud DB so any user can see them globally in real time.
   ================================================================ */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

const supabase = (supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('placeholder'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

declare global {
  // eslint-disable-next-line no-var
  var __qf_community_quizzes: Map<string, any> | undefined
}

if (!global.__qf_community_quizzes) {
  global.__qf_community_quizzes = new Map()
}

const communityMap = global.__qf_community_quizzes

export async function GET() {
  const noCacheHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'CDN-Cache-Control': 'no-store',
    'Vercel-CDN-Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Expires': '0'
  }

  const memoryList = Array.from(communityMap.values())

  // If Supabase is configured, fetch published quizzes from cloud DB too
  let supabaseList: any[] = []
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('is_draft', false)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn('[Community API GET Supabase Warning]:', error.message)
      } else if (data && data.length > 0) {
        supabaseList = data
          .filter((item: any) => {
            // Filter out live active game rooms (id starts with room_)
            if (!item.id || String(item.id).startsWith('room_')) return false
            return true
          })
          .map((item: any) => {
            const qd = item.quiz_data || {}
            
            // If item.quiz_data is already a full CommunityQuiz object:
            if (qd.quiz && Array.isArray(qd.quiz.questions)) {
              return {
                ...qd,
                id: item.id || qd.id,
                title: item.title || qd.title,
                description: item.description || qd.description || '',
                createdAt: qd.createdAt || (item.created_at ? new Date(item.created_at).getTime() : Date.now())
              }
            }

            // Otherwise reconstruct valid CommunityQuiz structure
            const questions = qd.questions || (qd.quiz && qd.quiz.questions) || []
            const embeddedQuiz = {
              title: item.title,
              description: item.description || '',
              language: item.language || qd.language || 'English',
              bloomLevel: item.bloom_level || qd.bloomLevel || 'Comprehension',
              questions
            }

            return {
              id: item.id,
              title: item.title,
              description: item.description || '',
              category: qd.category || 'General Knowledge',
              tags: qd.tags || ['Community'],
              isFounder: false,
              authorName: qd.authorName || 'QuizFlow Creator',
              difficulty: qd.difficulty || 'medium',
              bloomLevel: item.bloom_level || qd.bloomLevel || 'Comprehension',
              questionCount: item.question_count || questions.length || 0,
              playsCount: qd.playsCount || 0,
              rating: qd.rating || 0,
              reviewCount: qd.reviewCount || 0,
              quiz: embeddedQuiz,
              comments: qd.comments || [],
              createdAt: item.created_at ? new Date(item.created_at).getTime() : Date.now()
            }
          })
      }
    } catch (err) {
      console.warn('[Community API GET Exception]:', err)
    }
  }

  // Merge in-memory and Supabase lists (unique by ID)
  const combinedMap = new Map<string, any>()
  for (const q of [...memoryList, ...supabaseList]) {
    if (q && q.id && q.quiz && Array.isArray(q.quiz.questions) && q.quiz.questions.length > 0) {
      combinedMap.set(q.id, q)
    }
  }

  return NextResponse.json({
    success: true,
    quizzes: Array.from(combinedMap.values())
  }, { headers: noCacheHeaders })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const quizItem = body?.quiz
    if (!quizItem || !quizItem.id) {
      return NextResponse.json({ error: 'Valid community quiz object required' }, { status: 400 })
    }

    // Save to global server memory
    communityMap.set(quizItem.id, quizItem)

    // Also sync to Supabase if available
    if (supabase) {
      try {
        const { error } = await supabase.from('quizzes').upsert({
          id: quizItem.id,
          host_id: 'community_creator',
          title: quizItem.title,
          description: quizItem.description || '',
          language: quizItem.quiz?.language || 'English',
          bloom_level: quizItem.bloomLevel || 'Comprehension',
          question_count: quizItem.questionCount || quizItem.quiz?.questions?.length || 0,
          quiz_data: quizItem, // Store full CommunityQuiz object
          is_draft: false,
          updated_at: new Date().toISOString()
        })
        if (error) {
          console.warn('[Community API POST Supabase Warning]:', error.message)
        }
      } catch (err) {
        console.warn('[Community API POST Supabase Exception]:', err)
      }
    }

    return NextResponse.json({ success: true, quiz: quizItem })
  } catch (e) {
    console.error('[Community API POST Error]', e)
    return NextResponse.json({ error: 'Failed to publish community quiz' }, { status: 500 })
  }
}
