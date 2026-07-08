# 86 — Stale Stripe Connect account: self-heal the status check

_Session 2026-07-06. Fixing a raw Stripe error that surfaced in the payouts UI, and
the concept behind why it happened._

---

## The symptom
Opening the payouts/profile area threw:

> The provided key 'sk_test_…wwsiLG' does not have access to account
> 'acct_1Toa5gE90IP6UQxL' (or that account does not exist). Application access may
> have been revoked.

## The concept: connected accounts are owned by ONE platform key

A Stripe **Connect** account (`acct_…`) is created *under* a specific platform
Stripe account (your `STRIPE_SECRET_KEY`). It belongs to that platform. If you later
swap your platform key to a **different Stripe account** — which happens when you
rotate keys to a new account, or reconnect Stripe during setup — every `acct_…` you
stored under the old key becomes **unreachable**: the new key literally has no
access to it. Stripe reports that as "does not have access / may have been revoked."

So the stored `profiles.stripe_account_id` was a fine account… for a *previous*
platform key. Against the current key it's an orphan.

**Lesson:** any external ID you cache (a Stripe `acct_`, a `price_`, a customer id)
is only valid for the credentials that created it. Rotate the credentials and your
cached ids can silently orphan. Treat "retrieve a stored external id" as an
operation that *can fail*, not one that always works.

## Why it only broke in one place

Two endpoints touch the stored account
([backend/routes/stripe-connect.js](../../../backend/routes/stripe-connect.js)):

- The **create-link** endpoint already self-healed: it wraps
  `stripe.accounts.retrieve` in try/catch, and on failure nulls out
  `stripe_account_id` + `stripe_onboarded` and creates a fresh account.
- The **`GET /status`** endpoint did **not** — it called
  `stripe.accounts.retrieve(profile.stripe_account_id)` bare, so a stale id threw
  the raw Stripe error straight to the UI (the profile page checks status on load).

Same stale-id reality, but one path degraded gracefully and the other exploded.
The inconsistency is the bug.

## The fix

Wrapped the retrieve in `/status` in the same try/catch as the create-link route:
on failure, clear the stale `stripe_account_id` / `stripe_onboarded` and return
`{ onboarded: false }`. Now a mismatched account degrades to "set up payouts"
instead of erroring, and the next onboarding attempt mints a fresh account under
the current key.

```js
let account;
try {
    account = await stripe.accounts.retrieve(profile.stripe_account_id);
} catch (err) {
    console.warn(`Stale Stripe account ${profile.stripe_account_id} on status check — clearing:`, err.message);
    await supabase.from('profiles')
        .update({ stripe_account_id: null, stripe_onboarded: false })
        .eq('id', req.user.id);
    return res.json({ onboarded: false });
}
```

**Lesson:** if one code path guards against a failure mode, *every* path that hits
the same external call needs the same guard — otherwise the unguarded one is a
latent crash waiting for the same condition.

## Clearing the already-orphaned row (one-time)

The code self-heals going forward, but the existing bad row was cleared directly:

```sql
update profiles
set stripe_account_id = null, stripe_onboarded = false
where stripe_account_id = 'acct_1Toa5gE90IP6UQxL';
```

Then re-onboard in the app (Profile → set up payouts) to create a fresh Express
account under the current key. (If multiple creators onboarded under the old key,
they're all orphaned — same fix per account, or a broader `where stripe_account_id
is not null` reset in dev.)

**Status:** `node --check` passes. The graceful-degrade path is easy to verify —
load the payouts page with a stale/cleared account and confirm it shows "set up
payouts" instead of an error.
