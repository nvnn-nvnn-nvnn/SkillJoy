# 145 — Editorial landing redesign (parallel file, not swapped)

Date: 2026-07-13

## What this is
A from-scratch, restrained/editorial take on the marketing landing page, built from an engineered
"premium studio, no vibe-coding" prompt. Lives at `src/introduction-pages/LandingRedesign.jsx` as a
**parallel file** — the current `Home.jsx` stays live. To swap:
`main.jsx` → `import LandingPage from './introduction-pages/LandingRedesign'`. Classes are prefixed
`lx-` so the two pages can't collide.

## Design decisions (the teaching part)
1. **One expressive object.** The product is maximalist (glow, video bgs, effects), so the marketing
   page is deliberately quiet — the ONLY place personality shows is the phone mockup. Contrast sells
   the customization story better than decorating the page with it.
2. **Honest social proof.** The trust strip is product truths (Stripe, Apple/Google Pay, instant
   delivery, keep 95%) — verifiable claims, not invented user counts. Testimonials omitted entirely:
   ours are placeholders, and "quiet but fake" is still fake.
3. **Token-pure inverted band.** The customization section uses `background: var(--text);
   color: var(--bg)` — no hardcoded dark hex. In light mode it's a near-black band; in dark mode it
   inverts to light. One rule, both themes correct, and secondary text derives via
   `color-mix(in srgb, var(--bg) 74%, transparent)`.
4. **Hairline grid instead of cards.** The sell-anything grid is `border-top + border-left` on the
   container and `border-right + border-bottom` on cells — a classic single-hairline table (no
   doubled borders), all type, no icons. Steps are top-rule editorial columns with accent numerals.
5. **What was removed vs Home.jsx:** glass CTA block, gradient washes, fabricated 5,000+/$1.2M
   stats, emoji feature icons, testimonial cards. What was kept: `.sj-pill`, `.btn` classes, the
   reveal pattern, the phone mockup concept, the routing/`LEGACY_MODE` redirect.

## Files
- `src/introduction-pages/LandingRedesign.jsx` (new, not routed)
- Prompt engineering: this page was generated from a filled-in brief (stack conventions, brand
  inputs, the restraint-vs-maximalism resolution, button-reset landmine, honesty guardrails).

## Status
Built clean. Not swapped into routing — Devv decides which page wins after comparing.
