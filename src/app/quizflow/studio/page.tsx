'use client'
export const dynamic = 'force-dynamic'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { AIGeneratedQuiz, AIGeneratedQuestion, BloomLevel } from '@/quizflow/types'
import { createSession } from '@/quizflow/sessionStore'
import { generatePrintableWorksheet, type WorksheetVersion } from '@/quizflow/pdfGenerator'
import { ingestYouTubeUrl, ingestWebpageUrl, parseUploadedFile, type IngestedContent } from '@/quizflow/ingestion'
import { saveQuizDraft } from '@/quizflow/quizStore'

const LANGUAGES = [
  { code: 'Hindi', flag: '🇮🇳', label: 'Hindi (हिंदी)' },
  { code: 'Marathi', flag: '🇮🇳', label: 'Marathi (मराठी)' },
  { code: 'Bengali', flag: '🇮🇳', label: 'Bengali (বাংলা)' },
  { code: 'Gujarati', flag: '🇮🇳', label: 'Gujarati (ગુજરાતી)' },
  { code: 'Tamil', flag: '🇮🇳', label: 'Tamil (தமிழ்)' },
  { code: 'Telugu', flag: '🇮🇳', label: 'Telugu (తెలుగు)' },
  { code: 'French', flag: '🇫🇷', label: 'French (Français)' },
  { code: 'German', flag: '🇩🇪', label: 'German (Deutsch)' },
  { code: 'Spanish', flag: '🇪🇸', label: 'Spanish (Español)' },
  { code: 'Japanese', flag: '🇯🇵', label: 'Japanese (日本語)' },
  { code: 'English', flag: '🇬🇧', label: 'English' },
]

const BLOOM_LEVELS: Array<{ value: BloomLevel; label: string; icon: string; emoji: string }> = [
  { value: 'Recall', label: 'Recall (Facts & Definitions)', icon: '🧠', emoji: '🧠' },
  { value: 'Comprehension', label: 'Comprehension (Understanding)', icon: '💡', emoji: '💡' },
  { value: 'Application', label: 'Application (Problem Solving)', icon: '🛠️', emoji: '🛠️' },
  { value: 'Analysis', label: 'Analysis (Critical Thinking)', icon: '🔬', emoji: '🔬' },
]

const DEFAULT_QUIZ: AIGeneratedQuiz = {
  title: 'Untitled Quiz',
  description: '',
  language: 'English',
  bloomLevel: 'Recall',
  questions: []
}

