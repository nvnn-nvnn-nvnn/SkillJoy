// Lightweight scaffold placeholder for v3 pages that get built out in later
// phases. Keeps nav links live and the app runnable without dead 404s.
// Remove each usage as its real page is implemented.
export default function PhasePlaceholder({ title, phase, blurb }) {
  return (
    <div style={{
      maxWidth: 520, margin: '0 auto', padding: '64px 20px',
      textAlign: 'center', minHeight: '60vh',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12,
    }}>
      <span style={{
        alignSelf: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--accent)',
        background: 'var(--accent-light)', border: '1px solid var(--accent-mid)',
        borderRadius: 999, padding: '4px 12px',
      }}>{phase} · coming soon</span>
      <h1 style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{title}</h1>
      <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>{blurb}</p>
    </div>
  );
}
