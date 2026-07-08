# 85 — Guest payments: a build-it-yourself guide (ELI20)

_Session 2026-07-06. Teaching guide (like notes 79/80). Guest checkout looks like a
"let people pay without logging in" feature, but the moment you look closely it's
really an **identity** problem wearing a checkout costume. This walks the concept
first, then points at the real code._

---

## 0. The one idea to internalize

**"Guest checkout" is a lie you tell the buyer, not a thing your backend believes.**

To the buyer: "no account needed, just pay." To your database: *every purchase
still belongs to a real user row.* The whole feature is the trick that makes those
two truths coexist — the buyer never sees an account, but one quietly exists.

Once that clicks, everything else follows: you're not building a parallel
"guest-purchase" system, you're building a way to **manufacture an account behind
the buyer's back** and hand it to them later via a link.

## 1. Why you can't just "skip the login"

Look at what your app assumes everywhere:
- `purchases.buyer_id` is `NOT NULL REFERENCES profiles(id)` — a purchase *must*
  point at a real user.
- The Locker is gated on `user` + a purchase row.
- Fulfilment emails come from `getUserEmail(buyer_id)`.

So a purchase with "no user" isn't a small tweak — it's a value your schema
literally can't represent. You have two ways out:

- **(A) Make an account for them** → keep the whole system unchanged.
- **(B) Invent an email-keyed guest model** → nullable `buyer_id`, a `guest_email`
  column, a separate token-access page, and every access check rewritten.

We chose **A**. This is the single most important design call in the feature, and
the reason is *leverage*: option A means the Locker, order bumps, receipts, and
membership code all keep working with **zero changes**. Option B would have you
re-implementing "can this person see this?" in two places forever. Stan/Gumroad do
A — when you "buy as guest," they silently made you an account.

**Lesson:** when a feature seems to need a new data model, first ask "can I reuse the
existing one by creating the missing entity instead of inventing a parallel one?"
Reuse beats parallel systems almost every time.

## 2. The crux: *when* do you create the account?

This is the subtle part, and getting it wrong is a real vulnerability.

Naive version: "collect their email, make the account, then charge them." But your
guest endpoint has **no auth** — anyone on the internet can hit it. If it creates an
account on every call, I can spam you 10,000 fake accounts with a `for` loop before
a single payment happens.

The fix is a sequencing insight: **create the account at _fulfilment_, not at
_intent_.**

- **Intent** (before payment): just create the Stripe PaymentIntent. Stash the
  email + name in its `metadata`. Create *nothing* in your DB.
- **Fulfilment** (after Stripe says "paid"): *now* create-or-find the account and
  grant the purchase.

Because account creation is gated behind "a real card was actually charged," the
open endpoint can't be abused. Payment is your spam filter.

See it in [guest.js](../../../backend/routes/guest.js): the `/intent` route
validates + creates the PI with `metadata.kind = 'skill_guest'` and returns — no
`profiles` insert, no `purchases` row. All the account work lives in
[guestFulfillment.js](../../../backend/lib/guestFulfillment.js), which only ever runs
*after* Stripe confirms.

## 3. "Create-or-find" — the idempotent identity step

At fulfilment you need a `buyer_id` for the email. Two cases: they've bought before
(account exists) or they haven't (create it). You want **one function that handles
both and is safe to call twice.** That's `findOrCreateBuyer(email, name)`:

1. Fast path: is there already a `profiles` row with this email? Use its id. (This
   is *why* profiles carries an `email` column — it's your lookup key.)
2. Else create a passwordless auth user: `auth.admin.createUser({ email,
   email_confirm: true })`. `email_confirm: true` is the important flag — it marks
   the address trusted so the magic link works immediately (no "confirm your email"
   dance for someone who literally just paid you).
3. Then upsert a `profiles` row — because `purchases.buyer_id` has a foreign key to
   `profiles`, so the profile must exist before the purchase can.

**Lesson:** any step that can run more than once (and fulfilment always can — see §5)
should be written as "find-or-create," never "create." Idempotency isn't a nicety
here; it's the difference between one account and a duplicate-key crash.

## 4. How the buyer gets in without a password: magic links

You made them an account they don't know exists and never chose a password for. How
do they open what they bought?

A **magic link**: `auth.admin.generateLink({ type: 'magiclink', email, options: {
redirectTo: '/locker/:skillId' } })`. It returns a URL that, when clicked, *signs
them in* and drops them on the product. No password, no login form.

Email that link in the receipt (see the bottom of `fulfillGuestPurchase`). Now the
buyer's experience is: pay → check email → click → "oh nice, here's my stuff." They
never know an account happened. The lie from §0 holds.

Gotcha you'll hit: the link's `redirectTo` must be in Supabase's **Redirect URLs**
allow-list (Auth → URL Configuration), same as Google auth in note 84. If it isn't,
Supabase silently sends them to your Site URL instead.

## 5. Why fulfilment runs twice (and why that's fine)

Stripe tells you a payment succeeded **two ways**, on purpose for reliability:
- the **webhook** (`payment_intent.succeeded`) — the source of truth, but can lag.
- the **/confirm** call your frontend makes right after paying — instant, but the
  browser could close before it fires.

You wire *both* so the buyer is never stranded. But that means `fulfillGuestPurchase`
can run twice for one payment. If it granted twice you'd get double emails or
duplicate rows. So it opens with an **idempotency guard**: "is this purchase already
`paid`? then stop." Placed *before* the email send, so the guest gets exactly one
"here's your link" email even though fulfilment fired twice.

**Lesson:** whenever two independent triggers can fire the same side effect, make the
effect idempotent and let them race. Don't try to make only one of them fire — that's
where the stranded-buyer bugs live.

## 6. The frontend is the easy 20%

Almost all the thinking is server-side. The client just:
- Stops force-redirecting logged-out users to `/login`; instead, for a one-time paid
  product it shows name + email fields ([Checkout.jsx](../../../src/app-pages/Checkout.jsx)).
- Calls `startGuestCheckout` instead of `startCheckout`, and `confirmGuestCheckout`
  after paying.
- Can't send the guest to the Locker (they're not logged in *yet* — the magic link
  does that), so it shows a "check your email" screen.

Notice the shape mirrors the logged-in flow almost exactly — same PaymentIntent, same
Payment Element, just different endpoints and a different ending. That's the payoff of
choosing option A in §1.

## 7. What this deliberately doesn't do (scope)
- **One-time paid products only.** Free (lead) + membership guests get sent to
  `/login`. Memberships need a customer/subscription tied to an account — a bigger flow.
- **No promo-code field for guests** — the live-preview route is auth-gated. The
  backend intent accepts a code; the UI just doesn't offer one yet.

## 8. Test it
1. Log out. Open a published one-time product's `/checkout/:id`.
2. Promo step shows **name + email** → fill → Continue.
3. Pay with `4242…` (`stripe listen` running).
4. "Check your email" screen → inbox has a receipt + **Access your purchase** magic
   link → clicking it signs you in on the Locker with the product.
5. Confirm a `profiles` row + a paid `purchases` row now exist for that email.

**Status:** backend `node --check` passes on all files; frontend builds. Not yet
observed at runtime (needs a logged-out live Stripe payment) — drive §8 before
trusting it with money.

---

**TL;DR:** Guest checkout = quietly making the buyer an account *after* they pay (so
the open endpoint can't be spammed), granting the purchase through your normal
buyer_id system (so you reuse everything), and handing them a magic link so they get
in without a password (so they never notice the account). The three ideas that carry
it: **create-at-fulfilment** (§2), **find-or-create + idempotency** (§3, §5), and
**magic-link access** (§4).
