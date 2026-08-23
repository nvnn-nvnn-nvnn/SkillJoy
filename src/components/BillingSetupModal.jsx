import { useEffect, useRef } from 'react';
import { X, CreditCard, Store, ShieldCheck, CalendarClock } from 'lucide-react';

// ── "Set up billing" explainer ──────────────────────────────────────────────
//
// Exists because of one specific confusion. SkillJoy has TWO separate Stripe
// relationships and they are easy to mistake for each other:
//
//   Payouts (Stripe Connect) — money flows TO the creator. Set up on /profile.
//   Platform plan            — money flows FROM the creator to SkillJoy. This.
//
// A creator who finished Connect onboarding reasonably believes "my Stripe is
// set up", then hits "No billing account yet — subscribe first." and has no way
// to know a second, unrelated thing exists. That raw error is accurate and
// useless. This modal names both, says which one is missing, and starts it.
//
// `reason` picks the framing:
//   'no-account'   — they clicked Manage billing with no subscription behind it
//   'has-products' — they've built products but never started the plan
export default function BillingSetupModal({ open, reason = 'no-account', productCount = 0, busy, error, onStart, onClose }) {
  const closeRef = useRef(null);

  // Escape to dismiss + focus the close button on open, so the modal is
  // keyboard-usable and doesn't trap someone who opened it by accident.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    // Stop the page behind from scrolling under the overlay.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const lede = reason === 'has-products'
    ? <>You’ve built {productCount > 0 ? <strong>{productCount} product{productCount === 1 ? '' : 's'}</strong> : 'your products'}, but your storefront can’t go live until your platform plan is running. It takes about a minute.</>
    : <>That button opens the billing portal for your <strong>platform plan</strong> — and you haven’t started one yet, so there’s nothing to manage. Here’s what it is and how to set it up.</>;

  return (
    <div className="bsm-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="bsm" role="dialog" aria-modal="true" aria-labelledby="bsm-title">
        <button ref={closeRef} className="bsm-x" onClick={onClose} aria-label="Close"><X size={17} /></button>

        <h2 className="bsm-title" id="bsm-title">Set up your billing account</h2>
        <p className="bsm-lede">{lede}</p>

        {/* The disambiguation is the whole point of this modal — it goes first,
            before any steps, because it's the thing being misunderstood. */}
        <div className="bsm-split">
          <div className="bsm-half">
            <span className="bsm-halficon bsm-in"><Store size={16} /></span>
            <span className="bsm-halftitle">Payouts</span>
            <span className="bsm-halfsub">Stripe pays <em>you</em> when someone buys. Set up on your Profile.</span>
          </div>
          <div className="bsm-half bsm-half-on">
            <span className="bsm-halficon bsm-out"><CreditCard size={16} /></span>
            <span className="bsm-halftitle">Platform plan <span className="bsm-tag">this one</span></span>
            <span className="bsm-halfsub">You pay SkillJoy to keep your storefront live. Separate from payouts.</span>
          </div>
        </div>
        <p className="bsm-note">
          These are two different Stripe connections. Finishing one doesn’t start the other —
          which is why you can have payouts working and still see “no billing account”.
        </p>

        <ol className="bsm-steps">
          <li>
            <span className="bsm-stepicon"><CreditCard size={15} /></span>
            <div>
              <strong>Add a card on Stripe</strong>
              <p>You’ll go to Stripe’s secure checkout. Your card details go to Stripe, never to SkillJoy.</p>
            </div>
          </li>
          <li>
            <span className="bsm-stepicon"><CalendarClock size={15} /></span>
            <div>
              <strong>14 days free — no charge today</strong>
              <p>The card is saved now, but the first payment isn’t taken until day 14. Cancel before then and you pay nothing.</p>
            </div>
          </li>
          <li>
            <span className="bsm-stepicon"><ShieldCheck size={15} /></span>
            <div>
              <strong>Your storefront goes live</strong>
              <p>Publishing unlocks immediately. Building, customizing, and adding products stay free either way.</p>
            </div>
          </li>
        </ol>

        {error && <p className="bsm-err" role="alert">{error}</p>}

        <div className="bsm-actions">
          <button className="bsm-btn bsm-ghost" onClick={onClose} disabled={busy}>Not now</button>
          <button className="bsm-btn bsm-primary" onClick={onStart} disabled={busy}>
            {busy ? 'Opening Stripe…' : 'Start free trial'}
          </button>
        </div>
        <p className="bsm-fine">You’ll come back here automatically once Stripe is done.</p>

        <Styles />
      </div>
    </div>
  );
}

