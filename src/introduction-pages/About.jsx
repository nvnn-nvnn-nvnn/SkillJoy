import { Link } from 'react-router-dom';
import {
    FileText, GraduationCap, CalendarClock, Repeat, Video, Magnet,
    Palette, CreditCard, BarChart3, Mail, Check, ArrowRight,
} from 'lucide-react';

// About — what SkillJoy actually is, described from the shipped feature set.
//
// Rewritten 2026-08-21 for two reasons:
//  1. Same hardcoded-colour bug as the legal pages (note 169). This page had
//     literal section backgrounds (#E0D5C3, #EDE6D8) that never responded to
//     data-theme="dark", plus a footer whose buttons were rgba(255,255,255,…)
//     over a section with no background — white on cream, invisible in LIGHT
//     mode, which is how long it had been broken without anyone noticing.
//  2. The copy predated most of the product. It described "files, videos,
//     prompts, guides" as the whole offer, with no mention of courses with
//     progress tracking, native 1:1 booking, memberships, or the growth tools.
//     Everything below is a feature that exists today.

const SELLS = [
    { icon: FileText, label: 'Digital products', blurb: 'Files, templates, presets — delivered instantly after checkout.' },
    { icon: GraduationCap, label: 'Courses', blurb: 'Modules and lessons with per-lesson progress tracking.' },
    { icon: CalendarClock, label: '1:1 coaching', blurb: 'Bookable slots from your own weekly availability.' },
    { icon: Repeat, label: 'Memberships', blurb: 'Recurring access that renews on its own.' },
    { icon: Video, label: 'Webinars', blurb: 'Ticketed live or evergreen events.' },
    { icon: Magnet, label: 'Lead magnets', blurb: 'Free downloads that grow your email list.' },
];

const RUNS = [
    { icon: Palette, label: 'A page that looks like you', points: ['Themes, fonts, colours and effects', 'Links, socials and products in one place', 'Group products under your own headings'] },
    { icon: CreditCard, label: 'Checkout that just works', points: ['Stripe checkout, including guest buyers', 'Discount codes and order bumps', 'Payouts straight to your bank'] },
    { icon: BarChart3, label: 'Numbers you can act on', points: ['Views, sales and revenue over time', 'Your own tracking pixels', 'Buyer reviews on every product'] },
    { icon: Mail, label: 'An audience you own', points: ['Capture emails from your page', 'Send broadcasts to your list', 'Free lead magnets to grow it'] },
];

