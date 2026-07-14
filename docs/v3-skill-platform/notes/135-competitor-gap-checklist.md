# 135 — Competitor gap analysis → roadmap checklist

Date: 2026-07-13

## What this is
Compared SkillJoy's current feature set against **Stan Store, Beacons, and Sellfy** and added
the gaps as a new **Phase 6 — Competitor parity gaps** section in
`108-production-roadmap-and-audit.md` (the running roadmap checklist).

## Method
Grounded in the actual code, not memory. Verified current capabilities before calling anything a gap:
- `src/app-pages/Checkout.jsx` — uses Stripe `PaymentElement` (so Apple/Google Pay wallets already
  work) + **order bumps** (`order_bump_skill_id`, bump total) + discount codes + guest checkout.
- `src/lib/subscribers.js` — email capture, subscriber list, `sendBroadcast` (one-shot only; **no**
  automation/sequences/cart recovery).
- Product types, reviews, pixels, embeds, analytics, payouts all already present.
- Customization (bg video / overlays / audio / cursor+name FX) confirmed in `Storefront.jsx` — the edge.

## Gaps recorded (see note 108 Phase 6 for detail)
- **High-leverage:** automated email + abandoned-cart, custom domain, bundles + post-purchase upsells.
- **Worth doing:** affiliate/referral, AI assist, SMS + audience CRM, tip jar, mobile app + sale push,
  migration/import, IG auto-DM, webinar + drip-scheduled lessons.
- **Deliberate non-goals:** print-on-demand / physical (Sellfy), media kit + brand-deals (Beacons) —
  different businesses; skip unless pivoting.

## Files
- `docs/v3-skill-platform/notes/108-production-roadmap-and-audit.md` (added Phase 6 section)
