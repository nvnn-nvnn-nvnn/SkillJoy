import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useUser } from '@/lib/stores';
import { getPublicSkill } from '@/lib/skills';
import { resolveTheme, MODE_PALETTES, readableOn, contrastRatio } from '@/lib/storefront';
import { getProfileTheme } from '@/lib/profiles';
import { startCheckout, confirmCheckout, validateCode, startGuestCheckout, confirmGuestCheckout } from '@/lib/purchases';
import { recordEvent } from '@/lib/metrics';
import BackLink from '@/components/BackLink';

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
  const [status, setStatus] = useState('loading'); // loading|notfound|error|promo|pay|guest-success
  const [ckTheme, setCkTheme] = useState(null); // creator's resolved storefront theme; null → app-default look

  // guest checkout (no account) — collected on the promo step when !user
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const isGuest = !user;

  // promo state
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(null); // { code, percentOff, amountCents }
  const [promoMsg, setPromoMsg] = useState('');
  const [continuing, setContinuing] = useState(false);

  // order bump state
  const [bumpSkill, setBumpSkill] = useState(null); // the add-on product being offered
  const [bumpOn, setBumpOn] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await getPublicSkill(skillId);
        if (!alive) return;
        if (!s) { setStatus('notfound'); return; }
        setSkill(s);
        setAmountCents(s.price_cents);
        recordEvent('checkout_start', { skillId: s.id, creatorId: s.creator_id, buyerId: user?.id ?? null });

        // Themed checkout: fetch the creator's look in parallel. Best-effort by
        // design — a slow or failed theme query must NEVER delay or break
        // payment, so this doesn't await and null falls back to the app look.
        getProfileTheme(s.creator_id)
          .then(t => { if (alive && t !== null) setCkTheme(resolveTheme(t)); })
          .catch(() => {});

        // Load the order-bump product (one-time checkouts only). Best-effort.
        if (s.order_bump_skill_id && s.price_cents && s.pricing_type === 'onetime') {
          try {
            const b = await getPublicSkill(s.order_bump_skill_id);
            if (alive && b && b.status === 'published') setBumpSkill(b);
          } catch { /* bump is optional — ignore */ }
        }

        // Guests can only check out one-time PAID products. Free (lead) and
        // membership need an account → send them to log in first.
        if (!user) {
          if (s.price_cents && s.pricing_type === 'onetime') { setStatus('promo'); return; }
          navigate(`/login?redirect=${encodeURIComponent(`/checkout/${skillId}`)}`);
          return;
        }

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
    if (isGuest) {
      if (!guestName.trim()) { setErr('Please enter your name.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) { setErr('Please enter a valid email.'); return; }
    }
    setContinuing(true); setErr('');
    try {
      const out = isGuest
        ? await startGuestCheckout(skillId, { name: guestName.trim(), email: guestEmail.trim(), code: applied?.code || null, bump: bumpOn })
        : await startCheckout(skillId, applied?.code || null, bumpOn);
      if (out.free) { navigate(`/locker/${skillId}`); return; }
      setClientSecret(out.clientSecret);
      setAmountCents(out.amountCents ?? amountCents);
      setStatus('pay');
    } catch (e) { setErr(e.message); }
    finally { setContinuing(false); }
  }

  // Bump price (creator's override, else the add-on's own price) + running total.
  const bumpCents = bumpSkill ? (skill?.order_bump_price_cents ?? bumpSkill.price_cents ?? 0) : 0;
  const displayTotal = amountCents + (bumpOn ? bumpCents : 0);

  // ── Creator theming — accent + mode palette ONLY. Deliberately no bg media,
  // overlays, glow, audio or tilt here: checkout is a trust surface, and it
  // stays calm, fast and legible no matter how loud the storefront is.
  const mode = ckTheme?.mode === 'dark' ? 'dark' : 'light';
  const palette = ckTheme ? MODE_PALETTES[mode] : null;
  const accent = ckTheme?.accent;
  const pin = palette ? {
    colorScheme: mode,
    '--bg': palette.bg, '--surface': palette.surface, '--surface-alt': palette.surfaceAlt,
    '--text': palette.text, '--text-secondary': palette.textSecondary, '--text-muted': palette.textMuted,
    '--border': palette.border, '--border-strong': palette.borderStrong,
    '--accent': accent,
    // Text ON the accent (pay buttons): luminance-picked so a near-white or
    // near-black accent can never produce an unreadable button.
    '--accent-foreground': readableOn(accent),
    '--accent-hover': `color-mix(in srgb, ${accent} 85%, #000)`,
    '--accent-light': `color-mix(in srgb, ${accent} 12%, ${palette.surface})`,
    '--accent-mid': `color-mix(in srgb, ${accent} 38%, transparent)`,
    // Accent AS text (bump price): needs 4.5:1 on the surface, else fall back.
    '--ck-accent-text': contrastRatio(accent, palette.surface) >= 4.5 ? accent : palette.text,
    '--ck-danger': mode === 'dark' ? '#f87171' : '#dc2626',
  } : undefined;

  // Stripe's PaymentElement is an iframe — themed via the appearance API, not
  // CSS. Built from the same resolved theme; appearance is fixed at <Elements>
  // mount, which clientSecret already gates.
  const appearance = ckTheme ? {
    theme: mode === 'dark' ? 'night' : 'flat',
    variables: {
      colorPrimary: accent,
      colorBackground: palette.surface,
      colorText: palette.text,
      colorDanger: '#dc2626',
      fontFamily: 'inherit',
      borderRadius: '10px',
    },
  } : { theme: 'flat', variables: { colorPrimary: '#D4522A' } };

  if (status === 'loading') return <Shell pin={pin}><p className="ck-muted">Preparing checkout…</p></Shell>;
  if (status === 'notfound') return <Shell pin={pin}><p className="ck-muted">This Skill isn’t available.</p></Shell>;
  if (status === 'error') return (
    <Shell pin={pin}><p className="ck-err">{err}</p><BackLink onClick={() => navigate(-1)}>Go back</BackLink></Shell>
  );

  return (
    <Shell pin={pin}>
      <Summary skill={skill} amountCents={amountCents} discounted={!!applied} />

      {status === 'promo' && (
        <div className="ck-promo">
          {isGuest && (
            <div className="ck-guest">
              <label className="ck-plabel">Your details</label>
              <input className="ck-in" value={guestName} onChange={e => setGuestName(e.target.value)}
                placeholder="Full name" autoComplete="name" />
              <input className="ck-in" type="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}
                placeholder="you@email.com" autoComplete="email" />
              <p className="ck-fine ck-guest-note">We’ll email your purchase here with a link to access it — no account needed.</p>
            </div>
          )}

          {!isGuest && (
            <>
              <label className="ck-plabel">Have a promo code?</label>
              <div className="ck-prow">
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CODE" />
                <button className="btn btn-secondary btn-sm" onClick={applyCode} type="button">Apply</button>
              </div>
              {promoMsg && <p className={`ck-pmsg${applied ? ' ok' : ' bad'}`}>{promoMsg}</p>}
            </>
          )}

          {bumpSkill && (
            <label className="ck-bump">
              <input type="checkbox" checked={bumpOn} onChange={e => setBumpOn(e.target.checked)} />
              <span className="ck-bump-body">
                <span className="ck-bump-title">
                  {skill.order_bump_blurb || `Add “${bumpSkill.title}”`}
                  <span className="ck-bump-price">+${(bumpCents / 100).toFixed(2)}</span>
                </span>
                {bumpSkill.outcome && <span className="ck-bump-sub">{bumpSkill.outcome}</span>}
              </span>
            </label>
          )}

          <button className="btn btn-primary ck-pay" onClick={toPayment} disabled={continuing}>
            {continuing ? '…' : `Continue to payment · $${(displayTotal / 100).toFixed(2)}`}
          </button>
          {err && <p className="ck-err">{err}</p>}
        </div>
      )}

      {status === 'pay' && clientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <CheckoutForm skill={skill} amountCents={amountCents} guest={isGuest} onPaid={() => {
            recordEvent('purchase', { skillId: skill.id, creatorId: skill.creator_id, buyerId: user?.id ?? null });
            if (isGuest) setStatus('guest-success');
            else navigate(`/locker/${skillId}`);
          }} />
        </Elements>
      )}

      {status === 'guest-success' && (
        <div className="ck-done">
          <p style={{ fontSize: 44 }}>✅</p>
          <p className="ck-done-t">You’re all set!</p>
          <p className="ck-muted">We’ve emailed <strong>{guestEmail}</strong> a receipt and a link to access <strong>{skill.title}</strong> — no password needed. Check your inbox (and spam, just in case).</p>
          <button className="btn btn-primary ck-pay" style={{ marginTop: 20 }} onClick={() => navigate(-1)}>Go back</button>
        </div>
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

function CheckoutForm({ skill, amountCents, onPaid, guest = false }) {
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
        // Guests aren't logged in, so don't bounce them to the (gated) Locker.
        confirmParams: { return_url: `${window.location.origin}/checkout/${skill.id}` },
      });
      if (error) throw new Error(error.message);
      if (paymentIntent?.status === 'succeeded') {
        try {
          if (guest) await confirmGuestCheckout(skill.id, paymentIntent.id);
          else await confirmCheckout(skill.id, paymentIntent.id);
        } catch { /* webhook will catch up */ }
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

function Shell({ pin, children }) {
  return (
    <div className="ck-wrap" style={pin}>
      {/* Full-page canvas so a dark store gets a dark page, not a dark card on cream. */}
      {pin && <div className="ck-bg" aria-hidden="true" />}
      <title>Checkout — SkillJoy</title>
      <h1 className="ck-h1">Checkout</h1>
      {children}
      <style>{`
        .ck-wrap { position:relative; max-width:460px; margin:0 auto; padding:28px 16px 80px; color:var(--text); }
        .ck-bg { position:fixed; inset:0; z-index:-1; background:var(--bg); }
        .ck-h1 { font-size:24px; font-weight:700; font-family:var(--font-display); margin-bottom:18px; color:var(--text); }
        .ck-muted { color:var(--text-muted); }
        /* Pay CTAs re-pinned here so the themed accent + readable-on-accent text
           win regardless of how the global .btn-primary is defined. */
        .ck-wrap .btn-primary { background:var(--accent); color:var(--accent-foreground, #fff); }
        .ck-wrap .btn-primary:hover:not(:disabled) { background:var(--accent-hover, var(--accent)); color:var(--accent-foreground, #fff); }
        /* Errors are semantic danger, not the creator's accent — a mint-green
           "payment failed" is a trust bug, not a style choice. */
        .ck-err { color:var(--ck-danger, #dc2626); background:color-mix(in srgb, var(--ck-danger, #dc2626) 10%, var(--surface)); border:1px solid color-mix(in srgb, var(--ck-danger, #dc2626) 35%, var(--border)); border-radius:var(--r-sm); padding:10px 14px; font-size:14px; margin:8px 0; }
        .ck-summary { display:flex; gap:14px; align-items:center; padding:14px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface); margin-bottom:20px; }
        .ck-cover { width:64px; height:64px; border-radius:var(--r); background:var(--surface-alt) center/cover no-repeat; display:flex; align-items:center; justify-content:center; font-size:26px; flex-shrink:0; }
        .ck-title { font-weight:700; color:var(--text); }
        .ck-price { font-weight:800; font-size:18px; margin-top:2px; }
        .ck-was { text-decoration:line-through; color:var(--text-muted); font-weight:600; font-size:15px; margin-right:8px; }
        .ck-sub { font-size:13px; color:var(--text-muted); font-weight:600; }
        .ck-promo { display:flex; flex-direction:column; gap:10px; }
        .ck-plabel { font-size:13px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }
        .ck-prow { display:flex; gap:8px; }
        .ck-prow input { flex:1; text-transform:uppercase; background:var(--surface); color:var(--text); }
        .ck-pmsg { font-size:13px; margin:0; }
        .ck-pmsg.ok { color:var(--green, #16a34a); }
        .ck-pmsg.bad { color:var(--ck-danger, #dc2626); }
        .ck-bump { display:flex; gap:12px; align-items:flex-start; padding:14px; border:1.5px dashed var(--accent-mid); border-radius:var(--r-lg); background:var(--accent-light); cursor:pointer; }
        .ck-bump input { margin-top:3px; width:18px; height:18px; flex-shrink:0; accent-color:var(--accent); cursor:pointer; }
        .ck-bump-body { display:flex; flex-direction:column; gap:3px; }
        .ck-bump-title { font-weight:700; color:var(--text); display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; }
        .ck-bump-price { color:var(--ck-accent-text, var(--accent)); font-weight:800; }
        .ck-bump-sub { font-size:13px; color:var(--text-secondary); }
        .ck-form { display:flex; flex-direction:column; gap:16px; }
        .ck-pay { width:100%; font-size:16px; padding:13px; }
        .ck-fine { text-align:center; font-size:12px; color:var(--text-muted); }
        .ck-guest { display:flex; flex-direction:column; gap:10px; margin-bottom:6px; }
        .ck-in { width:100%; padding:11px 12px; border:1px solid var(--border-strong); border-radius:var(--r); font-family:inherit; font-size:15px; background:var(--surface); color:var(--text); }
        .ck-in:focus { outline:none; border-color:var(--accent); }
        .ck-guest-note { text-align:left; margin-top:2px; }
        .ck-done { text-align:center; padding:24px 0; }
        .ck-done-t { font-weight:800; font-size:20px; margin:6px 0 10px; }
      `}</style>
    </div>
  );
}
