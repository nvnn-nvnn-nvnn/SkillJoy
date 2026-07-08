# 90 — Guest checkout: ownership pre-check (stop double-charging)

_Session 2026-07-08. Closing the one open money gap before the live cutover: a
guest could be charged again for a product they already owned._

---

## The gap

Logged-in checkout blocks re-purchase **before** creating the PaymentIntent
([checkout.js](../../../backend/routes/checkout.js) — `if (existing?.status ===
'paid') return 409`). Guest checkout couldn't do the same, because at *intent*
time a guest has **no account** yet (the account is created at fulfilment). So:

1. Guest enters email + card → PI created (no ownership check) → **card charged**.
2. Fulfilment runs → `fulfillGuestPurchase`'s idempotency guard sees the existing
   paid row → skips → **no double-grant**, but the money was already taken.

Net: no duplicate access, but a **real double-charge** — pay again, get nothing new.

## The fix — resolve ownership by EMAIL (read-only)

The key realisation: even without an account, we have the guest's **email**, and
`findOrCreateBuyer`'s fast-path already proves an existing buyer can be found by
`profiles.email`. So the guard is a pure **Supabase read** — no account created:

> email → `profiles` (existing account?) → `purchases` (paid row for this skill?)

In [guest.js](../../../backend/routes/guest.js) `/intent`, right after the
one-time/paid validation and **before** creating the PaymentIntent:

```js
const cleanEmail = email.trim().toLowerCase();
const { data: existingProfile } = await supabase
    .from('profiles').select('id').eq('email', cleanEmail).maybeSingle();
const existingBuyerId = existingProfile?.id || null;
if (existingBuyerId) {
    const { data: owned } = await supabase.from('purchases')
        .select('status').eq('buyer_id', existingBuyerId).eq('skill_id', skillId).maybeSingle();
    if (owned?.status === 'paid') {
        return res.status(409).json({ error: 'You already own this — check your email for the access link, or log in to open it in your Locker.' });
    }
}
```

Mirrors the logged-in 409, so no PI is ever created for something already owned →
no charge.

## Also guarded: the order bump

Same class of bug on the add-on. If the resolved `existingBuyerId` already owns the
bump product, we now **skip adding it** (rather than charge for it) — the main
purchase still proceeds:

```js
let ownsBump = false;
if (existingBuyerId) {
    const { data: bo } = await supabase.from('purchases')
        .select('status').eq('buyer_id', existingBuyerId).eq('skill_id', b.id).maybeSingle();
    ownsBump = bo?.status === 'paid';
}
if (!ownsBump) { bumpSkill = b; bumpCents = ...; }
```

(Guests get a *skip* rather than the logged-in flow's 409-on-owned-bump, because a
guest owning the bump shouldn't block buying the main product.)

## Why a read is safe for an anonymous endpoint
`/api/guest/*` has no auth, so the guard must not mutate. It doesn't: it only
`select`s. No account, purchase, or PI is created until payment succeeds — the
whole reason accounts are minted at fulfilment (note 85) still holds.

## Boundary this does NOT cover
A brand-new email that has never bought before has no `profiles` row, so nothing to
check — correct (they don't own it). And two truly-concurrent guest checkouts with
the same new email could both pass the read; the fulfilment layer's atomic
flip-or-insert (guestFulfillment.js) still prevents a double-grant there. So: read
guard stops the common re-buy; the fulfilment guard is the backstop for races.

**Status:** `node --check` passes. Verify by: guest-buy a product with email X,
then attempt to guest-buy the same product with X again → should 409 before the
payment form, no charge.
