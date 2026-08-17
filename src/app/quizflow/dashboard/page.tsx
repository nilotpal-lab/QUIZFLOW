'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getHostUser, logoutHostAsync, updateHostProfile, initAuthSync, type HostUser } from '@/quizflow/authStore'
import { getSavedQuizzes, deleteSavedQuiz, saveQuizDraft, type SavedQuizItem } from '@/quizflow/quizStore'
import { getSessionHistory, type SessionHistoryRecord } from '@/quizflow/historyStore'
import { createSession } from '@/quizflow/sessionStore'
import { publishQuizToCommunity } from '@/quizflow/communityStore'
import { getSupabase } from '@/quizflow/supabaseClient'
import * as XLSX from 'xlsx'

type Tab = 'quizzes' | 'teams' | 'leaderboard' | 'controls' | 'game' | 'history' | 'profile'

const TABS: { id: Tab; label: string }[] = [
  { id: 'quizzes', label: '📝 My Quizzes' },
  { id: 'teams', label: '👥 Teams & Credentials' },
  { id: 'leaderboard', label: '🏆 Live Leaderboard' },
  { id: 'controls', label: '🎛️ Day-of Controls' },
  { id: 'game', label: '🎮 Active Game' },
  { id: 'history', label: '📊 Hosted Sessions' },
  { id: 'profile', label: '👤 Profile' }
]

/* ── Admin API helper: attaches the Supabase host Bearer token ── */
async function getAdminBearer(): Promise<string | null> {
  const client = getSupabase()
  if (!client) return null
  try {
    const { data } = await client.auth.getSession()
    return data.session?.access_token || null
  } catch {
    return null
  }
}

async function adminFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: any }> {
  const token = await getAdminBearer()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...init, headers })
  let body: any = null
  try { body = await res.json() } catch { /* no body */ }
  return { ok: res.ok, status: res.status, body }
}

function formatExactTime(ts?: number) {
  if (!ts) return 'N/A'
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  })
}

function formatDuration(startedAt?: number, completedAt?: number, durationMs?: number) {
  let ms = durationMs
  if (!ms && startedAt && completedAt) {
    ms = completedAt - startedAt
  }
  if (!ms || ms <= 0) return 'Under 1 min'
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

/* Convert ISO string ↔ datetime-local input value. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ── Excel/CSV bulk upload helpers ────────────────────────────── */
function normalizeHeader(h: any): string {
  return String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}
function isNameColumn(h: any): boolean {
  const n = normalizeHeader(h)
  return n === 'team' || n === 'name' || n === 'team name' || n === 'teamname' || n === 'group' || n === 'class' || (n.includes('team') && n.includes('name'))
}
function isRosterColumn(h: any): boolean {
  const n = normalizeHeader(h)
  return n === 'roster' || n === 'members' || n === 'member' || n === 'member names' || n === 'members names' || n === 'team members' || n === 'students' || n === 'student names' || n === 'names' || n === 'players' || n.includes('member') || n.includes('roster') || n.includes('student')
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields). */
function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let cur: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cur.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      cur.push(field); field = ''
      if (cur.some(c => c.trim() !== '')) rows.push(cur)
      cur = []
    } else field += ch
  }
  cur.push(field)
  if (cur.some(c => c.trim() !== '')) rows.push(cur)
  return rows
}

/** Map spreadsheet rows → teams, auto-detecting the header row. */
function rowsToTeams(rows: string[][]): { name: string; roster: string[] }[] {
  let headerIdx = -1
  let nameCol = -1
  let rosterCol = -1
  for (let r = 0; r < rows.length; r++) {
    const ni = rows[r].findIndex(isNameColumn)
    if (ni >= 0) {
      headerIdx = r
      nameCol = ni
      rosterCol = rows[r].findIndex((c, i) => i !== ni && isRosterColumn(c))
      break
    }
  }
  if (headerIdx < 0) return []
  const teams: { name: string; roster: string[] }[] = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const name = String(row[nameCol] ?? '').trim()
    if (!name) continue
    const rosterCell = rosterCol >= 0 ? String(row[rosterCol] ?? '') : ''
    const roster = rosterCell.split(/[\n,;|]+/).map(s => s.trim()).filter(Boolean)
    teams.push({ name, roster })
  }
  return teams
}

