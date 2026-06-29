import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useUser } from '@/lib/stores';
import { getPublicSkill } from '@/lib/skills';
import { startCheckout, confirmCheckout, validateCode } from '@/lib/purchases';
import { recordEvent } from '@/lib/analytics';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// Phase 3/10 — checkout for a Skill. One-time: optional promo code → embedded
// Payment Element. Membership: hosted Stripe subscription. Free: instant grant.
export default function Checkout() {
  const { skillId } = useParams();
  const user = useUser();
  const navigate = useNavigate();
  const [skill, setSkill] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [amountCents, setAmountCents] = useState(0);
  const [err, setErr] = useState('');
  const [status, setStatus] = useState('loading'); // loading|notfound|error|promo|pay

  // promo state
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(null); // { code, percentOff, amountCents }
  const [promoMsg, setPromoMsg] = useState('');
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    if (!user) { navigate(`/login?redirect=${encodeURIComponent(`/checkout/${skillId}`)}`); return; }
    let alive = true;
    (async () => {
      try {
        const s = await getPublicSkill(skillId);
        if (!alive) return;
        if (!s) { setStatus('notfound'); return; }
        setSkill(s);
        setAmountCents(s.price_cents);
        recordEvent('checkout_start', { skillId: s.id, creatorId: s.creator_id, buyerId: user.id });

        // Free → grant now. Membership → hosted subscription. Both skip the promo step.
        if (!s.price_cents || s.pricing_type === 'membership') {
          const out = await startCheckout(skillId);
          if (!alive) return;
          if (out.free) { recordEvent('purchase', { skillId: s.id, creatorId: s.creator_id, buyerId: user.id }); navigate(`/locker/${skillId}`); return; }
          if (out.membership) { window.location.href = out.url; return; }
          setClientSecret(out.clientSecret); setAmountCents(out.amountCents ?? s.price_cents); setStatus('pay'); return;
        }
        // One-time → promo step.
        setStatus('promo');
      } catch (e) { if (alive) { setErr(e.message); setStatus('error'); } }
    })();
    return () => { alive = false; };
  }, [skillId, user, navigate]);

  async function applyCode() {
    if (!code.trim()) return;
    setPromoMsg('');
    const r = await validateCode(skillId, code.trim());
    if (r.valid) { setApplied({ code: code.trim(), percentOff: r.percentOff, amountCents: r.amountCents }); setAmountCents(r.amountCents); setPromoMsg(`✓ ${r.percentOff}% off applied`); }
    else { setApplied(null); setAmountCents(skill.price_cents); setPromoMsg(r.error || 'Invalid code'); }
  }

  async function toPayment() {
    setContinuing(true); setErr('');
    try {
      const out = await startCheckout(skillId, applied?.code || null);
      if (out.free) { navigate(`/locker/${skillId}`); return; }
      setClientSecret(out.clientSecret);
      setAmountCents(out.amountCents ?? amountCents);
      setStatus('pay');
    } catch (e) { setErr(e.message); }
    finally { setContinuing(false); }
  }

  if (status === 'loading') return <Shell><p className="ck-muted">Preparing checkout…</p></Shell>;
  if (status === 'notfound') return <Shell><p className="ck-muted">This Skill isn’t available.</p></Shell>;
  if (status === 'error') return (
    <Shell><p className="ck-err">{err}</p><button className="btn btn-secondary" onClick={() => navigate(-1)}>← Go back</button></Shell>
  );

  return (
    <Shell>
      <Summary skill={skill} amountCents={amountCents} discounted={!!applied} />

      {status === 'promo' && (
        <div className="ck-promo">
          <label className="ck-plabel">Have a promo code?</label>
          <div className="ck-prow">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CODE" />
            <button className="btn btn-secondary btn-sm" onClick={applyCode} type="button">Apply</button>
          </div>
          {promoMsg && <p className={`ck-pmsg${applied ? ' ok' : ' bad'}`}>{promoMsg}</p>}
          <button className="btn btn-primary ck-pay" onClick={toPayment} disabled={continuing}>
            {continuing ? '…' : 'Continue to payment'}
          </button>
          {err && <p className="ck-err">{err}</p>}
        </div>
      )}

      {status === 'pay' && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'flat', variables: { colorPrimary: '#D4522A' } } }}>
          <CheckoutForm skill={skill} amountCents={amountCents} onPaid={() => {
            recordEvent('purchase', { skillId: skill.id, creatorId: skill.creator_id, buyerId: user.id });
            navigate(`/locker/${skillId}`);
          }} />
        </Elements>
      )}
    </Shell>
  );
}

