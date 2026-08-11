import React from 'react'

export function QuizFlowJsonLd() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': 'https://quizflow-peach.vercel.app/#webapp',
        name: 'QuizFlow',
        alternateName: ['Quiz Flow', 'QuizFlow App', 'QuizFlow AI'],
        url: 'https://quizflow-peach.vercel.app',
        description:
          'QuizFlow is the leading AI-powered classroom quiz generator and real-time multiplayer competition arena. Create Bloom-taxonomy quizzes in seconds, host live games with PINs, and master topics with interactive flashcards.',
        applicationCategory: 'EducationalApplication',
        operatingSystem: 'Any (Web, iOS, Android, macOS, Windows)',
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
        },
        featureList: [
          'AI-Powered Quiz Generation from Topics or Notes',
          'Real-time Multiplayer Classroom Battles with 6-Digit PINs',
          'Bloom’s Taxonomy Cognitive Level Steering (Recall to Evaluation)',
          'Automated AI Question Image Attachment',
          'Curated & Founder-Verified Quiz Library',
          'Solo Practice Arena with Web Speech Audio TTS Narration',
          'Focus Shield Anti-Cheat & Live Proctoring Alerts',
          'Printable PDF Worksheet & FSRS Flashcards Export',
        ],
        creator: {
          '@type': 'Organization',
          '@id': 'https://quizflow-peach.vercel.app/#organization',
          name: 'QuizFlow Technologies',
          url: 'https://quizflow-peach.vercel.app',
          logo: {
            '@type': 'ImageObject',
            url: 'https://quizflow-peach.vercel.app/og-image.png',
            width: '1200',
            height: '630',
          },
        },
      },
      {
        '@type': 'Organization',
        '@id': 'https://quizflow-peach.vercel.app/#organization',
        name: 'QuizFlow',
        url: 'https://quizflow-peach.vercel.app',
        logo: 'https://quizflow-peach.vercel.app/og-image.png',
        sameAs: [
          'https://github.com/nilotpal-lab/QUIZFLOW',
        ],
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://quizflow-peach.vercel.app/#breadcrumbs',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://quizflow-peach.vercel.app/quizflow',
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Quiz Library & Practice',
            item: 'https://quizflow-peach.vercel.app/quizflow/practice',
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: 'AI Quiz Studio',
            item: 'https://quizflow-peach.vercel.app/quizflow/studio',
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: 'Join Game',
            item: 'https://quizflow-peach.vercel.app/quizflow/join',
          },
        ],
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://quizflow-peach.vercel.app/#faq',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is QuizFlow?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'QuizFlow is a modern, AI-powered interactive classroom quiz platform that allows educators and students to generate high-order thinking quizzes instantly, host live multiplayer games with 6-digit PINs, and study through a categorized library.',
            },
          },
          {
            '@type': 'Question',
            name: 'How does QuizFlow AI create questions?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'QuizFlow uses advanced artificial intelligence to synthesize curriculum concepts into structured multiple-choice questions aligned with Bloom’s Taxonomy. It automatically attaches relevant images, distractor misconception explanations, and timers.',
            },
          },
          {
            '@type': 'Question',
            name: 'How do students join a live QuizFlow game?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Students can simply navigate to the Join Game page on any device (phone, tablet, or laptop), enter the 6-digit room PIN displayed on the teacher’s screen, choose a nickname and custom avatar, and compete in real time.',
            },
          },
          {
            '@type': 'Question',
            name: 'Is QuizFlow free to use for teachers and schools?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes! QuizFlow is 100% free to host live multiplayer classroom battles, generate AI quizzes, and practice solo with flashcards.',
            },
          },
          {
            '@type': 'Question',
            name: 'What subjects are covered in the QuizFlow Library?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'The QuizFlow Library contains pre-made and founder-verified decks spanning Sports, Biology & Life Sciences, Mathematics & Logic, Technology & Code, World History, Cosmology & Space, and General Knowledge.',
            },
          },
        ],
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  )
}
