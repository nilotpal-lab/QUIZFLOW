import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Valid URL is required' }, { status: 400 })
    }

    let targetUrl = url.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      next: { revalidate: 3600 }
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch webpage (Status ${res.status})` }, { status: 500 })
    }

    const html = await res.text()

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : targetUrl

    // Strip <script>, <style>, <nav>, <header>, <footer>, <svg>
    let clean = html
      .replace(/<script\b[^<]*>([\s\S]*?)<\/script>/gi, '')
      .replace(/<style\b[^<]*>([\s\S]*?)<\/style>/gi, '')
      .replace(/<nav\b[^<]*>([\s\S]*?)<\/nav>/gi, '')
      .replace(/<header\b[^<]*>([\s\S]*?)<\/header>/gi, '')
      .replace(/<footer\b[^<]*>([\s\S]*?)<\/footer>/gi, '')
      .replace(/<svg\b[^<]*>([\s\S]*?)<\/svg>/gi, '')

    // Extract text from <p>, <h1>, <h2>, <h3>, <li>, <article>
    const contentMatches = clean.match(/<(p|h1|h2|h3|li|article)[^>]*>(.*?)<\/\1>/gi)
    let extractedText = ''

    if (contentMatches && contentMatches.length > 0) {
      extractedText = contentMatches
        .map(m => m.replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 25)
        .join('\n\n')
    }

    if (!extractedText || extractedText.length < 100) {
      // Fallback strip all tags
      extractedText = clean
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }

    // Limit text length to 12,000 characters for prompt efficiency
    const truncatedText = extractedText.slice(0, 12000)

    return NextResponse.json({
      success: true,
      url: targetUrl,
      title,
      text: `Webpage Title: "${title}"\nURL: ${targetUrl}\n\nWebpage Article Content:\n${truncatedText}`,
      wordCount: truncatedText.split(/\s+/).length
    })
  } catch (error: any) {
    console.error('Ingest URL API Error:', error)
    return NextResponse.json({ error: error?.message || 'Failed to ingest website content' }, { status: 500 })
  }
}
