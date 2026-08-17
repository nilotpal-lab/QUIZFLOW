/* ================================================================
   QuizFlow — Team Creation Factory (server-only)
   Shared by POST /api/admin/teams and POST /api/admin/teams/bulk.
   Generates a unique team code + username, a random password
   (PBKDF2-hashed server-side), and inserts the team row. The
   plaintext password is returned exactly once for day-of handout.
   ================================================================ */

import { generateTeamCode, generateUsername, generatePassword, hashPassword } from './credentials'

async function ensureUnique(supabase: any, column: string, generate: () => string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = generate()
    const { data } = await supabase.from('teams').select('id').eq(column, candidate).maybeSingle()
    if (!data) return candidate
  }
  throw new Error(`Could not generate a unique ${column}.`)
}

export async function createTeamRecord(
  supabase: any,
  name: string,
  roster: string[]
): Promise<{ team: any; credentials: { username: string; password: string } }> {
  const code = await ensureUnique(supabase, 'code', generateTeamCode)
  const username = await ensureUnique(supabase, 'username', () => generateUsername(name))
  const password = generatePassword()
  const { salt, hash } = await hashPassword(password)

  const { data, error } = await supabase
    .from('teams')
    .insert({
      name,
      code,
      username,
      roster: roster.length ? roster : [name],
      password_salt: salt,
      password_hash: hash,
      status: 'waiting',
      claimed_by: null,
      device_id: null,
      claimed_at: null
    })
    .select()
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return {
    team: {
      id: data.id,
      name: data.name,
      code: data.code,
      username: data.username,
      roster: data.roster,
      status: data.status
    },
    credentials: { username: data.username, password }
  }
}
