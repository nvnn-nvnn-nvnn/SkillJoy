import { useMemo } from 'react';

// ── Shared layout for Terms / Privacy / Refund ──────────────────────────────
//
// Replaces three near-identical copies that each hardcoded two colours:
//
//   <p style={{ color: '#000' }}>            ← invisible on a dark background
//   <div style={{ background: '#f0ede8' }}>  ← a permanently LIGHT card, so the
//                                              --text-secondary inside it went
//                                              light-on-light in dark mode
//
// That's the whole dark-mode bug: hardcoded values can't respond to
// data-theme="dark", and one of them was a *background*, which silently broke
// the token-driven text sitting on top of it. Everything here is a token.
//
// The readability changes are as deliberate as the colour ones:
//  · sections are numbered <section> elements with real <h2>s and ids, so the
//    page is navigable by screen reader and linkable by anchor
//  · a sticky table of contents on wide screens — legal pages are reference
//    documents people scan for one clause, not prose they read top to bottom
//  · ~68ch measure and 1.75 line-height; the old full-width 760px paragraphs at
//    1.7 were a wall
export default function LegalPage({ title, updated, intro, sections }) {
  // Stable anchor ids from the heading text: "5. Payments & Escrow" → "payments-escrow".
  const withIds = useMemo(() => sections.map((s, i) => ({
    ...s,
    id: s.title.toLowerCase().replace(/^\d+\.\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `section-${i + 1}`,
  })), [sections]);

  return (
    <div className="lg">
      <title>{title} — SkillJoy</title>

      <header className="lg-head">
        <h1 className="lg-title">{title}</h1>
        <p className="lg-updated">
          Last updated <time>{updated}</time>
        </p>
        {intro && <p className="lg-intro">{intro}</p>}
      </header>

      <div className="lg-body">
        <nav className="lg-toc" aria-label="On this page">
          <p className="lg-toc-head">On this page</p>
          <ol>
            {withIds.map(s => (
              <li key={s.id}><a href={`#${s.id}`}>{s.title.replace(/^\d+\.\s*/, '')}</a></li>
            ))}
          </ol>
        </nav>

        <div className="lg-content">
          {withIds.map(s => (
            <section key={s.id} id={s.id} className="lg-section">
              <h2 className="lg-h2">{s.title}</h2>
              <div className="lg-text">{s.body}</div>
            </section>
          ))}
        </div>
      </div>

      <Styles />
    </div>
  );
}

function Styles() {
  return <style>{`
    .lg { max-width: 1040px; margin: 0 auto; padding: 56px 20px 110px; }

    .lg-head { max-width: 68ch; margin-bottom: 42px; }
    .lg-title { font-size: clamp(30px, 5vw, 42px); font-weight: 800; letter-spacing: -.025em;
      line-height: 1.12; color: var(--text); font-family: var(--font-display); margin: 0; }
    .lg-updated { margin: 12px 0 0; font-size: 13px; font-weight: 600; color: var(--text-muted); }
    .lg-intro { margin: 20px 0 0; font-size: 16.5px; line-height: 1.7; color: var(--text-secondary); }

    /* TOC beside the content on wide screens, stacked above it on narrow. */
    .lg-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 52px; align-items: start; }

    .lg-toc { position: sticky; top: 88px; }
    .lg-toc-head { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em;
      color: var(--text-muted); margin: 0 0 12px; }
    .lg-toc ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;
      border-left: 1px solid var(--border); }
    .lg-toc a { display: block; padding: 6px 0 6px 14px; margin-left: -1px; border-left: 2px solid transparent;
      font-size: 13px; line-height: 1.45; color: var(--text-secondary); text-decoration: none; }
    .lg-toc a:hover { color: var(--accent); border-left-color: var(--accent-mid); }

    .lg-content { min-width: 0; }
    /* A rule between sections rather than a card each: the boxed look is what
       made the page feel like a form, and the card background is exactly what
       broke in dark mode. */
    .lg-section { padding: 0 0 30px; margin-bottom: 30px; border-bottom: 1px solid var(--border); }
    .lg-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    /* scroll-margin keeps an anchored heading clear of the fixed header. */
    .lg-section { scroll-margin-top: 90px; }

    .lg-h2 { font-size: 20px; font-weight: 750; letter-spacing: -.012em; color: var(--text);
      margin: 0 0 12px; line-height: 1.3; }
    .lg-text { max-width: 68ch; font-size: 15.5px; line-height: 1.75; color: var(--text-secondary); }
    .lg-text p { margin: 0 0 14px; }
    .lg-text p:last-child { margin-bottom: 0; }
    .lg-text strong { color: var(--text); font-weight: 700; }
    .lg-text a { color: var(--accent); font-weight: 600; text-decoration: underline;
      text-underline-offset: 2px; }
    .lg-text ul { margin: 0 0 14px; padding-left: 20px; display: flex; flex-direction: column; gap: 8px; }
    .lg-text li { padding-left: 2px; }
    .lg-text li::marker { color: var(--accent-mid); }

    @media (max-width: 900px) {
      .lg { padding: 36px 18px 80px; }
      .lg-body { grid-template-columns: 1fr; gap: 30px; }
      /* Sticky is pointless once it's a stacked block at the top. */
      .lg-toc { position: static; padding-bottom: 22px; border-bottom: 1px solid var(--border); }
      .lg-toc ol { flex-direction: row; flex-wrap: wrap; gap: 6px 8px; border-left: none; }
      .lg-toc a { padding: 5px 11px; border: 1px solid var(--border); border-radius: var(--r-full);
        margin-left: 0; font-size: 12.5px; }
      .lg-toc a:hover { border-color: var(--accent); }
    }
  `}</style>;
}
