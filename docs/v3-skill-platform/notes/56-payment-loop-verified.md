# 56 — Payment Loop Verified End-to-End (Stripe test mode)

**Date:** 2026-07-08

## Overview

Drove the full v3 payment loop live against Stripe **test mode** with real
webhook delivery (Stripe CLI forwarding). **All four money paths pass.** This
closes the biggest standing risk (phases 3/6/10 had never run live).

## Setup
- Stripe CLI: `stripe listen --api-key <sk_test> --forward-to localhost:3001/webhooks/stripe`.
- Backend booted with the CLI's signing secret inline
  (`STRIPE_WEBHOOK_SECRET=whsec_… node index.js`) so local webhook signatures verify.
- Test buyer created via Supabase admin API (+ a seeded `profiles` row, since
  `purchases.buyer_id` FKs to profiles).
- Card entry done programmatically: create the PaymentIntent through our real
  endpoint, then confirm it via the Stripe API with `pm_card_visa` (the card
  *widget* is Stripe's component, not our code; this exercises our full
  charge→webhook→fulfilment path deterministically). Membership used the real
  hosted Checkout page driven by Playwright.

## Results

### ✅ One-time purchase
Our `/api/checkout/:id/intent` → destination charge → **`payment_intent.succeeded`
webhook** → backend "Skill purchase fulfilled" → `purchases.status = paid ($15)`
→ creator got "New sale! 🎉".

### ✅ Discount code
Intent with `TEST50` returned **amountCents 1250** (50% off $25) → confirmed →
`purchases.status = paid $12.50, discount_code = TEST50` → `discounts.times_redeemed`
incremented to 1 (via webhook).

### ✅ Membership (recurring)
Hosted subscription Checkout completed → **`checkout.session.completed` +
`customer.subscription.created`** → backend "🔁 Membership started" →
`purchases.status = paid`, `stripe_subscription_id` set.

### ✅ Refund
Controlled seller (throwaway account reusing a valid connected account) → buyer
bought a $10 Skill (paid via webhook) → seller called `/api/checkout/refund` →
**Stripe refund succeeded $10** → `purchases.status = refunded` (revokes access
via RLS) → buyer notified "Refund issued".

### ✅ Stale-account guard (from note 55 audit)
davidzhang's connected account (`acct_1TqmPe…`) confirmed valid under the current
key (charges + payouts enabled). Not-onboarded/stale sellers are rejected cleanly.

## Findings
- ⚠️ **Receipt emails fail in Resend sandbox** — "You can only send testing emails
  to your own email address." Best-effort/caught (doesn't block fulfilment). For
  real buyer receipts, **verify a domain in Resend** and set `RESEND_FROM`.
- ⚠️ **Local webhooks need the CLI's secret.** Running the backend from `.env`
  (deployed `STRIPE_WEBHOOK_SECRET`) will fail signature verification for
  CLI-forwarded events. For local testing: keep `stripe listen` running and boot
  the backend with the secret it prints. The `/confirm` fallbacks also fulfil if
  the webhook is unavailable.
- Playwright can't reliably drive Stripe's embedded Payment Element (nested
  iframe accordion) — used API confirm instead. Hosted Checkout worked once Link
  "save my info" was unchecked (it was forcing a required phone field).

## Test artifacts — CLEANED UP (2026-07-08)
All test data removed after verification: cancelled the test Stripe subscription;
deleted the two test users (`buyer+1783485596@`, `seller2+1783487100@`) + profiles,
"Refund Test Skill", the `TEST50` discount, and all their `purchases` /
`analytics_events`. Verified 0 test profiles + no TEST50 remaining. (Note:
`profiles`/`auth` deletes needed dependents cleared first — `analytics_events.buyer_id`
is ON DELETE RESTRICT, so those rows had to go before the profile/auth user.)

## Onboarding cleanup — already done
The "legacy teach/learn steps" flagged earlier were already removed by the owner:
onboarding is now a lean 2-step flow (name + username + bio, then optional
availability). No action needed.

## Verdict
**PASS** — one-time, discount, membership, and refund all work end-to-end with
real Stripe test charges + webhook fulfilment. The payment system is proven, and
the test data has been cleaned out.
