import { useState, useEffect } from 'react';
import { getBillingStatus, startSubscription, openBillingPortal, trialDaysLeft } from '@/lib/billing';

/*
 * TrialBanner — platform-subscription state, shown on the creator Dashboard.
 *  - 'none'      → renders nothing (build/customize are free; the gate appears at publish)
 *  - 'trialing'  → days-left countdown + Manage billing
 *  - 'active'    → one quiet "Manage billing" row
 *  - lapsed (past_due/unpaid/canceled/…) → "storefront paused" + fix-it action
 * The RLS gate already hides a lapsed creator's storefront server-side; this
 * banner is just the in-app surface of that state.
 */
export default function TrialBanner() {
  const [billing, setBilling] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    getBillingStatus().then(setBilling).catch(() => setBilling(null));
  }, []);

  if (!billing || billing.status === 'none') return null;

  async function act(fn) {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(e.message); setBusy(false); }
  }

  const { status } = billing;
  let body = null;

  if (status === 'trialing') {
    const days = trialDaysLeft(billing.trial_ends_at);
    body = (
      <div className="tb tb-trial">
        <span>⏳ <strong>{days} day{days === 1 ? '' : 's'} left</strong> in your free trial — your storefront is live. First charge when the trial ends.</span>
        <button type="button" className="tb-btn" disabled={busy} onClick={() => act(openBillingPortal)}>Manage billing</button>
      </div>
    );
  } else if (status === 'active') {
    body = (
      <div className="tb tb-active">
        <span>Platform plan: <strong>active</strong></span>
        <button type="button" className="tb-btn" disabled={busy} onClick={() => act(openBillingPortal)}>Manage billing</button>
      </div>
    );
  } else if (status === 'past_due' || status === 'unpaid') {
    body = (
      <div className="tb tb-paused">
        <span>⚠️ <strong>Your storefront is paused</strong> — your last payment failed. Update your card to go back live. Your buyers keep their access.</span>
        <button type="button" className="tb-btn tb-btn-warn" disabled={busy} onClick={() => act(openBillingPortal)}>Update payment method</button>
      </div>
    );
  } else { // canceled / incomplete / anything not live
    body = (
      <div className="tb tb-paused">
        <span>⚠️ <strong>Your storefront is paused</strong> — resubscribe to go live again. Your products, customizations, and buyers’ access are all safe.</span>
        <button type="button" className="tb-btn tb-btn-warn" disabled={busy} onClick={() => act(startSubscription)}>Resubscribe</button>
      </div>
    );
  }

  return (
    <>
      {body}
      {err && <p className="tb-err">{err}</p>}
      <style>{`
        .tb { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
              padding:12px 16px; border-radius:12px; margin:0 0 16px; font-size:14px; }
        .tb-trial  { background:rgba(245,99,74,.1);  border:1px solid rgba(245,99,74,.35); }
        .tb-active { background:rgba(0,0,0,.04);     border:1px solid rgba(0,0,0,.08); }
        .tb-paused { background:rgba(255,159,10,.12); border:1px solid rgba(255,159,10,.4); }
        .tb-btn { border:0; border-radius:8px; padding:8px 14px; font-size:13px; font-weight:600;
                  cursor:pointer; background:#F5634A; color:#fff; white-space:nowrap; }
        .tb-btn:disabled { opacity:.6; cursor:default; }
        .tb-btn-warn { background:#e08700; }
        .tb-err { color:#c0392b; font-size:13px; margin:-8px 0 12px; }
      `}</style>
    </>
  );
}
