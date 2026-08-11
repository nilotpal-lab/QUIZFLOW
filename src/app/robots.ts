import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://quizflow-peach.vercel.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/quizflow',
          '/quizflow/practice',
          '/quizflow/studio',
          '/quizflow/join',
          '/quizflow/auth',
          '/practice',
          '/studio',
          '/join',
        ],
        disallow: [
          '/api/',
          '/quizflow/play',
          '/quizflow/lobby/',
          '/quizflow/host',
          '/quizflow/dashboard/',
          '/quizflow/results',
          '/play',
          '/lobby/',
          '/host',
          '/results',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: ['/api/', '/quizflow/play', '/quizflow/lobby/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}