function Styles() {
  return <style>{`
    .bsm-overlay { position:fixed; inset:0; z-index:1000; background:rgba(20,18,12,.55);
      display:flex; align-items:center; justify-content:center; padding:20px; overflow-y:auto;
      backdrop-filter:blur(2px); animation:bsm-fade .16s ease; }
    @keyframes bsm-fade { from { opacity:0; } }
    .bsm { position:relative; width:100%; max-width:560px; margin:auto; background:var(--surface);
      border:1px solid var(--border); border-radius:var(--r-lg); padding:26px 26px 20px;
      box-shadow:0 24px 60px rgba(20,18,12,.28); animation:bsm-rise .18s cubic-bezier(.2,.9,.3,1); }
    @keyframes bsm-rise { from { transform:translateY(10px); opacity:0; } }
    @media (prefers-reduced-motion: reduce) {
      .bsm-overlay, .bsm { animation:none; }
    }
    .bsm-x { position:absolute; top:12px; right:12px; width:32px; height:32px; padding:0; border-radius:var(--r-full);
      border:1px solid var(--border); background:var(--surface); color:var(--text-muted); cursor:pointer;
      display:inline-flex; align-items:center; justify-content:center; }
    .bsm-x:hover { background:var(--surface-alt); color:var(--text); }
    .bsm-title { font-size:21px; font-weight:800; letter-spacing:-.01em; color:var(--text); margin:0 34px 8px 0; }
    .bsm-lede { font-size:14px; line-height:1.6; color:var(--text-secondary); margin:0 0 18px; }

    .bsm-split { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
    .bsm-half { display:flex; flex-direction:column; gap:5px; padding:13px; border-radius:var(--r);
      border:1px solid var(--border); background:var(--surface-alt); }
    .bsm-half-on { border-color:var(--accent-mid); background:var(--accent-light); }
    .bsm-halficon { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px;
      border-radius:var(--r-sm); background:var(--surface); color:var(--text-secondary); border:1px solid var(--border); }
    .bsm-half-on .bsm-halficon { color:var(--accent-hover); border-color:var(--accent-mid); }
    .bsm-halftitle { font-size:13.5px; font-weight:800; color:var(--text); display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .bsm-tag { font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;
      background:var(--accent); color:var(--accent-foreground); padding:2px 7px; border-radius:var(--r-full); }
    .bsm-halfsub { font-size:12px; line-height:1.5; color:var(--text-secondary); }
    .bsm-halfsub em { font-style:normal; font-weight:700; color:var(--text); }
    .bsm-note { font-size:12.5px; line-height:1.55; color:var(--text-muted); margin:10px 0 18px; }

    .bsm-steps { list-style:none; margin:0 0 6px; padding:0; display:flex; flex-direction:column; gap:14px;
      border-top:1px solid var(--border); padding-top:18px; }
    .bsm-steps li { display:flex; gap:12px; align-items:flex-start; }
    .bsm-stepicon { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
      width:30px; height:30px; border-radius:var(--r-full); background:var(--accent-light); color:var(--accent-hover); }
    .bsm-steps strong { display:block; font-size:14px; font-weight:700; color:var(--text); }
    .bsm-steps p { margin:3px 0 0; font-size:13px; line-height:1.55; color:var(--text-secondary); }

    .bsm-err { margin:14px 0 0; padding:9px 12px; border-radius:var(--r-sm); font-size:13px; font-weight:600;
      color:var(--danger); background:var(--danger-light); border:1px solid var(--danger-mid); }

    .bsm-actions { display:flex; justify-content:flex-end; gap:9px; margin-top:20px; flex-wrap:wrap; }
    .bsm-btn { padding:11px 20px; border-radius:var(--r-full); font-size:14px; font-weight:700;
      font-family:inherit; cursor:pointer; white-space:nowrap; border:1.5px solid transparent; }
    .bsm-btn:disabled { opacity:.6; cursor:default; }
    .bsm-ghost { background:var(--surface); color:var(--text-secondary); border-color:var(--border-strong); }
    .bsm-ghost:hover:not(:disabled) { background:var(--surface-alt); color:var(--text); }
    .bsm-primary { background:var(--accent); color:var(--accent-foreground); }
    .bsm-primary:hover:not(:disabled) { background:var(--accent-hover); }
    .bsm-fine { text-align:right; font-size:11.5px; color:var(--text-muted); margin:9px 0 0; }

    @media (max-width:540px) {
      .bsm { padding:22px 18px 16px; }
      .bsm-split { grid-template-columns:1fr; }
      .bsm-actions { flex-direction:column-reverse; }
      .bsm-btn { width:100%; }
      .bsm-fine { text-align:center; }
    }
  `}</style>;
}
