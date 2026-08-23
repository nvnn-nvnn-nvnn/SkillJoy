import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, User, Phone, Banknote, CreditCard, ChevronRight, Loader2 } from 'lucide-react';
import { useUser, useProfile } from '@/lib/stores';
import { getBillingStatus } from '@/lib/billing';
import { apiFetch } from '@/lib/api';
import BillingSetupModal from '@/components/BillingSetupModal';
import { startSubscription } from '@/lib/billing';

// ── "Ready to sell" checklist ───────────────────────────────────────────────
//
// Why this exists as ONE component instead of separate cards.
//
// Selling has four independent prerequisites, and they were scattered:
//   · name + handle      → set in onboarding
//   · phone              → gated at /services (PhoneLock)
//   · payouts            → a Stripe CONNECT account, set up on /profile
//   · platform plan      → a Stripe SUBSCRIPTION, prompted at publish
//
// The two Stripe items are the trap. A creator finishes Connect onboarding,
// sees "Payouts active", and reasonably concludes their Stripe is done — then
// hits a paywall at publish and has no idea why. They're opposite directions of
// money (Connect pays them; the plan is them paying us) and neither screen ever
// said the other existed.
//
// Showing all four together, with the money direction spelled out, is the fix:
// the answer to "what's left?" is one list rather than a scavenger hunt.
export default function SetupChecklist() {
    const user = useUser();
    const profile = useProfile();
    const [stripe, setStripe] = useState(null);   // { onboarded } | null while loading
    const [billing, setBilling] = useState(null); // { status } | null while loading
    const [modal, setModal] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (!user) return;
        let alive = true;
        apiFetch('/api/stripe-connect/status')
            .then(r => r.ok ? r.json() : { onboarded: false })
            .then(d => { if (alive) setStripe(d); })
            .catch(() => { if (alive) setStripe({ onboarded: false }); });
        getBillingStatus()
            .then(d => { if (alive) setBilling(d); })
            .catch(() => { if (alive) setBilling({ status: 'none' }); });
        return () => { alive = false; };
    }, [user]);

    async function connectPayouts() {
        setBusy(true); setErr('');
        try {
            const res = await apiFetch('/api/stripe-connect/onboard', { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.url) throw new Error(data.error || 'Could not start Stripe onboarding.');
            window.location.href = data.url;
        } catch (e) { setErr(e.message); setBusy(false); }
    }

    async function startPlan() {
        setBusy(true); setErr('');
        try { await startSubscription(); }
        catch (e) { setErr(e.message); setBusy(false); }
    }

    // Still resolving — render nothing rather than a checklist that will flip
    // items from "to do" to "done" a moment later. A checklist that lies for
    // 300ms is worse than one that appears 300ms late.
    if (!profile || stripe === null || billing === null) return null;

    const planLive = ['trialing', 'active'].includes(billing.status);

    const items = [
        {
            key: 'profile',
            icon: User,
            label: 'Name and page link',
            done: !!(profile.full_name?.trim() && profile.username?.trim()),
            todo: 'Add your name and claim your handle.',
            doneText: `@${profile.username}`,
            action: { type: 'link', to: '/profile', label: 'Edit' },
        },
        {
            key: 'phone',
            icon: Phone,
            label: 'Phone number',
            done: !!profile.phone?.trim(),
            todo: 'Needed to verify your account before selling.',
            doneText: 'Verified on file',
            action: { type: 'link', to: '/settings', label: 'Add' },
        },
        {
            key: 'payouts',
            icon: Banknote,
            label: 'Payouts',
            // The money-direction hint is the whole point of pairing these two.
            hint: 'Stripe pays you',
            done: !!stripe.onboarded,
            todo: 'Connect Stripe so your sales reach your bank.',
            doneText: 'Connected',
            action: { type: 'fn', fn: connectPayouts, label: 'Connect' },
        },
        {
            key: 'plan',
            icon: CreditCard,
            label: 'Platform plan',
            hint: 'You pay SkillJoy',
            done: planLive,
            todo: '14 days free. Unlocks publishing — nothing charged today.',
            doneText: billing.status === 'trialing' ? 'Free trial active' : 'Active',
            action: { type: 'fn', fn: () => setModal(true), label: 'Start' },
        },
    ];

    const doneCount = items.filter(i => i.done).length;
    const allDone = doneCount === items.length;

    return (
        <section className={`sc${allDone ? ' sc-done' : ''}`}>
            <div className="sc-head">
                <div>
                    <h2 className="sc-title">{allDone ? 'You’re set up to sell' : 'Finish setting up'}</h2>
                    <p className="sc-sub">
                        {allDone
                            ? 'Everything selling needs is in place.'
                            : 'These four things unlock selling. They’re quick, and you can do them in any order.'}
                    </p>
                </div>
                <span className="sc-count">{doneCount}/{items.length}</span>
            </div>

            <div className="sc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount}>
                <div className="sc-fill" style={{ width: `${(doneCount / items.length) * 100}%` }} />
            </div>

            <ul className="sc-list">
                {items.map(item => {
                    const Icon = item.icon;
                    return (
                        <li key={item.key} className={`sc-item${item.done ? ' on' : ''}`}>
                            <span className="sc-mark" aria-hidden="true">
                                {item.done ? <Check size={13} strokeWidth={3} /> : <Icon size={14} />}
                            </span>
                            <div className="sc-body">
                                <span className="sc-label">
                                    {item.label}
                                    {item.hint && <span className="sc-hint">{item.hint}</span>}
                                </span>
                                <span className="sc-desc">{item.done ? item.doneText : item.todo}</span>
                            </div>
                            {item.done ? (
                                <span className="sc-donepill">Done</span>
                            ) : item.action.type === 'link' ? (
                                <Link className="sc-act" to={item.action.to}>{item.action.label} <ChevronRight size={13} /></Link>
                            ) : (
                                <button className="sc-act" onClick={item.action.fn} disabled={busy}>
                                    {busy ? <Loader2 size={13} className="sc-spin" /> : <>{item.action.label} <ChevronRight size={13} /></>}
                                </button>
                            )}
                        </li>
                    );
                })}
            </ul>

            {err && <p className="sc-err" role="alert">{err}</p>}

            <BillingSetupModal
                open={modal}
                reason="has-products"
                busy={busy}
                error={err}
                onStart={startPlan}
                onClose={() => { setModal(false); setErr(''); setBusy(false); }}
            />

            <style>{`
        .sc { margin-top:26px; background:var(--surface); border:1px solid var(--border);
          border-radius:var(--r-lg); padding:22px 24px; box-shadow:var(--shadow-sm); }
        .sc-done { border-color:var(--green-mid); }
        .sc-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
        .sc-title { font-size:17px; font-weight:750; color:var(--text); margin:0; }
        .sc-sub { font-size:13px; line-height:1.55; color:var(--text-secondary); margin:4px 0 0; max-width:46ch; }
        .sc-count { flex-shrink:0; font-size:12.5px; font-weight:800; color:var(--text-muted);
          background:var(--surface-alt); border:1px solid var(--border); border-radius:var(--r-full); padding:4px 11px; }

        .sc-bar { height:5px; border-radius:var(--r-full); background:var(--surface-alt); overflow:hidden; margin:16px 0 4px; }
        .sc-fill { height:100%; background:var(--accent); border-radius:var(--r-full); transition:width .35s cubic-bezier(.4,0,.2,1); }
        .sc-done .sc-fill { background:var(--green); }

        .sc-list { list-style:none; margin:0; padding:0; }
        .sc-item { display:flex; align-items:center; gap:12px; padding:14px 0; border-bottom:1px solid var(--border); }
        .sc-item:last-child { border-bottom:none; padding-bottom:0; }
        .sc-mark { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
          width:26px; height:26px; border-radius:var(--r-full); background:var(--surface-alt);
          border:1px solid var(--border); color:var(--text-muted); }
        .sc-item.on .sc-mark { background:var(--green-light); border-color:var(--green-mid); color:var(--green); }
        .sc-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
        .sc-label { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:14px; font-weight:700; color:var(--text); }
        /* The money-direction tag — the single most clarifying element here. */
        .sc-hint { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;
          color:var(--text-muted); background:var(--surface-alt); border:1px solid var(--border);
          padding:2px 7px; border-radius:var(--r-full); white-space:nowrap; }
        .sc-desc { font-size:12.5px; line-height:1.5; color:var(--text-secondary); }
        .sc-item.on .sc-desc { color:var(--text-muted); }

        .sc-act { flex-shrink:0; display:inline-flex; align-items:center; gap:3px; width:auto; padding:7px 13px;
          border:1.5px solid var(--border-strong); border-radius:var(--r-full); background:var(--surface);
          color:var(--text); font-size:12.5px; font-weight:700; font-family:inherit; cursor:pointer; text-decoration:none; }
        .sc-act:hover { border-color:var(--accent); color:var(--accent); text-decoration:none; }
        .sc-act:disabled { opacity:.55; cursor:default; }
        .sc-donepill { flex-shrink:0; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.05em;
          color:var(--green); background:var(--green-light); border:1px solid var(--green-mid);
          padding:3px 9px; border-radius:var(--r-full); }
        .sc-spin { animation:scRot .8s linear infinite; }
        @keyframes scRot { to { transform:rotate(360deg); } }
        .sc-err { margin:12px 0 0; font-size:13px; font-weight:600; color:var(--danger); }

        @media (max-width:560px) {
          .sc { padding:18px; }
          .sc-item { flex-wrap:wrap; }
          .sc-body { flex:1 1 100%; order:2; padding-left:38px; margin-top:-22px; }
          .sc-act, .sc-donepill { order:1; margin-left:auto; }
        }
        @media (prefers-reduced-motion: reduce) { .sc-spin { animation:none; } .sc-fill { transition:none; } }
      `}</style>
        </section>
    );
}
