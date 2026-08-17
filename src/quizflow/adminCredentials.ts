/* ================================================================
   QuizFlow — Local Admin Credentials
   Name + password admin login (no Google / no email required).
   The admin session issued from these credentials is signed into the
   `qf_admin` cookie (authToken.ts) and accepted by the admin API
   routes via getAuthenticatedHost (serverSupabase.ts), so a local
   admin can use the Supabase-backed event tools without registering
   a Supabase account.
   ================================================================ */

export interface AdminCredential {
  name: string
  password: string
  school?: string
}

/** Master list of local admin accounts. Add more entries as needed. */
export const ADMIN_CREDENTIALS: AdminCredential[] = [
  { name: 'Sanchit', password: '123456', school: 'Event Admin' }
]

/**
 * Verify a name + password against the local admin registry.
 * Name matching is case-insensitive; passwords are exact.
 */
export function verifyAdminCredential(
  name: string,
  password: string
): AdminCredential | null {
  const n = (name || '').trim().toLowerCase()
  const match = ADMIN_CREDENTIALS.find(
    c => c.name.toLowerCase() === n && c.password === password
  )
  return match || null
}
