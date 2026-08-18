/* ================================================================
   QuizFlow — Excel & CSV Quiz Importer & Google Form Parser
   Supports uploading spreadsheets (.xlsx, .xls, .csv) to auto-generate
   structured quizzes.
   ================================================================ */

import * as XLSX from 'xlsx'
import type { AIGeneratedQuiz, AIGeneratedQuestion } from './types'

export interface ParsedExcelQuizResult {
  title: string
  questions: AIGeneratedQuestion[]
  errorCount: number
  warnings: string[]
}

function normalize(str: any): string {
  return String(str ?? '').trim().toLowerCase()
}

/**
 * Parses raw Excel/CSV workbook into a standard QuizFlow Quiz.
 *
 * Supported Column Structures:
 * 1. Explicit Columns:
 *    - Question / Prompt
 *    - Option A / Choice 1
 *    - Option B / Choice 2
 *    - Option C / Choice 3
 *    - Option D / Choice 4
 *    - Correct Answer (e.g. "A", "Option A", "1", or the full text)
 *    - Explanation (optional)
 *    - Time Limit (optional in seconds, e.g. 20)
 *
 * 2. Google Form to Sheets Export Format:
 *    - Detects questions and matching answer key column or asterisk/prefix marking.
 */
export async function parseQuizFromSpreadsheet(file: File): Promise<ParsedExcelQuizResult> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error('The uploaded spreadsheet contains no sheets.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

  if (rows.length < 2) {
    throw new Error('Spreadsheet must have at least a header row and 1 question row.')
  }

  const headers = rows[0].map(h => normalize(h))
  const rawTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ')

  // Find column indices
  let promptIdx = headers.findIndex(h => h.includes('question') || h.includes('prompt') || h.includes('title') || h === 'q')
  if (promptIdx === -1) promptIdx = 0

  const optionAIdx = headers.findIndex(h => h.includes('option a') || h.includes('choice a') || h.includes('option 1') || h.includes('choice 1') || h === 'a' || h === 'opt a')
  const optionBIdx = headers.findIndex(h => h.includes('option b') || h.includes('choice b') || h.includes('option 2') || h.includes('choice 2') || h === 'b' || h === 'opt b')
  const optionCIdx = headers.findIndex(h => h.includes('option c') || h.includes('choice c') || h.includes('option 3') || h.includes('choice 3') || h === 'c' || h === 'opt c')
  const optionDIdx = headers.findIndex(h => h.includes('option d') || h.includes('choice d') || h.includes('option 4') || h.includes('choice 4') || h === 'd' || h === 'opt d')

  const correctIdxCol = headers.findIndex(h => h.includes('correct') || h.includes('answer') || h.includes('key') || h.includes('ans') || h === 'right')
  const explanationIdx = headers.findIndex(h => h.includes('explanation') || h.includes('rationale') || h.includes('reason') || h.includes('why'))
  const timeLimitIdx = headers.findIndex(h => h.includes('time') || h.includes('seconds') || h.includes('timer') || h.includes('limit'))

  const questions: AIGeneratedQuestion[] = []
  const warnings: string[] = []
  let errorCount = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every(cell => String(cell).trim() === '')) continue

    const prompt = String(row[promptIdx] || '').trim()
    if (!prompt) continue

    // Collect choices
    let choices: string[] = []
    if (optionAIdx !== -1 && optionBIdx !== -1) {
      const a = String(row[optionAIdx] || '').trim()
      const b = String(row[optionBIdx] || '').trim()
      const c = optionCIdx !== -1 ? String(row[optionCIdx] || '').trim() : ''
      const d = optionDIdx !== -1 ? String(row[optionDIdx] || '').trim() : ''
      choices = [a, b, c, d].filter(Boolean)
    } else {
      // Fallback: take columns 1, 2, 3, 4
      choices = row.slice(1, 5).map(c => String(c).trim()).filter(Boolean)
    }

    if (choices.length < 2) {
      warnings.push(`Row ${r + 1}: Skipped question "${prompt.slice(0, 30)}..." because it has fewer than 2 choices.`)
      errorCount++
      continue
    }

    // Determine correct answer index (0-based)
    let correctIndex = -1

    // 1. First priority: Check if any choice has a special marker (+, *, [x], [correct], (correct), checkmark)
    const specialMarkerIdx = choices.findIndex(c => {
      const lower = c.trim().toLowerCase()
      return lower.startsWith('+') ||
             lower.endsWith('+') ||
             lower.startsWith('*') || 
             lower.endsWith('*') || 
             lower.includes('[x]') || 
             lower.includes('(correct)') || 
             lower.includes('[correct]') ||
             lower.startsWith('✓') ||
             lower.startsWith('✔')
    })

    if (specialMarkerIdx !== -1) {
      correctIndex = specialMarkerIdx
    } else if (correctIdxCol !== -1) {
      // 2. Second priority: Explicit Answer Column
      const rawCorrect = String(row[correctIdxCol] || '').trim().toLowerCase()
      if (rawCorrect === 'a' || rawCorrect === '1' || rawCorrect === 'option a' || rawCorrect === 'choice a') {
        correctIndex = 0
      } else if (rawCorrect === 'b' || rawCorrect === '2' || rawCorrect === 'option b' || rawCorrect === 'choice b') {
        correctIndex = 1
      } else if (rawCorrect === 'c' || rawCorrect === '3' || rawCorrect === 'option c' || rawCorrect === 'choice c') {
        correctIndex = 2
      } else if (rawCorrect === 'd' || rawCorrect === '4' || rawCorrect === 'option d' || rawCorrect === 'choice d') {
        correctIndex = 3
      } else {
        const matchedIdx = choices.findIndex(c => c.trim().toLowerCase() === rawCorrect)
        if (matchedIdx !== -1) {
          correctIndex = matchedIdx
        }
      }
    }

    if (correctIndex === -1) {
      correctIndex = 0 // Default to first choice if unmarked
    }

    // Clean up choices: remove markers (+, *, [x], (correct), checkmarks) so students see clean text
    const cleanedChoices = choices.map(c => 
      c.replace(/^\+\s*/, '')
       .replace(/\s*\+$/, '')
       .replace(/^\*\s*/, '')
       .replace(/\s*\*$/, '')
       .replace(/^\[x\]\s*/i, '')
       .replace(/^\[correct\]\s*/i, '')
       .replace(/\s*\[correct\]/i, '')
       .replace(/\s*\(correct\)/i, '')
       .replace(/^[✓✔]\s*/, '')
       .trim()
    )

    const explanation = explanationIdx !== -1 ? String(row[explanationIdx] || '').trim() : ''
    let timeLimitMs = 30000
    if (timeLimitIdx !== -1) {
      const parsedSec = Number(row[timeLimitIdx])
      if (!isNaN(parsedSec) && parsedSec >= 5 && parsedSec <= 120) {
        timeLimitMs = parsedSec * 1000
      }
    }

    questions.push({
      prompt,
      choices: cleanedChoices,
      correct_index: Math.min(Math.max(0, correctIndex), cleanedChoices.length - 1),
      difficulty: 'medium',
      explanation: explanation || `The correct answer is "${cleanedChoices[correctIndex]}".`,
      bloom_level: 'Recall',
      time_limit_ms: timeLimitMs
    })
  }

  if (questions.length === 0) {
    throw new Error('No valid questions could be extracted from the spreadsheet. Check columns format.')
  }

  return {
    title: rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1),
    questions,
    errorCount,
    warnings
  }
}
