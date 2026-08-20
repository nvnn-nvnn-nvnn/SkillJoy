# 152 — The fulfilment race: /confirm silently ate every side effect

Date: 2026-08-20

## The bug
Logged-in buyers got their product but **no receipt email, no creator "New sale!"
notification, no promo-code redemption count, and no Zapier/Make automation.** Guest buyers
were fine. It had been shipping this way; the sale itself worked, which is exactly why it
looked healthy end-to-end.

## Why
Two callers race to fulfil every sale:

1. `POST /api/webhooks/stripe` — Stripe's `payment_intent.succeeded`
2. `POST /api/checkout/:id/confirm` — fired by `Checkout.jsx` the moment
   `stripe.confirmPayment()` resolves

`/confirm` almost always **wins**, by seconds. And `/confirm` only did this:

```js
.update({ status: 'paid' }).eq(...).neq('status', 'paid')
```

Status flipped, nothing else. Then the webhook arrived and ran its idempotency guard —
`.neq('status', 'paid')` — which now matched **0 rows**, so it fell into the
`!paid.length` branch, logged `⚠️ already paid or pending row missing`, and skipped the
entire side-effect block. Both halves ran; neither did the work.

**Root cause: one column doing two jobs.** `status` meant both "buyer has access" *and*
"fulfilment has run". Both callers write it, so it cannot also arbitrate between them.

## The fix
Split the two meanings.

- New `purchases.fulfilled_at TIMESTAMPTZ` — the exactly-once claim token, written by
  nothing except fulfilment.
- New `backend/lib/skillFulfillment.js` exporting `fulfillSkillPurchase(pi)`, holding the
  grant *and* all side effects, mirroring the guest module's shape.
- Both `/confirm` and the webhook now call **the same function**. Whoever wins does the
  complete job; the loser no-ops.

The claim is one statement:

```js
.update({ status:'paid', stripe_payment_id: pi.id, fulfilled_at: new Date().toISOString() })
.eq('buyer_id', buyerId).eq('skill_id', skillId)
.is('fulfilled_at', null)          // ← the claim
.select('id')
```

Postgres serialises this per row under READ COMMITTED: the second caller blocks, re-evaluates
`fulfilled_at IS NULL` after the first commits, no longer matches, and gets 0 rows. Exactly
once, no advisory locks, no dedupe table.

A missed claim is *not* silently swallowed — `explainMissedClaim()` distinguishes "already
fulfilled" (expected, logs `↩️`) from "no purchase row at all" (a real fault, logs `⚠️`).
That distinction is what the old code collapsed into a single ambiguous warning.

## ⚠️ Deploy order
`fulfilled_at` **must exist before the new code runs** or every fulfilment throws. Apply the
`ALTER TABLE` in `supabase/schema.sql` first. It ships with a backfill —

```sql
UPDATE purchases SET fulfilled_at = created_at WHERE status='paid' AND fulfilled_at IS NULL;
```

— without which every already-paid purchase would look unfulfilled and re-fire its receipt
email on the next webhook redelivery.

## Transferable
- **A guard column that both racers write cannot arbitrate the race.** The claim needs its own
  column, touched by exactly one code path.
- **Side effects belong in the shared function, never in one of two racing callers.** The
  guest path had this right; the logged-in path grew its effects inline in the webhook and the
  fast-path never caught up.
- A "fast fallback" that quietly does *less* than the thing it front-runs is worse than no
  fallback — it converts a delay into permanent silent data loss.

## Still open
`fulfillGuestPurchase` never calls `fireAutomation`, so **guest sales don't fire creator
automations** while logged-in ones now do. Same defect class, deliberately left out of this
change — decide whether guest sales should trigger Zapier before adding it.

## Files
- `supabase/schema.sql` · `backend/lib/skillFulfillment.js` (new) ·
  `backend/routes/webhooks.js` (−84 lines, now delegates) · `backend/routes/checkout.js`
