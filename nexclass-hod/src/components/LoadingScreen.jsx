export default function LoadingScreen() {
  return (
    <main
      role="status"
      aria-label="Initializing NexClass HOD Portal"
      style={{
        minHeight: '100vh', width: '100vw', background: 'var(--bg)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      <div aria-hidden="true" style={{
        width: 40, height: 40,
        background: 'linear-gradient(135deg, #4F46E5, #2563EB)',
        borderRadius: 12, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'white', fontSize: 20,
        fontWeight: 800, marginBottom: 16,
      }}>N</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>
        NexClass<span style={{ color: 'var(--indigo)' }}> HOD</span>
      </div>
      <div aria-hidden="true" style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        {[0, 0.16, 0.32].map((delay, index) => (
          <span key={index} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--indigo)',
            animation: `dotPulse 1.2s ease-in-out ${delay}s infinite`,
          }} />
        ))}
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
        Initializing dashboard...
      </div>
    </main>
  )
}
