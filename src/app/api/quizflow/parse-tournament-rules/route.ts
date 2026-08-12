import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface RoundConfig {
  roundNumber: number
  quizTitle: string
  eliminationRule: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const rounds: RoundConfig[] = body.rounds || []

    if (!rounds.length) {
      return NextResponse.json({ simplified: '' }, { status: 200 })
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
      // Fallback: return rules as-is formatted
      const fallback = rounds.map(r =>
        `- **Round ${r.roundNumber}** (${r.quizTitle}): ${r.eliminationRule}`
      ).join('\n')
      return NextResponse.json({ simplified: fallback })
    }

    const prompt = `You are a game master assistant. Parse these tournament elimination rules and return ONLY a clean markdown bullet list that clearly explains exactly what happens after each round. Be concise, friendly, and specific. Use simple language players can understand.

Rounds:
${rounds.map(r => `Round ${r.roundNumber} (Quiz: "${r.quizTitle}"): ${r.eliminationRule}`).join('\n')}

Return ONLY bullet points in this format:
- Round 1: [who gets eliminated and why]
- Round 2: [who gets eliminated and why]
etc.
No extra text, no headers, no explanation. Just the bullet list.`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 512 }
        })
      }
    )

    if (!response.ok) {
      const fallback = rounds.map(r =>
        `- **Round ${r.roundNumber}**: ${r.eliminationRule}`
      ).join('\n')
      return NextResponse.json({ simplified: fallback })
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return NextResponse.json({ simplified: text.trim() })
  } catch (e) {
    console.error('[parse-tournament-rules]', e)
    return NextResponse.json({ simplified: '', error: 'Failed to parse rules' }, { status: 200 })
  }
}
