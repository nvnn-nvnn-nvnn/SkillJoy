import { useState } from 'react';

// ── Which build am I looking at? ────────────────────────────────────────────
//
// Dev only. Renders nothing in a production build, and Vite tree-shakes the
// whole component out because import.meta.env.DEV is a compile-time constant.
//
// Why this exists: a visual change that "doesn't show up" has three possible
// causes (LANDMINES §15), and the cheapest one to check — "is this build even
// running?" — was historically checked last. Three rounds of size tweaks were
// made against the deployed site before anyone asked which URL was open.
//
// Click it to collapse to a dot; it remembers that per browser.
export default function BuildBadge() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('sj-buildbadge') !== 'min'; } catch { return true; }
  });

  const stamp = typeof __BUILD_STAMP__ === 'string' ? __BUILD_STAMP__ : '';
  const time = stamp ? new Date(stamp).toLocaleTimeString() : '?';

  function toggle() {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem('sj-buildbadge', next ? 'full' : 'min'); } catch { /* private mode */ }
  }

  return (
    <button
      onClick={toggle}
      title={`Vite dev server · started ${time}
You are NOT looking at production.`}
      style={{
        position: 'fixed', left: 10, bottom: 10, zIndex: 2147483647,
        display: 'flex', alignItems: 'center', gap: 7,
        padding: open ? '6px 11px' : '6px', width: 'auto',
        borderRadius: 999, border: '1px solid rgba(255,255,255,.22)',
        background: 'rgba(16,16,20,.86)', backdropFilter: 'blur(8px)',
        color: '#fff', font: '600 11px/1 ui-monospace, monospace',
        letterSpacing: '.04em', cursor: 'pointer', opacity: .8,
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: '50%', background: '#34D399',
        boxShadow: '0 0 7px #34D399', flexShrink: 0,
      }} />
      {open && <span>DEV · {time}</span>}
    </button>
  );
}
