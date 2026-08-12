'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[QuizFlow ErrorBoundary Caught]:', error)
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: '#FFFCF5',
        color: '#10100F',
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          backgroundColor: '#F2EEE6',
          border: '3px solid #10100F',
          borderRadius: '16px',
          padding: '36px 24px',
          boxShadow: '4px 4px 0px #10100F',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚡</div>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 900,
            marginBottom: '8px',
            color: '#10100F',
          }}
        >
          Something went wrong
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: '#3A3A37',
            fontFamily: "'Inter', sans-serif",
            lineHeight: 1.5,
            marginBottom: '24px',
          }}
        >
          {error?.message || 'We encountered a momentary issue loading this view.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => reset()}
            style={{
              width: '100%',
              height: '46px',
              backgroundColor: '#FFD60A',
              color: '#10100F',
              border: '2.5px solid #10100F',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '2px 2px 0px #10100F',
            }}
          >
            🔄 Try Again
          </button>

          <Link href="/quizflow" style={{ textDecoration: 'none' }}>
            <button
              style={{
                width: '100%',
                height: '46px',
                backgroundColor: '#FFFFFF',
                color: '#10100F',
                border: '2.5px solid #10100F',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: '2px 2px 0px #10100F',
              }}
            >
              ← Return Home
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
