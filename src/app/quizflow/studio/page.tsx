'use client'
export const dynamic = 'force-dynamic'
import { useState } from 'react'
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

const BLOOM_LEVELS: Array<{ value: BloomLevel; label: string; icon: string }> = [
  { value: 'Recall', label: 'Recall (Facts & Definitions)', icon: '🧠' },
  { value: 'Comprehension', label: 'Comprehension (Understanding)', icon: '💡' },
  { value: 'Application', label: 'Application (Problem Solving)', icon: '🛠️' },
  { value: 'Analysis', label: 'Analysis (Critical Thinking)', icon: '🔬' },
]

const DEFAULT_QUIZ: AIGeneratedQuiz = {
  title: 'Photosynthesis & Plant Biology Quiz',
  description: 'An interactive quiz covering solar energy conversion, chloroplasts, and cellular respiration.',
  language: 'English',
  bloomLevel: 'Recall',
  questions: [
    {
      prompt: 'What is the process by which plants convert sunlight into food?',
      choices: ['Cellular Respiration', 'Photosynthesis', 'Fermentation', 'Transpiration'],
      correct_index: 1,
      difficulty: 'easy',
      explanation: 'Photosynthesis occurs in chloroplasts using chlorophyll to capture light energy.',
      bloom_level: 'Recall',
      misconceptions: [
        'Cellular respiration breaks down glucose to release energy, rather than synthesizing food from sunlight.',
        '',
        'Fermentation is an anaerobic process that extracts energy without oxygen, not solar conversion.',
        'Transpiration is water evaporation through stomata, not chemical food synthesis.'
      ],
      time_limit_ms: 20000
    },
    {
      prompt: 'Which organelle is responsible for hosting photosynthesis in plant cells?',
      choices: ['Mitochondria', 'Nucleus', 'Chloroplast', 'Ribosome'],
      correct_index: 2,
      difficulty: 'medium',
      explanation: 'Chloroplasts contain chlorophyll pigments that absorb blue and red light wavelengths.',
      bloom_level: 'Recall',
      misconceptions: [
        'Mitochondria perform cellular respiration to generate ATP, not photosynthesis.',
        'The nucleus houses genomic DNA and controls cell transcription, not photosynthetic light reactions.',
        '',
        'Ribosomes translate mRNA into protein chains, not solar glucose synthesis.'
      ],
      time_limit_ms: 15000
    },
    {
      prompt: 'What are the main outputs (products) of photosynthesis?',
      choices: ['Carbon Dioxide & Water', 'Glucose & Oxygen', 'Nitrogen & ATP', 'Lactic Acid & CO2'],
      correct_index: 1,
      difficulty: 'easy',
      explanation: 'The chemical reaction produces 6O2 + C6H12O6 (Glucose and Oxygen).',
      bloom_level: 'Comprehension',
      misconceptions: [
        'Carbon dioxide and water are the required inputs/reactants, not the final outputs.',
        '',
        'Atmospheric nitrogen is not a product of photosynthetic light/dark reactions.',
        'Lactic acid and carbon dioxide are byproducts of anaerobic muscle fermentation.'
      ],
      time_limit_ms: 20000
    }
  ]
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
    setQuiz({ ...quiz, questions: quiz.questions.filter((_, i) => i !== index) })
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

  return (
    <div className="page-wrapper memphis-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* TOP NAV BAR */}
      <div className="top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/"><button className="btn btn-sm" style={{ background: 'var(--paper)', color: 'var(--ink)' }}>← Exit Studio</button></a>
          <span style={{ fontFamily: 'Space Grotesk', fontSize: 18, fontWeight: 800 }}>✨ AI Quiz Studio</span>
          {provider && <span className="badge badge-mint">⚡ {provider}</span>}
        </div>

        {/* Quiz Title */}
        <input
          type="text"
          value={quiz.title}
          onChange={e => setQuiz({ ...quiz, title: e.target.value })}
          style={{
            fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 700,
            padding: '7px 16px', color: 'var(--ink)',
            background: 'var(--paper)', border: '2px solid var(--paper)',
            borderRadius: 10, textAlign: 'center', width: 320, outline: 'none',
          }}
        />

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-sm"
            style={{ background: 'var(--mint)', color: 'var(--ink)' }}
            onClick={() => generatePrintableWorksheet(quiz, selectedVersion, includeAnswerKey)}
          >
            🖨️ Print Test Sheet (PDF)
          </button>
          <button className="btn btn-sm" style={{ background: 'var(--paper-2)', color: 'var(--ink)' }} onClick={() => {
            saveQuizDraft(quiz, true)
            alert('✅ Quiz saved to Teacher Dashboard!')
          }}>
            💾 Save Draft
          </button>
          <a href="/dashboard">
            <button className="btn btn-sm" style={{ background: 'var(--violet)', color: '#fff' }}>
              📊 Dashboard
            </button>
          </a>
          <button
            className="btn btn-sun btn-sm"
            disabled={publishing || quiz.questions.length === 0}
            onClick={() => {
              setPublishing(true)
              const state = createSession(quiz, 'host-' + Date.now())
              router.push(`/host?pin=${state.pin}`)
            }}
          >
            {publishing ? '🚀 Creating...' : '🚀 Publish & Host →'}
          </button>
        </div>
      </div>

      {/* THREE-PANEL LAYOUT */}
      <div style={{ flex: 1, padding: 20, display: 'grid', gridTemplateColumns: '340px 1fr 280px', gap: 20 }}>

        {/* LEFT PANEL: Multimodal AI Generator */}
        <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>✨</span>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 17, fontWeight: 800 }}>Multimodal AI Studio</h3>
          </div>

          {/* Mode Selector Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, background: 'var(--paper-2)', padding: 4, borderRadius: 10, border: '1.5px solid var(--ink)' }}>
            {[
              { id: 'topic', label: 'Prompt', icon: '✨' },
              { id: 'file', label: 'Document', icon: '📄' },
              { id: 'youtube', label: 'YouTube', icon: '🎥' },
              { id: 'webpage', label: 'Webpage', icon: '🌐' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setIngestMode(tab.id as any)
                  setIngestError(null)
                }}
                className="btn btn-sm"
                style={{
                  fontSize: 11,
                  padding: '6px 2px',
                  fontWeight: 800,
                  fontFamily: 'Space Grotesk',
                  background: ingestMode === tab.id ? 'var(--mint)' : 'transparent',
                  border: ingestMode === tab.id ? '1.5px solid var(--ink)' : 'none',
                  boxShadow: 'none'
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* TAB 1: Topic Prompt */}
          {ingestMode === 'topic' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', marginBottom: 6 }}>
                Topic / Subject
              </label>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. Quantum Physics, Photosynthesis, World War 2..."
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                style={{ resize: 'none', fontFamily: 'Inter' }}
              />
            </div>
          )}

          {/* TAB 2: File Upload (PDF / PPTX / TXT / MD) */}
          {ingestMode === 'file' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', marginBottom: 6 }}>
                Upload PDF / PPTX / Text File
              </label>
              <div style={{ border: '2px dashed var(--ink)', borderRadius: 10, padding: 14, textAlign: 'center', background: '#F8F6F0', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept=".pdf,.pptx,.ppt,.txt,.md,.json,.csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="studio-file-input"
                />
                <label htmlFor="studio-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>📄</div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800 }}>Choose File or Drag & Drop</div>
                  <div style={{ fontSize: 11, color: '#666' }}>Supports .pdf, .pptx, .txt, .md</div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 3: YouTube Video URL */}
          {ingestMode === 'youtube' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', marginBottom: 6 }}>
                YouTube Video Link
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="url"
                  className="input"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  style={{ fontFamily: 'Inter', fontSize: 12 }}
                />
                <button
                  className="btn btn-sm btn-mint"
                  onClick={handleYouTubeIngest}
                  disabled={ingesting || !youtubeUrl.trim()}
                  style={{ whiteSpace: 'nowrap', fontWeight: 800 }}
                >
                  {ingesting ? '⏳' : 'Fetch'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Webpage URL */}
          {ingestMode === 'webpage' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', marginBottom: 6 }}>
                Website / Article URL
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="url"
                  className="input"
                  placeholder="https://en.wikipedia.org/wiki/..."
                  value={webpageUrl}
                  onChange={e => setWebpageUrl(e.target.value)}
                  style={{ fontFamily: 'Inter', fontSize: 12 }}
                />
                <button
                  className="btn btn-sm btn-mint"
                  onClick={handleWebpageIngest}
                  disabled={ingesting || !webpageUrl.trim()}
                  style={{ whiteSpace: 'nowrap', fontWeight: 800 }}
                >
                  {ingesting ? '⏳' : 'Scrape'}
                </button>
              </div>
            </div>
          )}

          {/* Ingest Error Display */}
          {ingestError && (
            <div style={{ fontSize: 12, color: 'var(--cherry)', background: '#FFEBEB', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--cherry)' }}>
              ⚠️ {ingestError}
            </div>
          )}

          {/* Ingested Content Preview Card */}
          {ingestedContent && ingestMode !== 'topic' && (
            <div className="anim-fade-up" style={{ padding: 12, background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 10, boxShadow: '3px 3px 0 var(--ink)' }}>
              {ingestedContent.thumbnailUrl && (
                <img src={ingestedContent.thumbnailUrl} alt="Thumbnail" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, marginBottom: 8, border: '1px solid var(--ink)' }} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                <div>
                  <div style={{ fontFamily: 'Space Grotesk', fontSize: 13, fontWeight: 800, color: 'var(--ink)' }}>
                    {ingestedContent.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                    📊 Extracted ~{ingestedContent.wordCount.toLocaleString()} words
                  </div>
                </div>
                <button
                  onClick={() => setIngestedContent(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cherry)', fontSize: 14, fontWeight: 800 }}
                  title="Remove Content"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Bloom's Taxonomy Dropdown */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--violet)', marginBottom: 6 }}>
              🧠 Bloom&apos;s Taxonomy Level
            </label>
            <select
              value={bloomLevel}
              onChange={e => {
                const lvl = e.target.value as BloomLevel
                setBloomLevel(lvl)
                setQuiz({ ...quiz, bloomLevel: lvl })
              }}
              className="input"
              style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}
            >
              {BLOOM_LEVELS.map(lvl => (
                <option key={lvl.value} value={lvl.value}>
                  {lvl.icon} {lvl.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-violet"
            onClick={handleGenerate}
            disabled={generating || (ingestMode === 'topic' ? !topicInput.trim() : !ingestedContent)}
            style={{ width: '100%', padding: '14px', fontSize: 15, fontWeight: 800 }}
          >
            {generating ? '🤖 Generating...' : `✨ Generate ${questionCount} Qs (${bloomLevel})`}
          </button>

          <hr className="ink" />

          <div>
            <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', marginBottom: 6 }}>
              Number of Questions
            </label>
            <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} className="input" style={{ fontFamily: 'Inter' }}>
              <option value={3}>3 Questions (Fast)</option>
              <option value={5}>5 Questions (Standard)</option>
              <option value={10}>10 Questions (Full)</option>
              <option value={15}>15 Questions (Long)</option>
              <option value={20}>20 Questions (Exam)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#666', marginBottom: 6 }}>
              Language
            </label>
            <select value={selectedLang} onChange={e => setSelectedLang(e.target.value)} className="input" style={{ fontFamily: 'Inter' }}>
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.flag} {lang.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* CENTER PANEL: Question Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 17, fontWeight: 800 }}>
              Questions ({quiz.questions.length})
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={addQuestion} className="btn btn-sm btn-mint">+ Add Question</button>
            </div>
          </div>

          {quiz.questions.map((q, qIdx) => (
            <div key={qIdx} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className="badge badge-ink">Q{qIdx + 1}</span>

                {/* Bloom Level Badge Select */}
                <select
                  value={q.bloom_level || quiz.bloomLevel || 'Recall'}
                  onChange={e => updateQuestion(qIdx, { bloom_level: e.target.value as BloomLevel })}
                  style={{ fontSize: 12, fontWeight: 700, padding: '4px 8px', border: '1.5px solid var(--ink)', borderRadius: 8, background: '#F0EAFF', color: 'var(--violet)', fontFamily: 'Space Grotesk' }}
                >
                  <option value="Recall">🧠 Recall</option>
                  <option value="Comprehension">💡 Comprehension</option>
                  <option value="Application">🛠️ Application</option>
                  <option value="Analysis">🔬 Analysis</option>
                </select>

                <select value={q.difficulty} onChange={e => updateQuestion(qIdx, { difficulty: e.target.value as any })} style={{ fontSize: 12, padding: '4px 8px', border: '1.5px solid var(--ink)', borderRadius: 8, background: 'var(--paper)', fontFamily: 'Inter' }}>
                  <option value="easy">🟢 Easy</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="hard">🔴 Hard</option>
                </select>

                <select value={q.time_limit_ms} onChange={e => updateQuestion(qIdx, { time_limit_ms: Number(e.target.value) })} style={{ fontSize: 12, padding: '4px 8px', border: '1.5px solid var(--ink)', borderRadius: 8, background: 'var(--paper)', fontFamily: 'Inter' }}>
                  <option value={10000}>⏱ 10s</option>
                  <option value={15000}>⏱ 15s</option>
                  <option value={20000}>⏱ 20s</option>
                  <option value={30000}>⏱ 30s</option>
                </select>

                <button onClick={() => removeQuestion(qIdx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--cherry)' }} title="Delete">🗑️</button>
              </div>

              <input type="text" value={q.prompt} onChange={e => updateQuestion(qIdx, { prompt: e.target.value })} className="input" style={{ marginBottom: 12, fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 15 }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {q.choices.map((choice, cIdx) => (
                  <div key={cIdx} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, border: `2px solid ${q.correct_index === cIdx ? 'var(--mint)' : 'var(--ink)'}`, borderRadius: 10, background: q.correct_index === cIdx ? '#D4FAF0' : 'var(--paper)', boxShadow: '2px 2px 0 var(--ink)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input type="radio" name={`correct-${qIdx}`} checked={q.correct_index === cIdx} onChange={() => updateQuestion(qIdx, { correct_index: cIdx })} style={{ cursor: 'pointer', accentColor: 'var(--mint)' }} />
                      <input type="text" value={choice} onChange={e => { const nc = [...q.choices]; nc[cIdx] = e.target.value; updateQuestion(qIdx, { choices: nc }) }} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--ink)', fontSize: 13, outline: 'none', fontFamily: 'Inter', fontWeight: 600 }} />
                    </div>
                    {/* Misconception input for wrong choice */}
                    {q.correct_index !== cIdx && (
                      <input
                        type="text"
                        placeholder="🔍 Diagnostic misconception explanation..."
                        value={q.misconceptions?.[cIdx] || ''}
                        onChange={e => updateMisconception(qIdx, cIdx, e.target.value)}
                        style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 6, background: '#FFFCF5', color: '#555', outline: 'none' }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {q.explanation && (
                <div style={{ fontSize: 12, color: '#666', background: 'var(--paper-2)', padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}>
                  💡 <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* RIGHT PANEL: AI Tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 800 }}>AI Differentiate</h3>
            </div>

            <div style={{ background: 'var(--paper-2)', border: '1.5px solid var(--ink)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--violet)', marginBottom: 8 }}>🌐 TRANSLATE TO:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {LANGUAGES.slice(0, 10).map(lang => (
                  <button key={lang.code} onClick={() => handleDifferentiate('translate', lang.code)} disabled={adaptingAction !== null} className="btn btn-sm" style={{ fontSize: 11, background: quiz.language === lang.code ? 'var(--mint)' : 'var(--paper)', padding: '5px 8px' }}>
                    {lang.flag} {lang.code}
                  </button>
                ))}
              </div>
              {adaptingAction?.startsWith('translate-') && (
                <div style={{ fontSize: 11, color: 'var(--violet)', textAlign: 'center', marginTop: 8 }}>⏳ Translating...</div>
              )}
            </div>
            <button onClick={() => handleDifferentiate('add_scenarios')} disabled={adaptingAction !== null} className="btn" style={{ width: '100%', fontSize: 13, marginBottom: 8 }}>
              {adaptingAction === 'add_scenarios' ? '⏳ Writing...' : '💡 Real-World Scenarios'}
            </button>
            <button onClick={() => handleDifferentiate('harder_distractors')} disabled={adaptingAction !== null} className="btn" style={{ width: '100%', fontSize: 13, marginBottom: 8 }}>
              {adaptingAction === 'harder_distractors' ? '⏳ Working...' : '⚡ Harder Distractors'}
            </button>
            <button onClick={() => handleDifferentiate('simplify')} disabled={adaptingAction !== null} className="btn" style={{ width: '100%', fontSize: 13 }}>
              {adaptingAction === 'simplify' ? '⏳ Simplifying...' : '📘 Simplify Level'}
            </button>
          </div>

          {/* Printable PDF Worksheet Generator Card */}
          <div className="card" style={{ padding: 18, background: '#FFF8E1', border: '2px solid var(--ink)', boxShadow: '3px 3px 0 var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>🖨️</span>
              <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 800 }}>Printable Test Sheet</h3>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 11, fontFamily: 'Space Grotesk', fontWeight: 700, textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
                Test Version (Choice Order)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(['A', 'B', 'C', 'D'] as WorksheetVersion[]).map(ver => (
                  <button
                    key={ver}
                    onClick={() => setSelectedVersion(ver)}
                    className="btn btn-sm"
                    style={{
                      fontWeight: 800,
                      fontFamily: 'Space Grotesk',
                      background: selectedVersion === ver ? 'var(--sun)' : 'var(--paper)',
                      border: '2px solid var(--ink)',
                      boxShadow: selectedVersion === ver ? '2px 2px 0 var(--ink)' : 'none',
                    }}
                  >
                    {ver}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, cursor: 'pointer', marginBottom: 12, fontFamily: 'Inter', fontWeight: 600 }}>
              <span>🔑 Master Answer Key</span>
              <input
                type="checkbox"
                checked={includeAnswerKey}
                onChange={e => setIncludeAnswerKey(e.target.checked)}
                style={{ accentColor: 'var(--violet)', width: 16, height: 16 }}
              />
            </label>

            <button
              onClick={() => generatePrintableWorksheet(quiz, selectedVersion, includeAnswerKey)}
              disabled={quiz.questions.length === 0}
              className="btn btn-mint"
              style={{ width: '100%', padding: '10px', fontSize: 13, fontWeight: 800, border: '2px solid var(--ink)', boxShadow: '2px 2px 0 var(--ink)' }}
            >
              🖨️ Print Test Sheet (PDF)
            </button>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 800, marginBottom: 14 }}>Settings</h3>
            {[
              { label: '🔀 Shuffle Questions', val: shuffleQuestions, set: setShuffleQuestions },
              { label: '💡 Show Explanations', val: showExplanations, set: setShowExplanations },
              { label: '🧪 Allow Power-Ups',   val: allowPowerUps,    set: setAllowPowerUps },
            ].map(({ label, val, set }) => (
              <label key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, cursor: 'pointer', marginBottom: 10 }}>
                <span>{label}</span>
                <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor: 'var(--violet)', width: 16, height: 16 }} />
              </label>
            ))}
          </div>

          <div style={{ padding: 18, textAlign: 'center', background: 'var(--sun)', border: '2px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)' }}>
            <div className="section-label">QUIZ SUMMARY</div>
            <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 900, color: 'var(--ink)', margin: '4px 0' }}>{quiz.questions.length} Qs</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 4 }}>
              <span className="badge badge-sky">{quiz.language || 'English'}</span>
              <span className="badge badge-violet">{quiz.bloomLevel || bloomLevel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
