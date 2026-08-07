export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', fontFamily: 'Space Grotesk', color: 'var(--ink)' }}>
      <h1 style={{ fontSize: 48, fontWeight: 900 }}>404</h1>
      <p style={{ fontFamily: 'Inter', marginTop: 8, opacity: 0.7 }}>Page Not Found</p>
    </div>
  )
}
