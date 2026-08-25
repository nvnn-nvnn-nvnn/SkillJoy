import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { LEGACY_MODE } from '@/lib/config';

// ── Landing redesign — restrained/editorial take. Route-swappable with Home.jsx
// (main.jsx: point the LandingPage import here). Classes are prefixed `lx-` so
// the two pages can coexist without style collisions during the swap.

const STEPS = [
  { n: '01', title: 'Build your page', body: 'Add your products, links and socials. Free to build — no card, no code.' },
  { n: '02', title: 'Share one link', body: 'Drop skilljoy.me/@you in your bio. One link, your whole store, made for the phone.' },
  { n: '03', title: 'Get paid', body: 'Buyers check out with Apple or Google Pay. Instant delivery, payouts by Stripe.' },
];

// Trust strip = verifiable product truths only — no invented user counts or earnings.
const PROOF = [
  { k: 'Payments', v: 'Powered by Stripe' },
  { k: 'Checkout', v: 'Apple & Google Pay' },
  { k: 'Delivery', v: 'Instant & secure' },
  { k: 'Your cut', v: 'Keep 95% of every sale' },
];

const SELL = [
  { title: 'Courses', body: 'Lessons, modules and files with progress tracking built in.' },
  { title: 'Coaching & bookings', body: '1:1 sessions with real availability and scheduling.' },
  { title: 'Memberships', body: 'Recurring access to a community or ongoing content.' },
  { title: 'Digital products', body: 'Templates, presets, guides — delivered instantly and securely.' },
  { title: 'Links & lead magnets', body: 'Free offers that grow your list, plus links to anywhere.' },
  { title: 'Analytics', body: 'Views, conversion and daily trends — see what actually sells.' },
];