export default function AboutPage() {
    return (
        <>
            <title>About — SkillJoy</title>

            <main className="ab">
                {/* ── Hero ── */}
                <section className="ab-hero">
                    <Link to="/" className="ab-back">← Back to home</Link>
                    <p className="ab-eyebrow">About SkillJoy</p>
                    <h1 className="ab-title">Everything you sell.<br /><em>One link.</em></h1>
                    <p className="ab-sub">
                        SkillJoy is a storefront for people who know things. Package what you know into
                        products, courses and coaching, put it all behind a single link, and get paid —
                        without stitching together five different tools.
                    </p>
                    <div className="ab-herocta">
                        <Link to="/login" className="ab-btn ab-btn-primary">Start your store <ArrowRight size={15} /></Link>
                        <Link to="/how-it-works" className="ab-btn">How it works</Link>
                    </div>
                </section>

                {/* ── What you can sell ── */}
                <section className="ab-band">
                    <div className="ab-wrap">
                        <p className="ab-label">What you can sell</p>
                        <h2 className="ab-h2">Six kinds of product, one builder</h2>
                        <p className="ab-lede">
                            Every product is built from the same content blocks — video, files, written guides,
                            prompts, and booking. Mix them however the thing you&rsquo;re selling needs.
                        </p>
                        <div className="ab-grid">
                            {/* Icon assigned as a VARIABLE, not destructured in the
                                param list: eslint's varsIgnorePattern ^[A-Z_] covers
                                variables but not args, so the destructured form trips
                                no-unused-vars. Same shape AddProduct.jsx already uses. */}
                            {SELLS.map(s => {
                                const Icon = s.icon;
                                return (
                                    <div key={s.label} className="ab-card">
                                        <span className="ab-cardicon"><Icon size={19} /></span>
                                        <h3 className="ab-cardtitle">{s.label}</h3>
                                        <p className="ab-cardblurb">{s.blurb}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* ── The business side ── */}
                <section className="ab-wrap ab-section">
                    <p className="ab-label">The rest of the business</p>
                    <h2 className="ab-h2">Not just a page — the whole shop</h2>
                    <div className="ab-runs">
                        {RUNS.map(r => {
                            const Icon = r.icon;
                            return (
                                <div key={r.label} className="ab-run">
                                    <span className="ab-runicon"><Icon size={18} /></span>
                                    <div>
                                        <h3 className="ab-cardtitle">{r.label}</h3>
                                        <ul className="ab-runlist">
                                            {r.points.map(p => (
                                                <li key={p}><Check size={13} strokeWidth={3} /> {p}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="ab-fee">
                        Building and customizing your page is free. Selling runs on a platform plan with a
                        14-day free trial — and you keep the bulk of every sale, with the fee shown plainly
                        at checkout.
                    </p>
                </section>

                {/* ── Story ── */}
                <section className="ab-band">
                    <div className="ab-wrap ab-story">
                        <div>
                            <p className="ab-label">The story</p>
                            <h2 className="ab-h2">Built for creators. Kept going.</h2>
                            <p className="ab-storybody">
                                SkillJoy started from a simple observation: the people who teach, design and
                                create the most online often have the hardest time getting paid for it —
                                juggling a link-in-bio here, a checkout tool there, a payment processor
                                somewhere else. We built one place to do all of it: package your expertise,
                                sell it from a single link, get paid.
                            </p>
                        </div>
                        <div className="ab-founder">
                            <div className="ab-avatar">RC</div>
                            <div>
                                <div className="ab-fname">Ryan Chang</div>
                                <div className="ab-frole">Founder · Designer · Developer</div>
                                <div className="ab-faward">🏆 3rd place — Northland Hackathon</div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Footer CTA ── */}
                <section className="ab-wrap ab-footer">
                    <h2 className="ab-h2 ab-center">Ready to claim your link?</h2>
                    <div className="ab-footerbtns">
                        <Link to="/login" className="ab-btn ab-btn-primary">Start your store <ArrowRight size={15} /></Link>
                        <Link to="/how-it-works" className="ab-btn">How it works</Link>
                        <Link to="/contact" className="ab-btn">Contact</Link>
                    </div>
                </section>
            </main>

            <Styles />
        </>
    );
}

function Styles() {
    return <style>{`
    .ab { display:flex; flex-direction:column; }
    .ab-wrap { max-width:960px; margin:0 auto; padding:0 24px; width:100%; }

    /* ── Hero ── */
    .ab-hero { max-width:960px; margin:0 auto; padding:52px 24px 64px; width:100%; }
    .ab-back { display:inline-block; font-size:13px; font-weight:600; color:var(--text-secondary);
      background:var(--surface); border:1px solid var(--border); border-radius:var(--r-full);
      padding:7px 15px; text-decoration:none; margin-bottom:34px; transition:border-color .15s ease, color .15s ease; }
    .ab-back:hover { border-color:var(--accent); color:var(--accent); }
    .ab-eyebrow { font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;
      color:var(--accent); margin-bottom:14px; }
    .ab-title { font-size:clamp(34px,5.5vw,58px); line-height:1.06; letter-spacing:-.03em;
      color:var(--text); font-family:var(--font-display); font-weight:800; margin:0 0 18px; }
    .ab-title em { font-style:italic; font-weight:700; color:var(--accent); }
    .ab-sub { font-size:clamp(15px,2vw,17.5px); color:var(--text-secondary); line-height:1.7; max-width:56ch; margin:0; }
    .ab-herocta { display:flex; flex-wrap:wrap; gap:10px; margin-top:30px; }

    .ab-btn { display:inline-flex; align-items:center; gap:7px; padding:12px 22px; border-radius:var(--r-full);
      border:1.5px solid var(--border-strong); background:var(--surface); color:var(--text);
      font-size:14.5px; font-weight:700; text-decoration:none; transition:border-color .15s ease, color .15s ease, background .15s ease; }
    .ab-btn:hover { border-color:var(--accent); color:var(--accent); text-decoration:none; }
    /* Was rgba(255,255,255,…) over a section with NO background — white on cream,
       i.e. invisible in light mode. Tokens now, so both themes work. */
    .ab-btn-primary { background:var(--accent); border-color:var(--accent); color:var(--accent-foreground); }
    .ab-btn-primary:hover { background:var(--accent-hover); border-color:var(--accent-hover); color:var(--accent-foreground); }

    /* ── Bands ── */
    .ab-band { background:var(--surface-alt); border-top:1px solid var(--border);
      border-bottom:1px solid var(--border); padding:62px 0; }
    .ab-section { padding:62px 24px; }
    .ab-label { font-size:11px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;
      color:var(--accent); margin:0 0 12px; }
    .ab-h2 { font-size:clamp(24px,3.2vw,34px); font-weight:800; letter-spacing:-.02em; line-height:1.2;
      color:var(--text); font-family:var(--font-display); margin:0 0 14px; }
    .ab-center { text-align:center; }
    .ab-lede { font-size:15.5px; line-height:1.7; color:var(--text-secondary); max-width:60ch; margin:0 0 30px; }

    /* ── Product grid ── */
    .ab-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; }
    .ab-card { padding:22px; border:1px solid var(--border); border-radius:var(--r-lg);
      background:var(--surface); transition:border-color .15s ease, transform .15s ease, box-shadow .15s ease; }
    .ab-card:hover { border-color:var(--accent-mid); transform:translateY(-2px); box-shadow:var(--shadow); }
    .ab-cardicon { display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px;
      border-radius:var(--r); background:var(--accent-light); color:var(--accent-hover); margin-bottom:13px; }
    .ab-cardtitle { font-size:16px; font-weight:750; color:var(--text); margin:0 0 6px; }
    .ab-cardblurb { font-size:13.5px; line-height:1.6; color:var(--text-secondary); margin:0; }

    /* ── Business list ── */
    .ab-runs { display:grid; grid-template-columns:1fr 1fr; gap:26px 40px; margin-top:26px; }
    .ab-run { display:flex; gap:14px; align-items:flex-start; }
    .ab-runicon { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
      width:38px; height:38px; border-radius:var(--r); background:var(--accent-light); color:var(--accent-hover); }
    .ab-runlist { list-style:none; margin:8px 0 0; padding:0; display:flex; flex-direction:column; gap:7px; }
    .ab-runlist li { display:flex; gap:8px; align-items:flex-start; font-size:13.5px; line-height:1.5; color:var(--text-secondary); }
    .ab-runlist svg { flex-shrink:0; margin-top:3px; color:var(--accent); }
    .ab-fee { margin:34px 0 0; padding:15px 18px; border-radius:var(--r); background:var(--accent-light);
      border:1px solid var(--accent-mid); font-size:13.5px; line-height:1.65; color:var(--text-secondary); }

    /* ── Story ── */
    .ab-story { display:grid; grid-template-columns:1fr auto; gap:44px; align-items:start; }
    .ab-storybody { font-size:15px; line-height:1.78; color:var(--text-secondary); max-width:56ch; margin:0; }
    .ab-founder { display:flex; align-items:center; gap:15px; background:var(--surface);
      border:1px solid var(--border); border-radius:var(--r-lg); padding:20px 24px; flex-shrink:0; min-width:250px; }
    .ab-avatar { width:52px; height:52px; border-radius:var(--r-full); background:var(--accent);
      color:var(--accent-foreground); font-size:18px; font-weight:800; display:flex; align-items:center;
      justify-content:center; flex-shrink:0; }
    .ab-fname { font-size:16px; font-weight:750; color:var(--text); }
    .ab-frole { font-size:13px; color:var(--text-secondary); margin-top:2px; }
    .ab-faward { font-size:12px; color:var(--text-muted); margin-top:6px; }

    /* ── Footer ── */
    .ab-footer { padding:62px 24px 84px; }
    .ab-footerbtns { display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:22px; }

    @media (max-width:760px) {
      .ab-hero { padding:34px 18px 46px; }
      .ab-wrap { padding:0 18px; }
      .ab-band { padding:44px 0; }
      .ab-section, .ab-footer { padding:44px 18px; }
      .ab-runs { grid-template-columns:1fr; gap:22px; }
      .ab-story { grid-template-columns:1fr; gap:28px; }
      .ab-founder { min-width:0; }
    }
    @media (prefers-reduced-motion: reduce) { .ab-card:hover { transform:none; } }
  `}</style>;
}
