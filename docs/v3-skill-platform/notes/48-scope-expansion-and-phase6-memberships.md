# 48 — Scope Expansion (full Stan parity) + Phase 6 (Memberships)

**Date:** 2026-06-22

## Scope decision

The owner confirmed via AskUserQuestion: **expand v3 from the MVP to full
stan.store parity + differentiators**, and **keep the transaction-fee pricing
model** (~5% per sale; no creator-facing subscription billing — the platform
earns via the Stripe `application_fee`, including on recurring memberships).

This lifts the "Explicitly OUT" list in doc 02 for: memberships, native booking,
email capture/marketing, affiliates/discounts, AutoDM/pixels, storefront
theming, receipts/refunds/tax, admin/support, SEO. New roadmap captured in
**`docs/v3-skill-platform/08-parity-roadmap.md`** (Phases 6–12).

Parity gap map (what was already built vs. not) is in
[note 46](46-phase4-versioning-community.md) and doc 08.

## Phase 6 — Memberships (recurring) — DONE

Membership Skills (`pricing_type='membership'`) now sell as **Stripe
Subscriptions** with our app fee. `vite build` + eslint + `node --check` pass.

- **`migrations/005_memberships.sql`** (new — ⚠️ run in Supabase after 001–004):
  `skills.stripe_price_id`; `purchases.stripe_subscription_id` +
  `current_period_end`; widened `purchases.status` CHECK to add `expired`.
- **`backend/routes/checkout.js`**: membership branch — ensures a recurring
  Stripe Price (creates Product+Price, caches `stripe_price_id`), creates a
  **hosted Checkout Session** (`mode:'subscription'`,
  `application_fee_percent` = fee bps/100, `transfer_data.destination` = creator),
  upserts a pending purchase, returns `{ membership:true, url }`. One-time path
  unchanged (embedded Payment Element).
- **`backend/routes/webhooks.js`**: `checkout.session.completed` (subscription +
  `kind='skill_sub'`) → grant access (status `paid`, store subscription id) +
  notify creator; `customer.subscription.updated/deleted` → keep access in sync
  (active/trialing → `paid`, else `expired`; store `current_period_end`).
- **`Checkout.jsx`**: `{membership}` → redirect to hosted Stripe checkout.
- **`Locker.jsx`** (`SkillConsume`): when returning with `?sub=success`, retries
  the access check ~5×/1.5s so the webhook grant isn't a race.

### Notes / decisions
- Memberships use **hosted Stripe Checkout** (redirect), not the embedded Payment
  Element — much simpler/robust for subscriptions + still gets Apple/Google Pay.
- Access gating is unchanged in spirit: a `paid` purchase row = access. Cancelled
  subs flip to `expired` and drop out of the Locker list.
- Expired-membership "renew" CTA in the Locker is **not** built yet (minor).

## Action required (owner)
- Run **`migrations/005_memberships.sql`** (after 001–004 → now 5 migrations).
- Stripe webhook must subscribe to `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted` (plus the
  existing `payment_intent.*`).
- Still unverified end-to-end with test keys (one-time AND subscription).

## Next
Phase 7 — storefront editor / design control (theme, branding, social + external/
affiliate link blocks, Skill reorder). The #1 Stan weakness and our headline
differentiator. See doc 08.
