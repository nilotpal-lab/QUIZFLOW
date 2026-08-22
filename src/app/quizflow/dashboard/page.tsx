'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getHostUser, logoutHostAsync, updateHostProfile, initAuthSync, type HostUser } from '@/quizflow/authStore'
import { getSavedQuizzes, deleteSavedQuiz, saveQuizDraft, type SavedQuizItem } from '@/quizflow/quizStore'
import { getSessionHistory, type SessionHistoryRecord } from '@/quizflow/historyStore'
import { createSession } from '@/quizflow/sessionStore'
import { publishQuizToCommunity } from '@/quizflow/communityStore'
import { getSupabase } from '@/quizflow/supabaseClient'
import { parseQuizFromSpreadsheet } from '@/quizflow/excelQuizParser'
import { exportLeaderboardToCSV } from '@/quizflow/exportCsv'
import { adminFetch } from '@/quizflow/adminFetch'
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
  return n === 'team' || n === 'name' || n === 'team name' || n === 'teamname' || n === 'group' || n === 'group name' || n === 'class' || (n.includes('team') && n.includes('name')) || n === 'username'
}
function isLeaderColumn(h: any): boolean {
  const n = normalizeHeader(h)
  return n === 'leader' || n === 'team leader' || n === 'teamleader' || n === 'captain' || n === 'leader name' || n === 'head' || n === 'lead' || n.includes('leader') || n.includes('captain')
}
function isRosterColumn(h: any): boolean {
  const n = normalizeHeader(h)
  return n === 'roster' || n === 'members' || n === 'member' || n === 'member names' || n === 'members names' || n === 'team members' || n === 'students' || n === 'student names' || n === 'names' || n === 'players' || n === 'teammates' || n.includes('member') || n.includes('roster') || n.includes('student') || n.includes('teammate')
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

function isPasswordColumn(h: any): boolean {
  const n = normalizeHeader(h)
  return n === 'password' || n === 'pass' || n === 'team password' || n === 'leader password' || n === 'pin'
}

/** Map spreadsheet rows → teams, auto-detecting Google Form headers & columns. */
function rowsToTeams(rows: string[][]): { name: string; roster: string[]; password?: string }[] {
  let headerIdx = -1
  let nameCol = -1
  let leaderCol = -1
  let passwordCol = -1
  let rosterCols: number[] = []

  for (let r = 0; r < rows.length; r++) {
    const ni = rows[r].findIndex(isNameColumn)
    if (ni >= 0) {
      headerIdx = r
      nameCol = ni
      leaderCol = rows[r].findIndex((c, i) => i !== ni && isLeaderColumn(c))
      passwordCol = rows[r].findIndex((c, i) => i !== ni && i !== leaderCol && isPasswordColumn(c))
      rosterCols = rows[r].map((c, i) => (i !== ni && i !== leaderCol && i !== passwordCol && isRosterColumn(c)) ? i : -1).filter(i => i >= 0)
      break
    }
  }

  if (headerIdx < 0) return []
  const teams: { name: string; roster: string[]; password?: string }[] = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const name = String(row[nameCol] ?? '').trim()
    if (!name) continue

    const customPass = passwordCol >= 0 ? String(row[passwordCol] ?? '').trim() : undefined
    const roster: string[] = []

    if (customPass) {
      roster.push(customPass)
    } else if (leaderCol >= 0) {
      const leader = String(row[leaderCol] ?? '').trim()
      if (leader) roster.push(leader)
    }

    if (rosterCols.length > 0) {
      for (const col of rosterCols) {
        const cell = String(row[col] ?? '').trim()
        if (!cell) continue
        const members = cell.split(/[\n,;|]+/).map(s => s.trim()).filter(Boolean)
        for (const m of members) {
          if (!roster.includes(m)) roster.push(m)
        }
      }
    } else if (leaderCol < 0 && passwordCol < 0) {
      // Fallback: search remaining columns if no explicit leader/password/roster columns matched
      for (let i = 0; i < row.length; i++) {
        if (i !== nameCol) {
          const cell = String(row[i] ?? '').trim()
          if (cell && !cell.includes('@') && !cell.match(/^\d{4}-\d{2}-\d{2}/)) {
            const members = cell.split(/[\n,;|]+/).map(s => s.trim()).filter(Boolean)
            for (const m of members) {
              if (!roster.includes(m)) roster.push(m)
            }
          }
        }
      }
    }

    // Default roster to [name] if empty
    if (roster.length === 0) {
      roster.push(name)
    }

    teams.push({ name, roster, password: customPass })
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
  const [previewQuiz, setPreviewQuiz] = useState<SavedQuizItem | null>(null)
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
  const [teamSearch, setTeamSearch] = useState('')
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
  const [totalRegisteredTeams, setTotalRegisteredTeams] = useState(0)
  const [claimedTeamsCount, setClaimedTeamsCount] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [waitingTeams, setWaitingTeams] = useState<any[]>([])
  const [offlineTeams, setOfflineTeams] = useState<any[]>([])
  const [teamsStatus, setTeamsStatus] = useState<any[]>([])
  const [isProjectorMode, setIsProjectorMode] = useState(false)
  const [isFullscreenLeaderboard, setIsFullscreenLeaderboard] = useState(false)
  const [unhideHostKey, setUnhideHostKey] = useState(false)
  const [showGameSetup, setShowGameSetup] = useState(false)
  const [hostElapsedSec, setHostElapsedSec] = useState(0)
  const [revealCountdown, setRevealCountdown] = useState(3)
  const autoActionFiredRef = useRef<string>('')
  const revealStartedAtRef = useRef<number | null>(null)
  const [clockOffset, setClockOffset] = useState(0)
  const clockOffsetSamples = useRef<number[]>([])
  const [printPassesModal, setPrintPassesModal] = useState(false)
  const [teamFilterStatus, setTeamFilterStatus] = useState<'all' | 'arena' | 'lobby' | 'offline'>('all')
  const [busy, setBusy] = useState('')

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const tabParam = searchParams.get('tab') as Tab | null
    if (tabParam && ['quizzes', 'teams', 'leaderboard', 'controls', 'game', 'history', 'profile'].includes(tabParam)) {
      setActiveTab(tabParam)
    }

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
      setOpensInput(res.body.config.opens_at ? toLocalInput(res.body.config.opens_at) : '')
      setClosesInput(res.body.config.closes_at ? toLocalInput(res.body.config.closes_at) : '')
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'teams' || activeTab === 'controls' || activeTab === 'game') {
      loadTeams()
      loadEventConfig()
    }
  }, [activeTab, loadTeams, loadEventConfig])

  /* ── Server clock sync for accurate host timer ── */
  useEffect(() => {
    let cancelled = false
    const syncClock = async () => {
      try {
        const clientBefore = Date.now()
        const res = await fetch(`/api/quiz/game?game_id=${encodeURIComponent(gameId.trim().toUpperCase())}&_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        })
        if (!res.ok) return
        const data = await res.json()
        const clientAfter = Date.now()
        // Use server_time from game state if available, otherwise use current time
        const serverTime = data?.game?.created_at ? new Date(data.game.created_at).getTime() : clientAfter
        const roundTrip = clientAfter - clientBefore
        const estimatedServerNow = serverTime + roundTrip / 2
        const offset = estimatedServerNow - clientAfter
        clockOffsetSamples.current.push(offset)
        if (clockOffsetSamples.current.length > 5) clockOffsetSamples.current.shift()
        const sorted = [...clockOffsetSamples.current].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        if (Math.abs(median) < 5000 && !cancelled) {
          setClockOffset(median)
        }
      } catch {}
    }
    syncClock()
    const t = setInterval(syncClock, 10000)
    return () => { cancelled = true; clearInterval(t) }
  }, [gameId])

  /* Live leaderboard poll + Supabase Realtime push (instant <30ms sync) */
  /* Runs when: leaderboard tab is active OR fullscreen overlay is open (F key from any tab) */
  useEffect(() => {
    if (activeTab !== 'leaderboard' && !isFullscreenLeaderboard) return
    const id = (liveGame?.id || lbGameId || 'EVENT').trim().toUpperCase()
    if (!id) return
    let cancelled = false
    let debounceTimer: any = null

    const tick = async () => {
      const res = await adminFetch(`/api/admin/leaderboard?game_id=${encodeURIComponent(id)}`)
      if (!cancelled) {
        if (res.ok && res.body?.leaderboard) setLbData(res.body.leaderboard)
        else setLbData([])
      }
    }

    const debouncedTick = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!cancelled) tick()
      }, 100)
    }

    // Fetch immediately on open so the fullscreen view shows live data right away
    tick()
    // High-speed fallback poll every 1s
    const t = setInterval(tick, 1000)

    // Subscribe to Supabase Realtime (Broadcast + Postgres for sub-100ms push)
    let sbSub: any = null
    try {
      const sb = getSupabase()
      if (sb) {
        const channel = sb.channel(`qf_lb_${id}`, {
          config: { broadcast: { self: false } }
        })
        sbSub = channel
        channel
          .on('broadcast', { event: 'state_sync' }, debouncedTick)
          .on('broadcast', { event: 'game_advanced' }, debouncedTick)
          .on('broadcast', { event: 'score_updated' }, debouncedTick)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions' }, debouncedTick)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, debouncedTick)
          .subscribe()
      }
    } catch { /* graceful fallback to poll only */ }

    return () => {
      cancelled = true
      clearInterval(t)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (sbSub && getSupabase()) {
        try { getSupabase()!.removeChannel(sbSub) } catch {}
      }
    }
  }, [activeTab, isFullscreenLeaderboard, lbGameId, liveGame?.id])

  /* Active game poll (via authenticated admin API) + Supabase Realtime push */
  useEffect(() => {
    if (activeTab !== 'game' && activeTab !== 'teams') return
    const id = (liveGame?.id || gameId || 'EVENT').trim().toUpperCase()
    if (!id) return
    let cancelled = false
    let debounceTimer: any = null

    const tick = async () => {
      const res = await adminFetch(`/api/quiz/game?game_id=${encodeURIComponent(id)}`)
      if (!cancelled && res.ok && res.body?.success) {
        setLiveGame(res.body.game || null)
        setTeamsInGame(res.body.active_sessions_count || 0)
        setTotalRegisteredTeams(res.body.total_registered_teams || 0)
        setClaimedTeamsCount(res.body.claimed_teams_count || 0)
        setAnsweredCount(res.body.answered_count || 0)
        setWaitingTeams(res.body.waiting_teams || [])
        setOfflineTeams(res.body.offline_teams || [])
        setTeamsStatus(res.body.teams_status || [])
      }
    }

    const debouncedTick = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        if (!cancelled) tick()
      }, 100)
    }

    tick()
    // High-speed fallback poll
    const t = setInterval(tick, 1000)

    // Subscribe to Supabase Realtime (both Broadcast & Postgres Changes for zero delay)
    let sbSub: any = null
    try {
      const sb = getSupabase()
      if (sb) {
        const channel = sb.channel(`qf_room_${id}`, {
          config: { broadcast: { self: false } }
        })
        sbSub = channel
        channel
          .on('broadcast', { event: 'state_sync' }, debouncedTick)
          .on('broadcast', { event: 'game_advanced' }, debouncedTick)
          .on('broadcast', { event: 'powerup_effect' }, debouncedTick)
          .on('broadcast', { event: 'score_updated' }, debouncedTick)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_sessions' }, debouncedTick)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, debouncedTick)
          .subscribe()
      }
    } catch { /* graceful fallback to poll only */ }

    return () => {
      cancelled = true
      clearInterval(t)
      if (debounceTimer) clearTimeout(debounceTimer)
      if (sbSub && getSupabase()) {
        try { getSupabase()!.removeChannel(sbSub) } catch {}
      }
    }
  }, [activeTab, gameId, liveGame?.id])

  /* Host 30s Countdown + 3s Break — Always-On Auto-Pacing Engine */
  useEffect(() => {
    if (!liveGame || liveGame.is_paused) return

    // 1. Question Active Phase (30s Countdown)
    if (liveGame.status === 'question_active' && liveGame.question_started_at) {
      revealStartedAtRef.current = null
      const tickActive = () => {
        const started = new Date(liveGame.question_started_at).getTime()
        const sec = Math.max(0, Math.floor(((Date.now() + clockOffset) - started) / 1000))
        setHostElapsedSec(sec)
        
        // Auto-advance to reveal after 30s (ALWAYS — no toggle needed)
        if (sec >= 30) {
          const actionKey = `reveal_${liveGame.current_question_index}`
          if (autoActionFiredRef.current !== actionKey) {
            autoActionFiredRef.current = actionKey
            handleAdvance('reveal')
          }
        }
      }
      tickActive()
      const t = setInterval(tickActive, 400)
      return () => clearInterval(t)
    }

    // 2. Question Reveal Phase (3s Break — answer reveal + countdown)
    if (liveGame.status === 'question_reveal') {
      if (revealStartedAtRef.current === null) {
        revealStartedAtRef.current = Date.now()
      }
      const tickReveal = () => {
        const elapsedSinceReveal = Math.floor((Date.now() - (revealStartedAtRef.current || Date.now())) / 1000)
        const remaining = Math.max(0, 3 - elapsedSinceReveal)
        setRevealCountdown(remaining)

        // Auto-advance to next question after 3s (ALWAYS — no toggle needed)
        if (remaining <= 0) {
          const actionKey = `next_${liveGame.current_question_index}`
          if (autoActionFiredRef.current !== actionKey) {
            autoActionFiredRef.current = actionKey
            revealStartedAtRef.current = null
            handleAdvance('next')
          }
        }
      }
      tickReveal()
      const t = setInterval(tickReveal, 300)
      return () => clearInterval(t)
    }

    // Other statuses
    setHostElapsedSec(0)
    revealStartedAtRef.current = null
  }, [liveGame?.status, liveGame?.is_paused, liveGame?.question_started_at, liveGame?.current_question_index, clockOffset])

  /* Host keyboard shortcuts ([Space] -> Next Action, [P] -> Pause/Resume, [N] -> Next Question, [M] -> Projector Mode, [F] -> Fullscreen Leaderboard) */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.code === 'Space' && activeTab === 'game') {
        e.preventDefault()
        if (!liveGame) return
        if (liveGame.status === 'lobby') handleAdvance('start')
        else if (liveGame.status === 'question_active') handleAdvance('reveal')
        else if (liveGame.status === 'question_reveal') handleAdvance('leaderboard')
        else if (liveGame.status === 'leaderboard') handleAdvance('next')
      } else if (e.key === 'p' || e.key === 'P') {
        if (activeTab === 'game' && liveGame) {
          handleAdvance(liveGame.is_paused ? 'resume' : 'pause')
        }
      } else if (e.key === 'n' || e.key === 'N') {
        if (activeTab === 'game' && liveGame) {
          handleAdvance('next')
        }
      } else if (e.key === 'm' || e.key === 'M') {
        if (activeTab === 'game') setIsProjectorMode(v => !v)
      } else if (e.key === 'f' || e.key === 'F') {
        setIsFullscreenLeaderboard(v => !v)
      } else if (e.key === 'Escape') {
        setIsProjectorMode(false)
        setIsFullscreenLeaderboard(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, liveGame])

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

  const handleHostSavedQuiz = async (item: SavedQuizItem) => {
    setSelectedQuizId(item.id)
    const id = (gameId.trim() || 'EVENT').toUpperCase()
    setBusy('Creating game…')
    const res = await adminFetch('/api/quiz/game', {
      method: 'POST',
      body: JSON.stringify({ game_id: id, quiz: item.quiz, mode: gameMode })
    })
    setBusy('')
    if (res.ok) {
      showToast(`✅ Game ${id} created — ${res.body.question_count} questions. Students can now join the lobby.`)
      setActiveTab('game')
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to create game.'}`)
    }
  }

  const handleEditQuizInStudio = (item: SavedQuizItem) => {
    localStorage.setItem('qf_saved_quiz', JSON.stringify(item.quiz))
    localStorage.setItem('qf_editing_quiz_id', item.id)
    router.push('/quizflow/studio?mode=edit')
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
    if (res.ok) showToast(`✅ ${team.name} released from device. They can now log in anywhere!`)
    else showToast(`❌ ${res.body?.error || 'Failed to release.'}`)
    loadTeams()
  }

  const handleReleaseAllDevices = async () => {
    const boundTeams = teams.filter(t => t.device_id)
    if (boundTeams.length === 0) {
      showToast('ℹ️ No teams are currently bound to devices.')
      return
    }
    if (!confirm(`Release device binding for all ${boundTeams.length} bound teams? All teams will be allowed to log in on new devices.`)) return
    setBusy('Releasing all devices…')
    let releasedCount = 0
    for (const t of boundTeams) {
      const res = await adminFetch(`/api/admin/teams/${t.id}/release`, { method: 'POST' })
      if (res.ok) releasedCount++
    }
    setBusy('')
    showToast(`✅ Released ${releasedCount} team device bindings!`)
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

  const handlePurgeAllTeams = async () => {
    if (teams.length === 0) {
      showToast('ℹ️ No registered teams to delete.')
      return
    }
    if (!confirm(`⚠️ Are you sure you want to DELETE ALL ${teams.length} registered teams?\n\nThis will permanently remove all team credentials and active game sessions!`)) return
    setBusy('Purging all teams…')
    const res = await adminFetch('/api/admin/teams', { method: 'DELETE' })
    setBusy('')
    if (res.ok) {
      showToast('🗑️ All teams permanently deleted.')
      loadTeams()
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to delete all teams.'}`)
    }
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
      if (res.body?.config) {
        setEventCfg(res.body.config)
      } else {
        setEventCfg(prev => prev ? { ...prev, login_open: open } : { login_open: open, opens_at: null, closes_at: null })
      }
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
    if (action === 'start' && teamsInGame === 0) {
      if (!confirm('No teams have logged into the arena lobby yet. Are you sure you want to start the game now?')) {
        return
      }
    }
    if (action === 'next') {
      setUnhideHostKey(false)
    }
    setBusy(`Advancing: ${action}…`)
    const res = await adminFetch('/api/quiz/game/advance', {
      method: 'POST',
      body: JSON.stringify({ game_id: id, action })
    })
    setBusy('')
    if (res.ok) {
      // Immediately refresh live game state without waiting for poll tick
      const stateRes = await adminFetch(`/api/quiz/game?game_id=${encodeURIComponent(id)}`)
      if (stateRes.ok && stateRes.body?.success) {
        setLiveGame(stateRes.body.game || null)
        setTeamsInGame(stateRes.body.active_sessions_count || 0)
        setTotalRegisteredTeams(stateRes.body.total_registered_teams || 0)
        setClaimedTeamsCount(stateRes.body.claimed_teams_count || 0)
        setAnsweredCount(stateRes.body.answered_count || 0)
        setWaitingTeams(stateRes.body.waiting_teams || [])
        setOfflineTeams(stateRes.body.offline_teams || [])
        setTeamsStatus(stateRes.body.teams_status || [])
      }
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to advance.'}`)
    }
  }

  const handleClearGame = async () => {
    const id = gameId.trim().toUpperCase()
    if (!id || !confirm(`Reset and clear the live game "${id}" from the arena?`)) return
    setBusy('Resetting arena…')
    const res = await adminFetch(`/api/quiz/game?game_id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    setBusy('')
    if (res.ok) {
      setLiveGame(null)
      setTeamsInGame(0)
      setAnsweredCount(0)
      setTeamsStatus([])
      showToast(`🧹 Live arena reset. Ready for next quiz.`)
    } else {
      showToast(`❌ ${res.body?.error || 'Failed to clear game.'}`)
    }
  }

  const handleExportCSV = () => {
    const data = teamsStatus && teamsStatus.length > 0 ? teamsStatus : lbData
    if (!data || data.length === 0) {
      showToast('No team records to export.')
      return
    }
    const success = exportLeaderboardToCSV(data, `quizflow_standings_${gameId || 'EVENT'}.csv`)
    if (success) showToast('📥 Full standings CSV downloaded!')
    else showToast('No records to export.')
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                  📝 My Quizzes
                </h2>
                <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                  Create via AI Studio, upload directly from Excel / CSV, or host games instantly.
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <label className="btn btn-mint btn-md" style={{ cursor: 'pointer', margin: 0, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  📊 Import Excel / CSV Quiz
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setBusy('Importing questions from spreadsheet…')
                      try {
                        const parsed = await parseQuizFromSpreadsheet(file)
                        const saved = saveQuizDraft({
                          title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
                          description: `Imported from Excel (${parsed.questions.length} questions)`,
                          language: 'English',
                          bloomLevel: 'Recall',
                          questions: parsed.questions
                        }, false)
                        setAllQuizzes(getSavedQuizzes())
                        setBusy('')
                        showToast(`✅ Successfully imported "${saved.title}" (${parsed.questions.length} Qs)!`)
                      } catch (err: any) {
                        setBusy('')
                        showToast(`❌ ${err?.message || 'Failed to parse Excel file.'}`)
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
                <Link href="/quizflow/practice"><button className="btn btn-violet btn-md">🌐 Community</button></Link>
                <Link href="/quizflow/studio"><button className="btn btn-sun btn-md">✨ AI Studio →</button></Link>
              </div>
            </div>

            {allQuizzes.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 44, marginBottom: 10 }}>📊</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800 }}>No Quizzes Found</h3>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 20, maxWidth: 500, margin: '0 auto 20px auto' }}>
                  Upload an Excel spreadsheet / Google Form CSV export, or generate one in seconds using AI Studio.
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <label className="btn btn-mint btn-lg" style={{ cursor: 'pointer', margin: 0, fontWeight: 800 }}>
                    📊 Upload Excel / CSV Quiz
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      style={{ display: 'none' }}
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        setBusy('Importing questions from spreadsheet…')
                        try {
                          const parsed = await parseQuizFromSpreadsheet(file)
                          const saved = saveQuizDraft({
                            title: parsed.title || file.name.replace(/\.[^/.]+$/, ''),
                            description: `Imported from Excel (${parsed.questions.length} questions)`,
                            language: 'English',
                            bloomLevel: 'Recall',
                            questions: parsed.questions
                          }, false)
                          setAllQuizzes(getSavedQuizzes())
                          setBusy('')
                          showToast(`✅ Successfully imported "${saved.title}" (${parsed.questions.length} Qs)!`)
                        } catch (err: any) {
                          setBusy('')
                          showToast(`❌ ${err?.message || 'Failed to parse Excel file.'}`)
                        }
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <Link href="/quizflow/studio"><button className="btn btn-sun btn-lg">✨ Open AI Studio</button></Link>
                </div>
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
                            <h3
                              onClick={() => setPreviewQuiz(item)}
                              className="hover:text-[var(--violet)] transition-colors cursor-pointer"
                              style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                              title="Click to preview quiz questions"
                            >
                              <span className="truncate">{item.title}</span>
                              <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0, fontWeight: 700 }}>👁️ Preview</span>
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
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
                            <button className="btn btn-sun btn-sm" style={{ fontWeight: 800 }} onClick={() => handleHostSavedQuiz(item)}>🚀 Host Game</button>
                            <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)', fontWeight: 800 }} onClick={() => setPreviewQuiz(item)}>👁️ Preview</button>
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
                            <h3
                              onClick={() => setPreviewQuiz(item)}
                              className="hover:text-[var(--violet)] transition-colors cursor-pointer"
                              style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}
                              title="Click to preview quiz questions"
                            >
                              <span className="truncate">{item.title}</span>
                              <span style={{ fontSize: 12, opacity: 0.6, flexShrink: 0, fontWeight: 700 }}>👁️ Preview</span>
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
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
                            <button className="btn btn-sun btn-sm" style={{ fontWeight: 800 }} onClick={() => handleHostSavedQuiz(item)}>🚀 Host Game</button>
                            <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)', fontWeight: 800 }} onClick={() => setPreviewQuiz(item)}>👁️ Preview</button>
                            <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)' }} onClick={() => handleEditQuizInStudio(item)}>✏️ Edit Studio</button>
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

            {/* Teams search & table toolbar */}
            {/* Teams search & table toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, minWidth: 260, maxWidth: 450 }}>
                <input
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="🔍 Search teams by name, username, code, or leader…"
                  value={teamSearch}
                  onChange={e => setTeamSearch(e.target.value)}
                />
                {teamSearch && (
                  <button className="btn btn-sm" onClick={() => setTeamSearch('')}>✕</button>
                )}
              </div>

              {/* Status Filter Tabs */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn btn-sm"
                  style={{ background: teamFilterStatus === 'all' ? 'var(--ink)' : '#fff', color: teamFilterStatus === 'all' ? '#fff' : 'var(--ink)', border: '2px solid var(--ink)', fontWeight: 800 }}
                  onClick={() => setTeamFilterStatus('all')}
                >
                  All ({teams.length})
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: teamFilterStatus === 'arena' ? 'var(--mint)' : '#fff', border: '2px solid var(--ink)', fontWeight: 800 }}
                  onClick={() => setTeamFilterStatus('arena')}
                >
                  🟢 In Arena ({teamsInGame})
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: teamFilterStatus === 'lobby' ? 'var(--sun)' : '#fff', border: '2px solid var(--ink)', fontWeight: 800 }}
                  onClick={() => setTeamFilterStatus('lobby')}
                  title="Teams who have logged in on a student device"
                >
                  📱 Logged In / Bound ({claimedTeamsCount})
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: teamFilterStatus === 'offline' ? 'var(--paper-2)' : '#fff', border: '2px solid var(--ink)', fontWeight: 800 }}
                  onClick={() => setTeamFilterStatus('offline')}
                >
                  ⚪ Unclaimed ({Math.max(0, teams.length - claimedTeamsCount)})
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  className="btn btn-sm btn-sun"
                  style={{ border: '2px solid var(--ink)', fontWeight: 800 }}
                  onClick={() => setPrintPassesModal(true)}
                  title="Generate printable cut-out credential passes for team distribution"
                >
                  🖨️ Print Passes
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--paper-2)', border: '2px solid var(--ink)', fontWeight: 800 }}
                  onClick={handleReleaseAllDevices}
                  title="Unlock all teams so students can switch or re-login from new devices"
                >
                  🔓 Release All ({teams.filter(t => t.device_id).length})
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: '#FFE4E7', color: 'var(--cherry)', border: '2px solid var(--cherry)', fontWeight: 800 }}
                  onClick={handlePurgeAllTeams}
                  title="Permanently remove all registered teams and their session data"
                >
                  🗑️ Purge All Teams
                </button>
              </div>
            </div>

            {/* Teams table */}
            {teams.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Teams Created Yet</h3>
                <p style={{ fontSize: 14, color: '#666' }}>Create teams above manually or upload an Excel/CSV file from Google Forms.</p>
              </div>
            ) : teamFilterStatus === 'lobby' && claimedTeamsCount === 0 ? (
              <div className="card" style={{ padding: 36, textAlign: 'center', background: '#FFFDE7', border: '2px solid #FFD54F' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📱</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 900, color: '#856404' }}>0 Teams Logged In On Devices Yet</h3>
                <p style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                  All {teams.length} registered teams are currently <strong>Unclaimed</strong>. Hand out credentials so students can log in at <code className="badge badge-ink">/quizflow/student/login</code>.
                </p>
                <button className="btn btn-sm btn-sun" style={{ marginTop: 14, fontWeight: 800 }} onClick={() => setTeamFilterStatus('all')}>
                  ← View All {teams.length} Registered Teams
                </button>
              </div>
            ) : (
              <div className="card" style={{ padding: 20, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--ink)', fontFamily: 'Space Grotesk', fontSize: 12, textTransform: 'uppercase' }}>
                      <th style={{ padding: 10 }}>Team</th>
                      <th style={{ padding: 10 }}>Code</th>
                      <th style={{ padding: 10 }}>Username</th>
                      <th style={{ padding: 10 }}>Roster &amp; Leader</th>
                      <th style={{ padding: 10 }}>Live Presence</th>
                      <th style={{ padding: 10 }}>Device Binding</th>
                      <th style={{ padding: 10, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams
                      .filter(t => {
                        const matchesSearch = !teamSearch ||
                          t.name?.toLowerCase().includes(teamSearch.toLowerCase()) ||
                          t.username?.toLowerCase().includes(teamSearch.toLowerCase()) ||
                          t.code?.toLowerCase().includes(teamSearch.toLowerCase()) ||
                          (Array.isArray(t.roster) && t.roster.some((m: string) => m.toLowerCase().includes(teamSearch.toLowerCase())))
                        
                        if (!matchesSearch) return false
                        
                        const isInArena = teamsStatus.some(s => s.team_id === t.id)
                        const isBound = !!t.device_id || t.status === 'claimed'
                        
                        if (teamFilterStatus === 'arena') return isInArena
                        if (teamFilterStatus === 'lobby') return isBound
                        if (teamFilterStatus === 'offline') return !isBound
                        return true
                      })
                      .map(t => {
                        const isInArena = teamsStatus.some(s => s.team_id === t.id)
                        const isBound = !!t.device_id || t.status === 'claimed'
                        const leaderName = Array.isArray(t.roster) && t.roster.length > 0 ? t.roster[0] : null
                        const memberNames = Array.isArray(t.roster) ? t.roster.slice(1) : []

                        return (
                          <tr key={t.id} style={{ borderBottom: '1px solid #eee', fontSize: 13, fontFamily: 'Inter' }}>
                            <td style={{ padding: 10, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                              <div>{t.name}</div>
                              {isInArena && <span className="badge badge-mint" style={{ fontSize: 9, padding: '1px 5px', marginTop: 2 }}>● IN ARENA</span>}
                            </td>
                            <td style={{ padding: 10 }}><span className="badge badge-sun">{t.code}</span></td>
                            <td style={{ padding: 10, fontWeight: 600 }}>{t.username || '—'}</td>
                            <td style={{ padding: 10, fontSize: 12 }}>
                              {leaderName ? (
                                <div>
                                  <span style={{ fontWeight: 800, color: 'var(--violet)' }}>👑 {leaderName}</span>
                                  {memberNames.length > 0 && (
                                    <span style={{ color: '#666', marginLeft: 4 }}>
                                      ({memberNames.join(', ')})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#999' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: 10 }}>
                              {isInArena ? (
                                <span className="badge badge-mint">🟢 In Arena</span>
                              ) : isBound ? (
                                <span className="badge badge-sun">🟡 Logged In</span>
                              ) : (
                                <span className="badge badge-ink">⚪ Unclaimed</span>
                              )}
                            </td>
                            <td style={{ padding: 10, fontSize: 12 }}>
                              {t.device_id ? (
                                <span className="badge badge-cherry" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  📱 Bound ({t.device_id.slice(0, 10)}…)
                                </span>
                              ) : (
                                <span style={{ color: '#888' }}>Unlocked</span>
                              )}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {t.device_id && (
                                <button
                                  className="btn btn-sm btn-mint"
                                  style={{ marginRight: 6, fontWeight: 800 }}
                                  onClick={() => handleReleaseTeam(t)}
                                  title="Click to cut out old device login so student can log in on their new device"
                                >
                                  🔓 Release Device
                                </button>
                              )}
                              <button className="btn btn-sm btn-sun" style={{ marginRight: 6 }} onClick={() => handleResetPassword(t)}>🔑 Reset</button>
                              <button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--cherry)', border: '1.5px solid var(--cherry)' }} onClick={() => handleDeleteTeam(t)}>🗑️</button>
                            </td>
                          </tr>
                        )
                      })}
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
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setIsFullscreenLeaderboard(true)}
                  className="btn btn-sm btn-violet"
                  style={{ color: '#fff', border: '2px solid var(--ink)', fontWeight: 900, boxShadow: '2px 2px 0 var(--ink)' }}
                  title="Launch full-screen cinema-grade Live Leaderboard for auditorium projector [F]"
                >
                  📺 Fullscreen Projector Stage [F]
                </button>
                <button
                  onClick={handleExportCSV}
                  className="btn btn-sm btn-sun"
                  style={{ border: '2px solid var(--ink)', fontWeight: 800 }}
                >
                  📥 Export Standings (.csv)
                </button>
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

        {/* ═══ TAB: ACTIVE GAME (Simplified & Logical Command Center) ═══ */}
        {activeTab === 'game' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                  🎮 Active Game Command Center
                </h2>
                <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                  {liveGame ? `Currently hosting: "${liveGame.quiz?.title || 'Loaded Quiz'}"` : 'No live room active right now. Select a quiz below to launch.'}
                </div>
              </div>

              {liveGame && (
                <button
                  onClick={handleClearGame}
                  className="btn btn-sm"
                  style={{
                    background: '#FFE4E7',
                    color: 'var(--cherry)',
                    border: '2px solid var(--cherry)',
                    boxShadow: '2px 2px 0 var(--ink)',
                    fontWeight: 800,
                    padding: '8px 14px'
                  }}
                  title="Stop live arena session without deleting your quiz from My Quizzes"
                >
                  ⏹️ Close &amp; Un-Host Game
                </button>
              )}
            </div>

            {/* 1. PROVISIONING CARD (When NO game is active) */}
            {!liveGame ? (
              <div className="card anim-scale-in" style={{ padding: 28, background: '#fff', border: '3px solid var(--ink)', boxShadow: '6px 6px 0 var(--ink)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 32 }}>🚀</span>
                  <div>
                    <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                      Launch a Live Quiz Room
                    </h3>
                    <div style={{ fontSize: 13, color: '#666', fontFamily: 'Inter' }}>
                      Pick a quiz to start. Your saved quiz in &quot;My Quizzes&quot; will stay 100% safe.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                      1. Select Quiz to Host
                    </label>
                    <select className="input" style={{ fontWeight: 700 }} value={selectedQuizId} onChange={e => setSelectedQuizId(e.target.value)}>
                      {allQuizzes.map(q => (
                        <option key={q.id} value={q.id}>{q.title} ({q.quiz.questions?.length || q.questionCount} Q)</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                      2. Match Game Mode
                    </label>
                    <select className="input" style={{ fontWeight: 700 }} value={gameMode} onChange={e => setGameMode(e.target.value)}>
                      <option value="classic">🎯 Classic Speed Quiz</option>
                      <option value="boss_raid">🐉 Boss Raid Finale</option>
                      <option value="tournament">🏆 Tournament Elimination</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                      3. Arena Room ID
                    </label>
                    <input className="input" style={{ textTransform: 'uppercase', fontWeight: 700 }} value={gameId} onChange={e => setGameId(e.target.value.toUpperCase())} placeholder="EVENT" />
                  </div>
                </div>

                <button
                  className="btn btn-mint btn-lg"
                  style={{ width: '100%', fontWeight: 900, fontSize: 16, border: '3px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)' }}
                  onClick={handleCreateGame}
                >
                  🚀 Host Quiz in Arena Now
                </button>
              </div>
            ) : liveGame.status === 'lobby' ? (
              /* 2. NEO-BRUTALIST ARCADE HOST LOBBY SCREEN (Matches user design) */
              <div className="card anim-scale-in" style={{ padding: 0, overflow: 'hidden', background: '#FFFCF5', border: '3px solid var(--ink)', boxShadow: '8px 8px 0 var(--ink)' }}>
                {/* A. TOP BLACK NAVIGATION BAR */}
                <div style={{ background: '#10100F', color: '#FFF', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 900, color: '#FFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⚡ QuizFlow
                    </span>
                    <span className="badge badge-sun" style={{ fontSize: 11, fontWeight: 900, padding: '4px 10px' }}>
                      HOST LOBBY
                    </span>
                  </div>

                  {/* ROOM CODE BADGE & COPY LINK */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFD60A', color: '#10100F', padding: '6px 14px', borderRadius: 10, border: '2px solid #10100F', fontWeight: 900, fontFamily: 'Space Grotesk', fontSize: 14 }}>
                    <span>GAME CODE</span>
                    <span style={{ fontSize: 20, letterSpacing: '0.1em' }}>{gameId || 'EVENT'}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/quizflow/student/login`)
                        showToast('📋 Student login link copied!')
                      }}
                      className="btn btn-sm"
                      style={{ background: '#10100F', color: '#FFF', fontSize: 10, padding: '3px 8px', borderRadius: 6, marginLeft: 6 }}
                    >
                      📋 Copy Link
                    </button>
                  </div>

                  {/* MODE SWITCHER & START GAME HERO BUTTON */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: '#222', padding: 4, borderRadius: 10, border: '1.5px solid #444', gap: 4 }}>
                      <button
                        onClick={() => setGameMode('classic')}
                        style={{
                          background: gameMode === 'classic' ? '#FFD60A' : 'transparent',
                          color: gameMode === 'classic' ? '#10100F' : '#FFF',
                          border: 'none', borderRadius: 6, padding: '4px 10px',
                          fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        🎯 Classic Mode
                      </button>
                      <button
                        onClick={() => setGameMode('boss_raid')}
                        style={{
                          background: gameMode === 'boss_raid' ? '#FFD60A' : 'transparent',
                          color: gameMode === 'boss_raid' ? '#10100F' : '#FFF',
                          border: 'none', borderRadius: 6, padding: '4px 10px',
                          fontFamily: 'Space Grotesk', fontSize: 11, fontWeight: 800, cursor: 'pointer'
                        }}
                      >
                        🐉 Boss Raid
                      </button>
                    </div>

                    <button
                      onClick={() => handleAdvance('start')}
                      className="btn btn-mint btn-lg"
                      style={{
                        border: '2.5px solid #10100F',
                        boxShadow: '3px 3px 0 #10100F',
                        fontWeight: 900,
                        fontSize: 15,
                        padding: '10px 22px'
                      }}
                    >
                      🎮 START GAME ({teamsInGame} joined) [Space]
                    </button>
                  </div>
                </div>

                {/* B. CENTER GIANT YELLOW DISPLAY BANNER */}
                <div style={{ padding: '36px 20px 24px', textAlign: 'center', background: '#FFFCF5' }}>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, color: '#444', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>📡 Students log in with Team Username at</span>
                    <span style={{ background: '#FFF', border: '1.5px solid #10100F', padding: '3px 10px', borderRadius: 6, fontWeight: 900, color: 'var(--violet)' }}>
                      /quizflow/student/login
                    </span>
                    <span>or enter Game Code:</span>
                  </div>

                  {/* HUGE YELLOW ROOM CODE BANNER BOX */}
                  <div
                    style={{
                      display: 'inline-block',
                      background: '#FFD60A',
                      border: '4px solid #10100F',
                      borderRadius: 20,
                      padding: '24px 64px',
                      boxShadow: '8px 8px 0 #10100F',
                      marginBottom: 16
                    }}
                  >
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(36px, 8vw, 68px)', fontWeight: 900, letterSpacing: '0.12em', color: '#10100F', lineHeight: 1 }}>
                      {gameId || 'EVENT'}
                    </div>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'Space Grotesk', color: '#555' }}>
                    📖 {liveGame.quiz?.title || 'Loaded Quiz'} — {liveGame.quiz?.questions?.length || 0} questions
                  </div>
                </div>

                {/* C. LIVE PLAYERS JOINED ROSTER GRID CARD */}
                <div style={{ padding: '24px', background: '#FFF', borderTop: '3px solid #10100F' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 900, textTransform: 'uppercase', color: '#10100F' }}>
                      PLAYERS / TEAMS JOINED ({teamsInGame})
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'Inter', color: '#777', fontWeight: 600 }}>
                      Click ✕ to disconnect any team
                    </div>
                  </div>

                  {teamsInGame === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', border: '2px dashed #CCC', borderRadius: 14, background: '#FAFAFA' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>⏳</div>
                      <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: '#333' }}>
                        Waiting for Teams to Log In...
                      </div>
                      <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                        Tell students to log in on their devices with their Team Username &amp; Password.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                      {teamsStatus.map((team: any) => {
                        const leaderName = Array.isArray(team.roster) && team.roster.length > 0 ? team.roster[0] : null
                        return (
                          <div
                            key={team.team_id}
                            style={{
                              padding: '10px 14px',
                              background: '#FFF',
                              border: '2.5px solid #10100F',
                              borderRadius: 14,
                              boxShadow: '3px 3px 0 #10100F',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: '50%',
                                  background: 'var(--sun)',
                                  border: '2px solid #10100F',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 14,
                                  fontWeight: 900,
                                  flexShrink: 0
                                }}
                              >
                                {team.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ overflow: 'hidden' }}>
                                <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, color: '#10100F' }}>
                                  {leaderName ? `👑 ${leaderName}` : team.name}
                                </div>
                                <div className="truncate" style={{ fontSize: 11, fontWeight: 700, color: '#666' }}>
                                  Team: {team.name} ({team.code})
                                </div>
                              </div>
                            </div>

                            {/* Red Kick ✕ Button */}
                            <button
                              onClick={() => {
                                const fullTeam = teams.find(t => t.id === team.team_id) || { id: team.team_id, name: team.name }
                                handleReleaseTeam(fullTeam)
                              }}
                              style={{
                                background: '#FFF',
                                color: 'var(--cherry)',
                                border: '1.5px solid var(--cherry)',
                                borderRadius: '50%',
                                width: 24,
                                height: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 12,
                                fontWeight: 900,
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                              title={`Disconnect ${team.name}`}
                            >
                              ✕
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Host Quick Toolbar Footer */}
                <div style={{ padding: '12px 24px', background: '#F2EEE6', borderTop: '2px solid #10100F', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setIsProjectorMode(true)}
                    className="btn btn-sm btn-violet"
                    style={{ color: '#fff', border: '2px solid var(--ink)', fontWeight: 800 }}
                  >
                    📺 Projector Mode [M]
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="btn btn-sm btn-sun"
                    style={{ border: '2px solid var(--ink)', fontWeight: 800 }}
                  >
                    📥 Export CSV
                  </button>
                  <button
                    onClick={handleClearGame}
                    className="btn btn-sm"
                    style={{ background: '#FFE4E7', color: 'var(--cherry)', border: '2px solid var(--cherry)', fontWeight: 800, marginLeft: 'auto' }}
                  >
                    ⏹️ Close &amp; Un-Host Game
                  </button>
                </div>
              </div>
            ) : (
              /* 3. ACTIVE GAME CONTROLLER (In Question / Reveal / Leaderboard) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Active Match Banner & Primary Action Button */}
                <div style={{ padding: 18, background: '#fff', border: '3px solid var(--ink)', borderRadius: 16, boxShadow: '5px 5px 0 var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 32 }}>
                      {liveGame.status === 'lobby' ? '🎮' : liveGame.status === 'question_active' ? '⏱️' : liveGame.status === 'question_reveal' ? '✅' : liveGame.status === 'leaderboard' ? '🏆' : '🏁'}
                    </span>
                    <div>
                      <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 900, textTransform: 'uppercase', color: 'var(--violet)' }}>
                        STAGE: {liveGame.status.toUpperCase().replace('_', ' ')}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontFamily: 'Space Grotesk' }}>
                        {liveGame.quiz?.title || 'Loaded Quiz'}
                      </div>
                    </div>
                  </div>

                  {/* HERO BUTTONS & PACING CONTROLS */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Pause / Resume Button */}
                    {liveGame.status !== 'lobby' && liveGame.status !== 'ended' && (
                      <button
                        onClick={() => handleAdvance(liveGame.is_paused ? 'resume' : 'pause')}
                        className={`btn btn-lg ${liveGame.is_paused ? 'btn-sun' : 'btn-white'}`}
                        style={{
                          background: liveGame.is_paused ? 'var(--sun)' : '#fff',
                          border: '3px solid var(--ink)',
                          boxShadow: '3px 3px 0 var(--ink)',
                          fontWeight: 900,
                          fontSize: 15,
                          padding: '14px 20px',
                          cursor: 'pointer'
                        }}
                        title="Pause / Resume active question timers and player submissions [P]"
                      >
                        {liveGame.is_paused ? '▶ RESUME QUIZ [P]' : '⏸️ PAUSE QUIZ [P]'}
                      </button>
                    )}

                    {/* Next Question Skip Button */}
                    {liveGame.status !== 'lobby' && liveGame.status !== 'ended' && (
                      <button
                        onClick={() => handleAdvance('next')}
                        className="btn btn-lg"
                        style={{
                          background: '#F0E6FF',
                          color: 'var(--ink)',
                          border: '3px solid var(--ink)',
                          boxShadow: '3px 3px 0 var(--ink)',
                          fontWeight: 900,
                          fontSize: 15,
                          padding: '14px 20px',
                          cursor: 'pointer'
                        }}
                        title="Jump immediately to next question [N]"
                      >
                        ⏭️ NEXT QUESTION [N]
                      </button>
                    )}

                    {/* ONE GIANT HERO BUTTON */}
                    <button
                      onClick={() => {
                        if (liveGame.status === 'lobby') handleAdvance('start')
                        else if (liveGame.status === 'question_active') handleAdvance('reveal')
                        else if (liveGame.status === 'question_reveal') handleAdvance('leaderboard')
                        else if (liveGame.status === 'leaderboard') handleAdvance('next')
                        else if (liveGame.status === 'ended') handleExportCSV()
                      }}
                      className="btn btn-lg"
                      style={{
                        background: liveGame.status === 'lobby' ? 'var(--mint)' :
                                    liveGame.status === 'question_active' ? 'var(--sun)' :
                                    liveGame.status === 'question_reveal' ? 'var(--sky)' :
                                    liveGame.status === 'leaderboard' ? 'var(--violet)' : '#E0E0E0',
                        color: liveGame.status === 'leaderboard' ? '#fff' : 'var(--ink)',
                        border: '3px solid var(--ink)',
                        boxShadow: '4px 4px 0 var(--ink)',
                        fontWeight: 900,
                        fontSize: 16,
                        padding: '14px 28px',
                        cursor: 'pointer'
                      }}
                    >
                      {liveGame.status === 'lobby' ? '▶ START MATCH [Space]' :
                       liveGame.status === 'question_active' ? '👁️ REVEAL ANSWER [Space]' :
                       liveGame.status === 'question_reveal' ? '🏆 SHOW STANDINGS [Space]' :
                       liveGame.status === 'leaderboard' ? '⏭️ ADVANCE [Space]' : '📥 EXPORT STANDINGS'}
                    </button>
                  </div>
                </div>

                {/* Host Quick Toolbar */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div
                    className="btn btn-sm"
                    style={{
                      background: 'var(--mint)',
                      color: 'var(--ink)',
                      border: '2px solid var(--ink)',
                      fontWeight: 800,
                      boxShadow: '2px 2px 0 var(--ink)',
                      cursor: 'default'
                    }}
                    title="Questions auto-advance: 30s question + 3s reveal break"
                  >
                    ⚡ Auto-Pacing: ON (30s + 3s)
                  </div>
                  <button
                    onClick={() => setIsProjectorMode(true)}
                    className="btn btn-sm btn-violet"
                    style={{ color: '#fff', border: '2px solid var(--ink)', fontWeight: 800, boxShadow: '2px 2px 0 var(--ink)' }}
                    title="Open full-screen projector view for classroom/auditorium"
                  >
                    📺 Projector Mode [M]
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="btn btn-sm btn-sun"
                    style={{ border: '2px solid var(--ink)', fontWeight: 800 }}
                  >
                    📥 Export Standings CSV
                  </button>
                  <button
                    onClick={handleClearGame}
                    className="btn btn-sm"
                    style={{ background: '#FFE4E7', color: 'var(--cherry)', border: '2px solid var(--cherry)', fontWeight: 800, marginLeft: 'auto' }}
                    title="Stop hosting this game (Quiz in My Quizzes remains completely safe)"
                  >
                    ⏹️ Close &amp; Un-Host Game
                  </button>
                </div>

                {/* Real-time Presence Bar */}
                <div style={{ padding: 14, background: '#fff', border: '2px solid var(--ink)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 900, color: 'var(--ink)' }}>
                      📡 Arena Real-Time Presence
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11, fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                      <span className="badge badge-ink">👥 {totalRegisteredTeams} Registered</span>
                      <span className="badge badge-mint">📱 {claimedTeamsCount} Bound to Device</span>
                      <span className="badge badge-sky">🏟️ {teamsInGame} In Arena</span>
                      <span className="badge badge-sun">⚡ {answeredCount} Answered</span>
                      {waitingTeams.length > 0 && <span className="badge badge-cherry">⏳ {waitingTeams.length} Thinking</span>}
                    </div>
                  </div>

                  {/* Submission Progress Bar */}
                  <div style={{ width: '100%', height: 10, background: 'var(--paper-2)', borderRadius: 6, border: '1.5px solid var(--ink)', overflow: 'hidden' }}>
                    <div style={{ width: `${teamsInGame > 0 ? (answeredCount / teamsInGame) * 100 : 0}%`, height: '100%', background: 'var(--mint)', transition: 'width 0.3s ease' }} />
                  </div>
                </div>

                {/* 🥇 3D Standings Podium (Leaderboard or Ended) */}
                {(liveGame.status === 'leaderboard' || liveGame.status === 'ended') && teamsStatus.length > 0 && (
                  <div style={{ padding: 20, background: 'var(--paper-2)', border: '2px solid var(--ink)', borderRadius: 12 }}>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                      <div style={{ fontSize: 32 }}>🏆</div>
                      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 900 }}>
                        {liveGame.status === 'ended' ? 'Championship Final Standings' : 'Live Round Standings'}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, margin: '16px auto 20px', maxWidth: 480 }}>
                      {teamsStatus[1] && (
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 18, marginBottom: 2 }}>🥈</div>
                          <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12 }}>{teamsStatus[1].name}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)' }}>⚡{teamsStatus[1].points.toLocaleString()}</div>
                          <div style={{ height: 55, background: '#E0E0E0', border: '2px solid var(--ink)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 18, marginTop: 4, boxShadow: '2px 2px 0 var(--ink)' }}>2</div>
                        </div>
                      )}
                      {teamsStatus[0] && (
                        <div style={{ flex: 1.2, textAlign: 'center' }}>
                          <div style={{ fontSize: 24, marginBottom: 2 }}>👑</div>
                          <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14 }}>{teamsStatus[0].name}</div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--violet)' }}>⚡{teamsStatus[0].points.toLocaleString()}</div>
                          <div style={{ height: 80, background: '#FFD700', border: '2.5px solid var(--ink)', borderRadius: '10px 10px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, marginTop: 4, boxShadow: '3px 3px 0 var(--ink)' }}>1</div>
                        </div>
                      )}
                      {teamsStatus[2] && (
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 18, marginBottom: 2 }}>🥉</div>
                          <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 12 }}>{teamsStatus[2].name}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--violet)' }}>⚡{teamsStatus[2].points.toLocaleString()}</div>
                          <div style={{ height: 40, background: '#CD7F32', color: '#fff', border: '2px solid var(--ink)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, marginTop: 4, boxShadow: '2px 2px 0 var(--ink)' }}>3</div>
                        </div>
                      )}
                    </div>

                    {/* Full Real-Time Standings Table */}
                    <div style={{ marginTop: 16, borderTop: '2px solid var(--ink)', paddingTop: 14, overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 640 }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--ink)', fontFamily: 'Space Grotesk', fontSize: 12, textTransform: 'uppercase' }}>
                            <th style={{ padding: '8px 10px' }}>Rank</th>
                            <th style={{ padding: '8px 10px' }}>Team</th>
                            <th style={{ padding: '8px 10px' }}>Points</th>
                            <th style={{ padding: '8px 10px' }}>Coins</th>
                            <th style={{ padding: '8px 10px' }}>Streak</th>
                            <th style={{ padding: '8px 10px' }}>Accuracy</th>
                            <th style={{ padding: '8px 10px' }}>Frenzy</th>
                            <th style={{ padding: '8px 10px' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamsStatus.map((team, idx) => (
                            <tr
                              key={team.team_id || idx}
                              style={{
                                borderBottom: '1px solid #eee',
                                fontSize: 13,
                                fontFamily: 'Inter',
                                background: idx === 0 ? '#FFFDE7' : idx === 1 ? '#F5F5F5' : idx === 2 ? '#FFF8E1' : undefined
                              }}
                            >
                              <td style={{ padding: '8px 10px', fontWeight: 900, fontFamily: 'Space Grotesk' }}>
                                {idx === 0 ? '👑 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 800, fontFamily: 'Space Grotesk' }}>
                                <div>{team.name}</div>
                                {team.code && <span className="badge badge-sun" style={{ fontSize: 10, padding: '1px 5px' }}>{team.code}</span>}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 900, color: 'var(--violet)', fontSize: 14 }}>
                                ⚡ {team.points.toLocaleString()}
                              </td>
                              <td style={{ padding: '8px 10px', fontWeight: 700 }}>
                                🪙 {team.coins}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {team.streak > 1 ? `🔥 ${team.streak}` : `${team.streak}`}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {team.total_correct}/{team.total_answered} {team.total_answered > 0 ? `(${Math.round((team.total_correct / team.total_answered) * 100)}%)` : ''}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {team.frenzy_correct_count || 0}
                              </td>
                              <td style={{ padding: '8px 10px' }}>
                                {team.violation_count > 0 ? (
                                  <span className="badge badge-cherry" style={{ fontSize: 10 }}>⚑ {team.violation_count}</span>
                                ) : (
                                  <span className="badge badge-mint" style={{ fontSize: 10 }}>Clean ✓</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Question Display for Host */}
                {liveGame.status !== 'leaderboard' && liveGame.status !== 'ended' && liveGame.quiz?.questions && liveGame.current_question_index >= 0 && liveGame.quiz.questions[liveGame.current_question_index] && (
                  <div style={{ padding: 16, background: 'var(--paper-2)', border: '2px solid var(--ink)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <span className="badge badge-ink" style={{ fontSize: 11 }}>
                        Question {liveGame.current_question_index + 1} of {liveGame.quiz.questions.length}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {liveGame.status === 'question_active' && !liveGame.is_paused && (
                          <span className={`badge ${30 - hostElapsedSec <= 5 ? 'badge-cherry animate-pulse' : 'badge-sun'}`} style={{ fontSize: 11 }}>
                            ⏱️ {Math.max(0, 30 - hostElapsedSec)}s left
                          </span>
                        )}
                        {liveGame.status === 'question_reveal' && (
                          <span className="badge badge-mint animate-pulse" style={{ fontSize: 11 }}>
                            🛒 Shopping Break ({revealCountdown}s auto-next)
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setUnhideHostKey(v => !v)}
                          className="btn btn-sm"
                          style={{ background: unhideHostKey ? 'var(--sun)' : '#fff', border: '2px solid var(--ink)', fontSize: 11, fontWeight: 800, padding: '4px 10px' }}
                        >
                          {unhideHostKey ? '🙈 Hide Answer Key' : '👁️ Unhide Answer Key'}
                        </button>
                      </div>
                    </div>

                    {/* 30s Countdown Timer Bar */}
                    {liveGame.status === 'question_active' && !liveGame.is_paused && (
                      <div style={{ width: '100%', height: 6, background: '#E0E0E0', borderRadius: 3, border: '1px solid var(--ink)', overflow: 'hidden', marginBottom: 12 }}>
                        <div style={{
                          width: `${Math.min(100, Math.max(0, ((30 - hostElapsedSec) / 30) * 100))}%`,
                          height: '100%',
                          background: (30 - hostElapsedSec) <= 5 ? 'var(--cherry)' : (30 - hostElapsedSec) <= 10 ? 'var(--sun)' : 'var(--mint)',
                          transition: 'width 0.5s linear'
                        }} />
                      </div>
                    )}

                    <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 16, marginBottom: 10, color: 'var(--ink)' }}>
                      {liveGame.quiz.questions[liveGame.current_question_index].prompt}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                      {liveGame.quiz.questions[liveGame.current_question_index].choices.map((c: string, ci: number) => {
                        const isCorrect = liveGame.quiz.questions[liveGame.current_question_index].correct_index === ci
                        const showKey = unhideHostKey || liveGame.status === 'question_reveal'
                        return (
                          <div 
                            key={ci} 
                            style={{
                              padding: 10, borderRadius: 8, fontSize: 13, fontWeight: 700,
                              display: 'flex', alignItems: 'center', gap: 8,
                              border: showKey && isCorrect ? '2px solid var(--ink)' : '1.5px solid rgba(16,16,15,0.25)',
                              background: showKey && isCorrect ? 'var(--mint)' : '#fff',
                              boxShadow: showKey && isCorrect ? '2px 2px 0 var(--ink)' : 'none'
                            }}
                          >
                            <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', border: '1.5px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                              {String.fromCharCode(65 + ci)}
                            </span>
                            <span style={{ flex: 1 }}>{c}</span>
                            {showKey && isCorrect && <span className="badge badge-mint" style={{ fontSize: 10, padding: '2px 6px', border: '1px solid var(--ink)' }}>✓ Key</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* Explanation - only shown when unhidden or during reveal */}
                    {(unhideHostKey || liveGame.status === 'question_reveal') ? (
                      liveGame.quiz.questions[liveGame.current_question_index].explanation ? (
                        <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff', border: '1.5px solid var(--ink)', borderRadius: 8, fontSize: 12, color: 'var(--ink)', display: 'flex', gap: 6 }}>
                          <span style={{ fontWeight: 800, flexShrink: 0 }}>💡 Explanation:</span>
                          <span>{liveGame.quiz.questions[liveGame.current_question_index].explanation}</span>
                        </div>
                      ) : null
                    ) : null}
                  </div>
                )}
              </div>
            )}

            {/* 📺 Auditorium Fullscreen Projector Arena Modal */}
            {isProjectorMode && liveGame && (
              <div className="fixed inset-0 z-50 bg-[var(--paper)] flex flex-col p-6 overflow-y-auto">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid var(--ink)', paddingBottom: 14, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="badge badge-ink" style={{ fontSize: 14, padding: '6px 12px' }}>
                      {liveGame.id} ARENA
                    </span>
                    <span className="badge badge-sun" style={{ fontSize: 14, padding: '6px 12px' }}>
                      {liveGame.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {liveGame.status !== 'lobby' && liveGame.status !== 'ended' && (
                      <button
                        onClick={() => handleAdvance(liveGame.is_paused ? 'resume' : 'pause')}
                        className={`btn btn-sm ${liveGame.is_paused ? 'btn-sun' : ''}`}
                        style={{ background: liveGame.is_paused ? 'var(--sun)' : '#fff', border: '2px solid var(--ink)', fontWeight: 800, fontSize: 13 }}
                      >
                        {liveGame.is_paused ? '▶ Resume [P]' : '⏸️ Pause [P]'}
                      </button>
                    )}
                    {liveGame.status !== 'lobby' && liveGame.status !== 'ended' && (
                      <button
                        onClick={() => handleAdvance('next')}
                        className="btn btn-sm"
                        style={{ background: '#F0E6FF', border: '2px solid var(--ink)', fontWeight: 800, fontSize: 13 }}
                      >
                        ⏭️ Next [N]
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (liveGame.status === 'lobby') handleAdvance('start')
                        else if (liveGame.status === 'question_active') handleAdvance('reveal')
                        else if (liveGame.status === 'question_reveal') handleAdvance('leaderboard')
                        else if (liveGame.status === 'leaderboard') handleAdvance('next')
                      }}
                      className="btn btn-sm btn-sun"
                      style={{ border: '2px solid var(--ink)', fontWeight: 900, fontSize: 13, padding: '6px 14px' }}
                    >
                      {liveGame.status === 'lobby' ? '▶ Start Game [Space]' : liveGame.status === 'question_active' ? '👁 Reveal Answer [Space]' : liveGame.status === 'question_reveal' ? '🏆 Standings [Space]' : '⏭ Next Question [Space]'}
                    </button>
                    <button
                      onClick={() => setIsProjectorMode(false)}
                      className="btn btn-sm"
                      style={{ background: '#fff', border: '2px solid var(--ink)', fontWeight: 800, fontSize: 13 }}
                    >
                      ✕ Exit Projector [M]
                    </button>
                  </div>
                </div>

                {/* Projector Question Content (when in question_active or question_reveal) */}
                {liveGame.status !== 'leaderboard' && liveGame.status !== 'ended' && liveGame.quiz?.questions && liveGame.current_question_index >= 0 && liveGame.quiz.questions[liveGame.current_question_index] && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
                    <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'Space Grotesk', textTransform: 'uppercase', color: 'var(--violet)', marginBottom: 8 }}>
                      Question {liveGame.current_question_index + 1} of {liveGame.quiz.questions.length}
                    </div>
                    <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(24px, 3.5vw, 40px)', fontWeight: 900, lineHeight: 1.25, color: 'var(--ink)', marginBottom: 30 }}>
                      {liveGame.quiz.questions[liveGame.current_question_index].prompt}
                    </h1>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                      {liveGame.quiz.questions[liveGame.current_question_index].choices.map((c: string, ci: number) => {
                        const colors = ['#FFE8EC', '#E3F2FD', '#FFF8E1', '#E8F5E9']
                        const borderColors = ['#FF4B5C', '#2196F3', '#FFC107', '#4CAF50']
                        const isCorrect = liveGame.quiz.questions[liveGame.current_question_index].correct_index === ci
                        const isReveal = liveGame.status === 'question_reveal'
                        return (
                          <div
                            key={ci}
                            style={{
                              padding: '20px 24px',
                              borderRadius: 14,
                              fontSize: 'clamp(16px, 1.8vw, 22px)',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 14,
                              border: `3px solid ${isReveal && isCorrect ? 'var(--ink)' : borderColors[ci % borderColors.length]}`,
                              background: isReveal && isCorrect ? 'var(--mint)' : colors[ci % colors.length],
                              boxShadow: '4px 4px 0 var(--ink)'
                            }}
                          >
                            <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '2px solid var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, flexShrink: 0 }}>
                              {String.fromCharCode(65 + ci)}
                            </span>
                            <span style={{ flex: 1 }}>{c}</span>
                            {isReveal && isCorrect && <span style={{ fontSize: 24, fontWeight: 900 }}>✓</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* Live Progress Bar at Bottom of Projector */}
                    <div style={{ marginTop: 36, padding: 14, background: '#fff', border: '2.5px solid var(--ink)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 14, marginBottom: 8, fontFamily: 'Space Grotesk' }}>
                        <span>● Live Submissions: {answeredCount} / {teamsInGame} Teams</span>
                        <span>{teamsInGame > 0 ? Math.round((answeredCount / teamsInGame) * 100) : 0}%</span>
                      </div>
                      <div style={{ width: '100%', height: 12, background: 'var(--paper-2)', borderRadius: 6, border: '1.5px solid var(--ink)', overflow: 'hidden' }}>
                        <div style={{ width: `${teamsInGame > 0 ? (answeredCount / teamsInGame) * 100 : 0}%`, height: '100%', background: 'var(--mint)', transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Projector Standings (when in leaderboard or ended) */}
                {(liveGame.status === 'leaderboard' || liveGame.status === 'ended') && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1100, margin: '0 auto', width: '100%', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ fontSize: 44, marginBottom: 4 }}>🏆</div>
                      <h1 style={{ fontFamily: 'Space Grotesk', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, textTransform: 'uppercase', color: 'var(--ink)' }}>
                        {liveGame.status === 'ended' ? 'Championship Final Standings' : 'Live Arena Standings'}
                      </h1>
                      <div style={{ fontSize: 15, fontFamily: 'Inter', color: '#555', fontWeight: 700 }}>
                        {teamsStatus.length} Teams Registered &amp; Active
                      </div>
                    </div>

                    {/* Grand 3D Olympic Podium */}
                    {teamsStatus.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 16, margin: '20px auto 30px', maxWidth: 700, width: '100%' }}>
                        {/* 2nd Place */}
                        {teamsStatus[1] && (
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 28, marginBottom: 4 }}>🥈</div>
                            <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 'clamp(14px, 1.8vw, 20px)' }}>{teamsStatus[1].name}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--violet)' }}>⚡ {teamsStatus[1].points.toLocaleString()} pts</div>
                            <div style={{ height: 100, background: '#E0E0E0', border: '3px solid var(--ink)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32, marginTop: 8, boxShadow: '4px 4px 0 var(--ink)' }}>
                              2
                            </div>
                          </div>
                        )}

                        {/* 1st Place */}
                        {teamsStatus[0] && (
                          <div style={{ flex: 1.3, textAlign: 'center' }}>
                            <div style={{ fontSize: 38, marginBottom: 2 }}>👑</div>
                            <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 'clamp(16px, 2.2vw, 24px)' }}>{teamsStatus[0].name}</div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--violet)' }}>⚡ {teamsStatus[0].points.toLocaleString()} pts</div>
                            <div style={{ height: 140, background: '#FFD700', border: '3.5px solid var(--ink)', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 44, marginTop: 8, boxShadow: '5px 5px 0 var(--ink)' }}>
                              1
                            </div>
                          </div>
                        )}

                        {/* 3rd Place */}
                        {teamsStatus[2] && (
                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 28, marginBottom: 4 }}>🥉</div>
                            <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 'clamp(14px, 1.8vw, 20px)' }}>{teamsStatus[2].name}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--violet)' }}>⚡ {teamsStatus[2].points.toLocaleString()} pts</div>
                            <div style={{ height: 75, background: '#CD7F32', color: '#fff', border: '3px solid var(--ink)', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 28, marginTop: 8, boxShadow: '4px 4px 0 var(--ink)' }}>
                              3
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Table for remaining teams */}
                    {teamsStatus.length > 3 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, maxHeight: 220, overflowY: 'auto', padding: 8 }}>
                        {teamsStatus.slice(3).map((t: any, idx: number) => (
                          <div key={t.team_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fff', border: '2px solid var(--ink)', borderRadius: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 900, width: 28 }}>#{idx + 4}</span>
                              <span style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</span>
                            </div>
                            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 14, color: 'var(--violet)' }}>
                              ⚡ {t.points.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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

      {/* ═══ SCROLLABLE QUIZ PREVIEW MODAL ═══ */}
      {previewQuiz && (
        <div 
          className="fixed inset-0 z-[300] bg-[rgba(16,16,15,0.65)] flex items-center justify-center p-3 sm:p-6" 
          onClick={() => setPreviewQuiz(null)}
        >
          <div 
            className="hard bg-[var(--paper)] border-[3px] border-[var(--ink)] rounded-[var(--radius-card)] w-full max-w-[780px] max-h-[88vh] flex flex-col shadow-[8px_8px_0px_#10100F] animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-[3px] border-[var(--ink)] bg-[var(--paper-2)] flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="badge badge-sun text-[11px]">
                    📝 {previewQuiz.quiz.questions?.length || previewQuiz.questionCount} Questions
                  </span>
                  <span className="badge badge-sky text-[11px]">{previewQuiz.language}</span>
                  <span className="badge badge-violet text-[11px]">{previewQuiz.bloomLevel}</span>
                </div>
                <h2 className="font-display font-[900] text-[20px] sm:text-[22px] text-[var(--ink)] truncate">
                  {previewQuiz.title}
                </h2>
              </div>
              <button 
                onClick={() => setPreviewQuiz(null)} 
                className="w-9 h-9 rounded-full border-[2px] border-[var(--ink)] bg-white font-bold text-[16px] flex items-center justify-center hover:bg-[var(--cherry)] hover:text-white transition-colors shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Questions List */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {(!previewQuiz.quiz.questions || previewQuiz.quiz.questions.length === 0) ? (
                <div className="text-center py-10 text-gray-500 font-medium">
                  No questions in this quiz yet. Click &quot;Edit Studio&quot; to add questions.
                </div>
              ) : (
                previewQuiz.quiz.questions.map((q, idx) => (
                  <div key={idx} className="hard bg-white border-[2.5px] border-[var(--ink)] rounded-[14px] p-4 shadow-[3px_3px_0px_#10100F]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="badge badge-ink text-[11px]">Q{idx + 1}</span>
                      <div className="flex gap-2">
                        {q.difficulty && <span className="badge badge-sky text-[10px] uppercase">{q.difficulty}</span>}
                        {q.time_limit_ms && <span className="badge badge-sun text-[10px]">⏱ {Math.round(q.time_limit_ms / 1000)}s</span>}
                      </div>
                    </div>

                    <h4 className="font-display font-[800] text-[15px] sm:text-[16px] text-[var(--ink)] mb-3 leading-snug">
                      {q.prompt}
                    </h4>

                    {/* Choices Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                      {q.choices.map((choice, cIdx) => {
                        const isCorrect = q.correct_index === cIdx
                        return (
                          <div
                            key={cIdx}
                            className={`p-2.5 rounded-[8px] border-[2px] text-[13px] font-semibold flex items-center gap-2 ${
                              isCorrect
                                ? 'bg-[var(--mint)] border-[var(--ink)] shadow-[2px_2px_0px_#10100F] font-bold text-[var(--ink)]'
                                : 'bg-[var(--paper-2)] border-[#10100F]/20 text-[var(--ink)]/80'
                            }`}
                          >
                            <span className="font-display font-black text-[12px] w-5 h-5 rounded-full bg-white border-[1.5px] border-[var(--ink)] flex items-center justify-center shrink-0">
                              {String.fromCharCode(65 + cIdx)}
                            </span>
                            <span className="flex-1">{choice}</span>
                            {isCorrect && (
                              <span className="badge badge-mint text-[9px] px-1.5 py-0.5 border border-[var(--ink)] shrink-0">
                                ✓ Correct
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Explanation */}
                    {q.explanation && (
                      <div className="bg-[var(--paper-2)] border-[1.5px] border-[var(--ink)]/30 rounded-[8px] p-2.5 text-[12px] text-[var(--ink)]/90 flex gap-2">
                        <span className="font-bold shrink-0">💡 Explanation:</span>
                        <span>{q.explanation}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t-[3px] border-[var(--ink)] bg-[var(--paper-2)] flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <button 
                onClick={() => setPreviewQuiz(null)}
                className="btn btn-sm"
                style={{ background: 'white', color: 'var(--ink)' }}
              >
                Close
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const qItem = previewQuiz
                    setPreviewQuiz(null)
                    handleEditQuizInStudio(qItem)
                  }}
                  className="btn btn-sm"
                  style={{ background: 'var(--paper)', color: 'var(--ink)' }}
                >
                  ✏️ Edit in Studio
                </button>
                <button 
                  onClick={() => {
                    const qItem = previewQuiz
                    setPreviewQuiz(null)
                    handleHostSavedQuiz(qItem)
                  }}
                  className="btn btn-sun btn-sm"
                  style={{ fontWeight: 800 }}
                >
                  🚀 Host Game →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PRINTABLE CREDENTIAL PASSES MODAL ═══ */}
      {printPassesModal && (
        <div className="fixed inset-0 z-[300] bg-[rgba(16,16,15,0.7)] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[var(--paper)] border-[3px] border-[var(--ink)] rounded-[16px] w-full max-w-[900px] max-h-[90vh] flex flex-col shadow-[8px_8px_0px_#10100F] animate-scale-in">
            {/* Header (hidden in print) */}
            <div className="p-4 border-b-[3px] border-[var(--ink)] bg-[var(--paper-2)] flex items-center justify-between gap-3 shrink-0 print:hidden">
              <div>
                <h2 className="font-display font-[900] text-[20px] text-[var(--ink)]">
                  🖨️ Team Credential Passes ({teams.length} Teams)
                </h2>
                <div className="text-[12px] text-[#555] font-sans">
                  Print or save as PDF. Hand out each cut-out slip to the respective team leader.
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="btn btn-sun btn-sm"
                  style={{ fontWeight: 900 }}
                >
                  🖨️ Print Now
                </button>
                <button
                  onClick={() => setPrintPassesModal(false)}
                  className="w-9 h-9 rounded-full border-[2px] border-[var(--ink)] bg-white font-bold text-[16px] flex items-center justify-center hover:bg-[var(--cherry)] hover:text-white transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Passes Content Grid */}
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              {teams.length === 0 ? (
                <div className="text-center py-10 text-gray-500 font-medium">
                  No registered teams found. Create or upload teams first.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teams.map((t, idx) => {
                    const leaderName = Array.isArray(t.roster) && t.roster.length > 0 ? t.roster[0] : t.name
                    const rosterStr = Array.isArray(t.roster) ? t.roster.join(', ') : 'Team Roster'
                    const initialPassword = leaderName

                    return (
                      <div
                        key={t.id || idx}
                        style={{
                          border: '2.5px dashed var(--ink)',
                          borderRadius: 12,
                          padding: 16,
                          background: 'var(--paper)',
                          pageBreakInside: 'avoid',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--ink)', paddingBottom: 6 }}>
                          <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 13, textTransform: 'uppercase', color: 'var(--violet)' }}>
                            ⚡ QUIZFLOW ARENA PASS
                          </span>
                          <span className="badge badge-sun" style={{ fontSize: 11 }}>
                            CODE: {t.code}
                          </span>
                        </div>

                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 16, color: 'var(--ink)' }}>
                            {t.name}
                          </div>
                          <div style={{ fontSize: 11, color: '#555', fontFamily: 'Inter' }}>
                            Roster: {rosterStr}
                          </div>
                        </div>

                        <div style={{ marginTop: 6, padding: 8, background: '#fff', border: '1.5px solid var(--ink)', borderRadius: 8, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontWeight: 700, color: '#555' }}>Username:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800 }}>{t.username || t.name}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 700, color: '#555' }}>Leader Password:</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--cherry)' }}>{initialPassword}</span>
                          </div>
                        </div>

                        <div style={{ fontSize: 10, color: '#777', textAlign: 'center', marginTop: 4 }}>
                          Login at: <strong>{typeof window !== 'undefined' ? `${window.location.origin}/quizflow/student/login` : '/quizflow/student/login'}</strong>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 🏆 FULLSCREEN AUDITORIUM LIVE LEADERBOARD STAGE ═══ */}
      {isFullscreenLeaderboard && (
        <div className="fixed inset-0 z-[250] bg-[var(--paper)] flex flex-col p-4 sm:p-8 overflow-y-auto memphis-bg animate-scale-in">
          {/* Top Stage Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid var(--ink)', paddingBottom: 14, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span className="badge badge-cherry" style={{ fontSize: 13, padding: '6px 14px', fontWeight: 900, animation: 'pulse 1.5s infinite' }}>
                🔴 LIVE ARENA STANDINGS
              </span>
              <span className="badge badge-ink" style={{ fontSize: 13, padding: '6px 12px' }}>
                GAME ID: {lbGameId || gameId || 'EVENT'}
              </span>
              <span style={{ fontSize: 13, color: '#555', fontFamily: 'Space Grotesk', fontWeight: 800 }}>
                {(lbData.length > 0 ? lbData : teamsStatus).length} Teams Competing · Live Synchronized (2s)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={handleExportCSV}
                className="btn btn-sm btn-sun"
                style={{ border: '2px solid var(--ink)', fontWeight: 800, padding: '8px 16px' }}
              >
                📥 Export CSV
              </button>
              <button
                onClick={() => setIsFullscreenLeaderboard(false)}
                className="btn btn-sm"
                style={{ background: '#fff', border: '2px solid var(--ink)', fontWeight: 900, fontSize: 13, padding: '8px 16px' }}
              >
                ✕ Exit Fullscreen [Esc / F]
              </button>
            </div>
          </div>

          {/* Fullscreen Stage Content */}
          {(() => {
            const data = lbData.length > 0 ? lbData : teamsStatus
            if (data.length === 0) {
              return (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>🏆</div>
                  <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 900 }}>No Active Standings Yet</h2>
                  <p style={{ color: '#666', fontSize: 15, marginTop: 6 }}>Create and launch a match to populate live auditorium standings.</p>
                </div>
              )
            }

            return (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
                {/* 🥇 Grand 3D Olympic Podium */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 16, margin: '10px auto 28px', maxWidth: 780, width: '100%' }}>
                  {/* 2nd Place */}
                  {data[1] && (
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 4 }}>🥈</div>
                      <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 'clamp(15px, 2vw, 22px)' }}>{data[1].name || data[1].code}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--violet)', marginTop: 2 }}>⚡ {(data[1].points || 0).toLocaleString()} pts</div>
                      {data[1].streak > 1 && <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--cherry)' }}>🔥 {data[1].streak} Streak</div>}
                      <div style={{ height: 110, background: '#E0E0E0', border: '3.5px solid var(--ink)', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 36, marginTop: 8, boxShadow: '4px 4px 0 var(--ink)' }}>
                        2
                      </div>
                    </div>
                  )}

                  {/* 1st Place (Elevated Gold) */}
                  {data[0] && (
                    <div style={{ flex: 1.35, textAlign: 'center' }}>
                      <div style={{ fontSize: 44, marginBottom: 2 }}>👑</div>
                      <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 'clamp(18px, 2.5vw, 26px)', color: 'var(--ink)' }}>{data[0].name || data[0].code}</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--violet)', marginTop: 2 }}>⚡ {(data[0].points || 0).toLocaleString()} pts</div>
                      {data[0].streak > 1 && <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--cherry)' }}>🔥 {data[0].streak} Streak</div>}
                      <div style={{ height: 160, background: '#FFD700', border: '4px solid var(--ink)', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 52, marginTop: 8, boxShadow: '6px 6px 0 var(--ink)' }}>
                        1
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {data[2] && (
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 32, marginBottom: 4 }}>🥉</div>
                      <div className="truncate" style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 'clamp(15px, 2vw, 22px)' }}>{data[2].name || data[2].code}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--violet)', marginTop: 2 }}>⚡ {(data[2].points || 0).toLocaleString()} pts</div>
                      {data[2].streak > 1 && <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--cherry)' }}>🔥 {data[2].streak} Streak</div>}
                      <div style={{ height: 80, background: '#CD7F32', color: '#fff', border: '3.5px solid var(--ink)', borderRadius: '14px 14px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 32, marginTop: 8, boxShadow: '4px 4px 0 var(--ink)' }}>
                        3
                      </div>
                    </div>
                  )}
                </div>

                {/* Ranked Standings Grid for 4th+ */}
                {data.length > 3 && (
                  <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.85)', border: '3px solid var(--ink)', borderRadius: 16, padding: 16, boxShadow: '5px 5px 0 var(--ink)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, maxHeight: '38vh', overflowY: 'auto', paddingRight: 6 }}>
                      {data.slice(3).map((row: any, idx: number) => (
                        <div
                          key={row.team_id || idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: '#fff',
                            border: '2px solid var(--ink)',
                            borderRadius: 12,
                            boxShadow: '2px 2px 0 var(--ink)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 16, width: 34, color: '#555' }}>
                              #{idx + 4}
                            </span>
                            <div className="truncate">
                              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 15, color: 'var(--ink)' }} className="truncate">
                                {row.name || row.code}
                              </div>
                              <div style={{ fontSize: 11, color: '#777', fontFamily: 'Inter' }}>
                                Code: {row.code || '—'} {row.roster && row.roster.length > 0 ? `· Leader: ${row.roster[0]}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            {row.streak > 1 && <span style={{ fontSize: 12, fontWeight: 800 }}>🔥{row.streak}</span>}
                            {row.coins > 0 && <span style={{ fontSize: 12, fontWeight: 800 }}>🪙{row.coins}</span>}
                            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 16, color: 'var(--violet)' }}>
                              ⚡ {(row.points || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
