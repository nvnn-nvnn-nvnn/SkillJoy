import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import { LEGACY_MODE } from '@/lib/config';

const STATS = [
  { value: '1 link', label: 'Your whole store' },
  { value: '6-in-1', label: 'Content formats' },
  { value: 'Instant', label: 'Delivery' },
  { value: '$0', label: 'Monthly fees' },
];

const STEPS = [
  { n: '1', title: 'Build a Skill', body: 'Add videos, files, prompts, workflows, guides and coaching. Set your price. Publish.' },
  { n: '2', title: 'Share your link', body: 'Drop skilljoy.me/@you in your bio. One link, your whole storefront — made for the phone.' },
  { n: '3', title: 'Get paid', body: 'Buyers check out on mobile and get instant access. Payouts handled by Stripe.' },
];

const FEATURES = [
  { icon: '🧩', title: 'One Skill, any format', body: 'Bundle videos, files, prompts, workflows, guides and coaching into a single product.' },
  { icon: '🔄', title: 'Update anytime', body: 'Edit a published Skill and every buyer instantly gets the new version.' },
  { icon: '💬', title: 'Built-in community', body: 'Every Skill comes with a private space for you and your buyers — no extra tools.' },
  { icon: '🛡️', title: 'Money you can trust', body: 'Transparent payouts by Stripe. No silent freezes — you always see why.' },
];

