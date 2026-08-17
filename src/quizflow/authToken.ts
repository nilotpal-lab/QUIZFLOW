/* ================================================================
   QuizFlow — Team Session Token Helper (Web Crypto HMAC-SHA256 JWT)
   Zero-dependency signed token for the team-login event flow.

   Works in BOTH the Node.js runtime (API routes) and the Edge
   runtime (middleware.ts) — only standard Web Crypto / btoa/atob /
   TextEncoder are used, so no new auth library is introduced.
   ================================================================ */

export const SESSION_COOKIE = 'qf_session'
export const ADMIN_COOKIE = 'qf_admin'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h

export interface SessionClaims {
  team_id: string
  member_name: string
  device_id: string
  /** 'admin' for the local name+password admin session, 'team' otherwise. */
  role?: 'admin' | 'team'
  iat: number
  exp: number
}

const encoder = new TextEncoder()

/** Secret used to sign/verify tokens. In prod, set QUIZFLOW_SESSION_SECRET. */
function getSessionSecret(): string {
  return (
    process.env.QUIZFLOW_SESSION_SECRET ||
    // Dev-only fallback so the app keeps working zero-config.
    // WARNING: change this in any real deployment.
    'qf-dev-insecure-secret-change-me'
  )
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/* ── Base64url (UTF-8 safe) helpers ────────────────────────────── */

function base64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function utf8Encode(text: string) {
  return encoder.encode(text)
}

function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/* ── Sign / verify ─────────────────────────────────────────────── */

export async function signSessionToken(
  claims: Omit<SessionClaims, 'iat' | 'exp'>
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: SessionClaims = {
    ...claims,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS
  }

  const headerB64 = base64urlEncode(utf8Encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payloadB64 = base64urlEncode(utf8Encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const signature = await crypto.subtle.sign(
    'HMAC',
    await getSigningKey(),
    utf8Encode(signingInput)
  )

  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, signatureB64] = parts

  try {
    const key = await getSigningKey()
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(signatureB64),
      utf8Encode(`${headerB64}.${payloadB64}`)
    )
    if (!valid) return null

    const claims = JSON.parse(utf8Decode(base64urlDecode(payloadB64))) as SessionClaims
    if (!claims?.team_id || typeof claims.exp !== 'number') return null
    if (claims.exp <= Math.floor(Date.now() / 1000)) return null // expired

    return claims
  } catch {
    return null
  }
}

/** Pull a raw cookie value out of a request by name. */
export function getCookieValue(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie') || ''
  const match = cookieHeader.split(';').find(c => {
    const [cookieName] = c.trim().split('=')
    return cookieName === name
  })
  if (!match) return null
  const value = match.trim().slice(name.length + 1)
  return value ? decodeURIComponent(value) : null
}

/** Pull the raw team-session cookie value out of a request. */
export function getSessionTokenFromRequest(req: Request): string | null {
  return getCookieValue(req, SESSION_COOKIE)
}

/* ── Local admin session (name + password login) ──────────────── */

/** Sign an admin token for the qf_admin cookie (role: 'admin'). */
export async function signAdminToken(name: string): Promise<string> {
  return signSessionToken({
    team_id: 'local_admin',
    member_name: name,
    device_id: 'admin',
    role: 'admin'
  })
}

/** Verify a qf_admin cookie value; returns claims only for admin-role tokens. */
export async function verifyAdminToken(token: string): Promise<SessionClaims | null> {
  if (!token) return null
  const claims = await verifySessionToken(token)
  return claims?.role === 'admin' ? claims : null
}
