/* ================================================================
   QuizFlow — Team Credential Helpers (Web Crypto PBKDF2)
   No new auth library — matches the existing Web Crypto convention
   (authToken.ts). Only ever runs server-side (API routes); the Edge
   middleware only verifies the session JWT, never passwords.

   Passwords are stored as PBKDF2-SHA256 hashes with a random salt:
       password_hash = base64url( PBKDF2(password, salt, 120k iters) )
   ================================================================ */

const encoder = new TextEncoder()
const PBKDF2_ITERATIONS = 120_000
const KEY_LENGTH_BITS = 256

/* ── Base64url (UTF-8 safe) — mirrors authToken.ts ────────────── */

function base64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function randomBytesBase64(n: number): string {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return base64urlEncode(bytes)
}

/* ── PBKDF2 hash / verify ─────────────────────────────────────── */

export async function hashPassword(
  password: string,
  salt?: string
): Promise<{ salt: string; hash: string }> {
  const s = salt || randomBytesBase64(16)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(s),
      iterations: PBKDF2_ITERATIONS
    },
    keyMaterial,
    KEY_LENGTH_BITS
  )
  return { salt: s, hash: base64urlEncode(new Uint8Array(bits)) }
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  if (!salt || !expectedHash) return false
  try {
    const { hash } = await hashPassword(password, salt)
    return hash === expectedHash
  } catch {
    return false
  }
}

/* ── Random credential generators ─────────────────────────────── */

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no I/L/O/0/1

function randomFromAlphabet(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

/** 6-char unambigous team code (matches the `teams.code` column). */
export function generateTeamCode(): string {
  return randomFromAlphabet(CODE_ALPHABET, 6)
}
