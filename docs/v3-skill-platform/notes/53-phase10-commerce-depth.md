# 53 — v3 Build: Phase 10 (Commerce Depth: Discounts, Refunds, Receipts)

**Date:** 2026-06-23

## Overview

Built **Phase 10 — commerce depth**: percentage promo codes, creator-initiated
refunds, and purchase receipt emails. Stripe **Tax deferred** (needs tax
registration config). `vite build` + eslint + `node --check` clean.

## What changed

### Discounts / promo codes
- **`migrations/009_commerce.sql`** (new — ⚠️ run after 001–008): `discounts`
  (creator_id, code, percent_off, active, max_redemptions, times_redeemed;
  case-insensitive unique per creator; owner-only RLS) + `purchases.discount_code`.
- **`backend/routes/checkout.js`**: `priceWithDiscount()` helper (validates code,
  enforces active + redemption cap, returns discounted cents); the one-time intent
  now accepts `body.code`, charges the discounted amount (+ proportional app fee),
  carries `code` in PI metadata. New `POST /:skillId/validate-code` for live
  preview. Redemption is counted in the webhook on success (not at intent, so
  abandoned checkouts don't burn redemptions). **Codes are one-time only**
  (memberships ignore them).
- **`lib/discounts.js`** (new): creator CRUD. **`components/DiscountsPanel.jsx`**
  (Dashboard): create/toggle/delete codes + usage counts.
- **`Checkout.jsx`** reworked into **two phases**: summary + promo input
  (apply → live discounted total) → "Continue to payment" → Payment Element with
  the discounted "Pay $X". Free/membership skip the promo step.

### Refunds
- **`backend/routes/checkout.js`** `POST /refund` { purchaseId }: creator-only;
  refunds the one-time PaymentIntent, sets `purchases.status='refunded'` (RLS then
  removes buyer access since gating keys on `paid`), notifies the buyer.
  Memberships are rejected (cancel via subscription, not refund).
- **`Dashboard.jsx`**: a **Refund** button per sale in the buyer table.

### Receipts
- **`backend/routes/webhooks.js`** skill branch now emails the buyer a receipt
  (skill title + amount + locker link) best-effort via Resend on success.

## Decisions / deferred
- **Stripe Tax: deferred.** `automatic_tax` needs a Stripe tax registration +
  buyer address collection — config-gated, not just code. Noted for Phase 12.
- Receipts + refund-notify require `RESEND_API_KEY` to actually send (refund
  itself works regardless; only the email is best-effort).

## Action required (Devan)
- Run **`migrations/009_commerce.sql`** (now 9 migrations: 001–009).

## Not verified
- Build/lint/syntax only. Discount math, redemption counting, refund→access-loss,
  and receipt email need the live Stripe + Resend test pass (still pending).

## Next
Phase 11 — pixels / AutoDM / affiliate program. Then 12 (SEO / integrations /
admin + Stripe Tax + email unsubscribe). Or the payment-loop verification with
Stripe test keys (now even more worth doing — discounts/refunds add surface).
See doc 08.
