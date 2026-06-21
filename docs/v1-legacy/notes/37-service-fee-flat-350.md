# 37 — Service Fee: Switched to Flat $3.50

**Date:** 2026-04-24

## What changed
Replaced the 10% percentage-based service fee with a flat $3.50 fee per transaction.

## Files updated
- `backend/config/fees.js` — rewrote all fee functions to return 350 cents / $3.50 flat; removed percent logic
- `src/app-pages/GigDetails.jsx` — `serviceFee = SERVICE_FEE` (flat) instead of `offerAmount * percent`
- `src/app-pages/Gigs.jsx` — same; fee label updated to "Service fee (flat)"
- `src/app-pages/MyOrders.jsx` — same
- `src/app-pages/Admin.jsx` — display text updated to "$3.50 flat fee per order"
- `src/introduction-pages/RefundPolicy.jsx` — "10%" → "$3.50"
- `src/introduction-pages/Terms.jsx` — "10% of the gig price" → "flat $3.50"
- `.env` — `VITE_SERVICE_FEE=3.50` (was 6.00)
- `.env.example` — renamed `VITE_SERVICE_FEE_PERCENT` → `VITE_SERVICE_FEE=3.50`

## Why
10% was unprofitable and wouldn't cover Stripe fees on low-price gigs.
