'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getHostUser, logoutHost, updateHostProfile, type HostUser } from '@/quizflow/authStore'
import { getSavedQuizzes, deleteSavedQuiz, type SavedQuizItem } from '@/quizflow/quizStore'
import { getSessionHistory, type SessionHistoryRecord } from '@/quizflow/historyStore'
import { createSession } from '@/quizflow/sessionStore'
import { generatePrintableWorksheet } from '@/quizflow/pdfGenerator'

export default function TeacherDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<HostUser | null>(null)
  const [activeTab, setActiveTab] = useState<'quizzes' | 'history' | 'profile'>('quizzes')

  // Quizzes & History state
  const [quizzes, setQuizzes] = useState<SavedQuizItem[]>([])
  const [history, setHistory] = useState<SessionHistoryRecord[]>([])
  const [selectedHistory, setSelectedHistory] = useState<SessionHistoryRecord | null>(null)

  // Profile Form state
  const [profileName, setProfileName]     = useState('')
  const [profileSchool, setProfileSchool] = useState('')
  const [saveSuccess, setSaveSuccess]     = useState(false)

  useEffect(() => {
    const hostUser = getHostUser()
    if (!hostUser) {
      router.push('/auth')
      return
    }
    setUser(hostUser)
    setProfileName(hostUser.name)
    setProfileSchool(hostUser.school)

    setQuizzes(getSavedQuizzes())
    setHistory(getSessionHistory())
  }, [router])

  const handleLogout = () => {
    logoutHost()
    router.push('/auth')
  }

  const handleDeleteQuiz = (id: string) => {
    if (confirm('Are you sure you want to delete this saved quiz?')) {
      deleteSavedQuiz(id)
      setQuizzes(getSavedQuizzes())
    }
  }

  const handleHostSavedQuiz = (item: SavedQuizItem) => {
    const state = createSession(item.quiz, 'host-' + Date.now())
    router.push(`/host?pin=${state.pin}`)
  }

  const handleEditQuizInStudio = (item: SavedQuizItem) => {
    localStorage.setItem('qf_saved_quiz', JSON.stringify(item.quiz))
    router.push('/studio')
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

  if (!user) return null

  return (
    <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* TOP COMMAND CENTER BAR */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>← Exit Dashboard</button></a>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>📊 Teacher Workspace</span>
          <span className="badge badge-sun">🎓 {user.school}</span>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'quizzes', label: `📂 My Quizzes (${quizzes.length})` },
            { id: 'history', label: `📊 Session History (${history.length})` },
            { id: 'profile', label: `👤 Profile` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="btn btn-sm"
              style={{
                fontFamily: 'Space Grotesk', fontWeight: 800,
                background: activeTab === tab.id ? 'var(--mint)' : 'var(--paper)',
                color: 'var(--ink)'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User Info & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/studio"><button className="btn btn-violet btn-sm">✨ + New AI Quiz</button></a>
          <button className="btn btn-sm" style={{ background: 'var(--cherry)', color: '#fff' }} onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div style={{ flex: 1, padding: 24, maxWidth: 1200, width: '100%', margin: '0 auto' }}>

        {/* TAB 1: MY QUIZZES & DRAFTS */}
        {activeTab === 'quizzes' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                  📂 Saved Quizzes & Drafts
                </h2>
                <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                  Manage your created quizzes, launch live sessions, or edit questions in AI Studio.
                </div>
              </div>
              <a href="/studio"><button className="btn btn-sun btn-lg">✨ Create Quiz in Studio →</button></a>
            </div>

            {quizzes.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📝</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Saved Quizzes Yet</h3>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>Use AI Studio to create or draft your first interactive classroom quiz.</p>
                <a href="/studio"><button className="btn btn-violet">✨ Open AI Studio</button></a>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
                {quizzes.map(item => (
                  <div key={item.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span className={`badge ${item.isDraft ? 'badge-cherry' : 'badge-mint'}`}>
                          {item.isDraft ? '📝 Draft' : '✅ Ready to Host'}
                        </span>
                        <span style={{ fontSize: 11, color: '#666', fontFamily: 'Inter' }}>
                          Updated {new Date(item.updatedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
                        {item.title}
                      </h3>
                      <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 14, lineHeight: 1.4 }}>
                        {item.description}
                      </p>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                        <span className="badge badge-ink">{item.questionCount} Questions</span>
                        <span className="badge badge-sky">{item.language}</span>
                        <span className="badge badge-violet">{item.bloomLevel}</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, borderTop: '2px solid var(--ink)', paddingTop: 14 }}>
                      <button className="btn btn-sun btn-sm" style={{ fontWeight: 800 }} onClick={() => handleHostSavedQuiz(item)}>
                        🚀 Host Game
                      </button>
                      <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)' }} onClick={() => handleEditQuizInStudio(item)}>
                        ✏️ Edit Studio
                      </button>
                      <button className="btn btn-sm" style={{ background: 'var(--mint)', color: 'var(--ink)' }} onClick={() => generatePrintableWorksheet(item.quiz, 'A', true)}>
                        🖨️ Print PDF
                      </button>
                      <button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--cherry)', border: '1.5px solid var(--cherry)' }} onClick={() => handleDeleteQuiz(item.id)}>
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SESSION HISTORY & CLASS ANALYTICS */}
        {activeTab === 'history' && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)' }}>
                📊 Past Session History & Analytics
              </h2>
              <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter' }}>
                Review past live room codes, class accuracy reports, and top student performers.
              </div>
            </div>

            {history.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎮</div>
                <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>No Game Sessions Hosted Yet</h3>
                <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>Host your first quiz to record live classroom session analytics.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: selectedHistory ? '1fr 420px' : '1fr', gap: 20 }}>
                
                {/* Session List Table */}
                <div className="card" style={{ padding: 20 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--ink)', fontFamily: 'Space Grotesk', fontSize: 12, textTransform: 'uppercase' }}>
                        <th style={{ padding: 10 }}>PIN</th>
                        <th style={{ padding: 10 }}>Quiz Title</th>
                        <th style={{ padding: 10 }}>Date</th>
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
                          <td style={{ padding: 10, color: '#666', fontSize: 12 }}>
                            {new Date(rec.completedAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: 10 }}>👥 {rec.totalPlayers}</td>
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
                              🔍 Report
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Session Detail Report Modal / Column */}
                {selectedHistory && (
                  <div className="card anim-scale-in" style={{ padding: 20, background: 'var(--paper)', border: '2px solid var(--ink)', boxShadow: '6px 6px 0 var(--ink)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>
                        📊 Session Report (PIN {selectedHistory.pin})
                      </h3>
                      <button onClick={() => setSelectedHistory(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
                    </div>

                    <div style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 14 }}>
                      {selectedHistory.quizTitle} • Hosted on {new Date(selectedHistory.completedAt).toLocaleDateString()}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <div style={{ background: '#FFF8E1', padding: 12, borderRadius: 10, border: '1.5px solid var(--ink)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, color: '#666' }}>CLASS ACCURACY</div>
                        <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Space Grotesk', color: 'var(--ink)' }}>{selectedHistory.classAccuracyPercent}%</div>
                      </div>
                      <div style={{ background: '#E8F8F5', padding: 12, borderRadius: 10, border: '1.5px solid var(--ink)', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 800, color: '#666' }}>TOP WINNER</div>
                        <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Space Grotesk', color: 'var(--violet)' }}>👑 {selectedHistory.winnerName}</div>
                      </div>
                    </div>

                    {/* Question Accuracy Breakdown */}
                    <h4 style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
                      🎯 Question Accuracy Breakdown
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto', marginBottom: 16 }}>
                      {selectedHistory.questionStats?.map((qs, i) => (
                        <div key={i} style={{ padding: 10, background: 'var(--paper-2)', borderRadius: 8, border: '1px solid #ddd', fontSize: 12 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>Q{i + 1}: {qs.prompt}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: '#666' }}>{qs.correctCount}/{qs.totalResponses} Correct</span>
                            <span className={`badge ${qs.accuracyPercent >= 70 ? 'badge-mint' : 'badge-cherry'}`} style={{ fontSize: 10 }}>
                              {qs.accuracyPercent}% Acc
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Student Roster Leaderboard */}
                    <h4 style={{ fontFamily: 'Space Grotesk', fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
                      🏅 Student Scoreboard
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                      {selectedHistory.playersSummary?.map(p => (
                        <div key={p.nickname} className="lb-row" style={{ padding: '6px 10px', fontSize: 12 }}>
                          <span style={{ fontWeight: 800, fontFamily: 'Space Grotesk' }}>#{p.rank} {p.nickname}</span>
                          <span style={{ fontWeight: 800 }}>{p.score.toLocaleString()} pts ({p.accuracyPercent}%)</span>
                        </div>
                      ))}
                    </div>

                  </div>
                )}

              </div>
            )}
          </div>
        )}

        {/* TAB 3: TEACHER PROFILE */}
        {activeTab === 'profile' && (
          <div className="card anim-scale-in" style={{ maxWidth: 540, margin: '0 auto', padding: 28 }}>
            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 900, color: 'var(--ink)', marginBottom: 6 }}>
              👤 Teacher Profile & Preferences
            </h2>
            <p style={{ fontSize: 13, color: '#555', fontFamily: 'Inter', marginBottom: 20 }}>
              Update your host display name, school institution, and classroom profile.
            </p>

            {saveSuccess && (
              <div className="badge badge-mint" style={{ display: 'block', padding: 10, textAlign: 'center', marginBottom: 16, fontSize: 13 }}>
                ✅ Profile updated successfully!
              </div>
            )}

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 800, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                  Host / Teacher Display Name
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
                  Teacher Email (Read Only)
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
