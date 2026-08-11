import type { Metadata, Viewport } from 'next'
import './globals.css'
import { constructMetadata } from '@/quizflow/metadata'
import { QuizFlowJsonLd } from '@/quizflow/JsonLd'

export const metadata: Metadata = constructMetadata()

export const viewport: Viewport = {
  themeColor: '#10100F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <QuizFlowJsonLd />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen antialiased bg-[#F6F1E7] text-[#10100F] selection:bg-[#FFE57F] selection:text-[#10100F]">
        {children}
      </body>
    </html>
  )
}
