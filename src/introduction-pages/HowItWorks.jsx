import { useEffect } from 'react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    emoji: '🔗',
    title: 'Claim your storefront',
    desc: "Sign up and grab your link — skilljoy.me/@you. It's the one link you'll share everywhere.",
  },
  {
    emoji: '🧩',
    title: 'Build a Skill',
    desc: 'Add what you sell — a digital download, course, coaching call, or membership — with content blocks and a price.',
  },
  {
    emoji: '🚀',
    title: 'Publish & share',
    desc: 'Publish your storefront and drop your link in your bio across Instagram, TikTok, YouTube, and X.',
  },
  {
    emoji: '💳',
    title: 'Get paid',
    desc: 'Buyers check out in one tap. Payments are processed securely by Stripe and paid out to your bank.',
  },
  {
    emoji: '📈',
    title: 'Grow',
    desc: 'Track sales and views, build your email list, offer discounts, and add more Skills as you grow.',
  },
];

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function HowItWorksPage() {
  // Scroll-reveal, matching the landing page.
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <title>How SkillJoy works — build, share, get paid</title>

      <main className="hiw">
        {/* ── Header ── */}
        <section className="hiw-head reveal">
          <span className="sj-pill"><span className="sj-dot" />How it works</span>
          <h1 className="hiw-title">From idea to income in <span className="accent-text">five steps</span></h1>
          <p className="hiw-sub">
            SkillJoy is the creator storefront for selling what you know — courses, templates,
            prompts, and coaching, all from one link, with secure Stripe-powered checkout.
          </p>
        </section>

        {/* ── Steps timeline ── */}
        <section className="hiw-steps">
          {STEPS.map((step, i) => (
            <div key={i} className={`hiw-step reveal reveal-d${(i % 3) + 1}`}>
              <div className="hiw-step-rail">
                <span className="hiw-step-num">{i + 1}</span>
              </div>
              <div className="hiw-card">
                <span className="hiw-step-emoji">{step.emoji}</span>
                <div className="hiw-step-copy">
                  <span className="hiw-step-kicker">Step {i + 1}</span>
                  <h3 className="hiw-step-title">{step.title}</h3>
                  <p className="hiw-step-desc">{step.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── Payments callout ── */}
        <section className="hiw-note reveal">
          <div className="hiw-note-inner">
            <span className="hiw-note-icon">🔒</span>
            <div>
              <h2 className="hiw-note-title">Payments &amp; payouts</h2>
              <p className="hiw-note-body">
                Checkout is powered by Stripe, so card details never touch SkillJoy. After a sale,
                your earnings are transferred to your connected Stripe account and paid out to your
                bank on Stripe's schedule. You keep the bulk of every sale — SkillJoy only takes a
                small platform fee, shown transparently at checkout.
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="hiw-cta reveal">
          <div className="hiw-cta-inner">
            <h2 className="hiw-cta-title">Ready to build yours?</h2>
            <p className="hiw-cta-sub">Free to set up, no card needed until you publish.</p>
            <div className="hiw-cta-btns">
              <Link to="/login" className="btn btn-primary hiw-cta-main">Start your store <Arrow /></Link>
              <Link to="/about" className="btn btn-secondary">About SkillJoy</Link>
            </div>
          </div>
        </section>
      </main>

      <style>{`
        .hiw { max-width: 760px; margin: 0 auto; padding: clamp(40px, 7vw, 80px) 24px clamp(56px, 8vw, 96px); }

        /* Scroll reveal (shared with landing) */
        .reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.3,1); }
        .reveal.in { opacity: 1; transform: none; }
        .reveal-d1 { transition-delay: .06s; }
        .reveal-d2 { transition-delay: .12s; }
        .reveal-d3 { transition-delay: .18s; }
        @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }

        .accent-text { color: var(--accent); }

        /* ── Header ── */
        .hiw-head { text-align: center; margin-bottom: clamp(40px, 6vw, 64px); }
        .hiw-title { font-size: clamp(32px, 5vw, 52px); line-height: 1.08; letter-spacing: -0.03em; color: var(--text); margin: 20px 0 18px; }
        .hiw-sub { font-size: clamp(15px, 1.5vw, 18px); line-height: 1.65; color: var(--text-secondary); max-width: 560px; margin: 0 auto; }

        /* ── Steps timeline ── */
        .hiw-steps { display: flex; flex-direction: column; gap: 16px; }
        .hiw-step { display: flex; gap: 20px; align-items: stretch; }
        .hiw-step-rail { position: relative; flex-shrink: 0; width: 44px; display: flex; justify-content: center; }
        /* Connecting line runs from below one number into the next step's gap. */
        .hiw-step-rail::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); top: 48px; bottom: -16px; width: 2px; background: linear-gradient(var(--border-strong), var(--border)); }
        .hiw-step:last-child .hiw-step-rail::after { display: none; }
        .hiw-step-num { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 50%; background: var(--accent); color: var(--accent-foreground); font-weight: 800; font-size: 17px; box-shadow: 0 6px 18px rgb(var(--accent-rgb) / 0.32); }

        .hiw-card { flex: 1; display: flex; gap: 16px; align-items: flex-start; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 20px 22px; transition: box-shadow .2s ease, transform .2s ease, border-color .2s ease; }
        .hiw-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); border-color: var(--accent-mid); }
        .hiw-step-emoji { font-size: 30px; line-height: 1; flex-shrink: 0; }
        .hiw-step-copy { min-width: 0; }
        .hiw-step-kicker { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.07em; color: var(--accent); }
        .hiw-step-title { font-size: 19px; color: var(--text); margin: 4px 0 6px; letter-spacing: -0.01em; }
        .hiw-step-desc { font-size: 14.5px; line-height: 1.6; color: var(--text-secondary); margin: 0; }

        /* ── Payments callout ── */
        .hiw-note { margin-top: clamp(36px, 6vw, 56px); }
        .hiw-note-inner { display: flex; gap: 18px; align-items: flex-start; background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--r-2xl); padding: 28px 30px; }
        .hiw-note-icon { font-size: 26px; line-height: 1; flex-shrink: 0; margin-top: 2px; }
        .hiw-note-title { font-size: 20px; font-weight: 700; color: var(--text); margin: 0 0 8px; }
        .hiw-note-body { font-size: 14.5px; color: var(--text-secondary); line-height: 1.7; margin: 0; }

        /* ── CTA ── */
        .hiw-cta { margin-top: clamp(36px, 6vw, 56px); }
        .hiw-cta-inner { text-align: center; background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.16), rgb(var(--accent-rgb) / 0.06)); border: 1px solid var(--accent-mid); border-radius: var(--r-2xl); padding: clamp(36px, 6vw, 56px) 24px; }
        .hiw-cta-title { font-size: clamp(24px, 3.4vw, 34px); color: var(--text); letter-spacing: -0.02em; margin: 0 0 8px; }
        .hiw-cta-sub { font-size: 15px; color: var(--text-secondary); margin: 0 0 24px; }
        .hiw-cta-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .hiw-cta-main { gap: 8px; }

        @media (max-width: 560px) {
          .hiw-card { flex-direction: column; gap: 10px; padding: 18px; }
          .hiw-cta-btns { flex-direction: column; align-items: stretch; }
          .hiw-cta-btns .btn { width: 100%; justify-content: center; }
          .hiw-note-inner { padding: 22px; }
        }
      `}</style>
    </>
  );
}
