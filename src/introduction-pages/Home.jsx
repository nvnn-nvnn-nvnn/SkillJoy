import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/lib/stores';
import PairCard from '@/components/Paircard';

const PAIRS = [
  { teach: 'Python', learn: 'Guitar', a: 'Maya', b: 'Jordan' },
  { teach: 'Oil Painting', learn: 'React', a: 'Alex', b: 'Priya' },
  { teach: 'Spanish', learn: 'Chess', a: 'Sofia', b: 'Leo' },
  { teach: 'Cooking', learn: 'Photography', a: 'Sam', b: 'Mia' },
  { teach: 'Yoga', learn: 'Graphic Design', a: 'Arjun', b: 'Chloe' },
  { teach: 'Chess', learn: 'Music Theory', a: 'Leo', b: 'Jordan' },
];

const STATS = [
  { value: '2,400+', label: 'Active students' },
  { value: '180+', label: 'Skills listed' },
  { value: '94%', label: 'Match satisfaction' },
  { value: '30+', label: 'Universities' },
];

const FEATURES = [
  {
    icon: '✦',
    title: 'AI-powered matching',
    body: 'Our AI reads your skill profile and surfaces your highest-compatibility matches in seconds — no browsing, no guesswork.',
    ai: true,
  },
  {
    icon: '🔒',
    title: 'Verified students only',
    body: 'Every account is tied to a .edu email so you only swap with real, verified college students.',
  },
  {
    icon: '💬',
    title: 'Built-in messaging',
    body: 'Coordinate sessions, share resources, and stay in sync — all inside SkillJoy.',
  },
  {
    icon: '🎯',
    title: 'Gig marketplace',
    body: 'Need a tutor fast? Browse the gig board and pay with real money when a direct swap isn\'t available.',
  },
];

