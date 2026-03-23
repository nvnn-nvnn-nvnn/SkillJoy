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

export default function LandingPage() {
  const user = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/matches');
  }, [user, navigate]);

  return (
    <>
      <title>SkillJoy — Trade Skills, Create Joy</title>

      <main>
        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-inner">
            <p className="hero-eyebrow fade-up">✦ Skill exchange for college students</p>
            <h1 className="hero-title fade-up-delay-1">
              Teach what you love.<br />
              <em>Learn what you crave.</em>
            </h1>
            <p className="hero-body fade-up-delay-2">
              Match with students who have exactly what you want to learn —
              and pay for it by teaching what you already know.
              No money. Just joy.
            </p>
            <div className="hero-cta fade-up-delay-3">
              <Link to="/login" className="btn btn-primary" style={{ fontSize: 16, padding: '16px 36px' }}>
                Find your match
              </Link>
              <p className="hero-hint">Free for all students · No credit card</p>
            </div>
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <div className="deco-ring deco-ring-1" />
            <div className="deco-ring deco-ring-2" />
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="how-section">
          <div className="page">
            <p className="section-label" style={{ textAlign: 'center' }}>How it works</p>
            <div className="steps">
              <div className="step fade-up">
                <div className="step-num">01</div>
                <h3>List your skills</h3>
                <p>Tell us what you can teach and what you want to learn — from Python to pottery.</p>
              </div>
              <div className="step-arrow" aria-hidden="true">→</div>
              <div className="step fade-up-delay-1">
                <div className="step-num">02</div>
                <h3>Get matched</h3>
                <p>We find students whose teach list matches your learn list — and vice versa.</p>
              </div>
              <div className="step-arrow" aria-hidden="true">→</div>
              <div className="step fade-up-delay-2">
                <div className="step-num">03</div>
                <h3>Propose a swap</h3>
                <p>Send a swap request, agree on a time, and exchange an hour of knowledge.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Live swap feed ── */}
        <section className="pairs-section">
          <div className="page">
            <p className="section-label" style={{ textAlign: 'center', marginBottom: 8 }}>Happening on campus</p>
            <h2 className="pairs-heading">Skills finding their match</h2>
            <div className="pairs-grid">
              {PAIRS.map((pair, i) => (
                <PairCard key={i} pair={pair} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Footer CTA ── */}
        <section className="footer-cta">
          <h2>Ready to trade?</h2>
          <p>Join hundreds of students already swapping skills.</p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: 24, fontSize: 16, padding: '16px 36px' }}>
            Get started free
          </Link>
        </section>
      </main>

      <style>{`
        /* Hero */
        .hero {
          min-height: 88vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          position: relative;
          overflow: hidden;
          padding: 80px 24px;
        }
        .hero-inner { position: relative; z-index: 2; max-width: 680px; }
        .hero-eyebrow {
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0.08em;
          color: var(--primary);
          text-transform: uppercase;
          margin-bottom: 20px;
        }
        .hero-title {
          font-size: clamp(42px, 7vw, 72px);
          line-height: 1.05;
          margin-bottom: 24px;
          color: var(--text);
        }
        .hero-title em { font-style: italic; color: var(--accent); }
        .hero-body {
          font-size: 18px;
          line-height: 1.7;
          color: var(--text-secondary);
          max-width: 480px;
          margin: 0 auto 36px;
        }
        .hero-cta { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .hero-hint { font-size: 12px; color: var(--text-muted); }

        /* Deco rings */
        .hero-decoration { position: absolute; inset: 0; pointer-events: none; }
        .deco-ring { position: absolute; border-radius: 50%; border: 1px solid var(--border); }
        .deco-ring-1 {
          width: 600px; height: 600px;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 6s ease-in-out infinite;
        }
        .deco-ring-2 {
          width: 900px; height: 900px;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 6s 2s ease-in-out infinite;
          opacity: 0.5;
        }
        @keyframes pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: 0.6; }
          50%       { transform: translate(-50%, -50%) scale(1.03); opacity: 0.3; }
        }

        /* How it works */
        .how-section { padding: 80px 0; background: var(--surface-alt); border-top: 1px solid var(--border); }
        .steps { display: flex; align-items: flex-start; gap: 16px; margin-top: 40px; flex-wrap: wrap; justify-content: center; }
        .step { flex: 1; min-width: 200px; max-width: 260px; text-align: center; padding: 24px; }
        .step-num { font-family: var(--font-display); font-size: 36px; font-weight: 400; color: var(--border-strong); margin-bottom: 12px; }
        .step h3 { font-size: 20px; margin-bottom: 8px; }
        .step p  { font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
        .step-arrow { font-size: 24px; color: var(--border-strong); padding-top: 36px; flex-shrink: 0; }

        /* Pairs */
        .pairs-section { padding: 80px 0; }
        .pairs-heading { font-size: 32px; text-align: center; margin-bottom: 48px; }
        .pairs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

        /* Footer CTA */
        .footer-cta { text-align: center; padding: 100px 24px; border-top: 1px solid var(--border); }
        .footer-cta h2 { font-size: 44px; margin-bottom: 12px; }
        .footer-cta p  { font-size: 17px; color: var(--text-secondary); }
      `}</style>
    </>
  );
}