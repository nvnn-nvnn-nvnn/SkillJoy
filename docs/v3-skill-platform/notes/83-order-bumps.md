# 83 — Order bumps (checkout upsell)

_Session 2026-07-06. First of the Stan-style conversion features: an order bump —
offer one of the creator's other one-time products as an add-on at checkout._

---

## Model (decided)

An order bump = **another existing product of the same creator**, offered
(optionally discounted) at this product's checkout. Buyer who checks the box pays
for both and gets access to both. Because the bump is the *same creator's* product,
it rides the existing single PaymentIntent + single transfer — one platform fee on
the combined total, no second charge, no second payout. Fulfilment just grants a
2nd purchase row.

_Not_ a custom inline add-on (that was the other option, rejected — it wouldn't be
a reusable product and would need its own delivery).

## Data — migration 019_order_bumps.sql (run in Supabase)

Three columns on `skills`:
- `order_bump_skill_id` UUID → skills(id) ON DELETE SET NULL — the product offered.
- `order_bump_price_cents` INTEGER — discounted bump price; NULL = the bump
  product's own `price_cents`.
- `order_bump_blurb` TEXT — optional offer headline.

Added all three to `SKILL_COLS` in [src/lib/skills.js](../../../src/lib/skills.js)
so they load everywhere.

## Builder — configure the bump (Options tab)

[SkillBuilder.jsx](../../../src/app-pages/SkillBuilder.jsx). Removed the "Order
bump" *Soon* tile; added a real control (only shown for non-lead, non-membership
products — i.e. products with a one-time checkout):
- Loads `bumpOptions` = the creator's **other published one-time** skills
  (`listMySkills` filtered; excludes self, memberships, drafts).
- A `<select>` to pick the bump product, a `$` override price (blank = normal
  price), and a headline input. All saved via the existing debounced `patchSkill`.
- Empty state if they have no other one-time product to offer.

## Checkout — offer + combined total

[Checkout.jsx](../../../src/app-pages/Checkout.jsx), one-time promo step only:
- On load, if the skill has `order_bump_skill_id`, fetch that product
  (`getPublicSkill`, best-effort) into `bumpSkill`.
- Renders a dashed-accent checkbox offer (blurb or "Add “<title>”" + `+$X`).
- `bumpCents = skill.order_bump_price_cents ?? bumpSkill.price_cents`; the Continue
  button shows the running total `amount + (bumpOn ? bumpCents : 0)`.
- `startCheckout(skillId, code, bump)` — added a 3rd `bump` arg
  ([src/lib/purchases.js](../../../src/lib/purchases.js)).

## Backend — amount, pending rows, fulfilment

[backend/routes/checkout.js](../../../backend/routes/checkout.js) `intent`:
- **Re-validates the bump server-side** (never trust the client): bump skill must be
  published, one-time, and the *same creator*; 409 if the buyer already owns it.
  Price is recomputed from the DB (`order_bump_price_cents ?? bump.price_cents`).
- PI `amount` = main charge + bump; `application_fee_amount` on the **total**.
  Bump identity carried in PI metadata (`bump_skill_id`, `bump_amount`,
  `bump_version`).
- Upserts a **pending purchase row for the bump** alongside the main one (both
  reference the same `stripe_payment_id`).

Fulfilment grants the bump in **both** paths (idempotent, `neq('status','paid')`):
- `payment_intent.succeeded` webhook
  ([webhooks.js](../../../backend/routes/webhooks.js)) — flips the bump row to paid
  + notifies the creator ("Order bump sold!").
- `/confirm` fast-fallback — same flip, so the buyer isn't stuck if the webhook lags.

## Why it's safe

- One creator, one PI, one transfer, one fee-on-total → no split-payment complexity.
- Server recomputes the price and re-checks ownership → a tampered client can't get
  a free/wrong-priced add-on.
- Both purchase rows share the PI id and both fulfilment paths guard on
  `status != 'paid'` → no double-grant, and a lagging webhook can't strand the bump.

## Not done / next
- **Post-purchase (one-click) upsell** — a true "after they pay, offer X" screen.
  This is the *pre-purchase* bump; the post-purchase upsell is a separate flow.
- **Verify** — unrun (needs a logged-in creator with 2 published one-time products +
  a live Stripe checkout). Build passes; behaviour unobserved.

## How to test
1. As a creator, publish two one-time products. On product A → Options → Order bump
   → pick product B, set a bump price + headline.
2. Buy product A from a 2nd account → the promo step shows the "Add B" checkbox with
   the bump price → check it → Continue shows the combined total → pay.
3. With `stripe listen` running, confirm the Locker shows **both** A and B, and the
   creator gets two sale notifications (one "Order bump sold!").
