# 08 — Stan-Parity Roadmap (post-MVP)

> **Decision (2026-06-22):** v3 scope is officially expanded from the MVP to
> **full stan.store parity + differentiators**. Pricing model stays
> **transaction-fee (~5% per sale)** — no creator-facing subscription billing to
> build; the platform earns via the Stripe `application_fee` on every sale,
> including recurring memberships. Supersedes the "Explicitly OUT" list in
> [doc 02](02-scope-in-and-out.md) for everything below (that list was the MVP
> boundary, now lifted).

MVP build (Phases 0–5) is complete: storefront, Skills (downloads/courses/
coaching-link), one-time checkout + delivery, versioning, community, dashboard +
analytics + transparent payouts. These phases close the remaining Stan gaps.

## Phase 6 — Memberships (recurring) ⭐ next
Stripe **Subscriptions** for `pricing_type='membership'`, with our app fee.
- `skills.stripe_price_id`; `purchases` gains `stripe_subscription_id`,
  `current_period_end`, and an `expired` status.
- Checkout branches: membership → hosted **Stripe Checkout Session**
  (mode `subscription`, `application_fee_percent` + destination); one-time stays
  the embedded Payment Element.
- Webhooks: `checkout.session.completed` (grant) + `customer.subscription.*`
  (keep access in sync; revoke on cancel/past_due).
- Access gating already keys off a `paid` purchase row → set `paid` while active,
  `expired` when the sub ends.

## Phase 7 — Storefront editor: design control ⭐ differentiator
Stan's #1 weakness is limited customization. Use `storefront_theme` (unused).
- Theme: accent color, font pair, layout (list vs grid), cover/banner, social
  links, custom bio.
- A "links" block type / standalone link items (external + affiliate links) on
  the storefront.
- Reorder + show/hide Skills; featured Skill.

## Phase 8 — Native booking
Replace coaching-link-only with a real booking system.
- `availability` (creator weekly rules), `bookings` table, time-slot picker,
  reminders (email), cancellation/reschedule. Optional Google Calendar sync.

## Phase 9 — Email capture + marketing
- Lead-magnet email capture on storefront; `subscribers` table.
- Broadcasts + basic lifecycle automation (post-purchase, abandoned-checkout).
  (Use a provider — Resend/Postmark — building on existing `lib/email`.)

## Phase 10 — Commerce depth
- Discounts/promo codes, order bumps.
- Receipts (buyer email), refunds UI (creator-initiated), Stripe Tax.

## Phase 11 — Growth/automation (higher-tier parity)
- Pixel tracking (Meta/TikTok/GA) per storefront.
- AutoDM / social automation hooks. Affiliate program.

## Phase 12 — Differentiators & polish
- Better SEO (SSR or prerender for storefronts/sales pages — revisit the
  Next.js question from [doc 03](03-architecture-and-data-model.md)).
- Integrations (Zapier/webhooks out), admin/support tooling, physical-product
  option, richer analytics + attribution.

## Sequencing rationale
6 → 7 first: memberships + design control are the highest-leverage parity gaps
and reuse existing infra. 8–11 are larger standalone systems. 12 is the
"win against Stan" layer (design, analytics, SEO, integrations) called out in
the competitive analysis. Each phase ships independently.
