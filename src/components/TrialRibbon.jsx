import { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { useUser } from '@/lib/stores';
import { getBillingStatus, openBillingPortal, trialDaysLeft } from '@/lib/billing';

// ── App-wide free-trial ribbon ──────────────────────────────────────────────
//
// TrialBanner already shows trial state, but only on /dashboard and /build —
// so a creator spending their trial in the storefront editor (which is most of
// it) never saw the countdown and got surprised by the first charge.
//
// This is a thin persistent strip above the header, visible on every app page.
// Deliberately NOT dismissible: it's a countdown to a charge, and the whole
// value is that it can't be missed. It stays slim to earn that.
//
// It escalates in the last 3 days — same information, more urgency, because
// "12 days left" and "1 day left" call for different reactions.
export default function TrialRibbon() {
    const user = useUser();
    const [billing, setBilling] = useState(null);
    const [busy, setBusy] = useState(false);

    // No synchronous setState in here: the `!user` case is handled by the render
    // guard below, so clearing state eagerly would be a set-during-effect with
    // no behavioural benefit. Only the async resolution writes.
    useEffect(() => {
        if (!user) return;
        let alive = true;
        getBillingStatus()
            .then(d => { if (alive) setBilling(d); })
            .catch(() => { if (alive) setBilling(null); });
        return () => { alive = false; };
    }, [user]);

    // Only for an active trial. Every other billing state has its own, richer
    // surface in TrialBanner — duplicating them here would be noise on a strip
    // that has to stay ignorable-but-present.
    if (!user || billing?.status !== 'trialing') return null;

    const days = trialDaysLeft(billing.trial_ends_at);
    const urgent = days <= 3;
    const endsOn = billing.trial_ends_at
        ? new Date(billing.trial_ends_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : null;

    async function manage() {
        setBusy(true);
        try { await openBillingPortal(); }   // redirects on success
        catch { setBusy(false); }            // TrialBanner owns the error surface
    }

    return (
        <div className={`tr${urgent ? ' tr-urgent' : ''}`} role="status">
            <span className="tr-icon" aria-hidden="true">
                {urgent ? <AlertTriangle size={14} /> : <Clock size={14} />}
            </span>
            <span className="tr-text">
                {days === 0
                    ? <><strong>Your free trial ends today.</strong> Billing starts after that.</>
                    : <><strong>{days} day{days === 1 ? '' : 's'} left</strong> in your free trial{endsOn ? <> · ends {endsOn}</> : null}</>}
            </span>
            <button className="tr-btn" onClick={manage} disabled={busy}>
                {busy ? 'Opening…' : 'Manage billing'}
            </button>

            <style>{`
        .tr { display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap;
          padding:7px 16px; font-size:13px; line-height:1.4; text-align:center;
          background:var(--accent-light); color:var(--text-secondary);
          border-bottom:1px solid var(--accent-mid); }
        .tr-urgent { background:var(--danger-light); border-bottom-color:var(--danger-mid); }
        .tr-icon { display:inline-flex; flex-shrink:0; color:var(--accent-hover); }
        .tr-urgent .tr-icon { color:var(--danger); }
        .tr-text strong { color:var(--text); font-weight:750; }
        .tr-urgent .tr-text strong { color:var(--danger); }
        .tr-btn { flex-shrink:0; width:auto; padding:4px 12px; border-radius:var(--r-full);
          border:1px solid var(--accent-mid); background:var(--surface); color:var(--accent-hover);
          font-size:12px; font-weight:700; font-family:inherit; cursor:pointer; }
        .tr-btn:hover:not(:disabled) { background:var(--accent); color:var(--accent-foreground); border-color:var(--accent); }
        .tr-urgent .tr-btn { border-color:var(--danger-mid); color:var(--danger); }
        .tr-urgent .tr-btn:hover:not(:disabled) { background:var(--danger-solid); color:#fff; border-color:var(--danger-solid); }
        .tr-btn:disabled { opacity:.6; cursor:default; }
        @media (max-width:520px) {
          .tr { gap:7px; padding:7px 12px; font-size:12.5px; }
          .tr-btn { font-size:11.5px; padding:3px 10px; }
        }
      `}</style>
        </div>
    );
}
