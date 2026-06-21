# 01 — Rebrand Map

Every v1 surface and its v2 fate. **Keep** = stays in the active flow.
**New** = build it. **Archive** = code/tables preserved but severed from the
primary user experience.

## Backend / data

| v1 surface | Fate | Notes |
|---|---|---|
| `gigs` table | **Keep & reframe** | Becomes the home of custom *services*. Already has title/description/price/tags/faqs. |
| `gig_requests` (escrow) | **Keep** | The per-buyer order + escrow flow for services. |
| `dispute_evidence`, dispute fields | **Keep** | Needed by the services side. |
| `swaps` table | **Archive** | Leave in DB; stop linking to it from nav. |
| `profiles.stripe_*`, Connect | **Keep** | Reused for product & service payouts. |
| `verify-college` route + `.edu` checks | **Sever** | Gate disabled via a single feature flag; code untouched. |
| `products` table | **NEW** | Instant-buy digital products. See doc 03. |
| `product_purchases` table | **NEW** | A buyer's purchase + download grant. See doc 03. |
| Supabase Storage `product-files` bucket | **NEW** | Private bucket; signed URLs for delivery. |

## Backend routes (`backend/routes/`)

| Route file | Fate |
|---|---|
| `payments.js` (create-intent, release) | **Keep**; add a product instant-charge endpoint (or new `products.js`). |
| `stripe-connect.js` | **Keep** as-is. |
| `webhooks.js` | **Keep**; extend to fulfill product purchases on `payment_intent.succeeded`. |
| `users.js`, `admin.js`, `reports.js`, `blocks.js`, `contact.js` | **Keep**. |
| `verify-college.js` | **Keep in code, unrouted/flagged off**. |

## Frontend pages (`src/app-pages/`)

| Page | Fate |
|---|---|
| `Gigs.jsx`, `GigDetails.jsx` | **Keep & relabel** → "Services". |
| `MyListings.jsx` | **Keep & extend** → manage products *and* services. |
| `MyOrders.jsx` | **Keep** → reframe as buyer orders/purchases. |
| `Matches.jsx`, `Swaps.jsx`, `MySwaps.jsx` | **Archive** — remove from primary nav; keep routes reachable. |
| `Disputes.jsx`, `DisputeDetail.jsx` | **Keep** but demote (accessible from an order, not top nav). |
| `Chat.jsx`, `Profile.jsx`, `Settings.jsx`, `Admin.jsx` | **Keep**, reframe copy. |
| `VerifyCollege.jsx` | **Keep in code**, route can stay but unlinked. |
| Product browse / detail / library | **NEW**. See doc 03. |

## Frontend intro pages (`src/introduction-pages/`)

| Page | Fate |
|---|---|
| `Home.jsx` (landing) | **Rewrite** copy for "everyday creators." |
| `HowItWorks.jsx`, `About.jsx` | **Rewrite** copy. |
| `Terms.jsx`, `Privacy.jsx`, `RefundPolicy.jsx`, `Contact.jsx` | **Keep**; light copy review (digital-goods refund terms). |

## Navigation (`src/components/Header.jsx`)

v1 primary nav: Matches · Swaps · Gigs · Orders · Disputes · Chat · Profile

**v2 primary nav (proposed):** Explore · Sell · My Purchases · Chat · Profile
- *Explore* = browse products + services
- *Sell* = creator dashboard (products + services + earnings)
- Swaps / Matches / Disputes drop out of the top bar (Disputes reachable from an
  order; Swaps/Matches reachable only via direct URL while archived).

## The college gate — how "sever" works

Add one flag (e.g. `VITE_CAMPUS_MODE=false` / a constant in
`src/lib/config.js`). Every `.edu` gate and `verify-college` redirect checks the
flag. When `false` (default for v2): no gate, anyone can list/buy. When `true`:
v1 campus behavior returns. **No verification code is deleted.** Details in
doc 02.
