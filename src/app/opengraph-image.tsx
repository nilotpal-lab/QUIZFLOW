import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'QuizFlow — #1 AI Classroom Quiz Competition & Battle Arena'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#F6F1E7',
          padding: '60px 80px',
          fontFamily: 'sans-serif',
          border: '16px solid #10100F',
          position: 'relative',
        }}
      >
        {/* Top bar with Badge */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '36px',
              fontWeight: 900,
              color: '#10100F',
            }}
          >
            <span
              style={{
                backgroundColor: '#FFE57F',
                border: '3px solid #10100F',
                padding: '6px 16px',
                borderRadius: '12px',
                boxShadow: '4px 4px 0px #10100F',
              }}
            >
              ⚡ QuizFlow
            </span>
          </div>

          <div
            style={{
              backgroundColor: '#10100F',
              color: '#FFFCF5',
              padding: '10px 24px',
              borderRadius: '999px',
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Classroom Battle Arena
          </div>
        </div>

        {/* Main Title & Hero Tagline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginTop: '20px',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 900,
              color: '#10100F',
              lineHeight: 1.1,
              letterSpacing: '-2px',
              textTransform: 'uppercase',
            }}
          >
            The #1 AI Classroom <br />
            <span style={{ color: '#7C4DFF' }}>Quiz Competition</span> Arena
          </div>

          <div
            style={{
              fontSize: '24px',
              color: '#333333',
              fontWeight: 600,
              marginTop: '18px',
              maxWidth: '850px',
            }}
          >
            Create Bloom-taxonomy AI quizzes in seconds, host live multiplayer games with PINs, and build long-term mastery.
          </div>
        </div>

        {/* Bottom Feature Chips */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFE57F',
              border: '3px solid #10100F',
              padding: '12px 24px',
              borderRadius: '14px',
              fontSize: '18px',
              fontWeight: 800,
              boxShadow: '4px 4px 0px #10100F',
            }}
          >
            ✨ AI Quiz Studio
          </div>
          <div
            style={{
              backgroundColor: '#00E676',
              border: '3px solid #10100F',
              padding: '12px 24px',
              borderRadius: '14px',
              fontSize: '18px',
              fontWeight: 800,
              boxShadow: '4px 4px 0px #10100F',
            }}
          >
            🚀 Live Multiplayer PIN
          </div>
          <div
            style={{
              backgroundColor: '#EDE7FF',
              border: '3px solid #10100F',
              padding: '12px 24px',
              borderRadius: '14px',
              fontSize: '18px',
              fontWeight: 800,
              color: '#512DA8',
              boxShadow: '4px 4px 0px #10100F',
            }}
          >
            📚 Practice &amp; Discover Decks
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
