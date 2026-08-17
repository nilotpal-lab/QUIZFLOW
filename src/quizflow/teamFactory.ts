/* ================================================================
   QuizFlow — Team Creation Factory (server-only)
   Shared by POST /api/admin/teams and POST /api/admin/teams/bulk.
   Generates a unique team code and inserts the team row.
   Credentials are human-memorable: username = team name, password =
   the team leader's name (first member of the roster). Both are
   PBKDF2-hashed/verified server-side; the plaintext is returned
   exactly once for day-of handout.
   ================================================================ */

import { generateTeamCode, hashPassword } from './credentials'

async function ensureUnique(supabase: any, column: string, generate: () => string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = generate()
    const { data } = await supabase.from('teams').select('id').eq(column, candidate).maybeSingle()
    if (!data) return candidate
  }
  throw new Error(`Could not generate a unique ${column}.`)
}

/** Username is the team name itself; append `-2`, `-3`… only on collision. */
async function ensureUniqueUsername(supabase: any, name: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? name : `${name}-${i + 1}`
    const { data } = await supabase.from('teams').select('id').eq('username', candidate).maybeSingle()
    if (!data) return candidate
  }
  throw new Error(`Could not generate a unique username for "${name}".`)
}

export async function createTeamRecord(
  supabase: any,
  name: string,
  roster: string[]
): Promise<{ team: any; credentials: { username: string; password: string } }> {
  const code = await ensureUnique(supabase, 'code', generateTeamCode)
  const username = await ensureUniqueUsername(supabase, name)
  // Password is the team leader's name — the FIRST roster entry. Falls
  // back to the team name when no roster was provided.
  const password = (roster[0] || name).trim()
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
