# 19 — Service Fee Refactor ($6 flat → 10% percentage)

## What changed

Replaced the flat `$6 per transaction` fee with a percentage-based fee (`10% of gig price`). The system is now driven by a single config constant + helper functions, so future fee changes are a one-line edit.

## Why

**Problem with flat $6:**
- On a $10 gig, $6 fee = 60% tax → kills small trades
- On a $200 gig, $6 fee = 3% → leaves money on the table
- Flat fees punish the low-price end of the market (college students, our core audience)

**Why 10%:**
- Matches Upwork (industry standard, nobody quits over it)
- Half of Fiverr (20%) — still positions SkillJoy as the cheap option
- Covers Stripe's ~2.9% + $0.30 fee on any gig size ≥ ~$5
- Gives real margin for chargebacks, refunds, and support overhead

**Math at 10%:**
| Gig | Buyer pays | Seller gets | We net (after Stripe ~2.9%+$0.30) |
|-----|------------|-------------|-----------------------------------|
| $20 | $22.00 | $20.00 | ~$1.12 |
| $50 | $55.00 | $50.00 | ~$3.10 |
| $100 | $110.00 | $100.00 | ~$6.50 |
| $200 | $220.00 | $200.00 | ~$13.20 |

## How — step-by-step

### 1. Central config with helpers (`backend/config/fees.js`)

Before: `SERVICE_FEE_DOLLARS = 6.00` + `SERVICE_FEE_CENTS = 600` (flat values).

After: percentage constant + helper functions that derive fee from either the base price (gig.price) or the total paid (payment_amount in DB, which already includes the fee):

```js
const SERVICE_FEE_PERCENT = 0.10;

feeCents(baseDollars)           // fee in cents from gig.price
feeDollars(baseDollars)         // fee in dollars from gig.price
feeCentsFromTotal(totalDollars) // fee in cents extracted from payment_amount
feeDollarsFromTotal(totalDollars) // same, in dollars
```

**Why two variants?** Because some callsites have `gig.price` (buyer-facing checkout), and others only have `payment_amount` (stored total, which includes the fee). The extraction formula:
```
payment_amount = base × (1 + percent)
base = payment_amount / (1 + percent)
fee = payment_amount − base
```

### 2. Backend callsites updated

| File | Line | What |
|------|------|------|
| `backend/routes/payments.js` | 48 | Create payment intent uses `feeDollars(gig.price)` |
| `backend/index.js` | 205, 231 | Auto-clearance transfer uses `feeCentsFromTotal(payment_amount)` |
| `backend/routes/admin.js` | 151, 248, 257 | Manual clearance + finances dashboard |
| `backend/routes/stripe-connect.js` | 20, 213 | Onboarding backfill transfer + seller earnings |

**Important change in admin finances:** `totalFeesEarned` previously was `clearedOrders.length × $6`. Now it sums `feeDollarsFromTotal(payment_amount)` per cleared order, because each order has a different fee. Had to add `payment_amount` to the select.

### 3. Frontend callsites updated

| File | What |
|------|------|
| `src/app-pages/GigDetails.jsx` | Checkout breakdown shows "Service fee (10%)" and computes fee from `customAmount` |
| `src/app-pages/Gigs.jsx` | Same for the inline payment modal |
| `src/app-pages/MyOrders.jsx` | Payment form shows percent-based fee based on `order.gig.price` |

Each reads `VITE_SERVICE_FEE_PERCENT` from env with `|| 0.10` fallback.

### 4. Copy/docs updated

| File | Change |
|------|--------|
| `src/introduction-pages/Terms.jsx` | "service fee of $6 per transaction" → "10% of the gig price per transaction" |
| `src/introduction-pages/RefundPolicy.jsx` | "$6 platform service fee is non-refundable" → "10% platform service fee is non-refundable" |
| `src/app-pages/Admin.jsx` | Finance card subtitle + explanation now reference "10% service fees" |
| `.env.example` | `VITE_SERVICE_FEE=6.00` → `VITE_SERVICE_FEE_PERCENT=0.10` |

## ⚠️ Deployment action required

Update your actual `.env` file (not tracked by git):

```
# Remove
VITE_SERVICE_FEE=6.00

# Add
VITE_SERVICE_FEE_PERCENT=0.10
```

Backend reads the hardcoded `0.10` from `backend/config/fees.js` — no backend env var needed, but you can promote it to env later if you want to A/B test fees without a deploy.

## Future changes

To change the fee rate, edit **ONE** place in the backend and **ONE** place in the frontend:
1. `backend/config/fees.js` → `SERVICE_FEE_PERCENT`
2. `.env` → `VITE_SERVICE_FEE_PERCENT`

All breakdowns, transfer math, admin reports, and seller earnings update automatically.

## Testing checklist

- [ ] Buyer checkout shows correct fee on gigs of varied prices ($10, $50, $200)
- [ ] Stripe payment intent amount = `gig.price × 1.10` (in cents)
- [ ] On auto-release, seller receives `gig.price` and platform keeps `gig.price × 0.10`
- [ ] Admin finances dashboard shows correct `totalFeesEarned` (sum, not count × flat fee)
- [ ] Seller earnings dashboard reflects the percentage net of fee