function Summary({ skill, amountCents, discounted }) {
  return (
    <div className="ck-summary">
      <div className="ck-cover" style={skill.cover_url ? { backgroundImage: `url(${skill.cover_url})` } : {}}>
        {!skill.cover_url && <span>🧩</span>}
      </div>
      <div>
        <p className="ck-title">{skill.title}</p>
        <p className="ck-price">
          {discounted && <span className="ck-was">${(skill.price_cents / 100).toFixed(2)}</span>}
          ${(amountCents / 100).toFixed(2)}
          {skill.pricing_type === 'membership' && <span className="ck-sub"> / membership</span>}
        </p>
      </div>
    </div>
  );
}

function CheckoutForm({ skill, amountCents, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [err, setErr] = useState('');

  async function pay(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true); setErr('');
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: { return_url: `${window.location.origin}/locker/${skill.id}` },
      });
      if (error) throw new Error(error.message);
      if (paymentIntent?.status === 'succeeded') {
        try { await confirmCheckout(skill.id, paymentIntent.id); } catch { /* webhook will catch up */ }
        onPaid();
      } else {
        throw new Error(`Payment ${paymentIntent?.status ?? 'incomplete'}.`);
      }
    } catch (e2) { setErr(e2.message); }
    finally { setProcessing(false); }
  }

  return (
    <form onSubmit={pay} className="ck-form">
      <PaymentElement />
      {err && <p className="ck-err">{err}</p>}
      <button className="btn btn-primary ck-pay" disabled={!stripe || processing}>
        {processing ? 'Processing…' : `Pay $${(amountCents / 100).toFixed(2)}`}
      </button>
      <p className="ck-fine">Instant access. Secure payment by Stripe.</p>
    </form>
  );
}

function Shell({ children }) {
  return (
    <div className="ck-wrap">
      <title>Checkout — SkillJoy</title>
      <h1 className="ck-h1">Checkout</h1>
      {children}
      <style>{`
        .ck-wrap { max-width:460px; margin:0 auto; padding:28px 16px 80px; }
        .ck-h1 { font-size:24px; font-weight:700; font-family:var(--font-display); margin-bottom:18px; }
        .ck-muted { color:var(--text-muted); }
        .ck-err { color:var(--accent); background:var(--accent-light); border:1px solid var(--accent-mid); border-radius:var(--r-sm); padding:10px 14px; font-size:14px; margin:8px 0; }
        .ck-summary { display:flex; gap:14px; align-items:center; padding:14px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); margin-bottom:20px; }
        .ck-cover { width:64px; height:64px; border-radius:var(--r); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0; }
        .ck-title { font-weight:700; color:var(--text); }
        .ck-price { font-weight:800; font-size:18px; margin-top:2px; }
        .ck-was { text-decoration:line-through; color:var(--text-muted); font-weight:600; font-size:15px; margin-right:8px; }
        .ck-sub { font-size:13px; color:var(--text-muted); font-weight:600; }
        .ck-promo { display:flex; flex-direction:column; gap:10px; }
        .ck-plabel { font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }
        .ck-prow { display:flex; gap:8px; }
        .ck-prow input { flex:1; text-transform:uppercase; }
        .ck-pmsg { font-size:13px; margin:0; }
        .ck-pmsg.ok { color:var(--green); }
        .ck-pmsg.bad { color:var(--accent); }
        .ck-form { display:flex; flex-direction:column; gap:16px; }
        .ck-pay { width:100%; font-size:16px; padding:13px; }
        .ck-fine { text-align:center; font-size:12px; color:var(--text-muted); }
      `}</style>
    </div>
  );
}
