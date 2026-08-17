import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'QuizFlow — AI Classroom Quiz Competition & Battle Arena',
    short_name: 'QuizFlow',
    description:
      'Real-time classroom multiplayer quiz competition platform with AI question generation and study practice decks.',
    start_url: '/quizflow',
    display: 'standalone',
    background_color: '#F6F1E7',
    theme_color: '#10100F',
    categories: ['education', 'games', 'productivity'],
    icons: [
      {
        src: '/logo.png',
        sizes: 'any',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  }
}
