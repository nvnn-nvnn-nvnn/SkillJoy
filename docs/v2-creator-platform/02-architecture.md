# 02 — Architecture

## Routes (`src/main.jsx`)

### Keep, relabel in UI only
`/gigs` → "Services" browse · `/gigs/:gigId` → service detail ·
`/my-listings` → creator dashboard · `/my-orders` → buyer orders ·
`/chat` · `/profile` · `/profile/:userId` · `/settings` · `/admin` ·
`/about` · `/contact` · `/how-it-works` · `/terms` · `/privacy` ·
`/refund-policy`

### New (doc 03)
- `/explore` — unified browse (products + services)
- `/products/:productId` — product detail + instant buy
- `/sell/products/new` — create a product
- `/library` — buyer's purchased products + download links

### Archive (route stays, unlinked from nav)
`/matches` · `/swaps` · `/my-swaps` · `/main-search` · `/disputes` ·
`/disputes/:disputeId` · `/verify-college`

> Archived routes remain registered so old links/bookmarks don't 404 and so the
> features can be re-enabled instantly. They're just removed from `Header.jsx`.

## Navigation (`src/components/Header.jsx`)

Replace the v1 link set. Proposed v2 primary nav:

| Link | Path | Notes |
|---|---|---|
| Explore | `/explore` | Browse products + services |
| Sell | `/my-listings` | Creator dashboard |
| Purchases | `/library` | What the user bought (products) + `/my-orders` (services) |
| Chat | `/chat` | unchanged |
| Profile | `/profile` | unchanged |

`unread.swap` badge logic drops from nav; `unread.gig` (service messages) stays.
Admin link stays (currently gated by hardcoded email — leave as-is).

## The college gate — single switch

Create `src/lib/config.js`:

```js
// Master switch for v1 campus behavior. v2 default = false (open to everyone).
export const CAMPUS_MODE = import.meta.env.VITE_CAMPUS_MODE === 'true';
```

Then guard each gate. Current gates (found in code):

- `Gigs.jsx:279` — `if (!profile?.college_verified) return <gate screen>`
  → `if (CAMPUS_MODE && !profile?.college_verified)`
- `Gigs.jsx:120` — `if (collegeVerified && universityDomain) query = query.eq('university_domain', …)`
  → wrap the domain filter in `if (CAMPUS_MODE && …)`
- Same `college_verified` / `university_domain` gating to audit in:
  `GigDetails.jsx`, `MyListings.jsx`, `Profile.jsx`, `Settings.jsx`,
  `Login.jsx`, `Home.jsx`, `About.jsx`, `main.jsx`.

**Rule:** never delete a `.edu`/`college_verified`/`university_domain` check —
only wrap it in `CAMPUS_MODE &&`. Flip `VITE_CAMPUS_MODE=true` to restore v1.

## Data model

### Existing (unchanged)
`profiles`, `gigs`, `gig_requests`, `swaps`, `messages`, `notifications`,
`favorites`, `dispute_evidence`. See `supabase/schema.sql`.

### New tables (full DDL in doc 03)
- `products` — instant-buy digital product listings.
- `product_purchases` — a buyer's paid purchase + delivery grant.

### New storage
- Supabase Storage bucket `product-files` — **private**. Files delivered via
  short-lived signed URLs after a verified purchase. Never expose the raw path.

### Migrations
Add new DDL to `supabase/schema.sql` (the consolidated archive) **and** keep a
dated migration snippet here in `docs/v2-creator-platform/migrations/` so the
SQL run in the Supabase editor is reproducible. Follow the v1 pattern:
`CREATE TABLE IF NOT EXISTS …`, enable RLS, add policies.

## Fees

v1 service fee lives in `backend/config/fees.js` (`SERVICE_FEE_CENTS = 600`).
For products, decide a separate product fee (flat or %). Document it alongside
the existing constant; do not silently reuse the $6 service fee for a $5
product. **Open decision — see doc 04.**

## Copy / branding pass

No logo/name change. Reframe user-facing strings: "gig" → "service", remove
"campus"/"student"/"college" framing from `Home.jsx`, `HowItWorks.jsx`,
`About.jsx`, onboarding, and nav. Keep it a find-and-review pass, not a blind
replace (some "skill" references are fine — the name is still SkillJoy).