// Feature Flag: Enabled for quiz creation, library saves, and global publishing
const ENABLE_GLOBAL_PUBLISH = true

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<HostUser | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('quizzes')

  // Quizzes & History state (existing)
  const [allQuizzes, setAllQuizzes] = useState<SavedQuizItem[]>([])
  const [history, setHistory] = useState<SessionHistoryRecord[]>([])
  const [selectedHistory, setSelectedHistory] = useState<SessionHistoryRecord | null>(null)
  const [historyViewMode, setHistoryViewMode] = useState<'timeline' | 'grouped'>('timeline')
  const [expandedQuizTitle, setExpandedQuizTitle] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Profile Form state (existing)
  const [profileName, setProfileName] = useState('')
  const [profileSchool, setProfileSchool] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [isOAuthPending, setIsOAuthPending] = useState(false)

  // Event / teams / game state (new)
  const [adminNotice, setAdminNotice] = useState('')
  const [teams, setTeams] = useState<any[]>([])
  const [createName, setCreateName] = useState('')
  const [createRoster, setCreateRoster] = useState('')
  const [credentialCard, setCredentialCard] = useState<{ teamName: string; username: string; password: string } | null>(null)
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadTeams, setUploadTeams] = useState<{ name: string; roster: string[] }[] | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [bulkResult, setBulkResult] = useState<{ created: any[]; failed: { name: string; error: string }[] } | null>(null)
  const [eventCfg, setEventCfg] = useState<{ login_open: boolean; opens_at: string | null; closes_at: string | null } | null>(null)
  const [opensInput, setOpensInput] = useState('')
  const [closesInput, setClosesInput] = useState('')
  const [lbGameId, setLbGameId] = useState('EVENT')
  const [lbData, setLbData] = useState<any[]>([])
  const [gameId, setGameId] = useState('EVENT')
  const [gameMode, setGameMode] = useState('classic')
  const [selectedQuizId, setSelectedQuizId] = useState('')
  const [liveGame, setLiveGame] = useState<any>(null)
  const [teamsInGame, setTeamsInGame] = useState(0)
  const [busy, setBusy] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  useEffect(() => {
    const hasOAuthParams = typeof window !== 'undefined' && (
      window.location.search.includes('code=') ||
      window.location.hash.includes('access_token=') ||
      window.location.hash.includes('error=')
    )

    if (hasOAuthParams) {
      setIsOAuthPending(true)
    }

    const hostUser = getHostUser()
    if (hostUser) {
      setUser(hostUser)
      setProfileName(hostUser.name)
      setProfileSchool(hostUser.school)
      setIsCheckingAuth(false)
    } else if (!hasOAuthParams) {
      const timer = setTimeout(() => {
        if (!getHostUser()) {
          router.push('/quizflow/auth')
        }
      }, 1500)
      return () => clearTimeout(timer)
    }

    const unsubscribe = initAuthSync(updatedUser => {
      setIsCheckingAuth(false)
      setIsOAuthPending(false)
      if (updatedUser) {
        setUser(updatedUser)
        setProfileName(updatedUser.name)
        setProfileSchool(updatedUser.school)
      } else if (!getHostUser() && !hasOAuthParams) {
        router.push('/quizflow/auth')
      }
    })

    setAllQuizzes(getSavedQuizzes())
    setHistory(getSessionHistory())

    return () => unsubscribe()
  }, [router])

  /* ── Data loaders ────────────────────────────────────────────── */
  const loadTeams = useCallback(async () => {
    const res = await adminFetch('/api/admin/teams')
    if (res.ok && res.body?.teams) {
      setTeams(res.body.teams)
      setAdminNotice('')
    } else if (res.status === 401) {
      setAdminNotice('Event tools need a Supabase admin session. Sign in with an Admin account (Demo/email-only logins cannot use them).')
    } else {
      setAdminNotice(res.body?.error || 'Failed to load teams.')
    }
  }, [])

  const loadEventConfig = useCallback(async () => {
    const res = await adminFetch('/api/event/config')
    if (res.ok && res.body?.config) {
      setEventCfg(res.body.config)
      setOpensInput(toLocalInput(res.body.config.opens_at))
      setClosesInput(toLocalInput(res.body.config.closes_at))
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'teams') loadTeams()
  }, [activeTab, loadTeams])

  useEffect(() => {
    if (activeTab === 'controls') loadEventConfig()
  }, [activeTab, loadEventConfig])

  /* Live leaderboard poll */
  useEffect(() => {
    if (activeTab !== 'leaderboard') return
    const id = lbGameId.trim().toUpperCase()
    if (!id) return
    let cancelled = false
    const tick = async () => {
      const res = await adminFetch(`/api/admin/leaderboard?game_id=${encodeURIComponent(id)}`)
      if (!cancelled) {
        if (res.ok && res.body?.leaderboard) setLbData(res.body.leaderboard)
        else setLbData([])
      }
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeTab, lbGameId])

  /* Active game poll (games table is anon-readable + sanitized) */
  useEffect(() => {
    if (activeTab !== 'game') return
    const id = gameId.trim().toUpperCase()
    if (!id) return
    let cancelled = false
    const tick = async () => {
      const client = getSupabase()
      if (!client) return
      const { data: game } = await client.from('games').select('*').eq('id', id).maybeSingle()
      const { count } = await client.from('quiz_sessions').select('team_id', { count: 'exact', head: true }).eq('game_id', id)
      if (!cancelled) {
        setLiveGame(game || null)
        setTeamsInGame(count || 0)
      }
    }
    tick()
    const t = setInterval(tick, 2000)
    return () => { cancelled = true; clearInterval(t) }
  }, [activeTab, gameId])

  useEffect(() => {
    if (allQuizzes.length > 0 && !selectedQuizId) {
      const ready = allQuizzes.find(q => !q.isDraft) || allQuizzes[0]
      setSelectedQuizId(ready.id)
    }
  }, [allQuizzes, selectedQuizId])

  /* ── Actions ─────────────────────────────────────────────────── */
  const handleLogout = async () => {
    await logoutHostAsync()
    router.push('/quizflow/auth')
  }

  const handleDeleteQuiz = (id: string) => {
    if (confirm('Are you sure you want to delete this draft quiz?')) {
      deleteSavedQuiz(id)
      setAllQuizzes(getSavedQuizzes())
    }
  }

  const handleHostSavedQuiz = (item: SavedQuizItem) => {
    const state = createSession(item.quiz, 'host-' + Date.now())
    router.push(`/quizflow/host?pin=${state.pin}`)
  }

  const handleEditQuizInStudio = (item: SavedQuizItem) => {
    localStorage.setItem('qf_saved_quiz', JSON.stringify(item.quiz))
    router.push('/quizflow/studio')
  }

  const handlePublishGlobal = (item: SavedQuizItem) => {
    publishQuizToCommunity(item.quiz, user?.name)
    saveQuizDraft(item.quiz, false, item.id)
    setAllQuizzes(getSavedQuizzes())
    showToast('🌐 Published to Global Community Library! Visible to all users.')
  }

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    const updated = updateHostProfile({ name: profileName, school: profileSchool })
    if (updated) {
      setUser(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  /* Teams & credentials */
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = createName.trim()
    if (!name) return
    setBusy('Creating team…')
    const roster = createRoster.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    const res = await adminFetch('/api/admin/teams', {
      method: 'POST',
      body: JSON.stringify({ name, roster })
    })
    setBusy('')
    if (res.ok && res.body?.credentials) {
      setCredentialCard({ teamName: res.body.team.name, username: res.body.credentials.username, password: res.body.credentials.password })
      setCreateName('')
      setCreateRoster('')
      showToast('✅ Team created! Save the credentials for day-of handout.')
      loadTeams()
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to create team.'}`)
    }
  }

  const handleResetPassword = async (team: any) => {
    setBusy(`Resetting password for ${team.name}…`)
    const res = await adminFetch(`/api/admin/teams/${team.id}/reset-password`, { method: 'POST' })
    setBusy('')
    if (res.ok && res.body?.credentials) {
      setCredentialCard({ teamName: team.name, username: res.body.credentials.username, password: res.body.credentials.password })
      showToast('🔑 Password reset — new credential shown.')
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to reset password.'}`)
    }
  }

  const handleReleaseTeam = async (team: any) => {
    if (!confirm(`Release device binding for ${team.name}? They can log in again from another device.`)) return
    setBusy('Releasing…')
    const res = await adminFetch(`/api/admin/teams/${team.id}/release`, { method: 'POST' })
    setBusy('')
    if (res.ok) showToast(`✅ ${team.name} released.`)
    else showToast(`❌ ${res.body?.error || 'Failed to release.'}`)
    loadTeams()
  }

  const handleDeleteTeam = async (team: any) => {
    if (!confirm(`Delete team "${team.name}"? This removes the team and its quiz session permanently.`)) return
    setBusy('Deleting…')
    const res = await adminFetch(`/api/admin/teams/${team.id}`, { method: 'DELETE' })
    setBusy('')
    if (res.ok) showToast(`🗑️ ${team.name} deleted.`)
    else showToast(`❌ ${res.body?.error || 'Failed to delete.'}`)
    loadTeams()
  }

  const copyCreds = (username: string, password: string) => {
    navigator.clipboard.writeText(`Team: ${credentialCard?.teamName}\nUsername: ${username}\nPassword: ${password}`)
    showToast('📋 Credentials copied!')
  }

  /* Bulk upload (Excel/CSV) */
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file
    if (!file) return
    setUploadError('')
    setBulkResult(null)
    setUploadTeams(null)
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      let rows: string[][]
      if (ext === 'csv') {
        rows = parseCsvText(await file.text())
      } else if (ext === 'xlsx' || ext === 'xls') {
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' })
      } else {
        setUploadError('Unsupported file — upload a .xlsx or .csv file.')
        return
      }
      const teams = rowsToTeams(rows)
      if (teams.length === 0) {
        setUploadError('No teams found. Use a "Team Name" column and a "Roster" column (team leader first, members comma-separated).')
        return
      }
      setUploadFileName(file.name)
      setUploadTeams(teams)
    } catch (err: any) {
      setUploadError('Could not read the file: ' + (err?.message || 'unknown error'))
    }
  }

  const handleBulkCreate = async () => {
    if (!uploadTeams?.length) return
    setBusy(`Creating ${uploadTeams.length} teams…`)
    const res = await adminFetch('/api/admin/teams/bulk', {
      method: 'POST',
      body: JSON.stringify({ teams: uploadTeams.map(t => ({ name: t.name, roster: t.roster })) })
    })
    setBusy('')
    if (res.ok && res.body?.success) {
      setBulkResult({ created: res.body.created || [], failed: res.body.failed || [] })
      showToast(`✅ Created ${res.body.createdCount || 0} teams from upload.`)
      setUploadTeams(null)
      setUploadFileName('')
      loadTeams()
    } else {
      showToast(`❌ ${res.body?.error || 'Bulk create failed.'}`)
    }
  }

  const downloadCredentialsCsv = () => {
    if (!bulkResult?.created.length) return
    const header = 'Team Name,Username,Password,Team Code,Roster\n'
    const lines = bulkResult.created.map((c: any) => {
      const t = c.team || {}
      const cred = c.credentials || {}
      const roster = (t.roster || []).join('; ')
      return [t.name, cred.username, cred.password, t.code, roster].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')
    })
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quizflow-team-credentials.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTemplate = () => {
    const csv = 'Team Name,Roster\nPhoenix Squad,Alex; Priya; Jordan\nTiger Claw,Mei; Rahul; Sara\n'
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'quizflow-team-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  /* Day-of controls */
  const handleToggleGate = async (open: boolean) => {
    setBusy(open ? 'Opening student login…' : 'Closing student login…')
    const res = await adminFetch('/api/admin/event-config', {
      method: 'POST',
      body: JSON.stringify({ login_open: open })
    })
    setBusy('')
    if (res.ok) {
      showToast(open ? '✅ Student login OPEN.' : '🔒 Student login CLOSED.')
      loadEventConfig()
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to update gate.'}`)
    }
  }

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('Saving schedule…')
    const res = await adminFetch('/api/admin/event-config', {
      method: 'POST',
      body: JSON.stringify({
        opens_at: opensInput ? new Date(opensInput).toISOString() : '',
        closes_at: closesInput ? new Date(closesInput).toISOString() : ''
      })
    })
    setBusy('')
    if (res.ok) {
      showToast('✅ Schedule saved.')
      loadEventConfig()
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to save schedule.'}`)
    }
  }

  /* Active game */
  const handleCreateGame = async () => {
    const id = gameId.trim().toUpperCase()
    const item = allQuizzes.find(q => q.id === selectedQuizId)
    if (!id || !item) {
      showToast('❌ Pick a quiz and enter a game id.')
      return
    }
    setBusy('Creating game…')
    const res = await adminFetch('/api/quiz/game', {
      method: 'POST',
      body: JSON.stringify({ game_id: id, quiz: item.quiz, mode: gameMode })
    })
    setBusy('')
    if (res.ok) {
      showToast(`✅ Game ${id} created — ${res.body.question_count} questions. Students can now join the lobby.`)
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to create game.'}`)
    }
  }

  const handleAdvance = async (action: string) => {
    const id = gameId.trim().toUpperCase()
    if (!id) return
    setBusy(`Advancing: ${action}…`)
    const res = await adminFetch('/api/quiz/game/advance', {
      method: 'POST',
      body: JSON.stringify({ game_id: id, action })
    })
    setBusy('')
    if (!res.ok) showToast(`❌ ${res.body?.error || 'Failed to advance.'}`)
  }

  const handleBoss = async (action: 'start' | 'finalize') => {
    const id = gameId.trim().toUpperCase()
    if (!id) return
    setBusy('Boss mode…')
    const res = await adminFetch(`/api/quiz/boss/${action}`, {
      method: 'POST',
      body: JSON.stringify({ game_id: id })
    })
    setBusy('')
    if (!res.ok) showToast(`❌ ${res.body?.error || 'Boss action failed.'}`)
    else showToast(action === 'start' ? '💥 Boss Frenzy started!' : '🏁 Boss finale finalized.')
  }

  const draftQuizzes = allQuizzes.filter(q => q.isDraft)
  const libraryReadyQuizzes = allQuizzes.filter(q => !q.isDraft)
  const selectedQuiz = allQuizzes.find(q => q.id === selectedQuizId)
  const loggedInTeams = teams.filter(t => t.status !== 'waiting').length

  const groupedHistoryMap = history.reduce<Record<string, SessionHistoryRecord[]>>((acc, item) => {
    const title = item.quizTitle || 'Untitled Quiz'
    if (!acc[title]) acc[title] = []
    acc[title].push(item)
    return acc
  }, {})

  /* ── Auth gate ───────────────────────────────────────────────── */
  if (!user) {
    return (
      <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card anim-scale-in" style={{ maxWidth: 440, width: '100%', padding: '40px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>
            {isOAuthPending ? '✨' : '🛡️'}
          </div>
          <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, marginBottom: 8, color: 'var(--ink)' }}>
            {isOAuthPending ? 'Connecting Google Session' : 'Admin Dashboard'}
          </h2>
          <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#555', marginBottom: 28, lineHeight: 1.5 }}>
            {isOAuthPending
              ? 'Finalizing your Google sign-in credentials...'
              : isCheckingAuth
                ? 'Verifying your admin credentials...'
                : 'Please sign in or start a free admin session to access quiz creation, teams, and event controls.'}
          </p>

          {!isOAuthPending && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Link href="/quizflow/auth" style={{ textDecoration: 'none' }}>
                <button className="btn btn-primary" style={{ width: '100%', height: 48, fontSize: 15 }}>
                  🔑 Sign In to Admin Dashboard →
                </button>
              </Link>

              <Link href="/quizflow" style={{ textDecoration: 'none' }}>
                <button className="btn" style={{ width: '100%', height: 44, background: 'var(--paper)', border: '2px solid var(--ink)', color: 'var(--ink)' }}>
                  ← Return to Home
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>
    )
  }

  /* ── Dashboard ───────────────────────────────────────────────── */
  return (
    <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>

      {/* TOP COMMAND CENTER BAR */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/quizflow"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>← Exit</button></Link>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800 }}>🛡️ Admin Dashboard</span>
          <span className="badge badge-sun" style={{ fontSize: 10 }}>🎓 {user.school}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/quizflow/studio"><button className="btn btn-violet btn-sm">✨ + New AI Quiz</button></Link>
          <button className="btn btn-sm" style={{ background: 'var(--cherry)', color: '#fff' }} onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* TAB STRIP */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px clamp(12px, 3vw, 20px)', background: 'var(--paper-2)', borderBottom: 'var(--line)' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="btn btn-sm"
            style={{
              fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12.5,
              background: activeTab === tab.id ? 'var(--mint)' : 'var(--paper)',
              color: 'var(--ink)', border: '2px solid var(--ink)', boxShadow: '2px 2px 0 var(--ink)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TOAST */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 100,
          background: 'var(--ink)', color: '#fff',
          padding: '12px 20px', borderRadius: 12, border: '2px solid var(--sun)',
          boxShadow: 'var(--shadow-hard-lg)', fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 14
        }}>
          {toastMsg}
        </div>
      )}

      {adminNotice && activeTab !== 'quizzes' && activeTab !== 'history' && activeTab !== 'profile' && (
        <div style={{
          margin: '16px 24px 0', padding: '12px 16px', background: '#FFF3CD',
          border: '2px solid var(--sun)', borderRadius: 10,
          fontFamily: 'Inter', fontSize: 13, fontWeight: 600, color: 'var(--ink)'
        }}>
          ⚠️ {adminNotice}
        </div>
      )}

      {busy && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 200, background: 'var(--violet)', color: '#fff', padding: '8px 18px', borderRadius: 999, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, boxShadow: '3px 3px 0 var(--ink)' }}>
          {busy}
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, padding: 'clamp(14px, 3vw, 24px)', maxWidth: 1280, width: '100%', margin: '0 auto' }}>

        {/* ═══ TAB: MY QUIZZES (existing) ═══ */}
        {activeTab === 'quizzes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                  📝 My Quizzes
                </h2>
                <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                  All quizzes saved in Studio. Click 🌐 Publish Global to share any quiz to the global library.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href="/quizflow/practice"><button className="btn btn-violet btn-md">🌐 Browse Community Library</button></Link>
                <Link href="/quizflow/studio"><button className="btn btn-sun btn-md">✨ Create in Studio →</button></Link>
              </div>
            </div>

            {allQuizzes.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Quizzes Found</h3>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>Quizzes you save in AI Studio will appear here automatically.</p>
                <Link href="/quizflow/studio"><button className="btn btn-violet">✨ Open AI Studio</button></Link>
              </div>
            ) : (
              <div>
                {draftQuizzes.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                      📝 DRAFT QUIZZES ({draftQuizzes.length}) — In progress, not yet published
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
                      {draftQuizzes.map(item => (
                        <div key={item.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span className="badge badge-cherry">📝 Draft</span>
                              <span style={{ fontSize: 11, color: '#666', fontFamily: 'Inter' }}>
                                Updated {formatExactTime(item.updatedAt)}
                              </span>
                            </div>
                            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                              {item.title}
                            </h3>
                            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 14, lineHeight: 1.4 }}>
                              {item.description}
                            </p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                              <span className="badge badge-ink">{item.quiz.questions?.length || item.questionCount} Questions</span>
                              <span className="badge badge-sky">{item.language}</span>
                              <span className="badge badge-violet">{item.bloomLevel}</span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: ENABLE_GLOBAL_PUBLISH ? '1fr 1fr' : '1fr', gap: 8, borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
                            <button className="btn btn-sun btn-sm" style={{ fontWeight: 800 }} onClick={() => handleHostSavedQuiz(item)}>🚀 Host Game</button>
                            {ENABLE_GLOBAL_PUBLISH && (
                              <button className="btn btn-violet btn-sm" style={{ fontWeight: 800, color: '#fff' }} onClick={() => handlePublishGlobal(item)}>🌐 Publish Global</button>
                            )}
                            <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)' }} onClick={() => handleEditQuizInStudio(item)}>✏️ Edit Studio</button>
                            <button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--cherry)', border: '1.5px solid var(--cherry)' }} onClick={() => handleDeleteQuiz(item.id)}>🗑️ Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {libraryReadyQuizzes.length > 0 && (
                  <div>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                      ✅ LIBRARY-READY QUIZZES ({libraryReadyQuizzes.length}) — Published or preset, ready to host
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20 }}>
                      {libraryReadyQuizzes.map(item => (
                        <div key={item.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span className="badge badge-mint">✅ Ready</span>
                              <span style={{ fontSize: 11, color: '#666', fontFamily: 'Inter' }}>
                                Updated {formatExactTime(item.updatedAt)}
                              </span>
                            </div>
                            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                              {item.title}
                            </h3>
                            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 14, lineHeight: 1.4 }}>
                              {item.description}
                            </p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                              <span className="badge badge-ink">{item.quiz.questions?.length || item.questionCount} Questions</span>
                              <span className="badge badge-sky">{item.language}</span>
                              <span className="badge badge-violet">{item.bloomLevel}</span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: ENABLE_GLOBAL_PUBLISH ? '1fr 1fr' : '1fr', gap: 8, borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
                            <button className="btn btn-sun btn-sm" style={{ fontWeight: 800 }} onClick={() => handleHostSavedQuiz(item)}>🚀 Host Game</button>
                            {ENABLE_GLOBAL_PUBLISH && (
                              <button className="btn btn-violet btn-sm" style={{ fontWeight: 800, color: '#fff' }} onClick={() => handlePublishGlobal(item)}>🌐 Publish Global</button>
                            )}
                            <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)' }} onClick={() => handleEditQuizInStudio(item)}>✏️ Edit</button>
                            <button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--cherry)', border: '1.5px solid var(--cherry)' }} onClick={() => handleDeleteQuiz(item.id)}>🗑️ Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: TEAMS & CREDENTIALS (new) ═══ */}
        {activeTab === 'teams' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                  👥 Teams &amp; Credentials
                </h2>
                <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                  Create competition teams and generate their day-of login credentials. {loggedInTeams} of {teams.length} teams logged in.
                </div>
              </div>
            </div>

            {/* Create team form */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 900, marginBottom: 12 }}>➕ Create Team</h3>
              <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Team Name</label>
                    <input
                      className="input"
                      value={createName}
                      onChange={e => setCreateName(e.target.value)}
                      placeholder="e.g. Phoenix Squad"
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Roster (leader first — comma / newline separated)</label>
                    <input
                      className="input"
                      value={createRoster}
                      onChange={e => setCreateRoster(e.target.value)}
                      placeholder="Alex, Priya, Jordan, Mei"
                    />
                  </div>
                </div>
                <div>
                  <button type="submit" className="btn btn-violet" style={{ color: '#fff' }}>⚡ Create &amp; Generate Credentials</button>
                  <span style={{ marginLeft: 12, fontSize: 12, color: '#666', fontFamily: 'Inter' }}>Username = team name · Password = team leader (first name in roster).</span>
                </div>
              </form>

              {credentialCard && (
                <div className="anim-scale-in" style={{ marginTop: 16, padding: 16, background: 'var(--paper)', border: '3px solid var(--mint)', borderRadius: 12, boxShadow: '4px 4px 0 var(--ink)' }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, marginBottom: 10, color: 'var(--ink)' }}>
                    🔑 Credentials for <strong>{credentialCard.teamName}</strong> — save for day-of handout
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="badge badge-ink">👤 {credentialCard.username}</span>
                    <span className="badge badge-sun">🔒 {credentialCard.password}</span>
                    <button className="btn btn-sm btn-mint" onClick={() => copyCreds(credentialCard.username, credentialCard.password)}>📋 Copy</button>
                    <button className="btn btn-sm" onClick={() => setCredentialCard(null)}>✕</button>
                  </div>
                </div>
              )}
            </div>

            {/* Bulk upload card */}
            <div className="card" style={{ padding: 20, marginBottom: 20, background: 'var(--paper-2)' }}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 900, marginBottom: 12 }}>📤 Bulk Upload (Excel / CSV)</h3>
              <div style={{ fontSize: 12.5, color: '#555', fontFamily: 'Inter', marginBottom: 12, lineHeight: 1.6 }}>
                Skip the manual entry — upload a spreadsheet with one row per team. Columns:{' '}
                <strong>Team Name</strong> (required) and <strong>Roster</strong> (team leader first, then members — comma / semicolon separated).
                Credentials: username = team name, password = first name in the roster (the team leader).
                <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={downloadTemplate}>⬇️ Download template</button>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="btn btn-sun" style={{ cursor: 'pointer', margin: 0 }}>
                  📂 Choose .xlsx / .csv file
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={handleUploadFile} style={{ display: 'none' }} />
                </label>
                {uploadFileName && <span style={{ fontSize: 13, fontFamily: 'Inter', color: '#333' }}>📄 {uploadFileName}</span>}
              </div>
              {uploadError && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--cherry)', fontFamily: 'Inter', fontWeight: 600 }}>⚠️ {uploadError}</div>
              )}
              {uploadTeams && uploadTeams.length > 0 && (
                <div className="anim-scale-in" style={{ marginTop: 14, padding: 14, background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 800, marginBottom: 8 }}>
                    🔎 {uploadTeams.length} team{uploadTeams.length === 1 ? '' : 's'} detected — review then create:
                  </div>
                  <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8, marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: 'Inter' }}>
                      <thead>
                        <tr style={{ background: 'var(--paper-2)', textAlign: 'left', fontFamily: 'Space Grotesk', textTransform: 'uppercase', fontSize: 11 }}>
                          <th style={{ padding: '8px 10px' }}>#</th>
                          <th style={{ padding: '8px 10px' }}>Team Name</th>
                          <th style={{ padding: '8px 10px' }}>Roster (members)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadTeams.map((t, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                            <td style={{ padding: '8px 10px', color: '#888' }}>{i + 1}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>{t.name}</td>
                            <td style={{ padding: '8px 10px', color: '#555' }}>{t.roster.length ? t.roster.join(', ') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button className="btn btn-violet" style={{ color: '#fff', fontWeight: 800 }} onClick={handleBulkCreate}>
                    ⚡ Create {uploadTeams.length} Team{uploadTeams.length === 1 ? '' : 's'} &amp; Generate Credentials
                  </button>
                  <button className="btn" style={{ marginLeft: 8 }} onClick={() => { setUploadTeams(null); setUploadFileName(''); setBulkResult(null); }}>✕ Cancel</button>
                </div>
              )}
              {bulkResult && (
                <div className="anim-scale-in" style={{ marginTop: 14, padding: 14, background: 'var(--paper)', border: '3px solid var(--mint)', borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 800, marginBottom: 6 }}>
                    ✅ Created {bulkResult.created.length} team{bulkResult.created.length === 1 ? '' : 's'}
                    {bulkResult.failed.length > 0 && <span style={{ color: 'var(--cherry)' }}> · {bulkResult.failed.length} failed</span>}
                  </div>
                  {bulkResult.created.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <button className="btn btn-sm btn-sun" onClick={downloadCredentialsCsv}>⬇️ Download credentials (.csv)</button>
                      <span style={{ marginLeft: 8, fontSize: 12, color: '#666', fontFamily: 'Inter' }}>Passwords are shown only once — download &amp; print for handout.</span>
                    </div>
                  )}
                  {bulkResult.failed.length > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--cherry)', fontFamily: 'Inter' }}>
                      {bulkResult.failed.map((f, i) => <div key={i}>• {f.name}: {f.error}</div>)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Teams table */}
            {teams.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Teams Yet</h3>
                <p style={{ fontSize: 14, color: '#666' }}>Create teams above to hand out credentials on the day.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--ink)', fontFamily: 'Space Grotesk', fontSize: 12, textTransform: 'uppercase' }}>
                      <th style={{ padding: 10 }}>Team</th>
                      <th style={{ padding: 10 }}>Code</th>
                      <th style={{ padding: 10 }}>Username</th>
                      <th style={{ padding: 10 }}>Roster</th>
                      <th style={{ padding: 10 }}>Status</th>
                      <th style={{ padding: 10 }}>Device</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid #eee', fontSize: 13, fontFamily: 'Inter' }}>
                        <td style={{ padding: 10, fontWeight: 800, fontFamily: 'Space Grotesk' }}>{t.name}</td>
                        <td style={{ padding: 10 }}><span className="badge badge-sun">{t.code}</span></td>
                        <td style={{ padding: 10, fontWeight: 600 }}>{t.username || '—'}</td>
                        <td style={{ padding: 10, fontSize: 12 }}>{(t.roster || []).join(', ')}</td>
                        <td style={{ padding: 10 }}>
                          <span className={`badge ${t.status === 'submitted' ? 'badge-violet' : t.status === 'waiting' ? 'badge-ink' : 'badge-mint'}`}>{t.status}</span>
                        </td>
                        <td style={{ padding: 10, fontSize: 12, color: t.device_id ? '#333' : '#999' }}>
                          {t.device_id ? `📱 ${t.device_id.slice(0, 12)}…` : 'Not bound'}
                        </td>
                        <td style={{ padding: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button className="btn btn-sm btn-sun" style={{ marginRight: 6 }} onClick={() => handleResetPassword(t)}>🔑 Reset</button>
                          <button className="btn btn-sm" style={{ marginRight: 6, background: 'var(--paper-2)' }} onClick={() => handleReleaseTeam(t)}>🔓 Release</button>
                          <button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--cherry)', border: '1.5px solid var(--cherry)' }} onClick={() => handleDeleteTeam(t)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: LIVE LEADERBOARD (new) ═══ */}
        {activeTab === 'leaderboard' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                  🏆 Live Leaderboard
                </h2>
                <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                  Real-time standings for the active competition game (auto-refreshes every 2s).
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, color: '#555' }}>GAME ID</label>
                <input
                  className="input"
                  style={{ width: 130, textTransform: 'uppercase' }}
                  value={lbGameId}
                  onChange={e => setLbGameId(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            {lbData.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🏆</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Standings Yet</h3>
                <p style={{ fontSize: 14, color: '#666' }}>Create the game and start playing to populate the leaderboard.</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 760 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--ink)', fontFamily: 'Space Grotesk', fontSize: 12, textTransform: 'uppercase' }}>
                      <th style={{ padding: 10 }}>#</th>
                      <th style={{ padding: 10 }}>Team</th>
                      <th style={{ padding: 10 }}>Points</th>
                      <th style={{ padding: 10 }}>Coins</th>
                      <th style={{ padding: 10 }}>Streak</th>
                      <th style={{ padding: 10 }}>Correct</th>
                      <th style={{ padding: 10 }}>Frenzy</th>
                      <th style={{ padding: 10 }}>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lbData.map(row => (
                      <tr key={row.team_id} style={{ borderBottom: '1px solid #eee', fontSize: 13, fontFamily: 'Inter', background: row.rank <= 3 ? 'rgba(255, 214, 10, 0.12)' : undefined }}>
                        <td style={{ padding: 10, fontWeight: 900, fontFamily: 'Space Grotesk' }}>
                          {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
                        </td>
                        <td style={{ padding: 10, fontWeight: 800 }}>{row.name || row.code}</td>
                        <td style={{ padding: 10, fontWeight: 800, color: 'var(--violet)' }}>{row.points.toLocaleString()}</td>
                        <td style={{ padding: 10 }}>🪙 {row.coins}</td>
                        <td style={{ padding: 10 }}>🔥 {row.streak}</td>
                        <td style={{ padding: 10 }}>{row.total_correct}/{row.total_answered}</td>
                        <td style={{ padding: 10 }}>{row.frenzy_correct_count}</td>
                        <td style={{ padding: 10 }}>{row.violation_count > 0 ? <span className="badge badge-cherry">⚑ {row.violation_count}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: DAY-OF CONTROLS (new) ═══ */}
        {activeTab === 'controls' && (
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>
              🎛️ Day-of Controls
            </h2>
            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 20 }}>
              Control when students can log in. The manual toggle wins over the schedule.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
              {/* Gate toggle */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 900, marginBottom: 10 }}>🔓 Login Gate</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <span className={`badge ${eventCfg?.login_open ? 'badge-mint' : 'badge-cherry'}`} style={{ fontSize: 13 }}>
                    {eventCfg?.login_open ? '● OPEN' : '● CLOSED'}
                  </span>
                  <span style={{ fontSize: 13, fontFamily: 'Inter', color: '#555' }}>
                    {loggedInTeams} / {teams.length} teams logged in
                  </span>
                </div>
                <button
                  className={`btn ${eventCfg?.login_open ? 'btn-cherry' : 'btn-mint'}`}
                  style={{ width: '100%', fontWeight: 800 }}
                  onClick={() => handleToggleGate(!eventCfg?.login_open)}
                >
                  {eventCfg?.login_open ? '🔒 Close Student Login' : '🔓 Open Student Login'}
                </button>
              </div>

              {/* Schedule */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 900, marginBottom: 10 }}>🗓️ Schedule (optional)</h3>
                <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Login opens at</label>
                    <input type="datetime-local" className="input" value={opensInput} onChange={e => setOpensInput(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Login closes at</label>
                    <input type="datetime-local" className="input" value={closesInput} onChange={e => setClosesInput(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-sun" style={{ fontWeight: 800 }}>💾 Save Schedule</button>
                </form>
              </div>
            </div>

            <div className="card" style={{ marginTop: 20, padding: 20, background: 'var(--paper-2)' }}>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 900, marginBottom: 8 }}>ℹ️ How the gate works</h3>
              <ul style={{ fontSize: 13, fontFamily: 'Inter', color: '#444', lineHeight: 1.8, paddingLeft: 18 }}>
                <li><strong>Before opens_at:</strong> students see "Login opens at &lt;time&gt;" and cannot log in.</li>
                <li><strong>Between opens_at and closes_at (or toggle ON):</strong> students can log in and play.</li>
                <li><strong>After closes_at (toggle OFF):</strong> students see the final-standings-only screen.</li>
              </ul>
            </div>
          </div>
        )}

        {/* ═══ TAB: ACTIVE GAME (new) ═══ */}
        {activeTab === 'game' && (
          <div>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>
              🎮 Active Game Control
            </h2>
            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 20 }}>
              Create the competition game — every team's session is registered automatically and students land in the lobby.
            </p>

            {/* Game setup */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Quiz</label>
                  <select className="input" value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}>
                    {allQuizzes.map(q => (
                      <option key={q.id} value={q.id}>{q.title} ({q.quiz.questions?.length || q.questionCount} Q)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Mode</label>
                  <select className="input" value={gameMode} onChange={e => setGameMode(e.target.value)}>
                    <option value="classic">🎯 Classic</option>
                    <option value="boss_raid">🐉 Boss Raid</option>
                    <option value="tournament">🏆 Tournament</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>Game ID</label>
                  <input className="input" style={{ textTransform: 'uppercase' }} value={gameId} onChange={e => setGameId(e.target.value.toUpperCase())} placeholder="EVENT" />
                </div>
              </div>
              <button className="btn btn-violet" style={{ color: '#fff', fontWeight: 800 }} onClick={handleCreateGame}>⚡ Create / Replace Game</button>
            </div>

            {/* Live game status */}
            {liveGame ? (
              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 900, color: 'var(--ink)' }}>
                      {liveGame.id} <span className="badge badge-ink">{liveGame.mode}</span>
                    </h3>
                    <div style={{ fontSize: 12, color: '#555', fontFamily: 'Inter', marginTop: 4 }}>
                      {teamsInGame} teams registered · Question {Math.max(0, liveGame.current_question_index) + 1} / {liveGame.quiz?.questions?.length || 0}
                    </div>
                  </div>
                  <span className={`badge ${liveGame.status === 'question_active' || liveGame.status === 'boss_frenzy' ? 'badge-cherry' : liveGame.status === 'ended' ? 'badge-violet' : 'badge-sun'}`} style={{ fontSize: 13 }}>
                    {liveGame.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {['start', 'next', 'reveal', 'leaderboard', 'end'].map(action => (
                    <button key={action} className="btn btn-sm" style={{ background: 'var(--paper-2)', border: '2px solid var(--ink)', boxShadow: '2px 2px 0 var(--ink)', fontWeight: 800 }}
                      onClick={() => handleAdvance(action)}>
                      {action === 'start' ? '▶ Start' : action === 'next' ? '⏭ Next' : action === 'reveal' ? '👁 Reveal' : action === 'leaderboard' ? '🏆 Board' : '🏁 End'}
                    </button>
                  ))}
                  {liveGame.status !== 'boss_frenzy' && (
                    <button className="btn btn-sm" style={{ background: '#111', color: '#FF4B5C', border: '2px solid #FF4B5C', boxShadow: '2px 2px 0 var(--ink)', fontWeight: 800 }} onClick={() => handleBoss('start')}>
                      💥 Boss Frenzy
                    </button>
                  )}
                  {liveGame.status === 'boss_frenzy' && (
                    <button className="btn btn-sm" style={{ background: '#111', color: '#FF4B5C', border: '2px solid #FF4B5C', boxShadow: '2px 2px 0 var(--ink)', fontWeight: 800 }} onClick={() => handleBoss('finalize')}>
                      🏁 Finalize Boss
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎮</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Game Loaded</h3>
                <p style={{ fontSize: 14, color: '#666' }}>Create the game above, then open student login from the Day-of Controls tab.</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: HOSTED SESSIONS (existing) ═══ */}
        {activeTab === 'history' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                  📊 Hosted Quizzes &amp; Session History
                </h2>
                <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                  Track every live room session hosted so far, including exact launch/end timestamps, participant scores, and multi-run history.
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, background: 'var(--paper)', padding: 4, borderRadius: 10, border: '2px solid var(--ink)' }}>
                <button
                  onClick={() => setHistoryViewMode('timeline')}
                  className="btn btn-sm"
                  style={{
                    fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12,
                    background: historyViewMode === 'timeline' ? 'var(--sun)' : 'transparent',
                    border: historyViewMode === 'timeline' ? '1.5px solid var(--ink)' : 'none'
                  }}
                >
                  🕒 All Runs Timeline
                </button>
                <button
                  onClick={() => setHistoryViewMode('grouped')}
                  className="btn btn-sm"
                  style={{
                    fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12,
                    background: historyViewMode === 'grouped' ? 'var(--violet)' : 'transparent',
                    color: historyViewMode === 'grouped' ? '#fff' : 'var(--ink)',
                    border: historyViewMode === 'grouped' ? '1.5px solid var(--ink)' : 'none'
                  }}
                >
                  📚 Grouped by Quiz ({Object.keys(groupedHistoryMap).length})
                </button>
              </div>
            </div>

            {history.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎮</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Game Sessions Hosted Yet</h3>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>Host a quiz from Studio or Preset cards to record live classroom sessions and student analytics.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: selectedHistory ? '1fr 440px' : '1fr', gap: 20 }}>
                {historyViewMode === 'timeline' && (
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, marginBottom: 12, color: '#666' }}>
                      Showing all {history.length} hosted session runs (newest first)
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--ink)', fontFamily: 'Space Grotesk', fontSize: 12, textTransform: 'uppercase' }}>
                          <th style={{ padding: 10 }}>PIN</th>
                          <th style={{ padding: 10 }}>Quiz Title</th>
                          <th style={{ padding: 10 }}>Launched Time</th>
                          <th style={{ padding: 10 }}>Ended Time</th>
                          <th style={{ padding: 10 }}>Duration</th>
                          <th style={{ padding: 10 }}>Players</th>
                          <th style={{ padding: 10 }}>Accuracy</th>
                          <th style={{ padding: 10 }}>Winner</th>
                          <th style={{ padding: 10, textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map(rec => (
                          <tr key={rec.id} style={{ borderBottom: '1px solid #eee', fontSize: 13, fontFamily: 'Inter' }}>
                            <td style={{ padding: 10, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                              <span className="badge badge-sun">{rec.pin}</span>
                            </td>
                            <td style={{ padding: 10, fontWeight: 700 }}>{rec.quizTitle}</td>
                            <td style={{ padding: 10, color: '#333', fontSize: 12, fontWeight: 600 }}>
                              {formatExactTime(rec.startedAt || (rec.completedAt - 600000))}
                            </td>
                            <td style={{ padding: 10, color: '#666', fontSize: 12 }}>
                              {formatExactTime(rec.completedAt)}
                            </td>
                            <td style={{ padding: 10, fontSize: 12, fontWeight: 700, color: 'var(--violet)' }}>
                              ⏱️ {formatDuration(rec.startedAt, rec.completedAt, rec.durationMs)}
                            </td>
                            <td style={{ padding: 10, fontWeight: 700 }}>👥 {rec.totalPlayers}</td>
                            <td style={{ padding: 10 }}>
                              <span className={`badge ${rec.classAccuracyPercent >= 70 ? 'badge-mint' : 'badge-cherry'}`}>
                                🎯 {rec.classAccuracyPercent}%
                              </span>
                            </td>
                            <td style={{ padding: 10, fontWeight: 700, color: 'var(--violet)' }}>
                              👑 {rec.winnerName} ({rec.winnerScore.toLocaleString()} pts)
                            </td>
                            <td style={{ padding: 10, textAlign: 'right' }}>
                              <button
                                className="btn btn-sm btn-violet"
                                onClick={() => setSelectedHistory(rec)}
                              >
                                🔍 Full Report
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {historyViewMode === 'grouped' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {Object.entries(groupedHistoryMap).map(([title, runs]) => {
                      const isExpanded = expandedQuizTitle === title || Object.keys(groupedHistoryMap).length === 1
                      const latestRun = runs[0]
                      return (
                        <div key={title} className="card" style={{ padding: 20 }}>
                          <div
                            onClick={() => setExpandedQuizTitle(isExpanded ? null : title)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                <span className="badge badge-sun font-extrabold">
                                  🎮 Hosted {runs.length} {runs.length === 1 ? 'Time' : 'Times'}
                                </span>
                                <span style={{ fontSize: 12, color: '#666', fontFamily: 'Inter' }}>
                                  Latest Run: {formatExactTime(latestRun.completedAt)}
                                </span>
                              </div>
                              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                                {title}
                              </h3>
                            </div>
                            <button className="btn btn-sm btn-sun">
                              {isExpanded ? '▲ Hide Runs' : `▼ View ${runs.length} Runs`}
                            </button>
                          </div>

                          {isExpanded && (
                            <div style={{ marginTop: 16, borderTop: '2px dashed var(--ink)', paddingTop: 14 }}>
                              <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, marginBottom: 10, color: 'var(--violet)' }}>
                                📋 All {runs.length} Hosted Runs for &quot;{title}&quot;:
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {runs.map((run, idx) => (
                                  <div key={run.id} style={{ background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 12, padding: 14 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="badge badge-ink font-bold">Run #{runs.length - idx}</span>
                                        <span className="badge badge-sun">PIN {run.pin}</span>
                                        <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--violet)' }}>
                                          ⏱️ {formatDuration(run.startedAt, run.completedAt, run.durationMs)}
                                        </span>
                                      </div>
                                      <button
                                        className="btn btn-sm btn-violet"
                                        onClick={(e) => { e.stopPropagation(); setSelectedHistory(run); }}
                                      >
                                        🔍 Inspect Roster &amp; Scores
                                      </button>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, fontSize: 12, fontFamily: 'Inter' }}>
                                      <div>🚀 <strong>Launched:</strong> {formatExactTime(run.startedAt || (run.completedAt - 600000))}</div>
                                      <div>🏁 <strong>Ended:</strong> {formatExactTime(run.completedAt)}</div>
                                      <div>👥 <strong>Players:</strong> {run.totalPlayers} Students</div>
                                      <div>🎯 <strong>Class Acc:</strong> {run.classAccuracyPercent}%</div>
                                      <div>👑 <strong>Winner:</strong> {run.winnerName} ({run.winnerScore.toLocaleString()} pts)</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {selectedHistory && (
                  <div className="card anim-scale-in" style={{ padding: 22, background: 'var(--paper)', border: '3px solid var(--ink)', boxShadow: '6px 6px 0 var(--ink)', height: 'fit-content' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 19, fontWeight: 900 }}>
                        📊 Session Analytics (PIN {selectedHistory.pin})
                      </h3>
                      <button onClick={() => setSelectedHistory(null)} style={{ background: 'none', border: 'none', fontSize: 22, fontWeight: 900, cursor: 'pointer' }}>✕</button>
                    </div>

                    <div style={{ fontSize: 13, color: '#444', fontFamily: 'Inter', marginBottom: 14, lineHeight: 1.4 }}>
                      <strong>{selectedHistory.quizTitle}</strong>
                      <div style={{ fontSize: 11.5, color: '#666', marginTop: 4 }}>
                        🚀 Launched: {formatExactTime(selectedHistory.startedAt || (selectedHistory.completedAt - 600000))}<br/>
                        🏁 Ended: {formatExactTime(selectedHistory.completedAt)} ({formatDuration(selectedHistory.startedAt, selectedHistory.completedAt, selectedHistory.durationMs)})
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <div style={{ background: '#FFF8E1', padding: 12, borderRadius: 10, border: '2px solid var(--ink)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, color: '#666' }}>CLASS ACCURACY</div>
                        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Space Grotesk', color: 'var(--ink)' }}>{selectedHistory.classAccuracyPercent}%</div>
                      </div>
                      <div style={{ background: '#E8F8F5', padding: 12, borderRadius: 10, border: '2px solid var(--ink)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, color: '#666' }}>TOP WINNER</div>
                        <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'Space Grotesk', color: 'var(--violet)' }}>👑 {selectedHistory.winnerName}</div>
                      </div>
                    </div>

                    <h4 style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 900, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>🏅 Student Roster &amp; Scores ({selectedHistory.playersSummary?.length || 0})</span>
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', marginBottom: 16, paddingRight: 4 }}>
                      {selectedHistory.playersSummary?.map(p => (
                        <div key={p.nickname} className="lb-row" style={{ padding: '8px 10px', fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1.5px solid var(--ink)', borderRadius: 8 }}>
                          <span style={{ fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                            #{p.rank} {p.nickname}
                          </span>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, color: 'var(--violet)' }}>{p.score.toLocaleString()} pts</span>
                            <span style={{ fontSize: 10, color: '#666', marginLeft: 6 }}>({p.totalCorrect}/{p.totalAnswered} · {p.accuracyPercent}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <h4 style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 900, marginBottom: 8 }}>
                      🎯 Question-by-Question Accuracy
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', paddingRight: 4 }}>
                      {selectedHistory.questionStats?.map((qs, i) => (
                        <div key={i} style={{ padding: 10, background: 'var(--paper-2)', borderRadius: 8, border: '1.5px solid var(--ink)', fontSize: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Q{i + 1}: {qs.prompt}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#666' }}>{qs.correctCount}/{qs.totalResponses} Correct Responses</span>
                            <span className={`badge ${qs.accuracyPercent >= 70 ? 'badge-mint' : 'badge-cherry'}`} style={{ fontSize: 10 }}>
                              {qs.accuracyPercent}% Acc
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ TAB: PROFILE (existing) ═══ */}
        {activeTab === 'profile' && (
          <div className="card anim-scale-in" style={{ maxWidth: 540, margin: '0 auto', padding: 28 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>
              👤 Admin Profile &amp; Preferences
            </h2>
            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 20 }}>
              Update your display name, school institution, and event profile.
            </p>

            {saveSuccess && (
              <div className="badge badge-mint" style={{ display: 'block', padding: 10, textAlign: 'center', marginBottom: 16, fontSize: 13 }}>
                ✅ Profile updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                  Admin Display Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                  School / Institution
                </label>
                <input
                  type="text"
                  className="input"
                  value={profileSchool}
                  onChange={e => setProfileSchool(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                  Admin Email (Read Only)
                </label>
                <input
                  type="email"
                  className="input"
                  value={user.email}
                  disabled
                  style={{ opacity: 0.6, background: '#eee' }}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 10, padding: '14px' }}>
                💾 Save Profile Changes
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
