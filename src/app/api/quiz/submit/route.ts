import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/quizflow/serverSupabase'
import {
  getSessionTokenFromRequest,
  verifySessionToken
} from '@/quizflow/authToken'

/* ================================================================
   QuizFlow — Quiz Submission (idempotent)
   POST /api/quiz/submit  { answers, score, violations }

   Writes final answers/score to quiz_sessions and marks the team
   status = 'submitted'. Duplicate submits return the already-stored
   session without re-scoring (guarded by the submitted_at flag via
   a conditional UPDATE; the insert fallback uses a deterministic
   token so the token UNIQUE constraint blocks duplicate rows).
   ================================================================ */

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const noCacheHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Expires': '0'
}

export async function POST(req: Request) {
  try {
    const token = getSessionTokenFromRequest(req)
    const claims = token ? await verifySessionToken(token) : null
    if (!claims) {
      return NextResponse.json({ success: false, error: 'Unauthorized — no valid session.' }, { status: 401, headers: noCacheHeaders })
    }

    let body: { answers?: unknown; score?: unknown; violations?: unknown }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400, headers: noCacheHeaders })
    }

    const answers = Array.isArray(body?.answers) ? body.answers : []
    const violations = Array.isArray(body?.violations) ? body.violations : []
    const score = typeof body?.score === 'number' && Number.isFinite(body.score) ? Math.max(0, Math.round(body.score)) : 0

    const supabase = getServerSupabase()
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase is not configured.' }, { status: 503, headers: noCacheHeaders })
    }

    const now = new Date().toISOString()

    // ── Fast path: already submitted → idempotent no-op ──────────
    const { data: existing } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('team_id', claims.team_id)
      .maybeSingle()

    if (existing?.submitted_at) {
      return NextResponse.json({ success: true, alreadySubmitted: true, session: existing }, { headers: noCacheHeaders })
    }

    // ── Atomic submit claim: only flips when submitted_at IS NULL ──
    const { data: updatedRows } = await supabase
      .from('quiz_sessions')
      .update({ answers, score, violations, submitted_at: now })
      .eq('team_id', claims.team_id)
      .is('submitted_at', null)
      .select()

    let session = updatedRows?.[0] ?? null

    if (!session) {
      // Lost the race, or no session row exists yet.
      const { data: recheck } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('team_id', claims.team_id)
        .maybeSingle()

      if (recheck?.submitted_at) {
        // A concurrent submit won — return its stored result.
        return NextResponse.json({ success: true, alreadySubmitted: true, session: recheck }, { headers: noCacheHeaders })
      }
      if (recheck) {
        session = recheck
      } else {
        // Create the session. Deterministic token derived from team_id:
        // the token UNIQUE constraint makes a concurrent duplicate insert
        // fail instead of creating a second row.
        const { data: inserted, error: insertError } = await supabase
          .from('quiz_sessions')
          .insert({
            team_id: claims.team_id,
            token: `sess_${claims.team_id}`,
            answers,
            score,
            violations,
            submitted_at: now
          })
          .select()
          .single()

        if (inserted) {
          session = inserted
        } else if (insertError) {
          // Unique-token violation from a racing submit — read the winner.
          const { data: winner } = await supabase
            .from('quiz_sessions')
            .select('*')
            .eq('team_id', claims.team_id)
            .maybeSingle()
          if (winner?.submitted_at) {
            return NextResponse.json({ success: true, alreadySubmitted: true, session: winner }, { headers: noCacheHeaders })
          }
          return NextResponse.json({ success: false, error: 'Failed to store submission.' }, { status: 500, headers: noCacheHeaders })
        }
      }
    }

    // Mark team submitted (idempotent — setting the same status twice is harmless).
    await supabase
      .from('teams')
      .update({ status: 'submitted' })
      .eq('id', claims.team_id)

    return NextResponse.json({ success: true, alreadySubmitted: false, session }, { headers: noCacheHeaders })
  } catch (err: any) {
    console.error('[Quiz Submit] Unexpected error:', err)
    return NextResponse.json({ success: false, error: 'Failed to submit quiz.' }, { status: 500, headers: noCacheHeaders })
  }
}
