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
      const { data } = await supabase
        .from('quizzes')
        .select('*')
        .eq('is_draft', false)
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        supabaseList = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description || '',
          category: item.quiz_data?.category || 'General Knowledge',
          tags: item.quiz_data?.tags || ['Community'],
          isFounder: false,
          authorName: item.quiz_data?.authorName || 'QuizFlow Creator',
          difficulty: item.quiz_data?.difficulty || 'medium',
          bloomLevel: item.bloom_level || 'Comprehension',
          questionCount: item.question_count || item.quiz_data?.questions?.length || 0,
          playsCount: item.quiz_data?.playsCount || 0,
          rating: item.quiz_data?.rating || 0,
          reviewCount: item.quiz_data?.reviewCount || 0,
          quiz: item.quiz_data || item,
          comments: item.quiz_data?.comments || [],
          createdAt: new Date(item.created_at).getTime()
        }))
      }
    } catch {
      // Graceful fallback to in-memory list
    }
  }

  // Merge in-memory and Supabase lists (unique by ID)
  const combinedMap = new Map<string, any>()
  for (const q of [...memoryList, ...supabaseList]) {
    if (q && q.id) {
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
        await supabase.from('quizzes').upsert({
          id: quizItem.id,
          host_id: 'community_creator',
          title: quizItem.title,
          description: quizItem.description,
          language: quizItem.quiz?.language || 'English',
          bloom_level: quizItem.bloomLevel || 'Comprehension',
          question_count: quizItem.questionCount || quizItem.quiz?.questions?.length || 0,
          quiz_data: { ...quizItem.quiz, category: quizItem.category, tags: quizItem.tags, authorName: quizItem.authorName },
          is_draft: false,
          updated_at: new Date().toISOString()
        })
      } catch {
        // Ignore Supabase errors
      }
    }

    return NextResponse.json({ success: true, quiz: quizItem })
  } catch (e) {
    console.error('[Community API POST Error]', e)
    return NextResponse.json({ error: 'Failed to publish community quiz' }, { status: 500 })
  }
}
