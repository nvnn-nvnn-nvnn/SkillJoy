import { useState, useEffect } from 'react';
import { getBillingStatus, startSubscription, openBillingPortal, trialDaysLeft } from '@/lib/billing';
import { listMySkills } from '@/lib/skills';
import { useUser } from '@/lib/stores';
import BillingSetupModal from '@/components/BillingSetupModal';

/*
 * TrialBanner — platform-subscription state, shown on the creator Dashboard.
 *  - 'none' + no products → renders nothing (build/customize are free)
 *  - 'none' + HAS products → "your products aren't live" prompt + explainer
 *  - 'trialing'  → days-left countdown + Manage billing
 *  - 'active'    → one quiet "Manage billing" row
 *  - lapsed (past_due/unpaid/canceled/…) → "storefront paused" + fix-it action
 * The RLS gate already hides a lapsed creator's storefront server-side; this
 * banner is just the in-app surface of that state.
 *
 * The 'none' + products case used to render NOTHING, which meant a creator
 * could build a full catalogue and get no indication anywhere that none of it
 * was reachable. Silence is the wrong answer once there's something to lose.
 */
export default function TrialBanner() {
  const user = useUser();
  const [billing, setBilling] = useState(null);
  const [productCount, setProductCount] = useState(null); // null = still counting
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(null); // null | 'no-account' | 'has-products'

  useEffect(() => {
    getBillingStatus().then(setBilling).catch(() => setBilling(null));
  }, []);

  // Only counted when there's no subscription — it's the one state where the
  // number changes what we show, so no reason to query otherwise.
  useEffect(() => {
    if (!user || billing?.status !== 'none') return;
    listMySkills(user.id)
      .then(list => setProductCount((list || []).length))
      .catch(() => setProductCount(0));
  }, [user, billing?.status]);

  async function act(fn) {
    setBusy(true); setErr('');
    try { await fn(); }
    catch (e) {
      setBusy(false);
      // The raw "No billing account yet — subscribe first." is technically
      // right and tells the creator nothing about what to do. Swap it for the
      // explainer; anything else is a genuine error and shows inline.
      if (/no billing account/i.test(e.message)) { setErr(''); setModal('no-account'); }
      else setErr(e.message);
    }
  }

  async function startFromModal() {
    setBusy(true); setErr('');
    try { await startSubscription(); }        // redirects away on success
    catch (e) { setErr(e.message); setBusy(false); }
  }

  const modalEl = (
    <BillingSetupModal
      open={!!modal}
      reason={modal || 'no-account'}
      productCount={productCount ?? 0}
      busy={busy}
      error={err}
      onStart={startFromModal}
      onClose={() => { setModal(null); setErr(''); setBusy(false); }}
    />
  );

  if (!billing) return null;

  // ── No subscription ──
  if (billing.status === 'none') {
    // Nothing built yet → stay quiet. The paywall is explained at publish time.
    if (!productCount) return <>{modalEl}</>;
    return (
      <>
        <div className="tb tb-none">
          <span>
            📦 <strong>{productCount} product{productCount === 1 ? '' : 's'} built, none of them live.</strong>{' '}
            Your storefront needs a platform plan before buyers can reach it — 14 days free, no charge today.
          </span>
          <button type="button" className="tb-btn" disabled={busy} onClick={() => setModal('has-products')}>
            Set up billing
          </button>
        </div>
        {err && <p className="tb-err">{err}</p>}
        <TBStyles />
        {modalEl}
      </>
    );
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
      <TBStyles />
      {modalEl}
    </>
  );
}

function TBStyles() {
  return <style>{`
    .tb { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
          padding:12px 16px; border-radius:12px; margin:0 0 16px; font-size:14px; }
    .tb-trial  { background:rgba(245,99,74,.1);  border:1px solid rgba(245,99,74,.35); }
    .tb-active { background:rgba(0,0,0,.04);     border:1px solid rgba(0,0,0,.08); }
    .tb-paused { background:rgba(255,159,10,.12); border:1px solid rgba(255,159,10,.4); }
    .tb-none   { background:rgba(245,99,74,.08);  border:1px solid rgba(245,99,74,.3); }
    .tb-btn { border:0; border-radius:8px; padding:8px 14px; font-size:13px; font-weight:600;
              cursor:pointer; background:#F5634A; color:#fff; white-space:nowrap; }
    .tb-btn:disabled { opacity:.6; cursor:default; }
    .tb-btn-warn { background:#e08700; }
    .tb-err { color:#c0392b; font-size:13px; margin:-8px 0 12px; }
  `}</style>;
}
