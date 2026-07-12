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
            <button className="sub-btn" disabled={busy}>{busy ? '…' : 'Subscribe'}</button>
          </form>
          {err && <p className="sub-err">{err}</p>}
        </>
      )}
      <style>{`
        /* Inherit the profile panel's glass (same opacity + blur) so it blends
           with the storefront instead of being a solid white box. Falls back to
           a solid surface when used outside a themed storefront. */
        .sub { margin-top:26px; padding:20px; border:1px solid color-mix(in srgb, var(--border-strong) 50%, transparent); border-radius:var(--r-lg);
          background:var(--sf-panel-bg, var(--surface)); -webkit-backdrop-filter:blur(var(--sf-panel-blur, 0px)); backdrop-filter:blur(var(--sf-panel-blur, 0px)); text-align:center; }
        .sub-title { font-weight:800; color:var(--text); font-size:15px; }
        .sub-sub { font-size:13px; color:var(--text-secondary); margin:4px 0 14px; }
        .sub-form { display:flex; gap:8px; }
        /* Adaptive input: a faint tint OF the text color + a text-color border,
           so it contrasts whether the creator's text is dark OR white (e.g. a
           white-text-on-dark-bg storefront). Avoids the white-on-white trap. */
        .sub-form input { flex:1; min-width:0; padding:11px 14px; border-radius:var(--r); font-size:14px;
          color:var(--text); background:color-mix(in srgb, var(--text) 9%, transparent);
          border:1.5px solid color-mix(in srgb, var(--text) 22%, transparent); }
        .sub-form input::placeholder { color:color-mix(in srgb, var(--text) 45%, transparent); }
        .sub-form input:focus { outline:none; border-color:var(--accent); }
        /* Dedicated high-contrast button (hard fallback so it's never a pale/UA-default
           box at rest — the .btn-primary version rendered near-white on the storefront). */
        /* Brand-green CTA, hardcoded — NOT the creator's --accent (which can be
           white/light on some themes, making an accent-bg button invisible). This
           is a "Built on SkillJoy" element, so a fixed green is correct + always
           high-contrast. */
        .sub-btn { flex-shrink:0; border:none; cursor:pointer; padding:12px 22px; border-radius:var(--r); font-family:var(--font-body); font-size:14px; font-weight:800; white-space:nowrap; color:#ffffff; background:#00CC99; box-shadow:0 2px 12px rgba(0,204,153,0.40); transition:filter .15s ease, transform .15s ease; }
        .sub-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); }
        .sub-btn:disabled { opacity:.6; cursor:default; }
        .sub-done { font-weight:600; color:var(--green); }
        .sub-err { color:var(--accent); font-size:13px; margin-top:8px; }
        @media (max-width:480px){ .sub-form { flex-direction:column; } }
      `}</style>
    </div>
  );
}
