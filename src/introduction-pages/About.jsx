import { Link } from 'react-router-dom';

export default function AboutPage() {
    return (
        <>
            <title>About — SkillJoy</title>

            <main className="ab-main">

                {/* ── Header ── */}
                <section className="ab-header">
                    <Link to="/" className="ab-back">← Back to Home</Link>
                    <p className="ab-eyebrow">About SkillJoy</p>
                    <h1 className="ab-title">Everything you sell.<br /><em>One link.</em></h1>
                    <p className="ab-subtitle">
                        SkillJoy is the creator storefront for turning what you know into income — courses,
                        templates, prompts, and coaching, all from a single link you share everywhere.
                    </p>
                </section>

                {/* ── Two value props ── */}
                <section className="ab-modes">
                    <div className="ab-container">

                        {/* Sell anything */}
                        <div className="ab-mode ab-mode-swap">
                            <div className="ab-mode-badge">Create</div>
                            <div className="ab-mode-icon" aria-hidden="true">🧩</div>
                            <h2 className="ab-mode-title">Sell what you know</h2>
                            <p className="ab-mode-desc">
                                Package your expertise into Skills — mix files, videos, prompts, guides, and live
                                coaching into one product, set a price, and publish in minutes.
                            </p>

                            <ul className="ab-mode-list">
                                <li>
                                    <span className="ab-check">✓</span>
                                    <span>Digital downloads, <strong>courses</strong>, and <strong>coaching</strong> calls</span>
                                </li>
                                <li>
                                    <span className="ab-check">✓</span>
                                    <span>Build a Skill from drag-and-drop content blocks</span>
                                </li>
                                <li>
                                    <span className="ab-check">✓</span>
                                    <span>One-time prices or recurring memberships</span>
                                </li>
                                <li>
                                    <span className="ab-check">✓</span>
                                    <span>Push updates to buyers and keep earning over time</span>
                                </li>
                            </ul>

                            <div className="ab-mode-example">
                                <span className="ab-example-chip ab-chip-teach">skilljoy.me/@you</span>
                                <span className="ab-example-arrow">→</span>
                                <span className="ab-example-chip ab-chip-learn">your storefront</span>
                            </div>

                            <Link to="/login" className="ab-mode-cta ab-cta-swap">Start your store →</Link>
                        </div>

                        {/* Run your business */}
                        <div className="ab-mode ab-mode-gig">
                            <div className="ab-mode-badge ab-badge-gig">Grow</div>
                            <div className="ab-mode-icon" aria-hidden="true">📈</div>
                            <h2 className="ab-mode-title">Run your whole business</h2>
                            <p className="ab-mode-desc">
                                Your storefront comes with everything you need to sell and grow — secure checkout,
                                analytics, an email audience, and automatic payouts.
                            </p>

                            <ul className="ab-mode-list">
                                <li>
                                    <span className="ab-check ab-check-gig">✓</span>
                                    <span>One-tap checkout powered by <strong>Stripe</strong></span>
                                </li>
                                <li>
                                    <span className="ab-check ab-check-gig">✓</span>
                                    <span>Sales analytics, discount codes, and upsells</span>
                                </li>
                                <li>
                                    <span className="ab-check ab-check-gig">✓</span>
                                    <span>Build an email list and capture leads automatically</span>
                                </li>
                                <li>
                                    <span className="ab-check ab-check-gig">✓</span>
                                    <span>Earnings paid out straight to your bank</span>
                                </li>
                            </ul>

                            <div className="ab-escrow-note">
                                <span className="ab-escrow-icon">🔒</span>
                                <span>Keep the bulk of every sale — SkillJoy charges only a small platform fee, shown transparently at checkout.</span>
                            </div>

                            <Link to="/how-it-works" className="ab-mode-cta ab-cta-gig">See how it works →</Link>
                        </div>

                    </div>
                </section>

                {/* ── Origin story ── */}
                <section className="ab-story">
                    <div className="ab-container ab-story-inner">
                        <div>
                            <p className="ab-section-label">The story</p>
                            <h2 className="ab-story-title">Built for creators.<br />Kept going.</h2>
                            <p className="ab-story-body">
                                SkillJoy started with a simple observation: the people who teach, design, and create
                                the most online often have the hardest time getting paid for it — juggling link-in-bios,
                                checkout tools, and payment processors. We built one place to do it all: a storefront
                                where you can package your expertise, sell it from a single link, and get paid.
                            </p>
                        </div>
                        <div className="ab-founder">
                            <div className="ab-founder-avatar">RC</div>
                            <div>
                                <div className="ab-founder-name">Ryan Chang</div>
                                <div className="ab-founder-role">Founder · Designer · Developer</div>
                                <div className="ab-founder-award">🏆 3rd place — Northland Hackathon</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Footer links ── */}
                <section className="ab-footer-links">
                    <div className="ab-container">
                        <Link to="/login" className="ab-footer-btn ab-footer-btn-primary">Start your store</Link>
                        <Link to="/how-it-works" className="ab-footer-btn">How it works</Link>
                        <Link to="/contact" className="ab-footer-btn">Contact</Link>
                    </div>
                </section>

            </main>

            <style>{`
                .ab-main { display: flex; flex-direction: column; min-height: 100vh; }
                .ab-container { max-width: 1000px; margin: 0 auto; padding: 0 24px; width: 100%; }

                /* Header */
                .ab-header {
                    padding: 48px 24px 64px;
                    max-width: 1000px;
                    margin: 0 auto;
                    width: 100%;
                    background: var(--bg);
                }
                .ab-back {
                    display: inline-block;
                    font-size: 13px;
                    font-weight: 500;
                    color: var(--text);
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: var(--r-full);
                    padding: 6px 14px;
                    text-decoration: none;
                    margin-bottom: 36px;
                    transition: all 0.15s;
                }
                .ab-back:hover { border-color: var(--border-strong); text-decoration: none; box-shadow: var(--shadow-sm); }
                .ab-eyebrow {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(0,0,0,0.45);
                    margin-bottom: 14px;
                }
                .ab-title {
                    font-size: clamp(32px, 5vw, 56px);
                    line-height: 1.08;
                    letter-spacing: -0.02em;
                    color: var(--text);
                    margin-bottom: 16px;
                }
                .ab-title em { font-style: italic; color: var(--text-secondary); }
                .ab-subtitle {
                    font-size: clamp(15px, 2vw, 17px);
                    color: var(--text-secondary);
                    line-height: 1.65;
                    max-width: 520px;
                }

                /* Two modes */
                .ab-modes {
                    background: #E0D5C3;
                    padding: 64px 0;
                    border-top: 1px solid var(--border);
                }
                .ab-modes .ab-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                .ab-mode {
                    border: 1px solid var(--border);
                    border-radius: var(--r-xl);
                    padding: 36px;
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    position: relative;
                    background: #EDE6D8;
                    transition: box-shadow 0.2s;
                }
                .ab-mode:hover { box-shadow: var(--shadow); }
                .ab-mode-swap { border-top: 3px solid #000; }
                .ab-mode-gig  { border-top: 3px solid #000; }

                .ab-mode-badge {
                    display: inline-flex;
                    align-items: center;
                    font-size: 10px;
                    font-weight: 700;
                    letter-spacing: 0.1em;
                    text-transform: uppercase;
                    background: var(--surface-alt);
                    border: 1px solid var(--border);
                    color: var(--text-secondary);
                    border-radius: var(--r-full);
                    padding: 3px 10px;
                    width: fit-content;
                    margin-bottom: 20px;
                }
                .ab-badge-gig { background: var(--accent-light); border-color: var(--accent-mid); color: var(--accent); }

                .ab-mode-icon { font-size: 32px; margin-bottom: 14px; line-height: 1; }
                .ab-mode-title { font-size: 26px; margin-bottom: 12px; color: var(--text); }
                .ab-mode-desc  { font-size: 14px; line-height: 1.7; color: var(--text-secondary); margin-bottom: 24px; }

                .ab-mode-list {
                    list-style: none;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    margin-bottom: 24px;
                }
                .ab-mode-list li {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    font-size: 14px;
                    color: var(--text-secondary);
                    line-height: 1.5;
                }
                .ab-check {
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--surface);
                    background: var(--text);
                    border-radius: 50%;
                    width: 20px; height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    margin-top: 1px;
                }
                .ab-check-gig { background: var(--accent); }

                /* Swap example chips */
                .ab-mode-example {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    padding: 14px 16px;
                    background: var(--surface-alt);
                    border: 1px solid var(--border);
                    border-radius: var(--r);
                    margin-bottom: 24px;
                }
                .ab-example-chip {
                    font-size: 12px;
                    font-weight: 600;
                    padding: 4px 12px;
                    border-radius: var(--r-full);
                }
                .ab-chip-teach { background: var(--primary-light); border: 1px solid var(--primary-mid); color: var(--text); }
                .ab-chip-learn { background: var(--green-light); border: 1px solid var(--green-mid); color: var(--green); }
                .ab-example-arrow { font-size: 16px; color: var(--text-muted); }

                /* Escrow note */
                .ab-escrow-note {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    font-size: 13px;
                    color: var(--text-secondary);
                    line-height: 1.55;
                    background: var(--accent-light);
                    border: 1px solid var(--accent-mid);
                    border-radius: var(--r);
                    padding: 12px 14px;
                    margin-bottom: 24px;
                }
                .ab-escrow-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }

                /* Local disclaimer */
                .ab-local-note {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    font-size: 12px;
                    color: var(--text-secondary);
                    line-height: 1.55;
                    background: var(--surface-alt);
                    border: 1px solid var(--border);
                    border-radius: var(--r);
                    padding: 11px 13px;
                    margin-bottom: 24px;
                }
                .ab-local-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }

                /* CTAs */
                .ab-mode-cta {
                    font-size: 14px;
                    font-weight: 600;
                    padding: 12px 20px;
                    border-radius: var(--r-full);
                    text-decoration: none;
                    display: inline-flex;
                    align-items: center;
                    transition: all 0.15s;
                    width: fit-content;
                    margin-top: auto;
                }
                .ab-cta-swap { background: var(--text); color: var(--surface); }
                .ab-cta-swap:hover { background: #222; text-decoration: none; color: var(--surface); }
                .ab-cta-gig  { background: var(--accent); color: #fff; }
                .ab-cta-gig:hover  { background: var(--accent-hover); text-decoration: none; color: #fff; }

                /* Story */
                .ab-story {
                    background: var(--surface-alt);
                    border-top: 1px solid var(--border);
                    border-bottom: 1px solid var(--border);
                    padding: 64px 0;
                }
                .ab-story-inner {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 48px;
                    align-items: start;
                }
                .ab-section-label {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: var(--accent);
                    margin-bottom: 12px;
                }
                .ab-story-title { font-size: clamp(24px, 3vw, 36px); color: var(--text); margin-bottom: 16px; letter-spacing: -0.015em; }
                .ab-story-body  { font-size: 15px; line-height: 1.75; color: var(--text-secondary); max-width: 520px; }

                .ab-founder {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: var(--r-lg);
                    padding: 20px 24px;
                    flex-shrink: 0;
                    min-width: 240px;
                }
                .ab-founder-avatar {
                    width: 52px; height: 52px;
                    border-radius: 50%;
                    background: var(--text);
                    color: var(--surface);
                    font-size: 18px;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .ab-founder-name  { font-size: 16px; font-weight: 700; margin-bottom: 2px; }
                .ab-founder-role  { font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
                .ab-founder-award { font-size: 12px; color: var(--text-muted); }

                /* Footer links */
                .ab-footer-links {
                    padding: 40px 0 56px;
                }
                .ab-footer-links .ab-container {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                }
                .ab-footer-btn {
                    font-size: 14px;
                    font-weight: 500;
                    padding: 10px 20px;
                    border-radius: var(--r-full);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: rgba(255,255,255,0.85);
                    background: rgba(255,255,255,0.1);
                    text-decoration: none;
                    transition: all 0.15s;
                    backdrop-filter: blur(4px);
                }
                .ab-footer-btn:hover { background: rgba(255,255,255,0.2); text-decoration: none; color: #fff; }
                .ab-footer-btn-primary { background: var(--surface); color: var(--text); border-color: transparent; }
                .ab-footer-btn-primary:hover { background: #fffff5; color: var(--text); }

                /* Mobile */
                @media (max-width: 700px) {
                    .ab-header { padding: 36px 16px 48px; }
                    .ab-modes .ab-container { grid-template-columns: 1fr; }
                    .ab-story-inner { grid-template-columns: 1fr; gap: 32px; }
                    .ab-founder { min-width: unset; }
                    .ab-mode { padding: 24px; }
                    .ab-footer-links .ab-container { padding: 0 16px; }
                }
            `}</style>
        </>
    );
}
