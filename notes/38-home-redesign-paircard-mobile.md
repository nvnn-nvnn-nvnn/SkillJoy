# 38 — Home Page Redesign + PairCard Fix + Mobile

**Date:** 2026-05-01

## What changed
Full redesign of the landing page and PairCard component to be production-quality.

### Home.jsx
- Hero: glassmorphism eyebrow pill (blinking dot), larger title, two CTAs (primary + ghost), color blobs for depth
- Stats bar docked to bottom of hero: 2400+ students, 180+ skills, 94% satisfaction, 30+ universities
- "How it works" — 3-column grid with connecting hairline rule between steps
- New Features section — 2×2 card grid (AI matching, Verified students, Messaging, Gig marketplace)
- Footer CTA — full-width dark section for contrast
- AI branding: eyebrow says "AI-powered skill exchange", step 02 renamed "AI finds your match", AI feature card gets black "AI" badge pill
- Mobile breakpoints: ≤900px (2-col pairs), ≤640px (single col, full-width CTAs, stacked stats 2×2), ≤380px (smallest screens)

### PairCard.jsx
- Redesigned from squished horizontal layout to vertical card
- Person A → exchange icon (custom SVG double-arrow in circle badge) → Person B
- Avatars styled with brand tokens (primary-light for A, accent-light for B)
