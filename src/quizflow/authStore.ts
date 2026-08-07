/* ================================================================
   QuizFlow — Host Auth Store
   Client-side authentication & host user profile store.
   ================================================================ */

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

import { syncHostUserToSupabase } from './supabaseClient'

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
