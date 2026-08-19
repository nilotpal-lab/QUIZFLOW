/* ================================================================
   QuizFlow — Excel & CSV Quiz Importer & Google Form Parser
   Supports uploading spreadsheets (.xlsx, .xls, .csv) to auto-generate
   structured quizzes.
   ================================================================ */

import * as XLSX from 'xlsx'
import type { AIGeneratedQuestion } from './types'

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
 * Strips leading option numbering/letters like "A) ", "B. ", "(C) ", "1: ", "+", "*", "✓"
 */
function cleanChoiceText(text: string): string {
  return text
    .replace(/^[\(\[]?[A-Da-d1-4][\.\)\:\-\]]\s*/, '') // Remove A), A., (A), 1., etc.
    .replace(/^\+\s*/, '')
    .replace(/\s*\+$/, '')
    .replace(/^\*\s*/, '')
    .replace(/\s*\*$/, '')
    .replace(/^\[x\]\s*/i, '')
    .replace(/^\[correct\]\s*/i, '')
    .replace(/\s*\[correct\]/i, '')
    .replace(/\s*\(correct\)/i, '')
    .replace(/^[✓✔]\s*/, '')
    .trim()
}

/**
 * Parses raw Excel/CSV workbook into a standard QuizFlow Quiz.
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

  const optionAIdx = headers.findIndex(h => h.includes('option a') || h.includes('choice a') || h.includes('option 1') || h.includes('choice 1') || h === 'a' || h === 'opt a' || h === 'option_a')
  const optionBIdx = headers.findIndex(h => h.includes('option b') || h.includes('choice b') || h.includes('option 2') || h.includes('choice 2') || h === 'b' || h === 'opt b' || h === 'option_b')
  const optionCIdx = headers.findIndex(h => h.includes('option c') || h.includes('choice c') || h.includes('option 3') || h.includes('choice 3') || h === 'c' || h === 'opt c' || h === 'option_c')
  const optionDIdx = headers.findIndex(h => h.includes('option d') || h.includes('choice d') || h.includes('option 4') || h.includes('choice 4') || h === 'd' || h === 'opt d' || h === 'option_d')

  const optionIndices = [optionAIdx, optionBIdx, optionCIdx, optionDIdx].filter(i => i !== -1)

  // Must NOT match choice columns
  const correctIdxCol = headers.findIndex((h, i) =>
    !optionIndices.includes(i) && (
      h === 'correct' || h === 'answer' || h === 'key' || h === 'ans' ||
      h === 'correct answer' || h === 'correct_answer' || h === 'correct option' ||
      h === 'correct_option' || h === 'answer key' || h === 'ans key' ||
      h === 'right answer' || h === 'solution' || h === 'target' ||
      h.includes('correct') || h.includes('answer key') ||
      (h.includes('answer') && !h.includes('option') && !h.includes('choice'))
    )
  )

  const explanationIdx = headers.findIndex((h, i) =>
    !optionIndices.includes(i) && (
      h.includes('explanation') || h.includes('rationale') || h.includes('reason') || h.includes('why')
    )
  )

  const timeLimitIdx = headers.findIndex(h =>
    h.includes('time') || h.includes('seconds') || h.includes('timer') || h.includes('limit')
  )

  const questions: AIGeneratedQuestion[] = []
  const warnings: string[] = []
  let errorCount = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every(cell => String(cell).trim() === '')) continue

    const prompt = String(row[promptIdx] || '').trim()
    if (!prompt) continue

    // Collect raw choices
    let rawChoices: string[] = []
    if (optionAIdx !== -1 && optionBIdx !== -1) {
      const a = String(row[optionAIdx] || '').trim()
      const b = String(row[optionBIdx] || '').trim()
      const c = optionCIdx !== -1 ? String(row[optionCIdx] || '').trim() : ''
      const d = optionDIdx !== -1 ? String(row[optionDIdx] || '').trim() : ''
      rawChoices = [a, b, c, d].filter(Boolean)
    } else {
      // Fallback: take columns 1, 2, 3, 4
      rawChoices = row.slice(1, 5).map(c => String(c).trim()).filter(Boolean)
    }

    if (rawChoices.length < 2) {
      warnings.push(`Row ${r + 1}: Skipped question "${prompt.slice(0, 30)}..." because it has fewer than 2 choices.`)
      errorCount++
      continue
    }

    const cleanedChoices = rawChoices.map(c => cleanChoiceText(c))
    const rawExplanation = explanationIdx !== -1 ? String(row[explanationIdx] || '').trim() : ''

    // Determine correct answer index (0-based)
    let correctIndex = -1

    // Strategy 1: Check if any raw choice has a special marker (+, *, [x], [correct], (correct), ✓)
    const specialMarkerIdx = rawChoices.findIndex(c => {
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
    }

    // Strategy 2: Explicit Answer Column
    if (correctIndex === -1 && correctIdxCol !== -1) {
      const rawAns = String(row[correctIdxCol] || '').trim()
      const lowerAns = rawAns.toLowerCase()

      // 2a. Direct letter or single-digit option matching: "A", "B", "C", "D", "1", "2", "3", "4"
      const letterMatch = lowerAns.match(/^[\(\[]?([a-d])[\.\)\:\-\]]?$/i) ||
                          lowerAns.match(/^(?:option|choice|opt)\s*([a-d])$/i)
      if (letterMatch) {
        const letter = letterMatch[1].toLowerCase()
        correctIndex = letter === 'a' ? 0 : letter === 'b' ? 1 : letter === 'c' ? 2 : 3
      }

      const numMatch = lowerAns.match(/^[\(\[]?([1-4])[\.\)\:\-\]]?$/) ||
                       lowerAns.match(/^(?:option|choice|opt)\s*([1-4])$/i)
      if (correctIndex === -1 && numMatch) {
        const num = parseInt(numMatch[1], 10)
        correctIndex = num - 1
      }

      // 2b. Exact text match against cleaned choice texts
      if (correctIndex === -1 && rawAns) {
        const cleanAns = cleanChoiceText(rawAns).toLowerCase()
        const exactIdx = cleanedChoices.findIndex(c => c.toLowerCase() === cleanAns || c.toLowerCase() === lowerAns)
        if (exactIdx !== -1) {
          correctIndex = exactIdx
        }
      }

      // 2c. Substring / inclusion match (e.g. choice is "20", answer column says "20 amino acids" or "B) 20")
      if (correctIndex === -1 && rawAns) {
        const cleanAns = cleanChoiceText(rawAns).toLowerCase()
        const subIdx = cleanedChoices.findIndex(c => {
          const cLow = c.toLowerCase()
          if (!cLow || !cleanAns) return false
          return (cLow.length >= 2 && cleanAns.includes(cLow)) ||
                 (cleanAns.length >= 2 && cLow.includes(cleanAns))
        })
        if (subIdx !== -1) {
          correctIndex = subIdx
        }
      }
    }

    // Strategy 3: Explanation text cross-verification
    if (correctIndex === -1 && rawExplanation) {
      const expLow = rawExplanation.toLowerCase()

      // 3a. Quoted text match: e.g. The correct answer is "Amino acids" or '20' or "20"
      const quotedMatches = Array.from(rawExplanation.matchAll(/["'“‘]([^"'”’]+)["'”’]/g)).map(m => m[1].trim())
      for (const quoted of quotedMatches) {
        const cleanQuoted = cleanChoiceText(quoted).toLowerCase()
        if (!cleanQuoted) continue
        const matchIdx = cleanedChoices.findIndex(c => c.toLowerCase() === cleanQuoted)
        if (matchIdx !== -1) {
          correctIndex = matchIdx
          break
        }
      }

      // 3b. Word-bounded option letters: e.g. "Option B", "Choice B", "(B)", "Answer is B.", "Correct: B"
      if (correctIndex === -1) {
        const optLetterMatch = expLow.match(/\b(?:option|choice)\s+([a-d])\b/i) ||
                               expLow.match(/\(([a-d])\)/i) ||
                               expLow.match(/(?:correct\s+answer\s+is|answer\s+is|correct\s+option\s+is|correct:)\s*\(?([a-d])\)?(?:\s*[\.\,\:\;\!\-\)]|\s*$|\s+(?:because|which|as|due|\-|\:))/i)
        if (optLetterMatch) {
          const letter = optLetterMatch[1].toLowerCase()
          const lIdx = letter === 'a' ? 0 : letter === 'b' ? 1 : letter === 'c' ? 2 : 3
          if (lIdx < cleanedChoices.length) {
            correctIndex = lIdx
          }
        }
      }

      // 3c. Exact phrase match after "correct answer is ..."
      if (correctIndex === -1) {
        const afterPhraseMatch = expLow.match(/(?:correct\s+answer\s+is|answer\s+is|correct\s+option\s+is|correct:)\s*[:\-]?\s*([^.,;\n\r]+)/i)
        if (afterPhraseMatch) {
          const targetPhrase = cleanChoiceText(afterPhraseMatch[1]).replace(/["'”’]/g, '').trim().toLowerCase()
          if (targetPhrase) {
            const phraseIdx = cleanedChoices.findIndex(c => {
              const cLow = c.toLowerCase()
              return cLow === targetPhrase || targetPhrase.startsWith(cLow) || cLow.startsWith(targetPhrase)
            })
            if (phraseIdx !== -1) {
              correctIndex = phraseIdx
            }
          }
        }
      }

      // 3d. Direct choice text inclusion in explanation
      if (correctIndex === -1) {
        const matchInExp = cleanedChoices.findIndex(c => {
          if (!c || c.length < 2) return false
          const cLow = c.toLowerCase()
          return expLow.includes(` ${cLow} `) || expLow.includes(` ${cLow}.`) || expLow.includes(` ${cLow},`)
        })
        if (matchInExp !== -1) {
          correctIndex = matchInExp
        }
      }
    }

    // Default to 0 if still unresolved
    if (correctIndex === -1 || correctIndex >= cleanedChoices.length) {
      correctIndex = 0
      warnings.push(`Row ${r + 1}: Could not find explicit answer key for "${prompt.slice(0, 30)}...". Defaulted to choice A.`)
    }

    let timeLimitMs = 30000
    if (timeLimitIdx !== -1) {
      const parsedSec = Number(row[timeLimitIdx])
      if (!isNaN(parsedSec) && parsedSec >= 5 && parsedSec <= 120) {
        timeLimitMs = parsedSec * 1000
      }
    }

    const safeCorrectIdx = Math.min(Math.max(0, correctIndex), cleanedChoices.length - 1)
    const explanation = rawExplanation || `The correct answer is "${cleanedChoices[safeCorrectIdx]}".`

    questions.push({
      prompt,
      choices: cleanedChoices,
      correct_index: safeCorrectIdx,
      difficulty: 'medium',
      explanation,
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