const CUSTOM = [
  'Video backgrounds', 'Glow & effects', 'Rain · snow · VHS', 'Site audio',
  '3D tilt', 'Cursor trails', 'One-tap themes', 'Light & dark',
];

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LandingPage() {
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate(LEGACY_MODE ? '/matches' : '/build');
  }, [user, navigate]);

  // Reveal-on-scroll (same pattern as the rest of the marketing pages).
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
      <title>SkillJoy — The Ultimate Link-In-Bio Store for Creators</title>

      <main className="lx">
        {/* ── Hero ── */}
        <section className="lx-hero">
          <div className="lx-hero-copy reveal">
            <span className="sj-pill"><span className="sj-dot" />The customizable link-in-bio store</span>
            <h1 className="lx-title">The Ultimate Link-In-Bio<br />Store for Creators.</h1>
            <p className="lx-sub">
              Sell courses, coaching, memberships and digital products from one page —
              and make it look like yours, not a template.
            </p>
            <div className="lx-cta">
              <Link to="/login" className="btn btn-primary lx-cta-main">Start free <Arrow /></Link>
              <Link to="/how-it-works" className="btn btn-secondary">How it works</Link>
            </div>
            <p className="lx-note">Free to build · 14-day trial when you publish · cancel anytime</p>
          </div>

          {/* The one expressive object on the page: the product itself. */}
          <div className="lx-phone-wrap reveal reveal-d2" aria-hidden="true">
            <div className="lx-phone">
              <div className="lx-phone-notch" />
              <div className="lx-store">
                <div className="lx-store-avatar">🌙</div>
                <p className="lx-store-name">Nova Reyes</p>
                <p className="lx-store-handle">@novacreates</p>
                <p className="lx-store-bio">Sound design, sample packs &amp; 1:1 mixing sessions.</p>
                <div className="lx-store-list">
                  <div className="lx-store-card"><span className="lx-store-thumb">🎹</span><span className="lx-store-title">Analog Sample Pack</span><span className="lx-store-price">$24</span></div>
                  <div className="lx-store-card"><span className="lx-store-thumb">🎚️</span><span className="lx-store-title">Mixing Masterclass</span><span className="lx-store-price">$59</span></div>
                  <div className="lx-store-card"><span className="lx-store-thumb">🎧</span><span className="lx-store-title">1:1 Mix Review</span><span className="lx-store-price">$90</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust strip — product truths, not testimonials ── */}
        <section className="lx-proof reveal" aria-label="Why creators trust SkillJoy">
          {PROOF.map(p => (
            <div key={p.k} className="lx-proof-cell">
              <span className="lx-proof-k">{p.k}</span>
              <span className="lx-proof-v">{p.v}</span>
            </div>
          ))}
        </section>

        {/* ── How it works ── */}
        <section className="lx-section">
          <div className="lx-head reveal">
            <span className="lx-kicker">How it works</span>
            <h2 className="lx-h2">Live in an afternoon.</h2>
          </div>
          <div className="lx-steps">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`lx-step reveal reveal-d${i + 1}`}>
                <span className="lx-step-n">{s.n}</span>
                <h3 className="lx-step-title">{s.title}</h3>
                <p className="lx-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Sell anything ── */}
        <section className="lx-section">
          <div className="lx-head reveal">
            <span className="lx-kicker">One page, everything you sell</span>
            <h2 className="lx-h2">Everything you need, in one link.</h2>
          </div>
          <div className="lx-grid reveal">
            {SELL.map(f => (
              <div key={f.title} className="lx-cell">
                <h3 className="lx-cell-title">{f.title}</h3>
                <p className="lx-body">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Customization — the differentiator, one inverted band ── */}
        <section className="lx-custom">
          <div className="lx-custom-inner reveal">
            <span className="lx-kicker lx-kicker-inv">Make it yours</span>
            <h2 className="lx-h2">A store that looks like you.<br />Not a template.</h2>
            <p className="lx-custom-sub">
              Video backgrounds, glow, overlays, audio, 3D tilt, one-tap themes —
              the deep customization other stores won&rsquo;t give you.
            </p>
            <ul className="lx-chips">
              {CUSTOM.map(c => <li key={c} className="lx-chip">{c}</li>)}
            </ul>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="lx-section">
          <div className="lx-head reveal">
            <span className="lx-kicker">Pricing</span>
            <h2 className="lx-h2">One plan. Try it free for 14 days.</h2>
          </div>
          <div className="lx-price reveal">
            <div className="lx-price-card">
              <p className="lx-price-amt"><span className="lx-price-big">$19</span><span className="lx-price-per">/month</span></p>
              <p className="lx-price-trial">
                Build and customize free. Publishing starts your 14-day trial —
                add a card, charged only when it ends.
              </p>
              <ul className="lx-price-list">
                <li>Sell courses, coaching, memberships &amp; downloads</li>
                <li>Apple / Google Pay checkout with instant delivery</li>
                <li>Deep customization — backgrounds, effects, themes</li>
                <li>Email capture, analytics &amp; transparent Stripe payouts</li>
                <li>Keep 95% of every sale · cancel anytime</li>
              </ul>
              <Link to="/login" className="btn btn-primary lx-price-btn">Start free <Arrow /></Link>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="lx-final">
          <div className="lx-final-inner reveal">
            <h2 className="lx-h2">Your store is one link away.</h2>
            <p className="lx-body lx-final-sub">No website, no code — turn what you know into income.</p>
            <Link to="/login" className="btn btn-primary lx-cta-main">Start free <Arrow /></Link>
          </div>
        </section>
      </main>

      <style>{`
        .lx { background: var(--bg); overflow-x: hidden; }
        .lx-section, .lx-hero, .lx-proof { max-width: 1080px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }

        /* ── Reveal (shared pattern) ── */
        .reveal { opacity: 0; transform: translateY(22px); transition: opacity .6s ease, transform .6s cubic-bezier(.2,.7,.3,1); }
        .reveal.in { opacity: 1; transform: none; }
        .reveal-d1 { transition-delay: .06s; }
        .reveal-d2 { transition-delay: .12s; }
        .reveal-d3 { transition-delay: .18s; }
        @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }

        /* ── Type system ── */
        .lx-kicker { display: block; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--text-muted); }
        .lx-h2 { font-family: var(--font-display); font-size: clamp(28px, 3.6vw, 42px); line-height: 1.12; letter-spacing: -0.025em; color: var(--text); margin-top: 14px; }
        .lx-body { font-size: 15px; line-height: 1.6; color: var(--text-secondary); }

        /* ── Hero ── */
        .lx-hero { display: grid; grid-template-columns: 1.05fr 0.95fr; align-items: center; gap: 56px; padding-top: clamp(56px, 9vw, 104px); padding-bottom: clamp(40px, 6vw, 72px); }
        .lx-title { font-family: var(--font-display); font-size: clamp(40px, 5.6vw, 68px); line-height: 1.04; letter-spacing: -0.03em; color: var(--text); margin: 22px 0 18px; }
        .lx-sub { font-size: clamp(16px, 1.5vw, 18px); line-height: 1.6; color: var(--text-secondary); max-width: 470px; margin-bottom: 30px; }
        .lx-cta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .lx-cta-main { gap: 8px; }
        .lx-note { margin-top: 16px; font-size: 13px; color: var(--text-muted); }

        /* ── Phone mockup — the justified expressive exception ── */
        .lx-phone-wrap { display: flex; justify-content: center; }
        .lx-phone { position: relative; width: 300px; background: #0e0f12; border-radius: 44px; padding: 12px;
          box-shadow: var(--shadow-xl), 0 0 48px rgb(var(--accent-rgb) / 0.18); }
        .lx-phone-notch { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); width: 100px; height: 18px; background: #0e0f12; border-radius: var(--r-full); z-index: 2; }
        .lx-store { background: #14151a; border-radius: 34px; padding: 40px 18px 24px; text-align: center; }
        .lx-store-avatar { width: 60px; height: 60px; margin: 2px auto 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px;
          background: rgb(var(--accent-rgb) / 0.16); border: 2px solid rgb(var(--accent-rgb) / 0.5); }
        .lx-store-name { font-family: var(--font-display); font-weight: 800; font-size: 17px; color: #f2f0ea; }
        .lx-store-handle { font-size: 13px; font-weight: 600; color: var(--accent-bright); margin-top: 1px; }
        .lx-store-bio { font-size: 12.5px; color: #b6b3ab; margin: 8px 4px 14px; line-height: 1.45; }
        .lx-store-list { display: flex; flex-direction: column; gap: 9px; }
        .lx-store-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; text-align: left;
          background: rgb(255 255 255 / 0.045); border: 1px solid rgb(255 255 255 / 0.08); border-radius: var(--r); }
        .lx-store-thumb { width: 38px; height: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px;
          background: rgb(var(--accent-rgb) / 0.14); border-radius: var(--r-sm); }
        .lx-store-title { flex: 1; min-width: 0; font-size: 12.5px; font-weight: 600; color: #f2f0ea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lx-store-price { font-size: 12.5px; font-weight: 800; color: var(--accent-bright); }

        /* ── Trust strip ── */
        .lx-proof { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px;
          border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding-top: 22px; padding-bottom: 22px; }
        .lx-proof-cell { display: flex; flex-direction: column; gap: 3px; }
        .lx-proof-k { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); }
        .lx-proof-v { font-size: 14.5px; font-weight: 700; color: var(--text); }

        /* ── Sections ── */
        .lx-section { padding-top: clamp(56px, 8vw, 96px); padding-bottom: clamp(20px, 3vw, 32px); }
        .lx-head { margin-bottom: 40px; }

        /* ── Steps — editorial top-rule columns ── */
        .lx-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .lx-step { border-top: 2px solid var(--border-strong); padding-top: 18px; }
        .lx-step-n { font-family: var(--font-display); font-size: 14px; font-weight: 800; color: var(--accent); letter-spacing: .04em; }
        .lx-step-title { font-family: var(--font-display); font-size: 19px; color: var(--text); margin: 8px 0 6px; letter-spacing: -0.01em; }

        /* ── Sell grid — hairline cells, type only ── */
        .lx-grid { display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid var(--border); border-left: 1px solid var(--border); }
        .lx-cell { padding: 24px 22px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
        .lx-cell-title { font-family: var(--font-display); font-size: 16.5px; color: var(--text); margin-bottom: 6px; letter-spacing: -0.01em; }

        /* ── Customization — inverted band (token-pure: works in both themes) ── */
        .lx-custom { background: var(--text); color: var(--bg); margin-top: clamp(56px, 8vw, 96px); padding: clamp(56px, 8vw, 96px) 24px; }
        .lx-custom-inner { max-width: 1080px; margin: 0 auto; }
        .lx-custom .lx-h2 { color: var(--bg); }
        .lx-kicker-inv { color: color-mix(in srgb, var(--bg) 55%, transparent); }
        .lx-custom-sub { font-size: 16px; line-height: 1.6; color: color-mix(in srgb, var(--bg) 74%, transparent); max-width: 520px; margin: 16px 0 28px; }
        .lx-chips { list-style: none; display: flex; flex-wrap: wrap; gap: 10px; padding: 0; margin: 0; }
        .lx-chip { padding: 9px 15px; border-radius: var(--r-full); font-size: 13.5px; font-weight: 600; color: var(--bg);
          border: 1px solid color-mix(in srgb, var(--bg) 26%, transparent); }

        /* ── Pricing ── */
        .lx-price { display: flex; }
        .lx-price-card { width: 100%; max-width: 440px; background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: var(--r-2xl); padding: 32px; box-shadow: var(--shadow); }
        .lx-price-amt { margin-bottom: 6px; }
        .lx-price-big { font-family: var(--font-display); font-size: 48px; font-weight: 800; color: var(--text); letter-spacing: -0.03em; }
        .lx-price-per { font-size: 16px; color: var(--text-muted); font-weight: 600; }
        .lx-price-trial { font-size: 13.5px; color: var(--text-secondary); line-height: 1.55; margin-bottom: 20px; }
        .lx-price-list { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 0 0 24px; padding: 0; }
        .lx-price-list li { position: relative; padding-left: 24px; font-size: 14.5px; color: var(--text); line-height: 1.45; }
        .lx-price-list li::before { content: '✓'; position: absolute; left: 0; top: 0; color: var(--accent); font-weight: 800; }
        .lx-price-btn { width: 100%; justify-content: center; gap: 8px; }

        /* ── Final CTA ── */
        .lx-final { border-top: 1px solid var(--border); margin-top: clamp(56px, 8vw, 96px); }
        .lx-final-inner { max-width: 1080px; margin: 0 auto; padding: clamp(56px, 8vw, 96px) 24px; text-align: center; }
        .lx-final .lx-h2 { margin-top: 0; }
        .lx-final-sub { max-width: 420px; margin: 12px auto 26px; }

        /* ── Responsive ── */
        @media (max-width: 880px) {
          .lx-hero { grid-template-columns: 1fr; gap: 40px; text-align: center; }
          .lx-hero-copy { display: flex; flex-direction: column; align-items: center; }
          .lx-sub { margin-left: auto; margin-right: auto; }
          .lx-proof { grid-template-columns: 1fr 1fr; }
          .lx-steps { grid-template-columns: 1fr; gap: 22px; }
          .lx-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .lx-hero, .lx-section, .lx-proof { padding-left: 16px; padding-right: 16px; }
          .lx-cta { flex-direction: column; align-items: stretch; width: 100%; }
          .lx-cta .btn { width: 100%; justify-content: center; }
          .lx-grid { grid-template-columns: 1fr; }
          .lx-price-card { max-width: none; }
        }
      `}</style>
    </>
  );
}
