# SkillJoy — Stripe Connect Implementation Guide

This guide walks you through implementing Stripe Connect so sellers can actually receive payouts. Everything in this app already works except this final piece — when a buyer releases funds, the money sits in your Stripe account and never reaches the seller.

---

## How Stripe Connect Works (Plain English)

Right now, when a buyer pays $20 for a gig:
- Stripe charges the buyer's card
- $20 lands in **your** Stripe account (the platform)
- Your DB says `payment_status: 'released'` but nothing moves to the seller

With Stripe Connect:
- Buyer pays $20
- Stripe charges the buyer's card
- $17 moves to the **seller's** Stripe account (their cut)
- $3 stays in **your** Stripe account (the service fee)
- The seller can withdraw their $17 to their bank whenever they want

Stripe handles all the KYC (identity verification), bank account linking, and compliance for you. You just redirect sellers to a Stripe-hosted page to set up their account.

---

## Part 1 — Stripe Dashboard Setup

### 1.1 Enable Connect in your Stripe Dashboard

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. In the left sidebar → **Connect** → **Get started**
3. Choose **Express** accounts (recommended — Stripe hosts the onboarding UI for you)
4. Fill in your platform details

### 1.2 Get your platform's account ID

After enabling Connect, your platform account ID starts with `acct_`. You'll see it in the Dashboard. You don't need to store this — it's your own account.

---

## Part 2 — Database Changes

Run this in your Supabase SQL editor:

```sql
-- Add Stripe Connect fields to profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS stripe_account_id text,
    ADD COLUMN IF NOT EXISTS stripe_onboarded boolean DEFAULT false;
```

`stripe_account_id` stores the seller's Connect account ID (e.g. `acct_1ABC...`).
`stripe_onboarded` is `true` once they've completed Stripe's onboarding form.

---

## Part 3 — Backend Endpoints

You need two new endpoints in your backend. Add them to a new file `backend/routes/stripe-connect.js`:

