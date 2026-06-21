# 03 — Digital Products Spec

The one genuinely new surface. A **digital product** is listed once and sold
many times with instant, automatic delivery — no request/accept/escrow.

## User stories

- As a creator, I upload a file (or paste a license/link), set a price and
  description, and publish. It appears in Explore.
- As a buyer, I open a product, click **Buy**, pay with card, and immediately
  get a download link. It lands in my **Library** forever.
- As a creator, I see units sold and earnings; payouts ride the existing Stripe
  Connect setup.

## Data model

```sql
-- ── products: instant-buy digital product listings ──────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),  -- 0 = free
    cover_url TEXT,                       -- public preview image
    category TEXT,
    tags TEXT[] DEFAULT '{}',

    -- delivery: exactly one of these is used per product
    delivery_type TEXT NOT NULL DEFAULT 'file'
        CHECK (delivery_type IN ('file', 'link', 'license')),
    file_path TEXT,                       -- path in private 'product-files' bucket
    external_url TEXT,                    -- for delivery_type = 'link'
    license_key TEXT,                     -- for delivery_type = 'license'

    is_active BOOLEAN DEFAULT true,
    sales_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_creator ON products(creator_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- Anyone can read active products; only the creator can write their own.
CREATE POLICY "Active products are public" ON products FOR SELECT
    USING (is_active = true OR auth.uid() = creator_id);
CREATE POLICY "Creators manage own products" ON products FOR ALL
    USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);


-- ── product_purchases: a paid purchase + delivery grant ─────────────────────
CREATE TABLE IF NOT EXISTS product_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES profiles(id),
    amount_cents INTEGER NOT NULL,
    fee_cents INTEGER NOT NULL DEFAULT 0,
    payment_intent_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON product_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON product_purchases(product_id);

ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer sees own purchases" ON product_purchases FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = creator_id);
-- Inserts/updates happen server-side (service role) on webhook confirmation.
CREATE POLICY "Service role writes purchases" ON product_purchases FOR INSERT
    WITH CHECK (true);
```

> Why a separate `products` table instead of reusing `gigs`: products have no
> escrow/dispute lifecycle, need file delivery, and have a `sales_count` (many
> buyers per listing). Mixing the two lifecycles into one table would make both
> harder to reason about. Services keep `gigs`/`gig_requests` untouched.

## File storage & delivery

- Bucket `product-files` is **private** (no public read policy).
- Upload: creator uploads to `product-files/{creator_id}/{uuid}/{filename}`;
  store that path in `products.file_path`.
- Delivery: only after a `product_purchases` row for `(buyer, product)` is
  `paid`, the backend issues a **signed URL** (`createSignedUrl`, short TTL,
  e.g. 5 min). The raw path is never sent to the client.
- `delivery_type = 'link'` / `'license'`: reveal `external_url` / `license_key`
  only to verified buyers (server-checked), same gate.

## Purchase flow (instant — no escrow)

```
Buyer clicks Buy
  → backend POST /api/products/buy { productId }
      - loads product, computes amount + fee
      - creates Stripe PaymentIntent (or Checkout Session)
      - inserts product_purchases row (status 'pending')
  → buyer pays (Stripe Elements / Checkout)
  → Stripe webhook payment_intent.succeeded
      - mark product_purchases.status = 'paid'
      - increment products.sales_count
      - (optional) transfer creator's cut via existing Connect transfer
  → buyer redirected to /library; download link available immediately
```

Contrast with services: products skip `escrow → release → 14-day clearance`.
Money can settle directly (still respecting Stripe Connect payout timing).
Reuse `webhooks.js` — add a branch keyed on metadata `{ kind: 'product' }` vs
the existing gig/escrow events.

## Backend endpoints (new — `backend/routes/products.js`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/products/buy` | Create PaymentIntent + pending purchase |
| `GET` | `/api/products/:id/download` | Verify purchase → return signed URL |
| (webhook) | `payment_intent.succeeded` | Fulfill purchase (in `webhooks.js`) |

CRUD for products themselves can go straight through Supabase from the client
(RLS already restricts writes to the creator), matching how v1 manages gigs.
File uploads use the Supabase Storage client directly.

## Frontend (new)

- `src/app-pages/ProductNew.jsx` — create/edit form (title, desc, price, cover,
  file upload, category/tags, delivery type). Route `/sell/products/new`.
- `src/app-pages/ProductDetail.jsx` — public detail + Buy button + Stripe.
  Route `/products/:productId`.
- `src/app-pages/Library.jsx` — buyer's purchases with download buttons.
  Route `/library`.
- `src/app-pages/Explore.jsx` — unified browse (products + services). Route
  `/explore`. Can start as a thin wrapper over the existing gigs browse plus a
  products grid.
- Extend `MyListings.jsx` to list the creator's products alongside services.

## Open questions (resolve in doc 04 / with product owner)

1. **Product fee:** flat or %? Same as the $6 service fee or different?
2. **Free products** (price 0) — allowed? (schema permits it.)
3. **Refunds** for digital goods — policy + admin action. (RefundPolicy page
   copy needs a digital-goods clause.)
4. **Direct charge vs. transfer:** charge platform then transfer to creator
   (current pattern), or Stripe destination charges? Current escrow code uses
   transfers — simplest to mirror.
