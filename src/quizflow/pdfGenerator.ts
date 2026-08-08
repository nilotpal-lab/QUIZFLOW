/* ================================================================
   QuizFlow — Printable PDF Worksheet Generator
   Generates print-ready HTML documents for window.print()
   supporting Test Versions A, B, C, D (randomized choices)
   and optional Master Answer Key.
   ================================================================ */

import type { AIGeneratedQuiz, AIGeneratedQuestion } from './types'

export type WorksheetVersion = 'A' | 'B' | 'C' | 'D'

export interface WorksheetOptions {
  quiz: AIGeneratedQuiz
  version?: WorksheetVersion
  showAnswerKey?: boolean
}

// Simple seeded pseudo-random generator for deterministic shuffling per version
function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function getVersionSeed(quizTitle: string, version: WorksheetVersion): number {
  const versionMap: Record<WorksheetVersion, number> = { A: 101, B: 202, C: 303, D: 404 }
  let hash = versionMap[version] || 101
  for (let i = 0; i < quizTitle.length; i++) {
    hash = (hash << 5) - hash + quizTitle.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export interface ProcessedQuestion {
  prompt: string
  choices: string[]
  correctIndex: number
  difficulty?: string
  explanation?: string
}

export function processQuestionsForVersion(
  quiz: AIGeneratedQuiz,
  version: WorksheetVersion
): ProcessedQuestion[] {
  return quiz.questions.map((q, qIndex) => {
    if (version === 'A') {
      return {
        prompt: q.prompt,
        choices: q.choices,
        correctIndex: q.correct_index,
        difficulty: q.difficulty,
        explanation: q.explanation,
      }
    }

    const seed = getVersionSeed(quiz.title, version) + qIndex * 37
    const rng = seededRandom(seed)

    const indexedChoices = q.choices.map((text, idx) => ({
      text,
      isCorrect: idx === q.correct_index,
    }))

    // Fisher-Yates shuffle with seeded RNG
    for (let i = indexedChoices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[indexedChoices[i], indexedChoices[j]] = [indexedChoices[j], indexedChoices[i]]
    }

    const newChoices = indexedChoices.map(c => c.text)
    const newCorrectIndex = indexedChoices.findIndex(c => c.isCorrect)

    return {
      prompt: q.prompt,
      choices: newChoices,
      correctIndex: newCorrectIndex,
      difficulty: q.difficulty,
      explanation: q.explanation,
    }
  })
}

function escapeHTML(str: unknown): string {
  if (typeof str !== 'string') return str ? String(str) : ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function generateWorksheetHTML(options: WorksheetOptions): string {
  const { quiz, version = 'A', showAnswerKey = true } = options
  const questions = processQuestionsForVersion(quiz, version)
  const letters = ['A', 'B', 'C', 'D']

  return `
<!DOCTYPE html>
<html lang="${escapeHTML(quiz.language || 'en')}">
<head>
  <meta charset="UTF-8">
  <title>${escapeHTML(quiz.title)} — Version ${version}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700;800&display=swap');

    @page {
      size: letter portrait;
      margin: 18mm 16mm 18mm 16mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #10100F;
      background: #FFF;
      line-height: 1.4;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .header-card {
      border: 3px solid #10100F;
      box-shadow: 4px 4px 0 #10100F;
      background: #FFFCF5;
      padding: 16px 20px;
      margin-bottom: 20px;
      border-radius: 8px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
      border-bottom: 2px dashed #10100F;
      padding-bottom: 10px;
    }

    .quiz-title {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 22px;
      font-weight: 800;
      color: #10100F;
      margin-bottom: 4px;
    }

    .quiz-desc {
      font-size: 13px;
      color: #555;
      font-style: italic;
    }

    .version-badge {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px;
      font-weight: 800;
      background: #FFE57F;
      border: 2px solid #10100F;
      padding: 4px 12px;
      border-radius: 6px;
      box-shadow: 2px 2px 0 #10100F;
      white-space: nowrap;
    }

    .student-fields {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 16px;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 13px;
      font-weight: 700;
    }

    .field-line {
      border-bottom: 2px solid #10100F;
      padding-bottom: 4px;
    }

    .question-block {
      border: 2px solid #10100F;
      box-shadow: 3px 3px 0 #10100F;
      background: #FFFCF5;
      padding: 16px;
      margin-bottom: 16px;
      border-radius: 6px;
      page-break-inside: avoid;
    }

    .question-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .q-number {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 14px;
      font-weight: 800;
      background: #10100F;
      color: #FFFCF5;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .q-prompt {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #10100F;
    }

    .choices-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 16px;
      margin-top: 10px;
      padding-left: 8px;
    }

    .choice-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }

    .checkbox {
      width: 16px;
      height: 16px;
      border: 2px solid #10100F;
      border-radius: 3px;
      display: inline-block;
      flex-shrink: 0;
      background: #FFF;
    }

    .choice-label {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      margin-right: 2px;
    }

    .page-break {
      page-break-before: always;
      margin-top: 40px;
    }

    .answer-key-header {
      font-family: 'Space Grotesk', sans-serif;
      font-size: 20px;
      font-weight: 800;
      background: #C8E6C9;
      border: 3px solid #10100F;
      box-shadow: 4px 4px 0 #10100F;
      padding: 14px 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .key-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
    }

    .key-table th, .key-table td {
      border: 2px solid #10100F;
      padding: 10px 12px;
      text-align: left;
      font-size: 13px;
    }

    .key-table th {
      font-family: 'Space Grotesk', sans-serif;
      background: #F4EFE6;
      font-weight: 800;
    }

    .footer {
      margin-top: 30px;
      text-align: center;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 11px;
      color: #777;
      border-top: 1px solid #CCC;
      padding-top: 10px;
    }
  </style>
</head>
<body>

  <div class="header-card">
    <div class="header-top">
      <div>
        <div class="quiz-title">${escapeHTML(quiz.title)}</div>
        <div class="quiz-desc">${escapeHTML(quiz.description || '')}</div>
      </div>
      <div class="version-badge">Version ${escapeHTML(version)}</div>
    </div>
    <div class="student-fields">
      <div class="field-line">Name: _______________________________</div>
      <div class="field-line">Date: ____________</div>
      <div class="field-line">Score: ____ / ${questions.length}</div>
    </div>
  </div>

  <div class="questions-container">
    ${questions.map((q, idx) => `
      <div class="question-block">
        <div class="question-header">
          <span class="q-number">Q${idx + 1}</span>
          <span class="q-prompt">${escapeHTML(q.prompt)}</span>
        </div>
        <div class="choices-grid">
          ${q.choices.map((choiceText, cIdx) => `
            <div class="choice-item">
              <span class="checkbox"></span>
              <span class="choice-label">${letters[cIdx % letters.length]}.</span>
              <span>${escapeHTML(choiceText)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('')}
  </div>

  ${showAnswerKey ? `
    <div class="page-break"></div>
    <div class="answer-key-header">
      <span>🔑 MASTER ANSWER KEY</span>
      <span style="font-size: 14px;">Test Version ${escapeHTML(version)}</span>
    </div>

    <table class="key-table">
      <thead>
        <tr>
          <th style="width: 60px;">Q #</th>
          <th style="width: 100px;">Correct Choice</th>
          <th>Answer Text</th>
          <th>Explanation</th>
        </tr>
      </thead>
      <tbody>
        ${questions.map((q, idx) => {
          const safeIdx = (typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < q.choices.length)
            ? q.correctIndex
            : 0
          const correctLetter = letters[safeIdx % letters.length] || 'A'
          const correctText = q.choices[safeIdx] || '—'
          return `
          <tr>
            <td style="font-weight: 800; font-family: 'Space Grotesk';">Q${idx + 1}</td>
            <td style="font-weight: 800; font-family: 'Space Grotesk'; background: #E8F5E9;">
              ${correctLetter}
            </td>
            <td style="font-weight: 600;">${escapeHTML(correctText)}</td>
            <td style="color: #444; font-size: 12px;">${escapeHTML(q.explanation || '—')}</td>
          </tr>
          `
        }).join('')}
      </tbody>
    </table>
  ` : ''}

  <div class="footer">
    Generated via QuizFlow Studio • Version ${escapeHTML(version)} • Bloom's Level: ${escapeHTML(quiz.bloomLevel || 'Recall')}
  </div>

</body>
</html>
`
}

export function generatePrintableWorksheet(
  quiz: AIGeneratedQuiz,
  version: WorksheetVersion = 'A',
  showAnswerKey: boolean = false
): void {
  if (typeof window === 'undefined') return

  const html = generateWorksheetHTML({ quiz, version, showAnswerKey })
  const printWindow = window.open('', '_blank', 'width=900,height=1100')

  if (!printWindow) {
    alert('Please allow popups to print the worksheet.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()

  // Wait for fonts and styling to load before triggering print
  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
  }, 400)
}
