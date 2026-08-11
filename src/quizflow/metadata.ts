import type { Metadata } from 'next'

export interface PageMetadataProps {
  title?: string
  description?: string
  path?: string
  image?: string
  noIndex?: boolean
  keywords?: string[]
}

const DEFAULT_KEYWORDS = [
  'QuizFlow',
  'quiz flow',
  'quizflow app',
  'AI quiz generator',
  'classroom quiz game',
  'multiplayer quiz',
  'Kahoot alternative',
  'Quizizz alternative',
  'interactive classroom battle',
  'Bloom taxonomy quiz maker',
  'live student quiz PIN',
  'formative assessment platform',
  'educational trivia battle',
  'spaced repetition flashcards',
  'biology quiz',
  'sports quiz',
  'mathematics quiz',
  'world history quiz',
  'teacher quiz maker'
]

export function constructMetadata({
  title = 'QuizFlow — #1 AI Classroom Quiz Generator & Multiplayer Battle Arena',
  description = 'QuizFlow is the ultimate AI quiz generator and real-time live classroom multiplayer competition arena. Create Bloom-taxonomy quizzes in seconds, host live games with 6-digit PINs, and master topics with interactive practice decks.',
  path = '/quizflow',
  image = '/og-image.png',
  noIndex = false,
  keywords = DEFAULT_KEYWORDS,
}: PageMetadataProps = {}): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://quizflow-peach.vercel.app'
  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  return {
    title: {
      default: title,
      template: '%s | QuizFlow',
    },
    description,
    keywords,
    applicationName: 'QuizFlow',
    authors: [{ name: 'QuizFlow Team', url: 'https://quizflow-peach.vercel.app' }],
    generator: 'Next.js',
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: url,
      languages: {
        'en-US': url,
        'x-default': url,
      },
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
    openGraph: {
      title,
      description,
      url,
      siteName: 'QuizFlow',
      locale: 'en_US',
      type: 'website',
      images: [
        {
          url: image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? image : `/${image}`}`,
          width: 1200,
          height: 630,
          alt: `${title} — Real-time Classroom Quiz Competition`,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? image : `/${image}`}`],
      creator: '@quizflow',
      site: '@quizflow',
    },
    icons: {
      icon: '/favicon.ico',
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    manifest: '/manifest.webmanifest',
    category: 'education',
  }
}
