import type { Metadata } from 'next'

export interface PageMetadataProps {
  title?: string
  description?: string
  path?: string
  image?: string
}

export function constructMetadata({
  title = 'QuizFlow — Live Classroom Quiz Competition',
  description = 'Real-time quiz competition platform for teachers and students. Create AI quizzes, host live games, and compete with power-ups.',
  path = '/quizflow',
  image = '/og-image.png'
}: PageMetadataProps = {}): Metadata {
  const url = `https://quizflow-peach.vercel.app${path}`

  return {
    title,
    description,
    metadataBase: new URL('https://quizflow-peach.vercel.app'),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'QuizFlow',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
      creator: '@quizflow',
    },
    icons: {
      icon: '/favicon.ico',
    },
  }
}
