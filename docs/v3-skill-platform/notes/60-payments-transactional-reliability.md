# 60 — Payments & transactional reliability (audit + go-live checklist)

Audited the money path end-to-end (2026-06-30). **Verdict: the architecture is
correct and reliable.** What remains for "everything works" is mostly *configuration
+ testing*, plus one real code race to harden.

## What's already correct ✅
- **Webhook is the source of truth.** Mounted **before** `express.json()`
  (`backend/index.js:44`) so the raw body survives; `constructEvent` verifies the
  Stripe signature (`webhooks.js:21`). Client never inserts paid purchases.
- **Idempotency.** Fulfillment update is guarded `.neq('status','paid')` →
  webhook retries / double-sends can't double-grant (`webhooks.js:43`).
- **Checkout guards.** Published-only, not-your-own, already-owned (409), creator
  must be `stripe_onboarded`; pending purchase upserted one-per-`(buyer,skill)`
  (`checkout.js`). Destination charge + `application_fee_amount` (5%).
- **Paywall enforced server-side.** `skill-files` bucket is **private**
  (mig 002, `public=false`, owner-only RLS). Download endpoint mints a **60s** signed
  URL only after verifying a `status='paid'` purchase (or creator) (`locker.js`).
- **Membership lifecycle.** `checkout.session.completed` grants;
  `customer.subscription.updated/deleted` flips access on/off (paid ↔ expired).
- **Refund.** Creator-only, refunds the PI, sets `refunded` (→ access revoked since
  the gate checks `paid`), notifies buyer (`checkout.js:182`).
- **Fees consistent.** `SKILL_PLATFORM_FEE_BPS = 500` (5%) one-time + membership;
  backend `fees.js` mirrors `src/lib/config.js`.

## ⚠️ Real risk to harden — confirm/webhook side-effect race
`/checkout/:id/confirm` is a fast fallback that sets `status='paid'`. If it wins the
race vs the webhook, the webhook's `.neq('status','paid')` update then returns 0 rows,
so everything inside that block is **skipped**: creator sale notification, buyer
receipt email, **promo-code redemption count**, and the outbound automation webhook.
Net: buyer gets access (good) but the sale's side-effects are silently lost.
- **Fix options:** (a) add a `purchases.fulfilled_at` flag; run side-effects once
  guarded by `fulfilled_at IS NULL` independent of the paid transition; or (b) drop
  `/confirm` and rely on the webhook (simplest if webhooks are reliably configured),
  showing the buyer a "processing…" state until the row flips to paid.
- Lower urgency if webhooks are configured + fast; still worth fixing before scale.

## Go-live configuration checklist 🔧
**Backend env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`,
`SUPABASE_SERVICE_KEY` (service role — RLS-bypassing, keep server-only),
`FRONTEND_URL`, `ADMIN_EMAIL`, email provider creds.
**Frontend env:** `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_API_URL` (apiFetch base),
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
**Stripe Dashboard:**
- [ ] Register webhook → `https://<api-host>/webhooks/stripe`; copy signing secret
      into `STRIPE_WEBHOOK_SECRET`.
- [ ] Enable events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
      `payment_intent.canceled`, `checkout.session.completed`,
      `customer.subscription.updated`, `customer.subscription.deleted`,
      `charge.dispute.created`, `charge.dispute.closed`.
- [ ] **Connect** enabled (Express) — creators onboard via `/api/stripe-connect`.
- [ ] (Optional) Apple/Google Pay domain verification for wallet buttons on web.
**Supabase:**
- [ ] Buckets exist + private/public correct (mig 002). `ADMIN_EMAIL` matches a
      profile row (chargeback notifications look it up).

## Test plan (Stripe test mode)
- [ ] `stripe listen --forward-to localhost:<port>/webhooks/stripe` (gives a temp
      signing secret for local).
- [ ] One-time buy with card `4242 4242 4242 4242` → purchase flips `paid`, file
      download works, receipt + creator notification fire, locker shows it.
- [ ] Promo code → discounted amount charged + `times_redeemed` increments.
- [ ] Membership → subscription active grants; cancel in Stripe → access revoked.
- [ ] Refund from dashboard → status `refunded`, download 403s afterward.
- [ ] Buy-your-own / already-owned / unpublished → correct 4xx.
- [ ] Creator without payouts → checkout blocked (402).

## Smaller hardening (optional)
- `subscription.updated` flips access off on **any** non-active status incl.
  `past_due` — consider a short grace window before revoking.
- Receipt/notification emails are best-effort (won't block fulfillment) — fine, but
  add retry/logging if deliverability matters.
- Consider storing `stripe_payment_id` on the pending row at intent time (already
  done) so reconciliation is easy.

## Next actions
1. Decide on the confirm/webhook race fix (recommend option (a): `fulfilled_at`).
2. Run the config checklist + test plan in Stripe **test mode** before flipping live keys.
