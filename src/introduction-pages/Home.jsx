import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { LEGACY_MODE } from '@/lib/config';

// ── PLACEHOLDER testimonial data — swap for real/fake account data ──────────
// name, handle, avatar (emoji or image url), quote, and what they sell.
const TESTIMONIALS = [
  { name: 'Maya Rivera', handle: '@mayamakes', avatar: '🎨', role: 'Design templates', quote: "I've done the Gumroad thing and the Linktree-plus-Stripe duct tape thing. This is the first page that didn't look like everyone else's. Made my first sale before I'd even finished the bio." },
  { name: 'Dre Coleman', handle: '@drebeats', avatar: '🎧', role: 'Sample packs & mixing', quote: "the customization is kind of the whole point for me. video bg, tracks previewing, my colors. guys keep dm'ing asking what site i'm on lol" },
  { name: 'Priya Nair', handle: '@priyacoaches', avatar: '💬', role: '1:1 coaching', quote: 'I was paying for Calendly, a course host, AND a separate checkout. Cancelled all three. Now people book and pay in the same two taps and nobody emails me confused anymore.' },
  { name: 'Leo Franklin', handle: '@leobuilds', avatar: '⚡', role: 'Notion systems', quote: 'Apple Pay checkout on mobile is stupid fast — my phone conversion basically doubled the week I moved over. Slightly annoyed I waited this long tbh.' },
  { name: 'Sana Malik', handle: '@sanawrites', avatar: '✍️', role: 'Courses & guides', quote: "not gonna lie, the email capture is what sold me. grew my list ~600 in a month off one free guide. and delivery is instant so no more me sending pdfs by hand at midnight" },
  { name: 'Theo Grant', handle: '@theographs', avatar: '📸', role: 'Presets & LUTs', quote: "Stan costs like $29 for a bunch of features that I don't even use, Skilljoy is only $19 per month and comes with all of the essential features, plus professional customization so that I can tailor my store exactly to my needs. " },
];

// Hallucinated social-proof numbers for the landing page.
const STATS = [
  { value: '5,000+', label: 'creators building' },
  { value: '$1.2M+', label: 'paid out to creators' },
  { value: '4.9/5', label: 'average rating' },
];

const STEPS = [
  { n: '1', title: 'Build your page', body: 'Add your products, links and socials. Make it look like nothing else — free, no card needed.' },
  { n: '2', title: 'Share one link', body: 'Drop skilljoy.me/@you in your bio. One link, your whole store — made for the phone.' },
  { n: '3', title: 'Get paid', body: 'Buyers check out with Apple / Google Pay and get instant access. Payouts by Stripe.' },
];

const SELL = [
  { icon: '🎓', title: 'Courses', body: 'Lessons, modules, videos and files — with progress tracking baked in.' },
  { icon: '📅', title: 'Coaching & bookings', body: '1:1 calls and sessions with real availability and scheduling.' },
  { icon: '🔁', title: 'Memberships', body: 'Recurring access to a community, a drop feed, or ongoing content.' },
  { icon: '📦', title: 'Digital products', body: 'Templates, presets, prompts, guides — instant, secure delivery.' },
  { icon: '🔗', title: 'Links & lead magnets', body: 'Free offers that grow your email list, and links to anywhere.' },
  { icon: '📈', title: 'Analytics', body: 'Views, conversion and daily trends — see what actually sells.' },
];

const CUSTOM = [
  { icon: '🌌', title: 'Backgrounds & video' },
  { icon: '✨', title: 'Glow & effects' },
  { icon: '🌧️', title: 'Rain · snow · VHS' },
  { icon: '🎵', title: 'Site audio' },
  { icon: '🖱️', title: 'Cursor trails' },
  { icon: '🌗', title: 'Light & dark' },
];

const Arrow = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Stars = () => <span className="lp-stars" aria-label="5 out of 5">★★★★★</span>;

