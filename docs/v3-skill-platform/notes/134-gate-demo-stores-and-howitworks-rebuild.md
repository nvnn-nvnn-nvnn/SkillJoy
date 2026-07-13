# 134 — Gate demo stores + How It Works rebuild

Date: 2026-07-13

## 1. Demo storefronts gated off (not browsable yet)
- `src/lib/demoStores.js`: added `DEMO_STORES_ENABLED = false` master switch. `getDemoStore()` returns `null` while false, so demo handles fall through to the normal Supabase lookup (→ not found). Flip to `true` to make them browsable.
- `src/introduction-pages/Home.jsx`: testimonial cards reverted from `<Link>` back to plain `<figure>` (no navigation, no "Visit store" affordance). Removed the link/hover CSS; **kept** the `.lp-stats` social-proof strip and the rewritten testimonials.

## 2. How It Works page rebuilt (`src/introduction-pages/HowItWorks.jsx`)
Was bare inline styles with hardcoded `#fff` (broke in dark mode). Now matches the landing page design system:
- Centered header: `sj-pill` + accent headline + sub.
- **Step timeline**: accent numbered badges connected by a vertical rail line (`.hiw-step-rail::after`, hidden on `:last-child`), each step a card with emoji + kicker + title + desc, hover lift.
- Payments callout → `surface-alt` card with lock icon.
- Soft accent-gradient CTA block; removed the hacky inline `#fff` override on the About button.
- Added scroll-reveal (IntersectionObserver, same as landing), all theme-aware tokens, responsive collapse at 560px.

## Files
- `src/lib/demoStores.js`
- `src/introduction-pages/Home.jsx`
- `src/introduction-pages/HowItWorks.jsx`

## Related
- Continues note 133 (social proof + demo stores).
