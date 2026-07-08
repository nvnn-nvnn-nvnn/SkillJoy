# 58 — Pre-launch Audit + Verification

**Date:** 2026-07-08

Focused audit of the money path + access control + the 500-hardening change,
then a live verification pass (Stripe test mode). Ran before flipping Stripe to
live.

## Audited
`checkout.js`, `guest.js`, `guestFulfillment.js`, `webhooks.js` (one-time /
membership / guest / order-bump), `locker.js` (gated download), route mounting +
rate limits (`index.js`), and the 500-hardening sed change.

## Findings & fixes

### 🐛 Guest fulfilment not race-safe — FIXED
`fulfillGuestPurchase` read `status==='paid'` then upserted, so the webhook and
`/confirm` racing could both pass → **double receipt email, double sale
notification, double discount redemption**. Replaced with an atomic once-only
grant: flip any non-paid row to paid (`.neq('status','paid').select()`), else
insert; a duplicate insert means another call won → return before side-effects.
Also handles a returning buyer who previously refunded (update path re-grants).

### 🐛 Membership grant not idempotent — FIXED
`checkout.session.completed` updated to paid with no guard → duplicate
notify/subscribe/receipt on Stripe redelivery. Added `.neq('status','paid')
.select()` and gated side-effects on the first grant only.

### 🔒 `/api/public` unsub had no strict rate limit — FIXED
Added `strictLimiter` (was token-guarded + global limit only).

### ✅ No issues found
- Access gate (`locker.js`): mints signed URL only after verifying a `paid`
  purchase or creator. Solid.
- Rate limits: `/api/checkout`, `/api/guest`, `/api/marketing`, `/api/payments`
  all strict-limited; guest is intentionally auth-free (account created at
  fulfilment, after payment).
- Authed one-time path was already idempotent (`.neq('status','paid')` +
  side-effects gated on affected rows).
- 500-hardening: all `serverError` calls are `return serverError(...)` or the
  terminal statement of a catch — no double-send regressions. `node --check`
  clean across all routes.

## Verification (live, Stripe test mode)
- **One-time (authed):** fresh buyer → intent → real charge → webhook → purchase
  **paid $15**, creator got **exactly +1** sale notification. (Regression check
  for the 500-hardening — checkout still works.)
- **Guest idempotency:** forced the webhook AND `/confirm` to race → guest account
  created, **exactly 1** paid purchase, creator got **exactly +1** notification
  (the bug would have produced 2). Fix confirmed.
- Test data cleaned up afterward.

## Verdict
**PASS.** Money path + access control audited; three concurrency/robustness
issues fixed and the fixes verified live. Safe to flip Stripe to live (remember:
live `STRIPE_SECRET_KEY` + register the live webhook endpoint + set its
`STRIPE_WEBHOOK_SECRET`; redeploy backend for the audit fixes + 500-hardening).
