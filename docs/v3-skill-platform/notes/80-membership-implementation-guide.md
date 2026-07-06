# 80 — Membership: a build-it-yourself guide (ELI20)

_Session 2026-07-05. Teaching guide (like note 79 for lead magnets). Membership
is the type where **the hard part is already built** — you're mostly framing +
adding one "let them cancel" flow. I'll point at real code and explain the why._

---

## 0. What a membership is (the concept)

A membership is **recurring access**: the buyer pays monthly, and *while they
keep paying, they keep access.* Stop paying → access ends. The whole game is:
"is this person's subscription currently active?" — and keeping your app's idea
of "active" in sync with Stripe's.

## 1. The two axes (this is the crux — internalize it)

Everything in this app has **two independent properties**:
- **`kind`** = *what it is* (`digital`, `course`, `membership`, …)
- **`pricing_type`** = *how it bills* (`onetime` or `membership`)

For most types these are unrelated. **Membership is the one type where they're
joined at the hip:** a membership *kind* must bill as a membership
*pricing_type* (recurring), or it isn't a membership. Your whole job on the
builder side is enforcing that link.

## 2. The big realization: payment + lifecycle already exist

Don't touch Stripe wiring — it's done. Trace it:

- **Checkout** (`backend/routes/checkout.js`, ~line 71): when
  `pricing_type === 'membership'`, it creates a **Stripe subscription** via hosted
  Checkout (recurring price, platform fee, transfer to the creator) and returns
  `{ membership: true, url }`. The frontend (`Checkout.jsx`) already does
  `window.location.href = url` for that.
- **Grant** (`backend/routes/webhooks.js`, ~line 331): `checkout.session.completed`
  (subscription + `kind: 'skill_sub'`) → sets the purchase `status: 'paid'` and
  stores `stripe_subscription_id`.
- **Revoke** (webhooks ~line 358): `customer.subscription.updated` /
  `.deleted` → flips status to `'paid'` when active, **`'expired'` when not**, and
  records `current_period_end`.

And access is gated on `status === 'paid'` (`hasPurchased` / `listMyPurchases` in
`src/lib/purchases.js`). So the chain already closes itself:

> cancel/failed payment → Stripe fires `subscription.deleted` → webhook sets
> `status: 'expired'` → `hasPurchased` returns false → the Locker locks. **You
> never manually revoke — the webhook is the source of truth.**

That "the webhook flips the flag, the app just reads it" pattern is the single
most important thing to understand here. Everything else hangs off it.

## 3. What's actually left to build

### A. Frame the type in the builder (`SkillBuilder.jsx`) — the main work
Very close to what you just did for lead magnets, but inverted (lock to
*recurring* instead of *free*):

- **Lock pricing to recurring.** In the Pricing step, add a `kind ===
  'membership'` branch. A membership must have `pricing_type: 'membership'` — so
  when it's a membership kind, **set/force `pricing_type: 'membership'`** and hide
  the one-time/membership toggle (the choice is already made). Keep the `$` input
  (they still set the monthly price) but label it "/month". Reuse the same
  ternary skill you learned: `kind === 'membership' ? (<locked recurring UI>) : (
  <normal price row>)`.
  - *Where does pricing_type get set?* Safest: default it when the product is
    created as a membership (in `AddProduct`/`createSkill`), so it's never wrong.
    Same "make bad state unrepresentable" idea as the lead free-lock.
- **Content = member benefits.** A membership delivers ongoing content — reuse
  the normal flat block editor (exactly like `digital`, no special delivery
  block). `KIND_HINTS.membership` copy already exists.
- **Publish guard.** Membership falls into the default "needs ≥1 block" check —
  no special guard needed (it's not digital-delivery or course-lessons).
- **Flip it on.** `productTypes.js`: set `membership` → `built: true` (do this
  last, after you've tested).

### B. Let members cancel — the one genuinely new flow
Right now there's **no in-app cancel** (the refund route even refuses
subscriptions on purpose). Don't build your own cancel logic — use Stripe's
**Customer Portal**. The elegant version:

1. Backend: one endpoint (e.g. `POST /api/checkout/portal`) that calls
   `stripe.billingPortal.sessions.create({ customer, return_url })` and returns
   the URL. You need the buyer's Stripe **customer id** — grab it off their
   subscription (`stripe.subscriptions.retrieve(stripe_subscription_id)` →
   `.customer`), or store it at subscribe time.
2. Frontend: a "Manage membership" button (in the Locker for membership
   products) that hits that endpoint and `window.location.href = url`.
3. **You do nothing else.** The buyer cancels/updates their card in Stripe's UI;
   Stripe fires `customer.subscription.deleted`; your **existing webhook** sets
   `status: 'expired'`; access ends. The loop you already built handles it.

That's the whole feature — one endpoint + one button, leaning on the webhook you
already have. Resist writing manual cancel/revoke code; it'll drift from Stripe.

### C. (Optional) creator sees members
On the dashboard, "N active members" = count purchases where the skill is theirs
and `status = 'paid'` and it's a membership. Nice-to-have, not required.

## 4. The design fork to be aware of
`current_period_end` is stored (webhooks line ~368). A "nice" membership keeps
access until the **end of the paid period** even after they cancel (they paid
through month-end). If you want that, gate access on `status === 'paid' OR
current_period_end > now` instead of status alone. For v1, status-only (instant
cutoff on cancel) is simpler and fine — just know the option exists.

## 5. How to test
1. Creator must have **payouts set up** (checkout blocks membership otherwise —
   `checkout.js` checks `stripe_onboarded`).
2. New product → Membership → set a monthly price → add a content block →
   Publish.
3. Buy from a 2nd account (test card `4242…`) → completes hosted Checkout →
   Locker unlocks the member content.
4. **Webhooks must be running locally** for grant/revoke: `stripe listen
   --forward-to localhost:3001/webhooks` (see note 62). Without it, the
   subscription completes at Stripe but your `status` never flips to paid.
5. Cancel the sub (Stripe dashboard or your portal button) → webhook fires →
   `status: 'expired'` → Locker locks. That round-trip is the whole feature.

## 6. Stretch
- Grace-until-period-end (the §4 fork).
- Dunning: on `invoice.payment_failed`, notify the buyer to update their card
  (Stripe portal handles the update; you just nudge).
- Member-only community / perks.

---

**TL;DR:** payment + grant + revoke are already wired (checkout subscription path
+ webhook lifecycle). Your work is: (1) in the builder, lock a `membership` kind
to `pricing_type: 'membership'` + monthly price (a ternary like the lead lock),
(2) add a Stripe **Customer Portal** endpoint + a "Manage membership" button so
people can cancel, (3) flip `built: true`. Access revocation is free — the
webhook already flips `status` to `expired` and the app reads it.
