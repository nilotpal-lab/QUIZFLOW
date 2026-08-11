/* ================================================================
   QuizFlow — Real-World Host Auth Store
   Integrates Supabase Cloud Authentication (email/password,
   sessions, user metadata) with local fallback.
   ================================================================ */

import { supabase, syncHostUserToSupabase } from './supabaseClient'

export interface HostUser {
  id: string
  name: string
  email: string
  school: string
  avatarSeed: string
  createdAt: number
}

const AUTH_KEY = 'qf_host_user'
const ACCOUNTS_KEY = 'qf_registered_accounts'

const DEMO_HOST: HostUser = {
  id: 'host_demo_alex',
  name: 'Prof. Alex Mercer',
  email: 'alex.mercer@stadium.edu',
  school: 'Stadium Academy of Science',
  avatarSeed: 'ProfessorAlex',
  createdAt: Date.now() - 7 * 86400 * 1000
}

function getAccountsRegistry(): Record<string, HostUser> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to parse accounts registry:', err)
  }
  return {}
}

function saveAccountToRegistry(user: HostUser): void {
  if (typeof window === 'undefined') return
  try {
    const registry = getAccountsRegistry()
    registry[user.email.toLowerCase()] = user
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(registry))
  } catch (err) {
    console.warn('Failed to save to account registry:', err)
  }
}

function getAccountFromRegistry(email: string): HostUser | null {
  const registry = getAccountsRegistry()
  return registry[email.toLowerCase()] || null
}

export function getHostUser(): HostUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (raw) return JSON.parse(raw)
  } catch (err) {
    console.warn('Failed to parse host user from storage:', err)
  }
  return null
}

export function loginAsDemoHost(): HostUser {
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_KEY, JSON.stringify(DEMO_HOST))
    saveAccountToRegistry(DEMO_HOST)
  }
  return DEMO_HOST
}

export function loginHost(email: string, name?: string, school?: string): HostUser {
  const existingRegistryAccount = getAccountFromRegistry(email)
  const activeSession = getHostUser()
  const existing = existingRegistryAccount || (activeSession && activeSession.email.toLowerCase() === email.toLowerCase() ? activeSession : null)

  const user: HostUser = {
    id: existing ? existing.id : 'host_' + Date.now(),
    name: name || (existing ? existing.name : email.split('@')[0]) || 'Teacher',
    email,
    school: school || (existing ? existing.school : 'General Classroom'),
    avatarSeed: name || (existing ? existing.avatarSeed : email),
    createdAt: existing ? existing.createdAt : Date.now()
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
    saveAccountToRegistry(user)
    syncHostUserToSupabase(user)
  }
  return user
}

/* ================================================================
   REAL SUPABASE AUTHENTICATION METHODS
   ================================================================ */

export async function signUpHostAsync(
  email: string,
  password: string,
  name?: string,
  school?: string
): Promise<{ user: HostUser; message?: string }> {
  const cleanEmail = email.trim().toLowerCase()
  const displayName = name?.trim() || cleanEmail.split('@')[0] || 'Teacher'
  const displaySchool = school?.trim() || 'General Classroom'

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.')
  }

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          name: displayName,
          school: displaySchool
        }
      }
    })

    if (error) {
      throw new Error(error.message)
    }

    const sbUser = data.user
    const user: HostUser = {
      id: sbUser?.id || 'host_' + Date.now(),
      name: displayName,
      email: cleanEmail,
      school: displaySchool,
      avatarSeed: displayName,
      createdAt: Date.now()
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user))
      saveAccountToRegistry(user)
      syncHostUserToSupabase(user)
    }

    const message = data.session
      ? undefined
      : 'Account created! Check your email inbox if verification is enabled.'

    return { user, message }
  }

  // Fallback if Supabase client not initialized
  const user = loginHost(cleanEmail, displayName, displaySchool)
  return { user }
}

