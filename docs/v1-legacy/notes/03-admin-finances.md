# Admin Panel — Finances Tab

## Why
When looking at the Stripe dashboard, the platform balance includes both SkillJoy's profit (the $6 service fee per order) and money that still needs to be sent to sellers (funds in the clearance window). These two amounts are indistinguishable in Stripe's UI alone.

The goal was to add a Finances tab to the admin panel that breaks down exactly:
- What's in Stripe (total, available vs pending)
- How much is reserved for sellers (will go out soon)
- What's actually SkillJoy's profit right now
- All-time fees collected

---

## How the escrow flow works

```
Buyer pays → funds held by Stripe on platform account (escrowed)
         ↓
Seller delivers → buyer releases funds (payment_status: released)
         ↓
3-day clearance window (protection against fraud chargebacks)
         ↓
Cron transfers: payment_amount - $6 to seller's Stripe Express account (cleared)
```

The $6 service fee stays on the platform account as profit.

---

## Backend — `GET /api/admin/finances`

File: `backend/routes/admin.js`

**What it fetches:**
1. Live Stripe balance via `stripe.balance.retrieve()` — split into available and pending
2. All `gig_requests` where `payment_status = 'released'` (in clearance window, not yet sent to sellers)
3. Count of all `payment_status = 'cleared'` orders (for all-time fee calculation)

**Key calculation:**
```js
const owedToSellers = releasedOrders.reduce((sum, o) => {
    return sum + Math.max(0, (o.payment_amount ?? 0) - SERVICE_FEE_DOLLARS);
}, 0);

const actualProfit = stripeTotal - owedToSellers;
```

`actualProfit` = what's truly yours = Stripe balance minus what you still owe sellers.

---

## Frontend — Finances Tab

File: `src/app-pages/Admin.jsx`

- Added `finances` and `financesLoading` state
- Added `loadFinances()` function calling `/api/admin/finances`
- Finances tab lazy-loads — only fetches when you click the tab
- Shows 4 stat cards: Stripe Balance, Owed to Sellers, Actual Profit (green highlight), All-Time Fees
- Shows a pending transfers list with per-order breakdown and clearance dates
- Refresh button to re-fetch live data

---

## Why `actualProfit` can be negative
If many orders are in the clearance window simultaneously and the platform balance is low (e.g. a refund was issued), `stripeTotal - owedToSellers` could go negative. This is normal — it means you've already received and spent the money that sellers are owed. In practice with the escrow model, this shouldn't happen unless Stripe fees or chargebacks have reduced the balance.

---

## Service Fee Architecture

The fee is configured in `backend/config/fees.js`:
```js
const SERVICE_FEE_DOLLARS = 6.00;
const SERVICE_FEE_CENTS   = 600;
module.exports = { SERVICE_FEE_DOLLARS, SERVICE_FEE_CENTS };
```

The frontend reads it from `.env`:
```
VITE_SERVICE_FEE=6.00
```

Displayed in `GigDetails.jsx` as the service fee line in the price breakdown.

---

## Why sellers receive the listed price (not listed price minus fee)

The buyer pays: `gig.price + $6`
The seller receives: `gig.price` (the full listed amount)
SkillJoy keeps: `$6` (minus Stripe's ~1% processing fee)

This is intentional — the fee is added on top of the seller's price, not deducted from it. Sellers always receive exactly what they listed.