export default function AIQuizStudio() {
  const router = useRouter()
  const [topicInput, setTopicInput]         = useState('')
  const [questionCount, setQuestionCount]   = useState(5)
  const [selectedLang, setSelectedLang]     = useState('English')
  const [bloomLevel, setBloomLevel]         = useState<BloomLevel>('Recall')
  const [generating, setGenerating]         = useState(false)
  const [publishing, setPublishing]         = useState(false)
  const [adaptingAction, setAdaptingAction] = useState<string | null>(null)
  const [provider, setProvider]             = useState<string | null>(null)
  const [quiz, setQuiz]                     = useState<AIGeneratedQuiz>(DEFAULT_QUIZ)
  const [selectedVersion, setSelectedVersion] = useState<WorksheetVersion>('A')
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true)

  // Ingestion Mode & States
  const [ingestMode, setIngestMode]         = useState<'topic' | 'file' | 'youtube' | 'webpage'>('topic')
  const [ingestedContent, setIngestedContent] = useState<IngestedContent | null>(null)
  const [ingesting, setIngesting]           = useState(false)
  const [youtubeUrl, setYoutubeUrl]         = useState('')
  const [webpageUrl, setWebpageUrl]         = useState('')
  const [ingestError, setIngestError]       = useState<string | null>(null)

  // Settings toggles
  const [shuffleQuestions, setShuffleQuestions] = useState(true)
  const [showExplanations, setShowExplanations] = useState(true)
  const [allowPowerUps, setAllowPowerUps]       = useState(true)

  // Edit title state
  const [editingTitle, setEditingTitle] = useState(false)
  const [tempTitle, setTempTitle] = useState(quiz.title)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Print view state
  const [showPrintModal, setShowPrintModal] = useState(false)

  // Question deleting animation
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [viewMode, setViewMode] = useState<'generate' | 'editor'>('generate')

  useEffect(() => {
    if (quiz.questions && quiz.questions.length > 0) {
      setViewMode('editor')
    }
  }, [])

  useEffect(() => {
    if (editingTitle) {
      titleInputRef.current?.focus()
    }
  }, [editingTitle])

  // Ingestion File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIngesting(true)
    setIngestError(null)
    try {
      const result = await parseUploadedFile(file)
      setIngestedContent(result)
      if (!topicInput) setTopicInput(result.title.replace(/^[^\s]+\s*/, ''))
    } catch (err: any) {
      setIngestError(err?.message || 'Failed to parse document file.')
    } finally {
      setIngesting(false)
    }
  }

  // Ingestion YouTube Handler
  const handleYouTubeIngest = async () => {
    if (!youtubeUrl.trim()) return
    setIngesting(true)
    setIngestError(null)
    try {
      const result = await ingestYouTubeUrl(youtubeUrl.trim())
      setIngestedContent(result)
      if (!topicInput) setTopicInput(result.title.replace(/^[^\s]+\s*/, ''))
    } catch (err: any) {
      setIngestError(err?.message || 'Failed to fetch YouTube video metadata.')
    } finally {
      setIngesting(false)
    }
  }

  // Ingestion Webpage Handler
  const handleWebpageIngest = async () => {
    if (!webpageUrl.trim()) return
    setIngesting(true)
    setIngestError(null)
    try {
      const result = await ingestWebpageUrl(webpageUrl.trim())
      setIngestedContent(result)
      if (!topicInput) setTopicInput(result.title.replace(/^[^\s]+\s*/, ''))
    } catch (err: any) {
      setIngestError(err?.message || 'Failed to fetch webpage text.')
    } finally {
      setIngesting(false)
    }
  }

  // Generate New Quiz
  const handleGenerate = async () => {
    let topic = topicInput.trim()
    let sourceText = ''
    let metaUrl = ''

    if (ingestMode !== 'topic' && ingestedContent) {
      topic = ingestedContent.title
      sourceText = ingestedContent.text
      metaUrl = ingestedContent.metaUrl || ''
    }

    if (!topic && !sourceText) return
    setGenerating(true)
    setViewMode('editor')
    try {
      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          sourceText,
          url: metaUrl,
          count: questionCount,
          targetLang: selectedLang,
          bloomLevel
        })
      })
      const data = await res.json()
      if (data.success && data.quiz) {
        setQuiz(data.quiz)
        setProvider(data.provider)
      }
    } catch (err) {
      console.error('Failed to generate quiz:', err)
    } finally {
      setGenerating(false)
    }
  }

  // AI Differentiate Actions
  const handleDifferentiate = async (actionType: string, langTarget?: string) => {
    const targetLanguage = langTarget || selectedLang
    setSelectedLang(targetLanguage)
    setAdaptingAction(actionType === 'translate' ? `translate-${targetLanguage}` : actionType)
    try {
      const activeTopic = topicInput.trim() || quiz.title || 'General Science'
      const payloadQuiz = quiz

      const res = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionType,
          topic: activeTopic,
          currentQuiz: payloadQuiz,
          count: questionCount,
          targetLang: targetLanguage,
          bloomLevel
        })
      })
      const data = await res.json()
      if (data.success && data.quiz) {
        setQuiz(data.quiz)
        setProvider(data.provider || 'AI Engine')
      }
    } catch (err) {
      console.error('AI Differentiate failed:', err)
    } finally {
      setAdaptingAction(null)
    }
  }

  const updateQuestion = (index: number, updated: Partial<AIGeneratedQuestion>) => {
    const nextQ = [...quiz.questions]
    nextQ[index] = { ...nextQ[index], ...updated }
    setQuiz({ ...quiz, questions: nextQ })
  }

  const updateMisconception = (qIdx: number, cIdx: number, text: string) => {
    const nextQ = [...quiz.questions]
    const currentMis = [...(nextQ[qIdx].misconceptions || ['', '', '', ''])]
    currentMis[cIdx] = text
    nextQ[qIdx] = { ...nextQ[qIdx], misconceptions: currentMis }
    setQuiz({ ...quiz, questions: nextQ })
  }

  const removeQuestion = (index: number) => {
    setDeletingId(index)
    setTimeout(() => {
      setQuiz({ ...quiz, questions: quiz.questions.filter((_, i) => i !== index) })
      setDeletingId(null)
    }, 220)
  }

  const addQuestion = () => {
    const newQ: AIGeneratedQuestion = {
      prompt: 'New Question Prompt...',
      choices: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_index: 0,
      difficulty: 'medium',
      bloom_level: bloomLevel,
      misconceptions: ['', 'Distractor B misconception', 'Distractor C misconception', 'Distractor D misconception'],
      time_limit_ms: 20000
    }
    setQuiz({ ...quiz, questions: [...quiz.questions, newQ] })
  }

  const currentBloomInfo = BLOOM_LEVELS.find(lvl => lvl.value === bloomLevel) || BLOOM_LEVELS[0]

  return (
    <div className="min-h-screen bg-[#F6F1E7] text-[#10100F] selection:bg-[#FFE57F] flex flex-col relative grain">
      
      {/* Styles Injection */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&family=Space+Grotesk:wght@600;700;800;900&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        .hard { box-shadow: 4px 4px 0px #10100F; }
        .soft { box-shadow: 2px 2px 0px #10100F; }
        .hard-white { box-shadow: 2px 2px 0px rgba(255,255,255,0.22); }
        .btn-press:active { transform: translate(2px,2px); box-shadow: 1px 1px 0px #10100F; }
        .btn-press-white:active { transform: translate(1px,1px); box-shadow: 1px 1px 0px rgba(255,255,255,0.22); }
        .grain:before {
          content:''; position:absolute; inset:0; pointer-events:none; opacity:0.025;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
        }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scale-in 0.3s ease-out forwards; }
      `}</style>

      {/* HEADER BAR (68px ink) */}
      <header className="h-[68px] bg-[#10100F] border-b-[3px] border-[#10100F] flex items-center justify-between px-5 sticky top-0 z-50 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => {
              if (viewMode === 'editor') {
                setViewMode('generate')
              } else {
                router.push('/quizflow')
              }
            }}
            className="h-10 px-4 bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] text-[13px] font-bold tracking-[-0.02em] flex items-center gap-2 btn-press hard-white text-[#10100F]"
          >
            <span>←</span> {viewMode === 'editor' ? 'Back to Generator' : 'Exit Studio'}
          </button>
          <div className="hidden lg:flex items-center gap-2 text-[#FFFCF5] sg font-extrabold text-[20px] tracking-[-0.03em]">
            <span className="w-8 h-8 bg-[#FFE57F] rounded-[8px] border-[2px] border-white/20 grid place-items-center text-[#10100F] text-[14px]">✦</span>
            AI Quiz Studio
          </div>
          {provider && <span className="h-7 px-3 bg-[#00E676] text-[#10100F] border-[2px] border-white/20 rounded-[8px] text-[11px] font-display font-bold flex items-center">⚡ {provider}</span>}
        </div>

        {/* Title Editing Pill */}
        {viewMode === 'editor' && (
          <div className="hidden md:flex flex-1 justify-center max-w-[420px] mx-4">
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={tempTitle}
                onChange={e => setTempTitle(e.target.value)}
                onBlur={() => {
                  setEditingTitle(false)
                  setQuiz({ ...quiz, title: tempTitle })
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setEditingTitle(false)
                    setQuiz({ ...quiz, title: tempTitle })
                  }
                }}
                className="w-full h-10 px-4 bg-white border-[3px] border-[#10100F] rounded-[24px] text-[13px] font-semibold outline-none text-[#10100F]"
              />
            ) : (
              <button
                onClick={() => {
                  setTempTitle(quiz.title)
                  setEditingTitle(true)
                }}
                className="w-full h-10 px-4 bg-[#FFF8EB] border-[3px] border-[#10100F] rounded-[24px] text-[13px] font-semibold flex items-center justify-between gap-2 text-left text-[#10100F] btn-press animate-scale-in"
              >
                <span className="truncate">{quiz.title}</span>
                <span className="shrink-0 w-6 h-6 grid place-items-center rounded-full bg-white border-[2px] border-[#10100F] text-[#10100F] text-[12px] hover:bg-[var(--sun)] transition-colors">✎</span>
              </button>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-[10px] shrink-0">
          {viewMode === 'editor' && (
            <>
              <button
                onClick={() => setShowPrintModal(true)}
                className="hidden sm:flex h-10 px-4 bg-[#00E676] border-[3px] border-[#10100F] rounded-[12px] text-[13px] font-bold items-center gap-2 hard-white btn-press-white text-[#10100F] animate-scale-in"
              >
                <span>⎙</span> Print Test PDF
              </button>
              <button
                onClick={() => {
                  saveQuizDraft(quiz, true)
                  alert('✅ Quiz saved to Teacher Dashboard!')
                }}
                className="hidden lg:flex h-10 px-4 bg-[#FFF8EB] border-[3px] border-white/20 rounded-[12px] text-[13px] font-bold hard-white btn-press-white text-white animate-scale-in"
              >
                Save Draft
              </button>
            </>
          )}
          <a href="/dashboard">
            <button className="h-10 px-4 bg-[#7C4DFF] border-[3px] border-white/20 rounded-[12px] text-[13px] font-bold hard-white btn-press-white text-white">
              Dashboard
            </button>
          </a>
          <button
            disabled={publishing || quiz.questions.length === 0}
            onClick={() => {
              setPublishing(true)
              const state = createSession(quiz, 'host-' + Date.now())
              router.push(`/host?pin=${state.pin}`)
            }}
            className="h-10 px-4 bg-[#FFE57F] border-[3px] border-white/20 rounded-[12px] text-[13px] font-bold hard-white btn-press-white text-[#10100F]"
          >
            {publishing ? 'Creating...' : 'Publish & Host'}
          </button>
        </div>
      </header>

      {viewMode === 'generate' ? (
        <div className="flex-1 flex items-center justify-center p-4 md:p-8 w-full max-w-[1440px] mx-auto animate-scale-in">
          <div className="w-full max-w-[640px] bg-[#FFF8EB] border-[3px] border-[#10100F] rounded-[20px] hard p-6 md:p-8 relative overflow-hidden">
            
            <div className="flex items-center gap-2.5 sg font-extrabold text-[22px] tracking-[-0.02em] mb-6">
              <span className="text-[24px]">✦</span> Multimodal AI Input
            </div>

            {/* Input Method Switcher */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {[
                { id: 'topic', label: 'Prompt', icon: '✦' },
                { id: 'file', label: 'Document', icon: '◫' },
                { id: 'youtube', label: 'YouTube', icon: '▶' },
                { id: 'webpage', label: 'Webpage', icon: '◍' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setIngestMode(tab.id as any)
                    setIngestError(null)
                  }}
                  className={`h-11 border-[3px] rounded-[12px] text-[12px] font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 transition-all btn-press ${
                    ingestMode === tab.id
                      ? 'bg-[#00E676] border-[#10100F] soft'
                      : 'bg-[#FFFCF5] border-[#10100F]/15 hover:border-[#10100F]'
                  }`}
                >
                  <span className="text-[14px]">{tab.icon}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Ingestion Panel Body */}
            <div className="mb-5">
              {ingestMode === 'topic' && (
                <div>
                  <label className="sg text-[11px] font-bold tracking-[0.08em] text-black/50 block mb-2">TOPIC / SUBJECT</label>
                  <textarea
                    value={topicInput}
                    onChange={e => setTopicInput(e.target.value)}
                    placeholder="e.g. Cellular respiration, molecular taxonomy, chemistry of catalysts..."
                    className="w-full h-[110px] bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] p-3.5 text-[14px] font-medium outline-none resize-none leading-[1.4] placeholder:text-black/30"
                  />
                </div>
              )}

              {ingestMode === 'file' && (
                <div>
                  <label className="sg text-[11px] font-bold tracking-[0.08em] text-black/50 block mb-2">UPLOAD DRAFT OR DOCUMENT</label>
                  <div className="border-[3px] border-dashed border-[#10100F]/20 rounded-[12px] p-6 text-center bg-[#FFFCF5]/50 hover:bg-[#FFFCF5] transition-colors relative cursor-pointer">
                    <input
                      type="file"
                      accept=".pdf,.pptx,.ppt,.txt,.md,.json,.csv"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <div className="text-[32px] mb-2">📄</div>
                    <div className="font-display font-[800] text-[14px]">Choose Document</div>
                    <div className="text-[11px] text-black/50 mt-1">Supports PDF, PPTX, MD, TXT</div>
                  </div>
                </div>
              )}

              {ingestMode === 'youtube' && (
                <div>
                  <label className="sg text-[11px] font-bold tracking-[0.08em] text-black/50 block mb-2">YOUTUBE VIDEO LINK</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={e => setYoutubeUrl(e.target.value)}
                      className="flex-1 h-[48px] bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] px-3.5 text-[13px] font-medium outline-none"
                    />
                    <button
                      onClick={handleYouTubeIngest}
                      disabled={ingesting || !youtubeUrl.trim()}
                      className="h-[48px] bg-[#00E676] border-[3px] border-[#10100F] rounded-[12px] px-4 font-display font-bold text-[12px] btn-press soft"
                    >
                      {ingesting ? '⏳' : 'Fetch'}
                    </button>
                  </div>
                </div>
              )}

              {ingestMode === 'webpage' && (
                <div>
                  <label className="sg text-[11px] font-bold tracking-[0.08em] text-black/50 block mb-2">SCRAPE WEBPAGE URL</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://en.wikipedia.org/wiki/..."
                      value={webpageUrl}
                      onChange={e => setWebpageUrl(e.target.value)}
                      className="flex-1 h-[48px] bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] px-3.5 text-[13px] font-medium outline-none"
                    />
                    <button
                      onClick={handleWebpageIngest}
                      disabled={ingesting || !webpageUrl.trim()}
                      className="h-[48px] bg-[#00E676] border-[3px] border-[#10100F] rounded-[12px] px-4 font-display font-bold text-[12px] btn-press soft"
                    >
                      {ingesting ? '⏳' : 'Scrape'}
                    </button>
                  </div>
                </div>
              )}

              {ingestError && (
                <div className="mt-3 text-[12px] font-bold text-[var(--cherry)] bg-red-50 border-[2px] border-[var(--cherry)] p-2.5 rounded-[8px]">
                  ⚠️ {ingestError}
                </div>
              )}

              {ingestedContent && ingestMode !== 'topic' && (
                <div className="mt-4 p-3 bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] soft flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-display font-black truncate">{ingestedContent.title}</div>
                    <div className="text-[10px] font-mono text-black/50 mt-0.5">📂 {ingestedContent.wordCount.toLocaleString()} words loaded</div>
                  </div>
                  <button onClick={() => setIngestedContent(null)} className="text-[var(--cherry)] font-bold">✕</button>
                </div>
              )}
            </div>

            {/* Bloom & Question Count & Language */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              
              <div>
                <label className="sg text-[11px] font-bold tracking-[0.08em] text-[var(--violet)] block mb-2 uppercase">BLOOM&apos;S TAXONOMY LEVEL</label>
                <div className="relative">
                  <select
                    value={bloomLevel}
                    onChange={e => {
                      const lvl = e.target.value as BloomLevel
                      setBloomLevel(lvl)
                      setQuiz({ ...quiz, bloomLevel: lvl })
                    }}
                    className="w-full h-[44px] bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] px-3 text-[13px] font-semibold outline-none appearance-none"
                  >
                    {BLOOM_LEVELS.map(lvl => (
                      <option key={lvl.value} value={lvl.value}>
                        {lvl.emoji} {lvl.value}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-black/55 font-bold">⌄</div>
                </div>
              </div>

              <div>
                <label className="sg text-[11px] font-bold tracking-[0.08em] text-black/50 block mb-2 uppercase">NUMBER OF QUESTIONS</label>
                <div className="relative">
                  <select
                    value={questionCount}
                    onChange={e => setQuestionCount(Number(e.target.value))}
                    className="w-full h-[44px] bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] px-3 text-[13px] font-semibold outline-none appearance-none"
                  >
                    <option value={3}>3 Questions</option>
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-black/55 font-bold">⌄</div>
                </div>
              </div>

              <div>
                <label className="sg text-[11px] font-bold tracking-[0.08em] text-black/50 block mb-2 uppercase">DEFAULT DIALECT / REGION</label>
                <div className="relative">
                  <select
                    value={selectedLang}
                    onChange={e => setSelectedLang(e.target.value)}
                    className="w-full h-[44px] bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] px-3 text-[13px] font-semibold outline-none appearance-none"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.flag} {lang.code}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-black/55 font-bold">⌄</div>
                </div>
              </div>

            </div>

            {/* Settings Toggles */}
            <div className="border-t-[2px] border-black/10 pt-5 mb-6">
              <h4 className="sg text-[11px] font-bold tracking-[0.08em] text-black/50 mb-3 uppercase">Generator Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Shuffle Questions', checked: shuffleQuestions, set: setShuffleQuestions },
                  { label: 'Show Explanations', checked: showExplanations, set: setShowExplanations },
                  { label: 'Allow Power-Ups', checked: allowPowerUps, set: setAllowPowerUps },
                ].map(cfg => (
                  <label key={cfg.label} className="flex items-center justify-between cursor-pointer group select-none bg-[#FFFCF5] border-[2px] border-[#10100F]/15 hover:border-[#10100F] rounded-[10px] p-2.5">
                    <span className="text-[12px] font-bold">{cfg.label}</span>
                    <button
                      onClick={() => cfg.set(!cfg.checked)}
                      className={`w-5 h-5 rounded-[6px] border-[2px] border-[#10100F] grid place-items-center transition ${
                        cfg.checked ? 'bg-[#7C4DFF] text-white' : 'bg-white'
                      }`}
                    >
                      {cfg.checked && <span className="text-[11px] font-bold">✓</span>}
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {/* Primary HERO Action Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || (ingestMode === 'topic' ? !topicInput.trim() : !ingestedContent)}
              className="w-full h-[54px] bg-[#FFE57F] border-[3px] border-[#10100F] rounded-[12px] hard sg font-extrabold text-[16px] tracking-[-0.02em] flex items-center justify-center gap-2 btn-press disabled:opacity-60"
            >
              {generating ? '🤖 Generating...' : `✨ Generate ${questionCount} Qs (${bloomLevel})`}
            </button>

          </div>
        </div>
      ) : (
        <div className="max-w-[1440px] mx-auto p-6 flex flex-col lg:grid lg:grid-cols-[1fr_320px] gap-6 items-start w-full animate-scale-in">
          
          {/* CENTER COLUMN: Interactive Question Cards */}
          <main className="w-full min-w-0 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="sg font-extrabold text-[22px] tracking-[-0.03em]">
                Questions ({quiz.questions.length})
              </h2>
              <button
                onClick={addQuestion}
                className="h-10 px-4 bg-[#00E676] border-[3px] border-[#10100F] rounded-[12px] text-[13px] font-bold soft btn-press"
              >
                + Add Question
              </button>
            </div>

            <div className="flex flex-col gap-6 w-full">
              {generating && (
                <div className="flex flex-col gap-6 w-full">
                  {[0, 1, 2].map(skeletonIdx => (
                    <div key={skeletonIdx} className="bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[16px] hard p-6 animate-pulse">
                      <div className="h-5 w-28 bg-black/10 rounded-full mb-4"></div>
                      <div className="h-6 w-5/6 bg-black/10 rounded-[8px] mb-3"></div>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        <div className="h-16 bg-black/5 rounded-[12px] border-[2px] border-black/5"></div>
                        <div className="h-16 bg-black/5 rounded-[12px] border-[2px] border-black/5"></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!generating && quiz.questions.map((q, qIdx) => (
                <div
                  key={qIdx}
                  className={`bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[16px] hard p-6 transition-all duration-200 ${
                    deletingId === qIdx ? 'scale-[0.96] opacity-0' : ''
                  }`}
                >
                  {/* Question Info Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="h-7 px-3 bg-[#10100F] text-[#FFFCF5] rounded-[24px] text-[12px] font-bold sg tracking-[0.04em] grid place-items-center">
                      Q{qIdx + 1}
                    </span>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Bloom taxonomy select */}
                      <select
                        value={q.bloom_level || 'Recall'}
                        onChange={e => updateQuestion(qIdx, { bloom_level: e.target.value as BloomLevel })}
                        className="h-8 px-2.5 bg-[#EDE7FF] border-[2px] border-[#10100F] rounded-[24px] text-[11px] font-bold outline-none sg cursor-pointer"
                      >
                        <option value="Recall">🧠 Recall</option>
                        <option value="Comprehension">💡 Comprehension</option>
                        <option value="Application">🛠️ Application</option>
                        <option value="Analysis">🔬 Analysis</option>
                      </select>

                      {/* Difficulty select */}
                      <select
                        value={q.difficulty}
                        onChange={e => updateQuestion(qIdx, { difficulty: e.target.value as any })}
                        className="h-8 px-2.5 bg-[#D9FDE8] border-[2px] border-[#10100F] rounded-[24px] text-[11px] font-bold outline-none cursor-pointer"
                      >
                        <option value="easy">🟢 Easy</option>
                        <option value="medium">🟡 Medium</option>
                        <option value="hard">🔴 Hard</option>
                      </select>

                      {/* Time limit select */}
                      <select
                        value={q.time_limit_ms}
                        onChange={e => updateQuestion(qIdx, { time_limit_ms: Number(e.target.value) })}
                        className="h-8 px-2.5 bg-white border-[2px] border-[#10100F] rounded-[24px] text-[11px] font-bold outline-none cursor-pointer"
                      >
                        <option value={10000}>⏱ 10s</option>
                        <option value={15000}>⏱ 15s</option>
                        <option value={20000}>⏱ 20s</option>
                        <option value={30000}>⏱ 30s</option>
                      </select>

                      {/* Action delete */}
                      <button
                        onClick={() => removeQuestion(qIdx)}
                        className="w-9 h-8 bg-[#FFF8EB] border-[2px] border-[#10100F] rounded-[10px] grid place-items-center hover:bg-[#FF5252] hover:text-white transition btn-press text-[13px] shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt Editable Textarea */}
                  <textarea
                    value={q.prompt}
                    onChange={e => updateQuestion(qIdx, { prompt: e.target.value })}
                    className="w-full mt-4 bg-transparent text-[18px] font-semibold leading-[1.5] outline-none resize-none border-b-[2px] border-dashed border-transparent focus:border-black/20"
                    rows={2}
                  />

                  {/* 2-Column Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    {q.choices.map((choice, cIdx) => {
                      const isCorrect = q.correct_index === cIdx
                      return (
                        <div
                          key={cIdx}
                          className={`text-left min-h-[64px] border-[3px] rounded-[12px] p-3 flex gap-3 items-start transition-all cursor-pointer ${
                            isCorrect
                              ? 'bg-[#D9FDE8] border-[#00E676] soft'
                              : 'bg-[#FFF8EB] border-[#10100F] hover:translate-y-[-1px]'
                          }`}
                          onClick={() => updateQuestion(qIdx, { correct_index: cIdx })}
                        >
                          <span className={`w-5 h-5 shrink-0 mt-0.5 rounded-full border-[3px] border-[#10100F] grid place-items-center ${
                            isCorrect ? 'bg-[#00E676]' : 'bg-white'
                          }`}>
                            {isCorrect && <span className="w-2 h-2 rounded-full bg-[#10100F]" />}
                          </span>
                          
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={choice}
                              onChange={e => {
                                const nc = [...q.choices]
                                nc[cIdx] = e.target.value
                                updateQuestion(qIdx, { choices: nc })
                              }}
                              className="w-full bg-transparent font-extrabold text-[13px] outline-none border-none text-[#10100F]"
                            />
                            {!isCorrect ? (
                              <input
                                type="text"
                                placeholder="🔍 Add misconceptions..."
                                value={q.misconceptions?.[cIdx] || ''}
                                onChange={e => updateMisconception(qIdx, cIdx, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="w-full mt-1 bg-transparent text-[11px] text-black/50 outline-none border-none"
                              />
                            ) : (
                              <div className="text-[11px] text-black/55 mt-1 font-semibold">Correct Answer</div>
                            )}
                          </div>

                          {isCorrect && (
                            <span className="shrink-0 w-6 h-6 rounded-full bg-[#00E676] border-[2px] border-[#10100F] grid place-items-center text-[12px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* Explanation Field */}
                  {showExplanations && q.explanation && (
                    <div className="mt-4 border-[2px] border-dashed border-black/15 bg-[#F9F6F0] rounded-[12px] px-3.5 py-3">
                      <span className="text-[13px] leading-[1.5] text-black/70 font-medium">
                        <span className="font-bold">💡 Explanation:</span> {q.explanation}
                      </span>
                    </div>
                  )}

                </div>
              ))}

              {!generating && quiz.questions.length < 6 && (
                <div className="border-[3px] border-dashed border-[#10100F]/20 rounded-[16px] p-8 text-center bg-[#FFFCF5]/60 w-full">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#FFE57F] border-[2px] border-[#10100F] grid place-items-center text-[18px] mb-3">✦</div>
                  <p className="sg font-bold text-[15px]">Add questions or generate more</p>
                  <p className="text-[13px] text-black/50 font-medium mt-1">Use the generator or craft a custom question with AI assists.</p>
                  <div className="mt-4 flex gap-2 justify-center">
                    <button onClick={addQuestion} className="h-10 px-4 bg-white border-[3px] border-[#10100F] rounded-[12px] text-[13px] font-bold soft btn-press">
                      + Blank Question
                    </button>
                    <button onClick={handleGenerate} className="h-10 px-4 bg-[#FFE57F] border-[3px] border-[#10100F] rounded-[12px] text-[13px] font-bold soft btn-press">
                      ✦ Generate 2 More
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* RIGHT COLUMN: AI Adaptations & Info Summary */}
          <aside className="w-full lg:sticky lg:top-[92px] flex flex-col gap-5">
            
            {/* AI Differentiate Card */}
            <div className="bg-[#FFF8EB] border-[3px] border-[#10100F] rounded-[16px] hard p-5">
              <div className="flex items-center gap-2 sg font-bold text-[16px] tracking-[-0.02em] mb-4">
                <span>🤖</span> AI Differentiate
              </div>

              <div className="bg-[#FFFCF5] border-[2px] border-[#10100F] rounded-[12px] p-3 mb-4 soft">
                <div className="sg text-[11px] font-extrabold tracking-[0.1em] text-[#7C4DFF] mb-3">🌐 TRANSLATE TO:</div>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.slice(0, 10).map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleDifferentiate('translate', lang.code)}
                      disabled={adaptingAction !== null}
                      className={`h-9 border-[2px] border-[#10100F] rounded-[10px] text-[11px] font-bold tracking-[-0.01em] transition btn-press ${
                        quiz.language === lang.code ? 'bg-[#FFE57F]' : 'bg-[#FFFCF5]'
                      }`}
                    >
                      {lang.flag} {lang.code}
                    </button>
                  ))}
                </div>
                {adaptingAction?.startsWith('translate-') && (
                  <div className="text-[11px] text-[var(--violet)] text-center mt-3 animate-pulse">⏳ Translating...</div>
                )}
              </div>

              <div className="flex flex-col gap-2.5">
                {[
                  { action: 'add_scenarios', label: 'Real-World Scenarios', icon: '🌏' },
                  { action: 'harder_distractors', label: 'Harder Distractors', icon: '🧩' },
                  { action: 'simplify', label: 'Simplify Level', icon: '🍃' }
                ].map(opt => (
                  <button
                    key={opt.action}
                    onClick={() => handleDifferentiate(opt.action)}
                    disabled={adaptingAction !== null}
                    className="w-full h-11 bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[12px] text-[13px] font-bold flex items-center gap-2 px-3 soft btn-press"
                  >
                    <span>{opt.icon}</span>
                    {adaptingAction === opt.action ? 'Working...' : opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Settings Toggles */}
            <div className="bg-[#FFF8EB] border-[3px] border-[#10100F] rounded-[16px] hard p-5">
              <h3 className="sg font-bold text-[16px] mb-4">Settings</h3>
              <div className="flex flex-col gap-3.5">
                {[
                  { label: 'Shuffle Questions', checked: shuffleQuestions, set: setShuffleQuestions },
                  { label: 'Show Explanations', checked: showExplanations, set: setShowExplanations },
                  { label: 'Allow Power-Ups', checked: allowPowerUps, set: setAllowPowerUps },
                ].map(cfg => (
                  <label key={cfg.label} className="flex items-center justify-between cursor-pointer group select-none">
                    <span className="text-[13px] font-semibold">{cfg.label}</span>
                    <button
                      onClick={() => cfg.set(!cfg.checked)}
                      className={`w-5 h-5 rounded-[6px] border-[2px] border-[#10100F] grid place-items-center transition ${
                        cfg.checked ? 'bg-[#7C4DFF] text-white' : 'bg-white'
                      }`}
                    >
                      {cfg.checked && <span className="text-[11px] font-bold">✓</span>}
                    </button>
                  </label>
                ))}
              </div>
            </div>

            {/* Sticky Summary Card */}
            <div className="bg-[#FFE57F] border-[3px] border-[#10100F] rounded-[16px] hard p-5 text-center">
              <div className="sg text-[11px] font-bold tracking-[0.12em] text-black/60">QUIZ SUMMARY</div>
              <div className="sg font-extrabold text-[36px] tracking-[-0.04em] leading-none mt-2">{quiz.questions.length} Qs</div>
              <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
                <span className="h-7 px-3 bg-[#40C4FF] border-[2px] border-[#10100F] rounded-[24px] text-[11px] font-bold grid place-items-center uppercase">
                  {quiz.language || 'English'}
                </span>
                <span className="h-7 px-3 bg-[#EDE7FF] border-[2px] border-[#10100F] rounded-[24px] text-[11px] font-bold grid place-items-center uppercase">
                  {quiz.bloomLevel || bloomLevel}
                </span>
              </div>

              {/* Difficulty spread */}
              <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-bold">
                <div className="bg-white border-[2px] border-[#10100F] rounded-[10px] py-2">
                  <div className="text-[16px] sg">{quiz.questions.filter(x => x.difficulty === 'easy').length}</div>
                  Easy
                </div>
                <div className="bg-white border-[2px] border-[#10100F] rounded-[10px] py-2">
                  <div className="text-[16px] sg">{quiz.questions.filter(x => x.difficulty === 'medium').length}</div>
                  Med
                </div>
                <div className="bg-white border-[2px] border-[#10100F] rounded-[10px] py-2">
                  <div className="text-[16px] sg">{quiz.questions.filter(x => x.difficulty === 'hard').length}</div>
                  Hard
                </div>
              </div>
            </div>

          </aside>

        </div>
      )}

      {/* PDF Export Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[2px] p-4 md:p-8 overflow-auto flex items-center justify-center">
          <div className="w-full max-w-[560px] bg-[#FFFCF5] border-[3px] border-[#10100F] rounded-[16px] hard p-6 relative">
            
            <div className="flex items-center justify-between mb-5">
              <h3 className="sg font-extrabold text-[18px]">⎙ Print Worksheet Sheet Options</h3>
              <button onClick={() => setShowPrintModal(false)} className="w-8 h-8 bg-white border-[2px] border-[#10100F] rounded-[8px] font-bold flex items-center justify-center hover:bg-[var(--cherry)] hover:text-white transition">✕</button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="sg text-[11px] font-bold tracking-[0.08em] text-black/60 block mb-2 uppercase">Test Version Variation</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['A', 'B', 'C', 'D'] as WorksheetVersion[]).map(ver => (
                    <button
                      key={ver}
                      onClick={() => setSelectedVersion(ver)}
                      className={`h-11 rounded-[10px] border-[3px] border-[#10100F] font-display font-black text-[14px] transition-all btn-press ${
                        selectedVersion === ver ? 'bg-[#FFE57F] soft' : 'bg-white hover:bg-[#FFF8EB]'
                      }`}
                    >
                      Version {ver}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t-[2px] border-black/10 pt-4">
                <span className="text-[13px] font-semibold">Include Answer Key page</span>
                <button
                  onClick={() => setIncludeAnswerKey(!includeAnswerKey)}
                  className={`w-5 h-5 rounded-[6px] border-[2px] border-[#10100F] grid place-items-center transition ${
                    includeAnswerKey ? 'bg-[#7C4DFF] text-white' : 'bg-white'
                  }`}
                >
                  {includeAnswerKey && <span className="text-[11px] font-bold">✓</span>}
                </button>
              </div>

              <button
                onClick={() => {
                  generatePrintableWorksheet(quiz, selectedVersion, includeAnswerKey)
                  setShowPrintModal(false)
                }}
                disabled={quiz.questions.length === 0}
                className="w-full h-12 bg-[#00E676] border-[3px] border-[#10100F] rounded-[12px] font-display font-bold text-[14px] hard btn-press uppercase"
              >
                🖨️ Generate PDF Printout
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Spacing bottom */}
      <div className="h-10" />

    </div>
  )
}