const PREVIEW = [
  { emoji: '🎨', title: 'Brand Kit Starter', price: '$29' },
  { emoji: '⚡', title: 'Notion OS Template', price: '$19' },
  { emoji: '🎥', title: '1:1 Coaching Call', price: '$80' },
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

  return (
    <>
      <title>SkillJoy — Sell your skills from one link</title>

      <main className="lp">

        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <span className="sj-pill"><span className="sj-dot" />The link-in-bio store for skills</span>
            <h1 className="lp-title">
              Sell what you know, <span className="accent-text">from one link.</span>
            </h1>
            <p className="lp-sub">
              Package your courses, templates, prompts and coaching into one Skill — and sell it
              straight from your bio. Built for creators, not coders.
            </p>
            <div className="lp-cta">
              <Link to="/login" className="btn btn-primary lp-cta-main">Start your store <Arrow /></Link>
              <Link to="/how-it-works" className="btn btn-secondary">How it works</Link>
            </div>
            <p className="lp-note">Free to start · small fee per sale · no monthly fees</p>
          </div>

          {/* Phone mockup — the real product as the hero visual */}
          <div className="lp-phone-wrap" aria-hidden="true">
            <div className="lp-phone sj-float">
              <div className="lp-phone-notch" />
              <div className="lp-store">
                <div className="lp-store-avatar">🌿</div>
                <p className="lp-store-name">Maya Rivera</p>
                <p className="lp-store-handle">@mayamakes</p>
                <p className="lp-store-bio">Design systems, templates & 1:1 coaching for indie makers.</p>
                <div className="lp-store-list">
                  {PREVIEW.map((p) => (
                    <div key={p.title} className="lp-store-card">
                      <div className="lp-store-thumb">{p.emoji}</div>
                      <div className="lp-store-meta">
                        <span className="lp-store-title">{p.title}</span>
                        <span className="lp-store-price">{p.price}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats strip ── */}
        <section className="lp-stats">
          {STATS.map((s) => (
            <div key={s.label} className="lp-stat">
              <span className="lp-stat-value">{s.value}</span>
              <span className="lp-stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        {/* ── How it works ── */}
        <section className="lp-section">
          <div className="lp-head">
            <span className="sj-pill"><span className="sj-dot" />How it works</span>
            <h2 className="lp-h2">Launch in three steps</h2>
          </div>
          <div className="lp-steps">
            {STEPS.map((s) => (
              <div key={s.n} className="lp-step">
                <span className="lp-step-num">{s.n}</span>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-body">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features ── */}
        <section className="lp-section lp-section-alt">
          <div className="lp-head">
            <span className="sj-pill"><span className="sj-dot" />Why SkillJoy</span>
            <h2 className="lp-h2">Everything in one place</h2>
          </div>
          <div className="lp-features">
            {FEATURES.map((f) => (
              <div key={f.title} className="lp-feature">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3 className="lp-feature-title">{f.title}</h3>
                <p className="lp-feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="lp-cta-block">
          <div className="lp-cta-inner">
            <h2 className="lp-cta-title">Your store is one link away.</h2>
            <p className="lp-cta-sub">Turn what you know into income — no website, no code, no monthly fees.</p>
            <Link to="/login" className="btn lp-cta-btn">Start your store <Arrow /></Link>
          </div>
        </section>
      </main>

      <style>{`
        .lp { background: var(--bg); }
        .lp-section, .lp-hero, .lp-stats { max-width: 1080px; margin: 0 auto; }

        /* ── Hero ── */
        .lp-hero {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          align-items: center;
          gap: 56px;
          padding: clamp(56px, 9vw, 104px) 24px clamp(40px, 6vw, 72px);
        }
        .lp-title {
          font-size: clamp(38px, 5.6vw, 66px);
          line-height: 1.06;
          letter-spacing: -0.03em;
          color: var(--text);
          margin: 22px 0 20px;
        }
        .lp-sub {
          font-size: clamp(16px, 1.5vw, 19px);
          line-height: 1.6;
          color: var(--text-secondary);
          max-width: 480px;
          margin-bottom: 30px;
        }
        .lp-cta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .lp-cta-main { gap: 8px; }
        .lp-note { margin-top: 16px; font-size: 13px; color: var(--text-muted); }

        /* ── Phone mockup ── */
        .lp-phone-wrap { display: flex; justify-content: center; }
        .lp-phone {
          position: relative;
          width: 308px;
          background: #1A1916;
          border-radius: 48px;
          padding: 12px;
          box-shadow: var(--shadow-xl);
        }
        .lp-phone-notch {
          position: absolute; top: 22px; left: 50%; transform: translateX(-50%);
          width: 104px; height: 20px; background: #1A1916; border-radius: var(--r-full); z-index: 2;
        }
        .lp-store {
          background: var(--surface);
          border-radius: 38px;
          padding: 38px 18px 24px;
          text-align: center;
        }
        .lp-store-avatar {
          width: 60px; height: 60px; margin: 6px auto 12px; border-radius: 50%;
          background: var(--accent-light); display: flex; align-items: center; justify-content: center;
          font-size: 28px; border: 1px solid var(--accent-mid);
        }
        .lp-store-name { font-weight: 700; font-size: 17px; color: var(--text); }
        .lp-store-handle { font-size: 13px; color: var(--accent); margin-top: 1px; font-weight: 600; }
        .lp-store-bio { font-size: 12.5px; color: var(--text-secondary); margin: 8px 4px 16px; line-height: 1.45; }
        .lp-store-list { display: flex; flex-direction: column; gap: 10px; }
        .lp-store-card {
          display: flex; align-items: center; gap: 11px; padding: 10px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r); box-shadow: var(--shadow-sm); text-align: left;
        }
        .lp-store-thumb {
          width: 42px; height: 42px; flex-shrink: 0; border-radius: var(--r-sm);
          background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .lp-store-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .lp-store-title { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .lp-store-price { font-size: 13px; font-weight: 700; color: var(--accent); }

        /* ── Stats strip ── */
        .lp-stats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 16px; padding: 0 24px clamp(16px, 4vw, 40px);
        }
        .lp-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 22px 18px; text-align: center;
        }
        .lp-stat-value { display: block; font-size: clamp(22px, 3vw, 30px); font-weight: 700; color: var(--text); letter-spacing: -0.02em; }
        .lp-stat-label { display: block; margin-top: 6px; font-size: 13px; color: var(--text-muted); }

        /* ── Sections ── */
        .lp-section { padding: clamp(56px, 8vw, 96px) 24px; }
        .lp-section-alt { max-width: none; background: var(--surface); }
        .lp-section-alt > .lp-head, .lp-section-alt > .lp-features { max-width: 1080px; margin-left: auto; margin-right: auto; }
        .lp-head { text-align: center; margin-bottom: 48px; }
        .lp-h2 { font-size: clamp(28px, 3.6vw, 42px); color: var(--text); margin-top: 16px; letter-spacing: -0.025em; }

        /* ── Steps ── */
        .lp-steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
        .lp-step { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 30px; }
        .lp-step-num {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; border-radius: 50%;
          background: var(--accent); color: var(--accent-foreground);
          font-weight: 700; font-size: 17px; margin-bottom: 18px;
        }
        .lp-step-title { font-size: 19px; color: var(--text); margin-bottom: 8px; }
        .lp-step-body { font-size: 14.5px; line-height: 1.6; color: var(--text-secondary); }

        /* ── Features ── */
        .lp-features { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        .lp-feature { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r-xl); padding: 28px; transition: box-shadow 0.2s ease, transform 0.2s ease; }
        .lp-feature:hover { box-shadow: var(--shadow-lg); transform: translateY(-2px); }
        .lp-feature-icon {
          width: 50px; height: 50px; border-radius: var(--r); margin-bottom: 16px;
          background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-size: 24px;
        }
        .lp-feature-title { font-size: 18px; color: var(--text); margin-bottom: 8px; }
        .lp-feature-body { font-size: 14.5px; line-height: 1.6; color: var(--text-secondary); }

        /* ── Final CTA ── */
        .lp-cta-block { padding: 0 24px clamp(56px, 8vw, 96px); }
        .lp-cta-inner {
          max-width: 1080px; margin: 0 auto; text-align: center;
          background: var(--accent); color: var(--accent-foreground);
          border-radius: var(--r-2xl); padding: clamp(48px, 7vw, 84px) 24px;
        }
        .lp-cta-title { font-size: clamp(28px, 4vw, 46px); color: #fff; letter-spacing: -0.025em; }
        .lp-cta-sub { font-size: 16px; color: rgb(255 255 255 / 0.85); max-width: 460px; margin: 14px auto 28px; line-height: 1.55; }
        .lp-cta-btn { background: #fff; color: var(--accent); padding: 14px 30px; font-size: 15px; gap: 8px; box-shadow: var(--shadow); }
        .lp-cta-btn:hover { background: #fff; transform: translateY(-1px); box-shadow: var(--shadow-lg); text-decoration: none; color: var(--accent); }

        /* ── Responsive ── */
        @media (max-width: 880px) {
          .lp-hero { grid-template-columns: 1fr; gap: 40px; text-align: center; padding-top: clamp(40px, 8vw, 72px); }
          .lp-hero-copy { display: flex; flex-direction: column; align-items: center; }
          .lp-sub { max-width: 520px; }
          .lp-stats { grid-template-columns: repeat(2, 1fr); }
          .lp-features { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .lp-hero { padding-left: 16px; padding-right: 16px; }
          .lp-section, .lp-cta-block, .lp-stats { padding-left: 16px; padding-right: 16px; }
          .lp-cta { flex-direction: column; align-items: stretch; width: 100%; }
          .lp-cta .btn { width: 100%; justify-content: center; }
          .lp-steps { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