export default function LandingPage() {
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/matches');
  }, [user, navigate]);

  return (
    <>
      <title>SkillJoy — Trade Skills, Create Joy</title>

      <main className="lp-main">

        {/* ── Hero ── */}
        <section className="lp-hero">
          <div className="lp-hero-bg" aria-hidden="true">
            <div className="lp-blob lp-blob-1" />
            <div className="lp-blob lp-blob-2" />
          </div>

          <div className="lp-hero-inner">
            <div className="lp-eyebrow">
              <span className="lp-eyebrow-dot" />
              AI-powered skill exchange for college students
            </div>

            <h1 className="lp-title">
              Teach what you love.<br />
              <em>Learn what you crave.</em>
            </h1>

            <p className="lp-subtitle">
              Match with students across the world who have exactly what you want to learn —
              and pay for it by teaching what you already know.
            </p>

            <div className="lp-cta-row">
              <Link to="/login" className="lp-btn-primary">
                Find your match
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link to="/about" className="lp-btn-ghost">How it works</Link>
            </div>

            <p className="lp-free-note">Free for all students · No credit card required</p>
          </div>

          {/* Stats pill row */}
          <div className="lp-stats-bar">
            {STATS.map((s) => (
              <div key={s.label} className="lp-stat">
                <span className="lp-stat-value">{s.value}</span>
                <span className="lp-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="lp-how">
          <div className="lp-container">
            <p className="lp-section-label">How it works</p>
            <h2 className="lp-section-title">Three steps to your first swap</h2>

            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-icon">01</div>
                <div className="lp-step-line" aria-hidden="true" />
                <h3 className="lp-step-title">List your skills</h3>
                <p className="lp-step-body">Tell us what you can teach and what you want to learn — from Python to pottery.</p>
              </div>
              <div className="lp-step">
                <div className="lp-step-icon">02</div>
                <div className="lp-step-line" aria-hidden="true" />
                <h3 className="lp-step-title">AI finds your match</h3>
                <p className="lp-step-body">Our AI scores compatibility across skills, availability, and learning style — and surfaces your best fits instantly.</p>
              </div>
              <div className="lp-step lp-step-last">
                <div className="lp-step-icon">03</div>
                <h3 className="lp-step-title">Swap & grow</h3>
                <p className="lp-step-body">Send a swap request, pick a time, and exchange an hour of real knowledge.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="lp-features">
          <div className="lp-container">
            <p className="lp-section-label">Why SkillJoy</p>
            <h2 className="lp-section-title">Everything you need to learn faster</h2>

            <div className="lp-feature-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className={`lp-feature-card${f.ai ? ' lp-feature-card-ai' : ''}`}>
                  <div className="lp-feature-card-top">
                    <div className="lp-feature-icon">{f.icon}</div>
                    {f.ai && <span className="lp-ai-badge">AI</span>}
                  </div>
                  <h3 className="lp-feature-title">{f.title}</h3>
                  <p className="lp-feature-body">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Live swap feed ── */}
        <section className="lp-pairs">
          <div className="lp-container">
            <p className="lp-section-label">Happening now</p>
            <h2 className="lp-section-title">Skills finding their match</h2>
            <p className="lp-pairs-sub">Real swaps happening between students across campuses.</p>
            <div className="lp-pairs-grid">
              {PAIRS.map((pair, i) => (
                <PairCard key={i} pair={pair} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer CTA ── */}
        <section className="lp-footer-cta">
          <div className="lp-footer-cta-inner">
            <p className="lp-section-label lp-section-label-light">Get started</p>
            <h2 className="lp-footer-title">Your next skill is one swap away.</h2>
            <p className="lp-footer-body">Join thousands of students already trading knowledge — for free.</p>
            <Link to="/login" className="lp-btn-primary lp-btn-large">
              Create your profile
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </section>
      </main>

      <style>{`
        /* ── Layout ── */
        .lp-main { display: flex; flex-direction: column; }
        .lp-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; width: 100%; }

        /* ── Hero ── */
        .lp-hero {
          min-height: 92vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          position: relative;
          overflow: hidden;
          padding: 100px 20px 0;
        }
        .lp-hero-bg { position: absolute; inset: 0; pointer-events: none; }
        .lp-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.25;
        }
        .lp-blob-1 { width: 500px; height: 500px; background: #fff; top: -100px; left: -100px; }
        .lp-blob-2 { width: 400px; height: 400px; background: var(--accent); bottom: 60px; right: -80px; }

        .lp-hero-inner { position: relative; z-index: 2; max-width: 760px; width: 100%; }

        .lp-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--surface);
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.3);
          border-radius: var(--r-full);
          padding: 6px 14px;
          margin-bottom: 28px;
          backdrop-filter: blur(4px);
        }
        .lp-eyebrow-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--surface);
          flex-shrink: 0;
          animation: blink 2s ease-in-out infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .lp-title {
          font-size: clamp(40px, 7.5vw, 84px);
          line-height: 1.02;
          color: #000;
          margin-bottom: 24px;
          letter-spacing: -0.02em;
        }
        .lp-title em { font-style: italic; color: rgba(255,255,255,0.75); }

        .lp-subtitle {
          font-size: clamp(15px, 2vw, 19px);
          line-height: 1.65;
          color: rgba(255,255,255,0.82);
          max-width: 520px;
          margin: 0 auto 36px;
        }

        .lp-cta-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        .lp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          color: var(--text);
          font-weight: 600;
          font-size: 15px;
          padding: 14px 28px;
          border-radius: var(--r-full);
          border: none;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.18);
          white-space: nowrap;
        }
        .lp-btn-primary:hover {
          background: #fffff5;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.22);
          text-decoration: none;
          color: var(--text);
        }

        .lp-btn-ghost {
          display: inline-flex;
          align-items: center;
          font-size: 15px;
          font-weight: 500;
          color: rgba(255,255,255,0.9);
          padding: 14px 24px;
          border-radius: var(--r-full);
          border: 1px solid rgba(255,255,255,0.3);
          text-decoration: none;
          transition: all 0.2s;
          backdrop-filter: blur(4px);
          background: rgba(255,255,255,0.08);
          white-space: nowrap;
        }
        .lp-btn-ghost:hover {
          background: rgba(255,255,255,0.16);
          border-color: rgba(255,255,255,0.5);
          text-decoration: none;
          color: rgba(255,255,255,0.9);
        }

        .lp-free-note {
          font-size: 12px;
          color: rgba(255,255,255,0.55);
          margin-bottom: 56px;
        }

        /* Stats bar */
        .lp-stats-bar {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 760px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: var(--r-xl) var(--r-xl) 0 0;
          backdrop-filter: blur(12px);
          overflow: hidden;
          margin-top: auto;
        }
        .lp-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px 12px;
          border-right: 1px solid rgba(255,255,255,0.15);
        }
        .lp-stat:last-child { border-right: none; }
        .lp-stat-value {
          font-family: var(--font-display);
          font-size: clamp(20px, 3vw, 28px);
          font-weight: 600;
          color: var(--surface);
          line-height: 1;
          margin-bottom: 4px;
        }
        .lp-stat-label {
          font-size: 10px;
          font-weight: 500;
          color: rgba(255,255,255,0.6);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-align: center;
        }

        /* ── Section shared ── */
        .lp-section-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 12px;
        }
        .lp-section-label-light { color: rgba(255,255,255,0.65); }
        .lp-section-title {
          font-size: clamp(26px, 4vw, 42px);
          color: var(--text);
          margin-bottom: 48px;
          letter-spacing: -0.015em;
        }

        /* ── How it works ── */
        .lp-how { padding: 80px 0; background: var(--surface); }
        .lp-steps {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0;
          position: relative;
        }
        .lp-step { padding: 0 32px 0 0; position: relative; }
        .lp-step-last { padding-right: 0; }
        .lp-step-icon {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.05em;
          color: var(--surface);
          background: var(--text);
          width: 40px; height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
        }
        .lp-step-line {
          position: absolute;
          top: 20px;
          left: 40px;
          right: 0;
          height: 1px;
          background: var(--border);
        }
        .lp-step-title { font-size: 18px; margin-bottom: 10px; color: var(--text); }
        .lp-step-body { font-size: 14px; line-height: 1.65; color: var(--text-secondary); }

        /* ── Features ── */
        .lp-features {
          padding: 80px 0;
          background: var(--surface-alt);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }
        .lp-feature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        .lp-feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 28px 28px 28px 28px;
          transition: all 0.2s;
        }
        .lp-feature-card:hover {
          box-shadow: var(--shadow);
          border-color: var(--border-strong);
          transform: translateY(-2px);
        }
        .lp-feature-card-ai {
          border-color: var(--border-strong);
          background: linear-gradient(135deg, var(--surface) 80%, var(--primary-light));
        }
        .lp-feature-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }
        .lp-feature-icon { font-size: 26px; line-height: 1; }
        .lp-ai-badge {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--surface);
          background: var(--text);
          border-radius: var(--r-full);
          padding: 3px 9px;
        }
        .lp-feature-title { font-size: 17px; margin-bottom: 8px; color: var(--text); }
        .lp-feature-body { font-size: 14px; line-height: 1.65; color: var(--text-secondary); }

        /* ── Pairs ── */
        .lp-pairs { padding: 80px 0; background: var(--surface); }
        .lp-pairs-sub {
          font-size: 15px;
          color: var(--text-secondary);
          margin-top: -32px;
          margin-bottom: 48px;
        }
        .lp-pairs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }

        /* ── Footer CTA ── */
        .lp-footer-cta {
          background: var(--text);
          padding: 80px 24px;
          display: flex;
          justify-content: center;
        }
        .lp-footer-cta-inner {
          max-width: 600px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .lp-footer-title {
          font-size: clamp(28px, 5vw, 52px);
          color: var(--surface);
          letter-spacing: -0.02em;
          line-height: 1.08;
        }
        .lp-footer-body { font-size: 16px; color: rgba(255,255,255,0.55); max-width: 400px; }
        .lp-btn-large { font-size: 16px; padding: 16px 36px; margin-top: 8px; }

        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lp-hero-inner { animation: fadeUp 0.7s ease both; }
        .lp-stats-bar  { animation: fadeUp 0.7s 0.25s ease both; }

        /* ── Tablet (≤900px) ── */
        @media (max-width: 900px) {
          .lp-pairs-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* ── Mobile (≤640px) ── */
        @media (max-width: 640px) {
          .lp-hero { min-height: 100svh; padding: 80px 16px 0; }
          .lp-eyebrow { font-size: 10px; padding: 5px 12px; text-align: center; }
          .lp-free-note { margin-bottom: 36px; }

          .lp-stats-bar {
            grid-template-columns: repeat(2, 1fr);
            border-radius: var(--r-lg) var(--r-lg) 0 0;
          }
          .lp-stat { padding: 16px 10px; }
          .lp-stat:nth-child(2) { border-right: none; }
          .lp-stat:nth-child(3),
          .lp-stat:nth-child(4) { border-top: 1px solid rgba(255,255,255,0.15); }

          .lp-how, .lp-features, .lp-pairs, .lp-footer-cta { padding: 60px 0; }
          .lp-container { padding: 0 16px; }

          .lp-steps { grid-template-columns: 1fr; gap: 36px; }
          .lp-step  { padding: 0; }
          .lp-step-line { display: none; }

          .lp-feature-grid { grid-template-columns: 1fr; gap: 12px; }
          .lp-feature-card { padding: 22px; }

          .lp-pairs-grid { grid-template-columns: 1fr; }

          .lp-cta-row { flex-direction: column; width: 100%; }
          .lp-btn-primary, .lp-btn-ghost { width: 100%; justify-content: center; }

          .lp-section-title { margin-bottom: 32px; }
          .lp-pairs-sub { margin-bottom: 32px; }

          .lp-footer-cta { padding: 60px 20px; }
          .lp-btn-large  { width: 100%; justify-content: center; }
        }

        /* ── Very small (≤380px) ── */
        @media (max-width: 380px) {
          .lp-stats-bar { grid-template-columns: 1fr 1fr; }
          .lp-stat-value { font-size: 18px; }
        }
      `}</style>
    </>
  );
}
