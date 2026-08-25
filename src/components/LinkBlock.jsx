import { useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { resolveBlockLayout, LINK_SHAPES } from '@/lib/blocks';

// ── Public renderer for one Links block (plan 04) ───────────────────────────
//
// Four styles off one data shape. They differ in geometry only — the anchor,
// its rel handling, and the affiliate tag are identical across all of them, so
// the style picks a className and the markup stays shared. Four separate
// renderers would drift on exactly the details (rel="sponsored", target) that
// matter most.
export default function LinkBlock({ block, links }) {
  const layout = resolveBlockLayout(block.layout);
  // Only when the block explicitly overrides — '' means inherit the page-level
  // link_shape, so the block var must not be emitted at all.
  const shapeRadius = layout.shape ? LINK_SHAPES.find(s => s.id === layout.shape)?.radius : null;
  const [open, setOpen] = useState(!block.default_collapsed);

  const visible = links
    .filter(l => l.visible !== false && l.url)
    .sort((a, b) => a.position - b.position);

  if (!block.visible || visible.length === 0) return null;

  const collapsible = !!block.collapsible;
  const showBody = !collapsible || open;
  const showTitle = layout.titleShow !== false;
  const headText = showTitle && !!(block.title?.trim() || block.subtitle?.trim());
  const hasHeader = headText || collapsible;

  const cls = [
    'lkb',
    `lkb-${layout.style}`,
    `lkb-title-${layout.titleStyle || 'bar'}`,
    `lkb-talign-${layout.titleAlign || layout.align || 'left'}`,
    `lkb-size-${layout.size}`,
    `lkb-align-${layout.align}`,
    // Booleans, so these are present-or-absent rather than a value suffix.
    layout.outline ? 'lkb-outline' : '',
    layout.shadow ? 'lkb-shadow' : '',
  ].filter(Boolean).join(' ');

  // Per-block colours as CSS variables, with the page-level value as the
  // fallback — an unset key must inherit, not override with empty.
  return (
    <section
      className={cls}
      style={{
        '--lkb-cols': layout.columns || 2,
        ...(layout.bg ? { '--lkb-bg': layout.bg } : null),
        ...(layout.fg ? { '--lkb-fg': layout.fg } : null),
        ...(layout.headingColor ? { '--lkb-head': layout.headingColor } : null),
        ...(shapeRadius ? { '--lkb-shape': shapeRadius } : null),
        ...(layout.ctaBg ? { '--lkb-cta-bg': layout.ctaBg } : null),
        ...(layout.ctaFg ? { '--lkb-cta-fg': layout.ctaFg } : null),
        // A pill overrides its own padding at the same moment it overrides its
        // radius — the two are one decision.
        ...(shapeRadius === '999px' ? { '--lkb-xpad': '26px' } : null),
      }}
    >
      {hasHeader && (
        collapsible ? (
          // A real button, since it toggles rather than navigates. Without
          // aria-expanded a screen reader has no way to know the block opened.
          <button className="lkb-head lkb-head-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
            {block.collapsed_thumb_url && (
              <span className="lkb-headthumb" style={{ backgroundImage: `url(${block.collapsed_thumb_url})` }} aria-hidden="true" />
            )}
            {headText && (
              <span className="lkb-headtext">
                {block.title?.trim() && <span className="lkb-title">{block.title}</span>}
                {block.subtitle?.trim() && <span className="lkb-sub">{block.subtitle}</span>}
              </span>
            )}
            <ChevronDown size={17} className={`lkb-caret${open ? ' open' : ''}`} aria-hidden="true" />
          </button>
        ) : (
          <div className="lkb-head">
            {headText && (
              <span className="lkb-headtext">
                {block.title?.trim() && <span className="lkb-title">{block.title}</span>}
                {block.subtitle?.trim() && <span className="lkb-sub">{block.subtitle}</span>}
              </span>
            )}
          </div>
        )
      )}

      {showBody && (
        <div className="lkb-items">
          {visible.map(l => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel={l.is_affiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
              className={`lkb-item${l.featured ? ' featured' : ''}${l.cover_url ? '' : ' lkb-noimg'}`}
            >
              {/* Top row: image, text, arrow. Its own flex container so the
                  button below can span the FULL card — inside .lkb-body,
                  width:100% only reached the edge of the text column. */}
              <span className="lkb-main">
                {l.cover_url && (
                  <span className="lkb-thumb" style={{ backgroundImage: `url(${l.cover_url})` }} aria-hidden="true" />
                )}

                <span className="lkb-body">
                  <span className="lkb-label">{l.label || 'Link'}</span>
                  {l.description && <span className="lkb-desc">{l.description}</span>}
                  {l.is_affiliate && <span className="lkb-aff">Affiliate</span>}
                </span>

                <ArrowUpRight size={17} className="lkb-arrow" aria-hidden="true" />
              </span>

              {/* A span, not a <button> — the whole card is already an <a>, and
                  nesting interactive elements is invalid and breaks keyboard
                  navigation. It only has to LOOK like a button. */}
              {l.cta_label?.trim() && <span className="lkb-cta">{l.cta_label}</span>}
            </a>
          ))}
        </div>
      )}

      <Styles />
    </section>
  );
}

function Styles() {
  return <style>{`
    .lkb { margin-top:16px; }
    .lkb-headtext { display:flex; flex-direction:column; gap:2px; min-width:0; }
    .lkb-head { display:flex; align-items:center; gap:11px; width:100%; margin-bottom:10px;
      padding:0; border:none; background:none; text-align:left; color:inherit; }
    .lkb-head-btn { cursor:pointer; padding:9px 11px; border-radius:var(--r);
      background:var(--sf-item-bg, var(--surface)); border:1px solid var(--border); }
    .lkb-headthumb { flex-shrink:0; width:38px; height:38px; border-radius:var(--r-sm);
      background:var(--surface-alt) center/cover no-repeat; }
    .lkb-headtext { display:flex; flex-direction:column; gap:1px; flex:1; min-width:0; }
    /* ── Heading panel ──
       A title on artwork is unreadable without something behind it — the same
       problem glass cards solve for content. The panel is built from the block
       text colour so it inherits the cascade and never needs its own control. */
    .lkb-title-bar .lkb-headtext { padding:10px 15px; border-radius:var(--r);
      background:color-mix(in srgb, var(--lkb-head, var(--sf-link-fg, var(--text))) 12%, transparent);
      border:1px solid color-mix(in srgb, var(--lkb-head, var(--sf-link-fg, var(--text))) 20%, transparent);
      -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); }
    /* Heading alignment is independent of the links: a centred title over
       left-aligned buttons is a normal thing to want. */
    .lkb-talign-left .lkb-head { justify-content:flex-start; }
    .lkb-talign-center .lkb-head { justify-content:center; }
    .lkb-talign-right .lkb-head { justify-content:flex-end; }
    .lkb-talign-center .lkb-headtext { text-align:center; align-items:center; }
    .lkb-talign-right .lkb-headtext { text-align:right; align-items:flex-end; }
    /* The collapsible toggle is a full-width row, so its text block stretches
       and the alignment has to come from text-align rather than justify. */
    .lkb-head-btn .lkb-headtext { flex:1; }
    .lkb-title { font-size:17.5px; font-weight:800; color:var(--lkb-head, var(--sf-link-fg, var(--text))); }
    .lkb-sub { font-size:13.5px; line-height:1.5; color:var(--lkb-head, var(--sf-link-fg, var(--text-secondary))); opacity:.82; }
    .lkb-caret { flex-shrink:0; color:var(--text-muted); transition:transform .2s ease; }
    .lkb-caret.open { transform:rotate(180deg); }

    .lkb-items { display:flex; flex-direction:column; gap:9px; }

    /* Shared item shell. Style variants below only change geometry. */
    /* --lkb-shape is the corner radius (Settings → Block shape); the fallback
       keeps the original pill. Border colour derives from the text colour so a
       custom pair stays coherent without a fourth control. */
    .lkb-item { display:flex; flex-direction:column; align-items:stretch; gap:0;
      padding-block:14px; padding-inline:var(--lkb-xpad, 15px);
      border-radius:var(--lkb-shape, var(--sf-link-radius, var(--r-full))); text-decoration:none;
      background:var(--lkb-bg, var(--sf-link-bg, var(--surface)));
      color:var(--lkb-fg, var(--sf-link-fg, var(--text)));
      border:1.5px solid transparent;
      box-shadow:0 0 var(--sf-glow-links, 0px) color-mix(in srgb, var(--accent) 78%, transparent);
      transition:transform .16s cubic-bezier(.34,1.4,.64,1), box-shadow .16s ease, border-color .16s ease; }
    .lkb-item:hover { transform:translateY(-2px);
      box-shadow:0 8px 22px color-mix(in srgb, var(--accent) 22%, transparent),
                 0 0 var(--sf-glow-links-strong, 0px) color-mix(in srgb, var(--accent) 60%, transparent); }
    /* The row. Every style variant reshapes THIS, not .lkb-item — the button
       must stay a full-width sibling underneath in all four. */
    .lkb-main { display:flex; align-items:center; gap:12px; width:100%; min-width:0; }
    .lkb-body { display:flex; flex-direction:column; gap:3px; flex:1; min-width:0; }
    .lkb-label { font-weight:800; font-size:15.5px; line-height:1.3;
      display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden;
      -webkit-line-clamp:2; line-clamp:2; overflow-wrap:anywhere; }
    .lkb-desc { font-size:13px; line-height:1.5; color:var(--lkb-fg, var(--sf-link-fg, var(--text-secondary))); opacity:.75;
      display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden;
      -webkit-line-clamp:3; line-clamp:3; }
    /* Looks like a button, is a span (see the markup note). Border derives from
       the text colour so it stays legible on any custom block fill. */
    /* A call to action is the thing you want clicked, so it gets the weight of
       one: solid fill, full width of the card, real padding. The pill version
       it replaces read as a tag sitting next to the text. */
    .lkb-cta { display:block; width:100%; margin-top:11px; padding:13px 16px;
      border-radius:calc(var(--lkb-shape, var(--sf-link-radius, 999px)) * 0.6);
      font-size:13px; font-weight:800; letter-spacing:.05em; text-transform:uppercase;
      text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      background:var(--lkb-cta-bg, var(--sf-cta-bg,
        color-mix(in srgb, var(--lkb-fg, var(--sf-link-fg, var(--accent))) 88%, black)));
      color:var(--lkb-cta-fg, var(--sf-cta-fg, #fff));
      border:1.5px solid transparent;
      transition:filter .14s ease, transform .14s ease; }
    .lkb-item:hover .lkb-cta { filter:brightness(1.08); }
    /* Classic is a single row — a block-level button would break the line, so
       there it stays inline and compact. */
    .lkb-classic .lkb-cta { padding:10px 14px; font-size:12px; }
    .lkb-aff { font-size:11px; font-weight:800; margin-top:2px; text-transform:uppercase; letter-spacing:.05em;
      color:var(--text-muted); }
    .lkb-thumb { flex-shrink:0; width:var(--lkb-thumb, 54px); height:var(--lkb-thumb, 54px); border-radius:var(--r-sm);
      background:var(--surface-alt) center/cover no-repeat;
      display:inline-flex; align-items:center; justify-content:center; color:var(--text-muted); }
    /* Same triple bloom as .sf-social, off the same --sf-icon-glow slider, so
       every icon on the page responds to one control. */
    .lkb-arrow, .lkb-item .lkb-icon { flex-shrink:0; opacity:.75;
      filter:
        drop-shadow(0 0 calc(var(--sf-icon-glow, 0px) * 0.3) color-mix(in srgb, var(--accent) 90%, transparent))
        drop-shadow(0 0 var(--sf-icon-glow, 0px) color-mix(in srgb, var(--accent) 55%, transparent))
        drop-shadow(0 0 calc(var(--sf-icon-glow, 0px) * 2.2) color-mix(in srgb, var(--accent) 38%, transparent));
      transition:filter .18s ease, opacity .14s ease; }
    .lkb-item:hover .lkb-arrow { opacity:1; }

    /* ── Classic: compact round thumb, centred label, arrow only ──
       This used to be 'display:none' on the thumb, from back when a link with
       no image still rendered a placeholder square. The thumb is now only
       present when there IS an image, so hiding it discarded real content. */
    .lkb-classic .lkb-thumb { width:calc(var(--lkb-thumb, 54px) * 0.9); height:calc(var(--lkb-thumb, 54px) * 0.9); border-radius:50%; }
    .lkb-classic .lkb-desc { -webkit-line-clamp:1; line-clamp:1; }
    .lkb-classic .lkb-label { -webkit-line-clamp:1; line-clamp:1; }

    /* ── Grid ── */
    .lkb-grid .lkb-items { display:grid; grid-template-columns:repeat(var(--lkb-cols, 2), minmax(0,1fr)); gap:9px; }
    .lkb-grid .lkb-item { text-align:center; padding:14px; border-radius:var(--r-lg); }
    .lkb-grid .lkb-main { flex-direction:column; align-items:stretch; gap:11px; }
    .lkb-grid .lkb-thumb { width:100%; height:104px; border-radius:var(--r); }
    .lkb-grid .lkb-arrow { display:none; }
    .lkb-grid .lkb-desc { -webkit-line-clamp:2; line-clamp:2; }

    /* ── Carousel ──
       Breaks out of the 540px column so the row can actually run edge to edge;
       the padding puts the first card back in line with everything above it.
       scroll-snap gives it the swipe feel without any JS. */
    .lkb-carousel .lkb-items { display:flex; flex-direction:row; gap:9px;
      overflow-x:auto; overscroll-behavior-x:contain; scroll-snap-type:x mandatory;
      scrollbar-width:none; padding:2px 1px 6px; }
    .lkb-carousel .lkb-items::-webkit-scrollbar { display:none; }
    .lkb-carousel .lkb-item { flex:0 0 190px; scroll-snap-align:start; border-radius:var(--r-lg); padding:14px; }
    .lkb-carousel .lkb-main { flex-direction:column; align-items:stretch; gap:11px; }
    .lkb-carousel .lkb-thumb { width:100%; height:112px; border-radius:var(--r); }
    .lkb-carousel .lkb-arrow { display:none; }

    /* ── Cards ── */
    .lkb-cards .lkb-item { padding:16px; border-radius:var(--r-lg); }
    .lkb-cards .lkb-main { align-items:flex-start; }
    .lkb-cards .lkb-thumb { width:var(--lkb-thumb, 54px); height:var(--lkb-thumb, 54px); border-radius:var(--r); }
    .lkb-cards .lkb-label { white-space:normal; }

    /* ── Size ── */
    .lkb-size-small { --lkb-thumb:46px; }
    .lkb-size-small .lkb-item { padding:11px 13px; }
    .lkb-size-small .lkb-label { font-size:14.5px; }
    .lkb-size-large { --lkb-thumb:64px; }
    .lkb-size-large .lkb-item { padding:16px 17px; }
    .lkb-size-large .lkb-label { font-size:16.5px; }

    /* ── Alignment. Classic centres its label by default; the other styles are
       left-aligned unless told otherwise. ── */
    .lkb-align-left .lkb-main { justify-content:flex-start; }
    .lkb-align-left .lkb-body { text-align:left; align-items:flex-start; }
    .lkb-align-center .lkb-body { text-align:center; align-items:center; }
    .lkb-align-right .lkb-body { text-align:right; align-items:flex-end; }

    /* ── No image → centre on the row ──
       Left-aligned text with nothing to its left reads as a mistake: the row
       has an image slot's worth of empty space and the label floats in it.
       Centring only kicks in for the DEFAULT (left) alignment — the selector is
       .lkb-align-left .lkb-noimg (0,3,0), which beats .lkb-align-left .lkb-body
       (0,2,0) but leaves an explicit Centre or Right choice untouched. A blanket
       .lkb-noimg rule would have silently disabled the alignment control for
       every imageless link, which is the bug pattern in LANDMINES §13. */
    .lkb-align-left .lkb-noimg .lkb-body { text-align:center; align-items:center; }
    .lkb-align-left .lkb-noimg .lkb-main { justify-content:center; }
    /* The arrow is taken out of flow so "centred" means centred against the
       card's outline, not against the space left over beside the arrow. */
    .lkb-noimg .lkb-main { position:relative; }
    .lkb-noimg .lkb-arrow { position:absolute; right:0; top:50%; transform:translateY(-50%); }
    .lkb-noimg .lkb-body { padding-inline:22px; }

    /* ── Outline / shadow ── */
    /* Both default OFF. The base border is transparent in the rule that
       declares it (above) — an override here would have equal specificity and
       beat any block-level colour, which is exactly what it used to do. */
    .lkb-outline .lkb-item { border-color:var(--lkb-fg, var(--sf-link-border, var(--border-strong))); }
    /* Shadow ADDS to the glow. Replacing box-shadow outright meant switching
       Shadow on silently switched the glow off. */
    .lkb-shadow .lkb-item { box-shadow:0 4px 14px rgba(20,18,12,.10),
      0 0 var(--sf-glow-links, 0px) color-mix(in srgb, var(--accent) 78%, transparent); }

    /* Featured reads as promoted without needing its own layout. */
    .lkb-item.featured { border-color:var(--accent); }

    @media (prefers-reduced-motion: reduce) {
      .lkb-item, .lkb-caret { transition:none; }
      .lkb-item:hover { transform:none; }
    }
  `}</style>;
}