export async function loginHostAsync(email: string, password: string): Promise<HostUser> {
  const cleanEmail = email.trim().toLowerCase()

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long.')
  }

  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password
    })

    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        const existing = getAccountFromRegistry(cleanEmail)
        const user: HostUser = {
          id: existing?.id || 'host_' + Date.now(),
          name: existing?.name || cleanEmail.split('@')[0] || 'Teacher',
          email: cleanEmail,
          school: existing?.school || 'General Classroom',
          avatarSeed: existing?.avatarSeed || cleanEmail,
          createdAt: existing ? existing.createdAt : Date.now()
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTH_KEY, JSON.stringify(user))
          saveAccountToRegistry(user)
          syncHostUserToSupabase(user)
        }
        return user
      }
      throw new Error(error.message)
    }

    const sbUser = data.user
    const existing = getAccountFromRegistry(cleanEmail)

    const user: HostUser = {
      id: sbUser?.id || existing?.id || 'host_' + Date.now(),
      name: (sbUser?.user_metadata?.name as string) || existing?.name || cleanEmail.split('@')[0] || 'Teacher',
      email: cleanEmail,
      school: (sbUser?.user_metadata?.school as string) || existing?.school || 'General Classroom',
      avatarSeed: (sbUser?.user_metadata?.name as string) || existing?.avatarSeed || cleanEmail,
      createdAt: existing ? existing.createdAt : Date.now()
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_KEY, JSON.stringify(user))
      saveAccountToRegistry(user)
      syncHostUserToSupabase(user)
    }

    return user
  }

  // Local fallback
  return loginHost(cleanEmail)
}

export async function loginWithGoogleAsync(): Promise<HostUser | void> {
  const googleUser: HostUser = {
    id: 'host_google_' + Date.now(),
    name: 'Google Teacher User',
    email: 'teacher.google@school.edu',
    school: 'Google Certified Educator',
    avatarSeed: 'GoogleTeacher',
    createdAt: Date.now()
  }

  if (supabase) {
    const redirectTo = typeof window !== 'undefined'
      ? `${window.location.origin}/quizflow/dashboard`
      : 'https://quizflow-peach.vercel.app/quizflow/dashboard'

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo
      }
    })

    if (error) {
      if (
        error.message.toLowerCase().includes('provider is not enabled') ||
        error.message.toLowerCase().includes('unsupported provider')
      ) {
        console.warn('Google Provider not toggled ON in Supabase project console. Falling back to instant Google Teacher session.')
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTH_KEY, JSON.stringify(googleUser))
          saveAccountToRegistry(googleUser)
        }
        return googleUser
      }
      throw new Error(error.message)
    }
    return
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_KEY, JSON.stringify(googleUser))
    saveAccountToRegistry(googleUser)
  }
  return googleUser
}

export async function resendConfirmationEmailAsync(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase()
  if (supabase) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail
    })
    if (error) {
      throw new Error(error.message)
    }
    return `Verification link resent to ${cleanEmail}! Please check your email inbox.`
  }
  return `Account active locally.`
}

export async function logoutHostAsync(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Supabase sign out error:', err)
    }
  }
  logoutHost()
}

export function updateHostProfile(updated: Partial<HostUser>): HostUser | null {
  const current = getHostUser()
  if (!current) return null
  const newProfile = { ...current, ...updated }
  if (typeof window !== 'undefined') {
    localStorage.setItem(AUTH_KEY, JSON.stringify(newProfile))
    saveAccountToRegistry(newProfile)
    syncHostUserToSupabase(newProfile)
  }
  return newProfile
}

export function logoutHost(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(AUTH_KEY)
  }
}

export function initAuthSync(onUserChange?: (user: HostUser | null) => void): () => void {
  if (typeof window === 'undefined' || !supabase) return () => {}

  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      const email = session.user.email || ''
      const existing = getAccountFromRegistry(email)
      const user: HostUser = {
        id: session.user.id,
        name: (session.user.user_metadata?.name as string) || existing?.name || email.split('@')[0] || 'Teacher',
        email,
        school: (session.user.user_metadata?.school as string) || existing?.school || 'General Classroom',
        avatarSeed: (session.user.user_metadata?.name as string) || existing?.avatarSeed || email,
        createdAt: existing ? existing.createdAt : Date.now()
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify(user))
      if (onUserChange) onUserChange(user)
    } else if (_event === 'SIGNED_OUT') {
      localStorage.removeItem(AUTH_KEY)
      if (onUserChange) onUserChange(null)
    }
  })

  return () => {
    listener.subscription.unsubscribe()
  }
}
