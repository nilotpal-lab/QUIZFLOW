/* ================================================================
   QuizFlow — Server-side Supabase Client & Host Auth Helper
   Route handlers run on the Node server (never in the browser),
   so they create their own client instead of reusing the browser
   proxy in supabaseClient.ts.
   ================================================================ */

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { ADMIN_COOKIE, getCookieValue, verifyAdminToken } from './authToken'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function getServerSupabase(): SupabaseClient | null {
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes('placeholder') ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Validate the host's admin session from a request. Two accepted forms:
 *   1. `Authorization: Bearer <supabase-access-token>` — the existing
 *      Supabase host auth (`supabase.auth.getUser(token)` verifies it
 *      without needing the service-role key).
 *   2. `qf_admin` cookie — a signed local admin session issued by the
 *      name+password admin login (/api/admin/session). Lets the local
 *      admin use the event tools without registering a Supabase account.
 */
export async function getAuthenticatedHost(req: Request): Promise<User | null> {
  const supabase = getServerSupabase()

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (token && supabase) {
    try {
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data?.user) return data.user
    } catch {
      /* fall through to cookie check */
    }
  }

  // Local admin session cookie (signed qf_admin) — name+password admin login.
  const adminToken = getCookieValue(req, ADMIN_COOKIE)
  if (adminToken) {
    const claims = await verifyAdminToken(adminToken)
    if (claims?.member_name) {
      const name = claims.member_name
      return {
        id: 'local_admin_' + name.toLowerCase().replace(/\s+/g, '_'),
        email: name.toLowerCase().replace(/\s+/g, '.') + '@quizflow.local',
        user_metadata: { name }
      } as unknown as User
    }
  }

  return null
}
