# 191 — Buying without an account, and the $1 account takeover

Date: 2026-08-25
Migrations: none

Guest checkout existed and was half-built. Two gaps, and the second one is a
security note more than a UX one — **the obvious fix for it is an account
takeover vector, and the obvious fix looks completely reasonable.**

---

## 1 · Free products forced a signup

Reported as "when the user redeems a product, it forces them to create an
account". True, and deliberate on both ends:

```js
// Checkout.jsx
if (!user) {
  if (s.price_cents && s.pricing_type === 'onetime') { setStatus('promo'); return; }
  navigate('/login?redirect=…');                    // ← every free product
}
```
```js
// guest.js
if (skill.pricing_type !== 'onetime' || !skill.price_cents) { /* rejected */ }
```

Guests could buy a **paid** product with no account, but not claim a **free**
one. Backwards. A lead magnet exists to trade a file for an email address, and
demanding a password is the highest-friction possible step at the exact moment
someone has the least invested.

### The fix reuses the paid path entirely

`POST /api/guest/:skillId/claim` is the paid flow minus Stripe: same
`findOrCreateBuyer`, same `purchases` row, same magic-link email. The product
lands in the same Locker.

**But the security model is not the same, and that is the whole design
question.** The paid flow is safe because Stripe confirms the caller actually
paid. There is no PaymentIntent on a free claim, so that proof is gone. What
replaces it:

```js
// The price IS the authorisation. Read server-side, never from the client.
if (skill.status !== 'published') return res.status(400)…
if (skill.price_cents || skill.pricing_type !== 'onetime') {
    return res.status(400).json({ error: 'This product is not free.' });
}
```

The route re-reads the skill from the database and refuses anything that is not
published, free and one-time. A client posting a paid product's id gets nothing.

> **Transferable:** when you remove a payment step, find what the payment was
> *proving* and replace it explicitly. "It's free so it doesn't matter" is how
> a free endpoint ends up granting a paid product.

Membership still requires an account — a subscription has to belong to someone
who can manage and cancel it.

**Idempotent**, verified: claiming twice returns 200 and leaves **one** purchase
row. A repeat claim is almost always someone who lost the first email, so they
get another link rather than an error.

---

## 2 · Paying and then being sent to your inbox

The second report: "I tested with a dollar payment and the app made me sign in
with my buyer email — that's stupid."

Correct. After a successful guest payment:

> ✅ You're all set!
> We've emailed you a receipt and a link to access **X** — check your inbox.
> **[ Go back ]**

They paid. They were looking at the page. And the product was somewhere else,
behind an inbox trip.

> **Transferable:** the moment someone completes a purchase is the worst
> possible time to introduce a detour. They have already done the hard part;
> everything after it should be the thing they bought.

---

## 3 · The takeover vector, which is the important part of this note

The obvious fix: after payment, hand back a session so the buyer is signed in.

**That is an account takeover primitive.**

```
1. Attacker opens a $1 product on any storefront
2. Enters victim@example.com as the buyer email
3. Pays $1 of their own money
4. Server signs them in as victim@example.com
```

Payment proves **someone paid**. It does not prove they own the inbox. Those are
completely different claims, and the checkout flow only ever verified the first.
For one dollar you would get a session on an account that may hold other
purchases, a storefront, and Stripe payout details.

This is worth sitting with, because the flawed version has every appearance of
being correct: the buyer paid, the payment is verified server-side, the
PaymentIntent metadata matches the skill, and the email came from the form the
buyer filled in. Every individual check passes. The gap is between "this payment
is real" and "this person is who they said they were".

### The gate: only when this transaction created the account

```js
async function signInTokenFor(email, created) {
    if (!created) return null;
    …
}
```

`findOrCreateBuyer` now returns `{ id, created }` — and `created` is a **security
signal, not a statistic**.

- **Account created by this purchase** → it contains exactly one thing, the
  product just bought. There is nothing to steal, so a session is safe.
