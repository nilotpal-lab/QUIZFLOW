'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          backgroundColor: '#FFFCF5',
          color: '#10100F',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#FFFFFF',
            border: '3px solid #10100F',
            borderRadius: '16px',
            padding: '36px 24px',
            boxShadow: '4px 4px 0px #10100F',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>⚠️</div>
          <h2 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px' }}>
            Application Error
          </h2>
          <p style={{ fontSize: '14px', color: '#555555', marginBottom: '24px' }}>
            {error?.message || 'A critical error occurred while starting the application.'}
          </p>
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
            🔄 Reload App
          </button>
        </div>
      </body>
    </html>
  )
}
