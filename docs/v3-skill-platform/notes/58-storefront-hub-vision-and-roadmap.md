# 58 — Storefront hub: product vision + post-implementation roadmap

The north star: SkillJoy should feel like a **mini business hub** for creators, not
a link list. Below is the product brief (what a Stan-class storefront needs) and the
ordered steps to get there from where the code is today.

## This session (done)
- **De-campus pass** (note 57): Profile, Onboarding, Settings, About, HowItWorks
  pivoted off swap/gig/college to the creator-storefront framing.
- **Profile trimmed**: removed About/Expertise/Availability sections (campus
  residue) — Profile is now an account hub (identity, payouts, storefront link,
  reviews). DB columns kept; bio still set in onboarding + shown on storefront.
- **Services dashboard** (notes 56): real data (skills + sales), product `kind`
  migration (011), and a **mobile-first responsive pass** (auto-fit stats,
  wrapping header/card actions, scroll-safe tabs, `min(100%, …)` card grid).

## Product brief — what the storefront needs

### Core must-haves
- **Mobile-first storefront.** Most traffic is social → must look/feel great on a
  phone, fast load, simple path to buy.
- **Digital product sales.** Ebooks, templates, downloads, courses, subscriptions,
  lead magnets — multiple ways to monetize.
- **Simple checkout.** Buy buttons, payment processing, discount codes, payment
  plans, frictionless payment methods.
- **Brand control.** Custom domain, colors, layout, white-label feel.
- **Analytics.** Where clicks/sales come from; product- and funnel-level perf.

### Trust & operations
- **Reliable payouts** — fast, predictable, clear fee disclosure.
- **Transparent fees** — show processor cost + total take rate even at "0% platform fee."
- **Support & policy clarity** — refunds, delivery problems, account/payout disputes.
- **Secure delivery** — instant file delivery, download protection, access mgmt.

### Growth
- **Lead capture** — email collection + free lead magnets.
- **Funnels & upsells** — order bumps, upsells, limited-time offers.
- **Affiliate tools** — let others promote products.
- **Social integrations** — auto-DM, pixel tracking, share flows.

### What wins users
Fast setup · professional presentation · one place to manage everything ·
a sharper edge than Stan on usability / trust / creator economics.

### MVP scope (target)
1. Beautiful mobile storefront
2. Product checkout + instant delivery
3. Basic analytics + conversion tracking
4. Custom branding + domains
5. Transparent payouts + support flows

## Roadmap — ordered next steps (with current state)

1. **Mobile storefront polish** — audit `Storefront.jsx` + `SkillPublic.jsx` on a
   phone; ensure fast, single-column, sticky buy button. (storefront exists; needs
   a mobile-first pass like the services dashboard got.)
2. **Checkout depth** — payment plans + order bumps on top of existing one-tap
   Stripe checkout + discount codes (`discounts.js` exists). Add upsell slots.
3. **Instant delivery + protection** — verify signed download URLs
   (`getBlockDownloadUrl`) expire; add per-buyer access checks + download limits.
4. **Analytics + funnels** — wire real `views`/conversion into the services
   dashboard (currently "—"); per-product funnel view. Source: `analytics.js`,
   `AnalyticsCards`, `pixels.js`.
5. **Brand control** — extend `StorefrontEditor` with theme (colors/layout) +
   **custom domain** support (DB + DNS/verify flow). `storefront_theme` JSONB exists.
6. **Lead magnets** — finish the `lead` product kind: free price + email capture
   via `subscribers.js`/`SubscribeForm`. Flip `built: true` in PRODUCT_TYPES.
7. **Payout + fee transparency** — surface take-rate breakdown at checkout and in
   `PayoutStatus`; clear payout timeline. (`payouts.js`, `SKILL_PLATFORM_FEE_BPS`.)
8. **Support/policy flows** — refund request UI, delivery-issue reporting, payout
   dispute path (refund exists server-side via `refundPurchase`).
9. **Courses + memberships** — real builders + gated access (the remaining
   `kind`s after digital/coaching). Course = modules/lessons/progress.
10. **Affiliate tools** — referral links + payout split (new schema + dashboard).

## Open question to confirm with Devv
- "The dashboard is fucked up / not responsive" — fixed the **/services** dashboard
  this pass. If the complaint is the **/dashboard** (revenue/payouts/buyers) page,
  its buyers table + dense grid still need a mobile pass (next).