- **Account already existed** → it may hold anything. That buyer gets the
  emailed link, which proves inbox ownership *before* granting a session.

The nice property is that the common case — a first-time buyer — gets the
frictionless path, and the case that could be an attack gets the safe one. No
one has to choose, and the attacker gains nothing by trying.

Verified live:

| | |
|---|---|
| New email, free claim | token **issued** |
| Same email again (account now exists) | token **withheld** |
| Paid product via the claim route | **400**, refused |

The token itself is a hashed single-use OTP exchanged via `verifyOtp`, returned
only alongside a PaymentIntent the server has already confirmed as `succeeded`.

> **Transferable:** "the user paid" and "the user controls this identity" are
> separate facts. Any flow that turns the first into the second — a session, a
> password reset, a linked account — needs the second proven independently.

---

## 4 · Three smaller things the work surfaced

**Every exit returns the same shape.** `fulfillGuestPurchase` had bare
`return;` statements on its early paths. They now all return
`{ signInToken: … }`, so the caller never has to distinguish "no token" from
"forgot to return one". `null` is a deliberate answer.

**The already-fulfilled branch signs them in too.** The webhook and `/confirm`
race, and Stripe redelivers — so "already fulfilled" is a normal outcome, not an
error. The buyer is still standing there having just paid.

**A convenience must never be able to fail a purchase.** `signInTokenFor` and
`redeemSignInToken` both swallow their errors. A failed link generation means
they use the emailed link; it does not mean the payment breaks.

**And a bug that had been live the whole time:** `full_name` was `null` on every
guest buyer. `findOrCreateBuyer` upserts with `ignoreDuplicates: true`, and a DB
trigger creates the profile row the instant the auth user is made — so the name
was always dropped. Found by reading a smoke-test row rather than by trusting
the code. Now backfilled, but **only when empty**, so a returning buyer who set
their own name is not overwritten by whatever they typed into a checkout form
months later.

---

## Files
`backend/routes/guest.js` — `/claim`, tokens on both responses
`backend/lib/guestFulfillment.js` — `fulfillFreeClaim`, `signInTokenFor`,
`findOrCreateBuyer` returns `{ id, created }`, name backfill
`src/lib/purchases.js` — `claimFreeProduct`, `redeemSignInToken`
`src/app-pages/Checkout.jsx` — free reaches the guest step, auto sign-in,
copy that adapts to free

## Still open
- A guest who pays with an email that already has an account still takes the
  inbox trip. Correct, but they are not told *why* — the success screen reads
  the same as a first-time buyer's.
- Nothing rate-limits `/claim`. It grants only free products to the email given,
  so the worst case is inbox spam rather than theft, but it is an unauthenticated
  write.

---

## Exercises

1. **Run the attack.** Point `/claim` at a free product with an email that
   already has an account. Confirm no token comes back. Now remove the
   `if (!created) return null;` guard and run it again — what exactly did you
   just gain access to?

2. **Find the missing proof.** The paid flow verifies a PaymentIntent; the free
   flow verifies the price. Write the one-sentence rule that covers both, then
   check `/api/guest/:skillId/intent` against it.

3. **Break idempotency.** Claim the same free product three times with one
   email. How many `purchases` rows exist? Now remove the duplicate-key branch
   and repeat — what does the buyer see, and is that better or worse than a
   silent success?

4. **Trace the name bug.** Why did `ignoreDuplicates: true` drop `full_name` for
   every guest? Name the two things that both had to be true. Then find another
   upsert in the codebase with the same flag and decide whether it has the same
   problem.

5. **Rate-limit `/claim`.** It is an unauthenticated write that sends email.
   Decide what to limit on — IP, email, product — and defend the choice against
   someone sharing a lead magnet link with a whole classroom on one network.

6. **Tell the second buyer why.** Someone whose email already has an account
   still gets the inbox trip. Write the copy that explains this without either
   confusing them or revealing that an account exists for that address — and say
   why that second constraint matters.