```js
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');

// ── STEP 1: Create a Connect account + return onboarding URL ────────────────
// Called when seller clicks "Set up payouts" in their profile
router.post('/onboard', async (req, res) => {
    try {
        // Check if seller already has an account
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id')
            .eq('id', req.user.id)
            .single();

        let accountId = profile?.stripe_account_id;

        // Create a new Express account if they don't have one
        if (!accountId) {
            const account = await stripe.accounts.create({ type: 'express' });
            accountId = account.id;

            // Save the account ID immediately
            await supabase
                .from('profiles')
                .update({ stripe_account_id: accountId })
                .eq('id', req.user.id);
        }

        // Create an onboarding link (valid for ~5 minutes)
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${process.env.FRONTEND_URL}/profile?stripe=refresh`,
            return_url:  `${process.env.FRONTEND_URL}/profile?stripe=success`,
            type: 'account_onboarding',
        });

        res.json({ url: accountLink.url });
    } catch (err) {
        console.error('Stripe onboard error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── STEP 2: Check onboarding status (called when seller returns from Stripe) ─
// Stripe redirects to /profile?stripe=success — call this to confirm
router.get('/status', async (req, res) => {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_account_id, stripe_onboarded')
            .eq('id', req.user.id)
            .single();

        if (!profile?.stripe_account_id) {
            return res.json({ onboarded: false });
        }

        // Ask Stripe if the account has finished onboarding
        const account = await stripe.accounts.retrieve(profile.stripe_account_id);
        const onboarded = account.details_submitted && account.charges_enabled;

        // Update DB if they just finished
        if (onboarded && !profile.stripe_onboarded) {
            await supabase
                .from('profiles')
                .update({ stripe_onboarded: true })
                .eq('id', req.user.id);
        }

        res.json({ onboarded, chargesEnabled: account.charges_enabled });
    } catch (err) {
        console.error('Stripe status error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
```

Then register it in `backend/index.js`:
```js
const stripeConnectRoutes = require('./routes/stripe-connect.js');
app.use('/api/stripe-connect', authMiddleware, stripeConnectRoutes);
```

Add `FRONTEND_URL` to your `backend/.env`:
```
FRONTEND_URL=http://localhost:5173
```

---

## Part 4 — Wire Up the Release Endpoint

Open `backend/routes/payments.js`, find the `/release` endpoint. Replace the TODO comment:

```js
// TODO: If using Stripe Connect, transfer funds to provider here
// await stripe.transfers.create({ ... });
```

With this:

```js
// Transfer funds to seller via Stripe Connect
const { data: providerProfile } = await supabase
    .from('profiles')
    .select('stripe_account_id, stripe_onboarded')
    .eq('id', order.provider_id)
    .single();

if (!providerProfile?.stripe_account_id || !providerProfile?.stripe_onboarded) {
    // Seller hasn't set up payouts — hold the funds, flag for manual review
    console.warn(`Provider ${order.provider_id} has no Stripe account. Funds held.`);
} else {
    const SERVICE_FEE_CENTS = 300; // $3.00
    const transferAmount = Math.round(order.payment_amount * 100) - SERVICE_FEE_CENTS;

    await stripe.transfers.create({
        amount: transferAmount,
        currency: 'usd',
        destination: providerProfile.stripe_account_id,
        transfer_group: orderId, // groups this transfer with the original charge
    });
}
```

**How the math works:**
- Buyer paid: `gig.price + $3.00`
- `payment_amount` stored in DB is the full amount (e.g. `$23.00`)
- Transfer to seller: `payment_amount - $3.00` = `$20.00`
- Your platform keeps: `$3.00`

---

## Part 5 — Frontend: "Set Up Payouts" Button

In the seller's profile page, show their payout status and an onboarding button.

### 5.1 Check status on page load

When the user visits their own profile, call `/api/stripe-connect/status`:

```js
const [stripeStatus, setStripeStatus] = useState(null);

useEffect(() => {
    if (!isOwnProfile) return;

    // If returning from Stripe onboarding
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe') === 'success' || params.get('stripe') === 'refresh') {
        checkStripeStatus();
        // Clean up URL
        window.history.replaceState({}, '', '/profile');
    } else {
        checkStripeStatus();
    }
}, []);

async function checkStripeStatus() {
    const res = await apiFetch('/api/stripe-connect/status');
    const data = await res.json();
    setStripeStatus(data);
}
```

### 5.2 Show the banner

```jsx
{isOwnProfile && profile?.offers_gigs && (
    <div style={{
        padding: '16px 20px',
        background: stripeStatus?.onboarded ? '#f0fdf4' : '#fffbeb',
        border: `1px solid ${stripeStatus?.onboarded ? '#86efac' : '#fde68a'}`,
        borderRadius: 10,
        marginBottom: 20
    }}>
        {stripeStatus?.onboarded ? (
            <p style={{ color: '#166534', fontWeight: 600, margin: 0 }}>
                ✅ Payouts active — you'll receive funds when buyers release payment.
            </p>
        ) : (
            <>
                <p style={{ color: '#92400e', fontWeight: 600, margin: '0 0 10px' }}>
                    ⚠️ Set up payouts to receive money from completed orders.
                </p>
                <button
                    className="btn btn-primary"
                    onClick={handleStripeOnboard}
                >
                    Set Up Payouts with Stripe
                </button>
            </>
        )}
    </div>
)}
```

### 5.3 Onboard handler

```js
async function handleStripeOnboard() {
    const res = await apiFetch('/api/stripe-connect/onboard', { method: 'POST' });
    const data = await res.json();
    if (data.url) {
        window.location.href = data.url; // Redirect to Stripe's hosted form
    }
}
```

---

## Part 6 — Testing Stripe Connect Locally

Stripe provides fake onboarding in test mode so you don't need real bank details.

### 6.1 Create a test Connect account via CLI

```bash
# In your terminal (stripe CLI must be installed)
stripe accounts create --type=express
```

Copy the `id` (starts with `acct_`) and manually insert it into your `profiles` table for your test seller user:

```sql
UPDATE profiles
SET stripe_account_id = 'acct_YOUR_TEST_ID', stripe_onboarded = true
WHERE id = 'your-seller-user-id';
```

This skips the onboarding form so you can test the payout flow immediately.

### 6.2 Test a full payout flow

1. Seller: set `stripe_account_id` + `stripe_onboarded = true` in DB (step above)
2. Buyer: request a gig → seller accepts → buyer pays (use card `4242 4242 4242 4242`)
3. Seller: mark as delivered
4. Buyer: release funds
5. Check your Stripe Dashboard → **Connect** → **Accounts** → find the test account → **Payments** — you should see the transfer

### 6.3 Test onboarding flow itself

1. Call `POST /api/stripe-connect/onboard` from the frontend
2. You'll get a URL — open it
3. Stripe test mode shows a simplified form, click through with fake data
4. You'll be redirected back to `/profile?stripe=success`
5. Call `GET /api/stripe-connect/status` — should return `{ onboarded: true }`

---

## Part 7 — Going Live (Production)

When you're ready to take real payments:

1. In Stripe Dashboard → switch from **Test** to **Live** mode
2. Get your **live** secret key and replace `STRIPE_SECRET_KEY` in your `.env`
3. Get your **live** webhook secret and replace `STRIPE_WEBHOOK_SECRET`
4. Set `FRONTEND_URL` to your production domain (e.g. `https://skilljoy.com`)
5. In Stripe Dashboard → Connect → Settings — fill in your platform's branding, support email, and terms of service URL (required for live)

> Stripe will review your platform before enabling live payouts. This usually takes 1–3 days. Apply early.

---

## Summary: What You're Building

```
Seller visits profile → clicks "Set Up Payouts"
    ↓
POST /api/stripe-connect/onboard
    ↓ stripe.accounts.create({ type: 'express' })
    ↓ stripe.accountLinks.create(...)
    ↓ Returns URL → redirect seller to Stripe

Seller fills out Stripe's form (bank account, ID, etc.)
    ↓ Stripe redirects back to /profile?stripe=success

GET /api/stripe-connect/status
    ↓ stripe.accounts.retrieve(accountId)
    ↓ checks details_submitted + charges_enabled
    ↓ updates profiles.stripe_onboarded = true

Buyer releases payment
    ↓ POST /api/payments/release
    ↓ stripe.transfers.create({ destination: seller.stripe_account_id })
    ↓ Seller receives money in their Stripe balance
    ↓ Seller withdraws to bank (Stripe handles this automatically on a schedule)
```

---

## Key Files to Touch

| File | What to add |
|---|---|
| `backend/routes/stripe-connect.js` | New file — onboard + status endpoints |
| `backend/index.js` | Register the new route |
| `backend/routes/payments.js` | Replace the TODO in `/release` with actual transfer |
| `backend/.env` | Add `FRONTEND_URL` |
| `src/app-pages/Profile.jsx` (or wherever your profile page is) | Add payout status banner + onboard button |
| Supabase SQL editor | Run the ALTER TABLE migration |
