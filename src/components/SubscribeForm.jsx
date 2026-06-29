import { useState } from 'react';
import { subscribe, isEmail } from '@/lib/subscribers';

// ── Storefront email capture (v3, Phase 9) ──────────────────────────────────
export default function SubscribeForm({ creatorId, name }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!isEmail(email)) { setErr('Enter a valid email.'); return; }
    setBusy(true); setErr('');
    try { await subscribe(creatorId, email); setDone(true); }
    catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="sub">
      {done ? (
        <p className="sub-done">✓ You’re on the list — thanks!</p>
      ) : (
        <>
          <p className="sub-title">Stay in the loop</p>
          <p className="sub-sub">Get updates{name ? ` from ${name}` : ''} — new drops, tips, and offers.</p>
          <form className="sub-form" onSubmit={submit}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
            <button className="btn btn-primary" disabled={busy}>{busy ? '…' : 'Subscribe'}</button>
          </form>
          {err && <p className="sub-err">{err}</p>}
        </>
      )}
      <style>{`
        .sub { margin-top:26px; padding:18px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); text-align:center; }
        .sub-title { font-weight:700; color:var(--text); }
        .sub-sub { font-size:13px; color:var(--text-secondary); margin:4px 0 12px; }
        .sub-form { display:flex; gap:8px; }
        .sub-form input { flex:1; }
        .sub-done { font-weight:600; color:var(--green); }
        .sub-err { color:var(--accent); font-size:13px; margin-top:8px; }
        @media (max-width:480px){ .sub-form { flex-direction:column; } }
      `}</style>
    </div>
  );
}