export default function LandingPage() {
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate(LEGACY_MODE ? '/matches' : '/build');
  }, [user, navigate]);

  // Scroll-reveal: fade/slide elements in as they enter the viewport (the
  // "parallax-ish" scroll feel). IntersectionObserver → no scroll-jank.
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

      <main className="lp">
        {/* ── 1. Intro / hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-copy reveal">
            <span className="sj-pill"><span className="sj-dot" />Courses · coaching · memberships · downloads</span>
            <h1 className="lp-title">The Ultimate<br />Link-In-Bio Store<br /><span className="accent-text">for Creators.</span></h1>
            <p className="lp-sub">Sell courses, coaching, memberships and digital products from one page — and make it look like nothing else out there.</p>
            <div className="lp-cta">
              <Link to="/login" className="btn btn-primary lp-cta-main">Start free <Arrow /></Link>
              <Link to="/how-it-works" className="btn btn-secondary">How it works</Link>
            </div>
            <p className="lp-note">Free to build · 14-day trial when you publish · cancel anytime</p>
          </div>

          <div className="lp-phone-wrap reveal reveal-d2" aria-hidden="true">
            <div className="lp-phone sj-float">
              <div className="lp-phone-notch" />
              <div className="lp-store">
                <div className="lp-store-avatar">🌙</div>
                <p className="lp-store-name">Nova Reyes</p>
                <p className="lp-store-handle">@novacreates</p>
                <p className="lp-store-bio">Sound design, sample packs & 1:1 mixing sessions.</p>
                <div className="lp-store-socials"><span>◎</span><span>▶</span><span>𝕏</span></div>
                <div className="lp-store-list">
                  <div className="lp-store-card"><div className="lp-store-thumb">🎹</div><div className="lp-store-meta"><span className="lp-store-title">Analog Sample Pack</span><span className="lp-store-price">$24</span></div></div>
                  <div className="lp-store-card"><div className="lp-store-thumb">🎚️</div><div className="lp-store-meta"><span className="lp-store-title">Mixing Masterclass</span><span className="lp-store-price">$59</span></div></div>
                  <div className="lp-store-card"><div className="lp-store-thumb">🎧</div><div className="lp-store-meta"><span className="lp-store-title">1:1 Mix Review</span><span className="lp-store-price">$90</span></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Testimonials ── */}
        <section className="lp-section">
          <div className="lp-head reveal">
            <span className="sj-pill"><span className="sj-dot" />Loved by creators</span>
            <h2 className="lp-h2">Over 5,000 people are building on SkillJoy</h2>
            <div className="lp-stats">
              {STATS.map(s => (
                <div key={s.label} className="lp-stat">
                  <span className="lp-stat-value">{s.value}</span>
                  <span className="lp-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-tgrid">
            {TESTIMONIALS.map((t, i) => (
              <figure key={t.handle} className={`lp-tcard reveal reveal-d${(i % 3) + 1}`}>
                <Stars />
                <blockquote className="lp-tquote">“{t.quote}”</blockquote>
                <figcaption className="lp-tby">
                  <span className="lp-tav">{t.avatar}</span>
                  <span className="lp-tinfo">
                    <span className="lp-tname">{t.name}</span>
                    <span className="lp-thandle">{t.handle} · {t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ── 3. How it works ── */}
        <section className="lp-section lp-section-alt">
          <div className="lp-head reveal">
            <span className="sj-pill"><span className="sj-dot" />How it works</span>
            <h2 className="lp-h2">Launch in three steps</h2>
          </div>
          <div className="lp-steps">
            {STEPS.map((s, i) => (
              <div key={s.n} className={`lp-step reveal reveal-d${i + 1}`}>
                <span className="lp-step-num">{s.n}</span>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4a. What it has — sell anything ── */}
        <section className="lp-section">
          <div className="lp-head reveal">
            <span className="sj-pill"><span className="sj-dot" />One page, everything you sell</span>
            <h2 className="lp-h2">Everything you need, in one link</h2>
          </div>
          <div className="lp-grid">
            {SELL.map((f, i) => (
              <div key={f.title} className={`lp-card reveal reveal-d${(i % 3) + 1}`}>
                <div className="lp-card-icon">{f.icon}</div>
                <h3 className="lp-card-title">{f.title}</h3>
                <p className="lp-card-body">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4b. What it has — customization (the differentiator) ── */}
        <section className="lp-custom">
          <div className="lp-custom-inner reveal">
            <span className="sj-pill sj-pill-dark"><span className="sj-dot" />Make it unmistakably yours</span>
            <h2 className="lp-h2 lp-h2-light">A store that looks like <span className="accent-text">you</span> — not a template.</h2>
            <p className="lp-custom-sub">Video backgrounds, glow, overlays, audio, cursor effects, light &amp; dark. The deep customization other stores won’t give you.</p>
            <div className="lp-chips">
              {CUSTOM.map((c) => <span key={c.title} className="lp-chip">{c.icon} {c.title}</span>)}
            </div>
          </div>
        </section>

        {/* ── 5. Try free 14 days → start ── */}
        <section className="lp-section">
          <div className="lp-head reveal">
            <span className="sj-pill"><span className="sj-dot" />Simple pricing</span>
            <h2 className="lp-h2">Try free for 14 days</h2>
          </div>
          <div className="lp-price reveal">
            <div className="lp-price-card">
              <p className="lp-price-name">SkillJoy</p>
              <p className="lp-price-amt"><span className="lp-price-big">$19</span><span className="lp-price-per">/month</span></p>
              <p className="lp-price-trial">Build &amp; customize free. When you publish, your 14-day trial starts — add a card, charged only when it ends.</p>
              <ul className="lp-price-list">
                <li>Sell courses, coaching, memberships &amp; downloads</li>
                <li>Apple / Google Pay checkout + instant delivery</li>
                <li>Deep customization — backgrounds, glow, effects</li>
                <li>Email capture, analytics &amp; transparent Stripe payouts</li>
                <li>Keep 95% of every sale · cancel anytime</li>
              </ul>
              <Link to="/login" className="btn btn-primary lp-price-btn">Start your free trial <Arrow /></Link>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="lp-cta-block">
          <div className="lp-cta-inner reveal">
            <h2 className="lp-cta-title">Your store is one link away.</h2>
            <p className="lp-cta-sub">Turn what you know into income — no website, no code, and a page that looks like nothing else.</p>
            <Link to="/login" className="btn lp-cta-btn">Start free <Arrow /></Link>
          </div>
        </section>
      </main>

      <style>{`
        .lp { background: var(--bg); overflow-x: hidden; }
        .lp-section, .lp-hero { max-width: 1080px; margin: 0 auto; }
        .accent-text { color: var(--accent); }

        /* ── Scroll reveal ── */
        .reveal { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.3,1); }
        .reveal.in { opacity: 1; transform: none; }
        .reveal-d1 { transition-delay: .07s; }
        .reveal-d2 { transition-delay: .14s; }
        .reveal-d3 { transition-delay: .21s; }
        @media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }

        /* ── Hero ── */
        .lp-hero { display: grid; grid-template-columns: 1.05fr 0.95fr; align-items: center; gap: 56px; padding: clamp(52px, 9vw, 100px) 24px clamp(40px, 6vw, 72px); position: relative; }
        .lp-hero::before { content: ''; position: absolute; top: -10%; left: 30%; width: 60%; height: 70%; background: radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.14), transparent); pointer-events: none; z-index: 0; }
        .lp-hero-copy, .lp-phone-wrap { position: relative; z-index: 1; }
        .lp-title { font-size: clamp(33px, 4.6vw, 54px); line-height: 1.06; letter-spacing: -0.03em; color: var(--text); margin: 22px 0 20px; text-wrap: balance; }
        .lp-sub { font-size: clamp(16px, 1.5vw, 19px); line-height: 1.6; color: var(--text-secondary); max-width: 490px; margin-bottom: 30px; }
        .lp-cta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .lp-cta-main { gap: 8px; }
        .lp-note { margin-top: 16px; font-size: 13px; color: var(--text-muted); }

        /* ── Phone mockup ── */
        .lp-phone-wrap { display: flex; justify-content: center; }
        .lp-phone { position: relative; width: 306px; background: #0e0f12; border-radius: 48px; padding: 12px; box-shadow: var(--shadow-xl), 0 0 60px rgb(var(--accent-rgb) / 0.28); }
        .lp-phone-notch { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); width: 104px; height: 20px; background: #0e0f12; border-radius: var(--r-full); z-index: 2; }
        .lp-store { background: linear-gradient(180deg, #17181d, #101116); border-radius: 38px; padding: 40px 18px 26px; text-align: center; }
        .lp-store-avatar { width: 62px; height: 62px; margin: 4px auto 12px; border-radius: 50%; background: rgb(var(--accent-rgb) / 0.18); display: flex; align-items: center; justify-content: center; font-size: 28px; border: 2px solid rgb(var(--accent-rgb) / 0.5); box-shadow: 0 0 22px rgb(var(--accent-rgb) / 0.45); }
        .lp-store-name { font-weight: 800; font-size: 18px; color: #f2f0ea; text-shadow: 0 0 14px rgb(var(--accent-rgb) / 0.5); }
        .lp-store-handle { font-size: 13px; color: var(--accent-bright); margin-top: 1px; font-weight: 600; }
        .lp-store-bio { font-size: 12.5px; color: #b6b3ab; margin: 8px 6px 12px; line-height: 1.45; }
        .lp-store-socials { display: flex; justify-content: center; gap: 16px; margin-bottom: 16px; color: var(--accent-bright); font-size: 15px; }
        .lp-store-socials span { filter: drop-shadow(0 0 6px rgb(var(--accent-rgb) / 0.6)); }
        .lp-store-list { display: flex; flex-direction: column; gap: 10px; }
        .lp-store-card { display: flex; align-items: center; gap: 11px; padding: 10px; background: rgb(255 255 255 / 0.04); border: 1px solid rgb(255 255 255 / 0.08); border-radius: var(--r); box-shadow: 0 0 16px rgb(var(--accent-rgb) / 0.12); text-align: left; }
        .lp-store-thumb { width: 42px; height: 42px; flex-shrink: 0; border-radius: var(--r-sm); background: rgb(var(--accent-rgb) / 0.16); display: flex; align-items: center; justify-content: center; font-size: 20px; }
        .lp-store-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .lp-store-title { font-size: 13px; font-weight: 600; color: #f2f0ea; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lp-store-price { font-size: 13px; font-weight: 800; color: var(--accent-bright); }

        /* ── Sections ── */
        .lp-section { padding: clamp(52px, 8vw, 92px) 24px; }
        .lp-section-alt { max-width: none; background: var(--surface); }
        .lp-section-alt > .lp-head, .lp-section-alt > .lp-steps { max-width: 1080px; margin-left: auto; margin-right: auto; }
        .lp-head { text-align: center; margin-bottom: 44px; }
        .lp-h2 { font-size: clamp(28px, 3.6vw, 42px); color: var(--text); margin-top: 16px; letter-spacing: -0.025em; }

        /* ── Social-proof stats strip ── */
        .lp-stats { display: flex; justify-content: center; flex-wrap: wrap; gap: clamp(24px, 6vw, 64px); margin-top: 28px; }
        .lp-stat { display: flex; flex-direction: column; align-items: center; }
        .lp-stat-value { font-family: var(--font-display); font-size: clamp(26px, 3.4vw, 38px); font-weight: 800; letter-spacing: -0.02em; color: var(--accent); line-height: 1; }
        .lp-stat-label { font-size: 13px; color: var(--text-secondary); margin-top: 8px; }

        /* ── Testimonials ── */
        .lp-tgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lp-tcard { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 26px; display: flex; flex-direction: column; }
        .lp-stars { color: #f5a623; font-size: 15px; letter-spacing: 2px; }
        .lp-tquote { font-size: 15px; line-height: 1.6; color: var(--text); margin: 12px 0 18px; flex: 1; }
        .lp-tby { display: flex; align-items: center; gap: 11px; }
        .lp-tav { width: 40px; height: 40px; flex-shrink: 0; border-radius: 50%; background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-size: 19px; }
        .lp-tinfo { display: flex; flex-direction: column; min-width: 0; }
        .lp-tname { font-weight: 700; font-size: 14px; color: var(--text); }
        .lp-thandle { font-size: 12px; color: var(--text-muted); }

        /* ── Steps ── */
        .lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .lp-step { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 30px; }
        .lp-step-num { display: flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 50%; background: var(--accent); color: var(--accent-foreground); font-weight: 700; font-size: 17px; margin-bottom: 18px; }
        .lp-step-title { font-size: 19px; color: var(--text); margin-bottom: 8px; }
        .lp-step-body { font-size: 14.5px; line-height: 1.6; color: var(--text-secondary); }

        /* ── Sell grid ── */
        .lp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .lp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 26px; transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease, opacity .7s ease; }
        .lp-card.in:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); border-color: var(--accent-mid); }
        .lp-card-icon { width: 50px; height: 50px; border-radius: var(--r); margin-bottom: 15px; background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-size: 24px; }
        .lp-card-title { font-size: 18px; color: var(--text); margin-bottom: 7px; }
        .lp-card-body { font-size: 14px; line-height: 1.55; color: var(--text-secondary); }

        /* ── Customization (dark band) ── */
        .lp-custom { background: #0e0f12; padding: clamp(56px, 8vw, 100px) 24px; text-align: center; position: relative; overflow: hidden; }
        .lp-custom::before { content: ''; position: absolute; inset: 0; background: radial-gradient(60% 60% at 50% 0%, rgb(var(--accent-rgb) / 0.22), transparent); pointer-events: none; }
        .lp-custom-inner { max-width: 820px; margin: 0 auto; position: relative; }
        .lp-h2-light { color: #f4f2ec; }
        .lp-custom-sub { font-size: 16px; color: #b6b3ab; line-height: 1.6; max-width: 560px; margin: 16px auto 26px; }
        .sj-pill-dark { background: rgb(255 255 255 / 0.06); color: #d8d5cd; border-color: rgb(255 255 255 / 0.12); }
        .lp-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
        .lp-chip { display: inline-flex; align-items: center; gap: 7px; padding: 9px 15px; border-radius: var(--r-full); font-size: 13.5px; font-weight: 600; color: #f2f0ea; background: rgb(255 255 255 / 0.05); border: 1px solid rgb(var(--accent-rgb) / 0.32); box-shadow: 0 0 18px rgb(var(--accent-rgb) / 0.14); }

        /* ── Pricing ── */
        .lp-price { display: flex; justify-content: center; }
        .lp-price-card { width: 100%; max-width: 460px; background: var(--surface); border: 1.5px solid var(--accent-mid); border-radius: var(--r-2xl); padding: 34px; box-shadow: 0 12px 40px rgb(var(--accent-rgb) / 0.14); }
        .lp-price-name { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
        .lp-price-amt { margin: 8px 0 4px; }
        .lp-price-big { font-size: 52px; font-weight: 800; color: var(--text); letter-spacing: -0.03em; }
        .lp-price-per { font-size: 17px; color: var(--text-muted); font-weight: 600; }
        .lp-price-trial { font-size: 13.5px; color: var(--text-secondary); margin-bottom: 18px; line-height: 1.5; }
        .lp-price-list { list-style: none; display: flex; flex-direction: column; gap: 10px; margin: 0 0 24px; }
        .lp-price-list li { position: relative; padding-left: 26px; font-size: 14.5px; color: var(--text); line-height: 1.45; }
        .lp-price-list li::before { content: '✓'; position: absolute; left: 0; top: 0; color: var(--accent); font-weight: 800; }
        .lp-price-btn { width: 100%; justify-content: center; gap: 8px; }

        /* ── Final CTA ── */
        .lp-cta-block { padding: 0 24px clamp(56px, 8vw, 96px); }
        .lp-cta-inner { position: relative; max-width: 1080px; margin: 0 auto; text-align: center; background: linear-gradient(135deg, rgb(var(--accent-rgb) / 0.55), rgb(var(--accent-rgb) / 0.28)); color: var(--accent-foreground); border-radius: var(--r-2xl); padding: clamp(48px, 7vw, 84px) 24px; border: 1px solid rgb(255 255 255 / 0.18); box-shadow: 0 20px 50px rgb(var(--accent-rgb) / 0.28), inset 0 1px 0 rgb(255 255 255 / 0.25); backdrop-filter: blur(16px) saturate(160%); -webkit-backdrop-filter: blur(16px) saturate(160%); }
        .lp-cta-title { font-size: clamp(28px, 4vw, 46px); color: #fff; letter-spacing: -0.025em; }
        .lp-cta-sub { font-size: 16px; color: rgb(255 255 255 / 0.9); max-width: 480px; margin: 14px auto 28px; line-height: 1.55; }
        .lp-cta-btn { background: #fff; color: var(--accent); padding: 14px 30px; font-size: 15px; gap: 8px; box-shadow: var(--shadow); }
        .lp-cta-btn:hover { background: #fff; transform: translateY(-1px); box-shadow: var(--shadow-lg); text-decoration: none; color: var(--accent); }

        /* ── Responsive ── */
        @media (max-width: 880px) {
          .lp-hero { grid-template-columns: 1fr; gap: 40px; text-align: center; padding-top: clamp(40px, 8vw, 72px); }
          .lp-hero-copy { display: flex; flex-direction: column; align-items: center; }
          .lp-tgrid, .lp-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .lp-hero, .lp-section, .lp-cta-block { padding-left: 16px; padding-right: 16px; }
          .lp-cta { flex-direction: column; align-items: stretch; width: 100%; }
          .lp-cta .btn { width: 100%; justify-content: center; }
          .lp-tgrid, .lp-grid, .lp-steps { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
