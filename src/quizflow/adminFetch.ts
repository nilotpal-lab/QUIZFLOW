import { getSupabase } from '@/quizflow/supabaseClient'

/* ================================================================
   QuizFlow — Reusable Admin API Fetch Utility
   Attaches the Supabase Host Bearer Token if available.
   ================================================================ */

export async function getAdminBearer(): Promise<string | null> {
  const client = getSupabase()
  if (!client) return null
  try {
    const { data } = await client.auth.getSession()
    return data.session?.access_token || null
  } catch {
    return null
  }
}

export async function adminFetch(
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; body: any }> {
  const token = await getAdminBearer()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {})
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  try {
    const res = await fetch(path, { ...init, headers })
    let body: any = null
    try {
      body = await res.json()
    } catch {
      // no JSON body
    }
    return { ok: res.ok, status: res.status, body }
  } catch (err: any) {
    return { ok: false, status: 500, body: { error: err?.message || 'Network error' } }
  }
}
