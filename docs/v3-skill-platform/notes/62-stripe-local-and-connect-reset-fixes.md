# 62 — Stripe local dev + Connect reset fixes

_Session: 2026-07-01. Debugging why Stripe wouldn't work locally, then a
"No such destination" checkout crash after a Stripe key reset._

## 1. "Stripe won't connect locally" → wrong API base URL

**Symptom:** checkout never worked on localhost.

**Root cause:** `src/lib/api.js` uses
`const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'`.
The root `.env` sets `VITE_API_URL=https://skilljoy-production.up.railway.app`,
so the localhost fallback never fired. The local frontend (localhost:5173) was
POSTing checkout to the **production Railway backend**, whose prod CORS only
allows its deployed frontend — so the browser blocked the response and checkout
couldn't fetch a `clientSecret`. Looked like "Stripe is broken."

**Fix:** created gitignored `.env.local` at repo root (Vite loads it over `.env`):

```
VITE_API_URL=http://localhost:3001
```

**How to run locally now:**
- Terminal 1: `cd backend && npm run dev` (nodemon → :3001)
- Terminal 2: `npm run dev` (Vite → :5173) — restart it so it picks up .env.local

Backend `NODE_ENV=development`, so its CORS already allows localhost:5173.
Test card `4242 4242 4242 4242`.

**Webhooks caveat:** webhooks don't reach localhost. Fulfillment still works
because `Checkout.jsx` calls `confirmCheckout` right after payment (fast
fallback in `backend/routes/checkout.js` `/confirm`). For real webhook testing:
`stripe listen --forward-to localhost:3001/webhooks` then paste the printed
`whsec_…` into `backend/.env`.

## 2. "No such destination: 'acct_1TLsLhCvaniZQTwL'" → orphaned Connect accounts

**Symptom:** checkout PaymentIntent failed at
`transfer_data.destination` (`backend/routes/checkout.js`).

**Root cause:** the Stripe platform account was reset. Current platform key
belongs to `acct_1TF1d1EO4L6TAYQJ`, but every creator's stored
`profiles.stripe_account_id` was a connected account created under the **old**
platform key. The new key has no access to those accounts → "No such
destination." Verified all **8/8** profiles with a `stripe_account_id` were
stale.

**Fix:** nulled `stripe_account_id` + set `stripe_onboarded=false` for all 8
profiles (the old ids are dead — not recoverable or reusable). Affected: all 8
accounts with a stored `stripe_account_id` (usernames redacted).

Note: `stripe-connect.js` `/onboard` already auto-detects a stale account and
resets it (lines ~56-68), so re-onboarding also self-heals one at a time. The
bulk clear just fixes them all at once and stops `/status` from throwing.

**To test a purchase end-to-end:**
1. Log in as the **seller** → Profile/Payouts → Set up payouts (creates a fresh
   `acct_…` under the current platform).
2. Complete Stripe Express test onboarding (phone `000 000 0000`, SSN
   `000-00-0000`, routing `110000000`, account `000123456789`).
3. Log in as the **buyer** → checkout now resolves the destination.

Until a seller re-onboards, buying their skill returns the clean
"creator hasn't finished setting up payouts yet" message (checkout.js:67)
instead of the cryptic Stripe error.

**Recurrence:** only happens in test mode after a platform key reset. Won't
recur in production unless the live platform account is rotated.
