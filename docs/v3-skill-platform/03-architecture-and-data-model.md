# 03 — Architecture & Data Model

## Stack decision

The spec **recommends** Next.js (App Router) + Supabase + Vercel. SkillJoy
already runs on:

- **Frontend:** React 19 + Vite + React Router v6 + Tailwind (in `src/`)
- **Backend:** Node + Express 5 (in `backend/`)
- **DB/Auth/Storage:** Supabase (Postgres + Auth + Realtime + Storage)
- **Payments:** Stripe (Connect Express already wired)
- **Deploy:** Frontend → Vercel (`vercel.json`), Backend → Railway
  (`railway.json`)

**Decision: keep the existing Vite + React + Express stack.** The spec says
"swap if you have strong preference," and rewriting a working app with live
Stripe Connect + Supabase Auth into Next.js is a large, risky cost with no MVP
payoff. We adapt the spec to this stack.

> **Open question (owner to confirm):** the only thing Next.js buys here is SSR
> for storefront SEO/social-share previews. For a link-in-bio shared directly to
> an audience, client-rendered + good Open Graph meta tags is enough at MVP. If
> SEO becomes a priority later, revisit. **No rewrite for MVP.**

## Route map (React Router, `src/main.jsx`)

New v3 routes to add. Public storefront is the headline route.

| Route | Page (`src/app-pages/`) | Access |
|-------|--------------------------|--------|
| `/@:username` | `Storefront.jsx` (new) | public |
| `/@:username/:skillId` | `SkillPublic.jsx` (new) — sales/landing page for one Skill | public |
| `/build` | `SkillBuilder.jsx` (new) — list of my Skills | creator |
| `/build/:skillId` | `SkillBuilder.jsx` (new) — edit one Skill | creator |
| `/checkout/:skillId` | `Checkout.jsx` (new) | buyer |
| `/locker` | `Locker.jsx` (new) — permanent purchases | buyer |
| `/locker/:skillId` | `SkillConsume.jsx` (new) — consume blocks + community | buyer |
| `/dashboard` | `Dashboard.jsx` (new) — sales/payouts/analytics | creator |
| `/settings/payouts` | reuse Stripe Connect onboarding | creator |

**`/@:username` note:** React Router matches `/@:username` fine, but SPA deep
links need a rewrite so the server returns `index.html`. Confirm `vercel.json`
has a catch-all rewrite to `/index.html` (it likely does for the existing SPA —
verify before relying on `/@handle` links shared on social).

## Mapping the spec's data model onto the existing schema

Spec starter (doc 11 of the source spec):

```
users            → existing `profiles` (add `username`)
skills           → NEW table
content_blocks   → NEW table
purchases        → NEW table
community_posts  → NEW table
analytics_events → NEW table
```

### `profiles` (existing — extend, don't replace)

Already has: `full_name`, `avatar_url`, `stripe_account_id`,
`stripe_onboarded`, `notification_prefs`, `privacy_settings`, `offers_gigs`.

Add for v3:
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,   -- the @handle for /@username
  ADD COLUMN IF NOT EXISTS bio TEXT,               -- storefront tagline
  ADD COLUMN IF NOT EXISTS storefront_theme JSONB; -- minimal: accent color etc.
```
`stripe_account_id` / `stripe_onboarded` already exist → reuse for payouts.

### `skills` (new)
```sql
CREATE TABLE skills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  outcome       TEXT,                       -- one-line promise / subtitle
  cover_url     TEXT,
  price_cents   INTEGER NOT NULL DEFAULT 0,
  pricing_type  TEXT NOT NULL DEFAULT 'onetime'
                  CHECK (pricing_type IN ('onetime','membership')),
  version       INTEGER NOT NULL DEFAULT 1,
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','published')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX skills_creator_idx ON skills(creator_id);
CREATE INDEX skills_published_idx ON skills(creator_id, status);
```

### `content_blocks` (new)
```sql
CREATE TABLE content_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  type         TEXT NOT NULL
                 CHECK (type IN ('video','file','prompt','workflow','text','coaching')),
  position     INTEGER NOT NULL DEFAULT 0,   -- ordering in the builder
  title        TEXT,
  body_text    TEXT,        -- prompt/text/workflow content (rich text)
  file_key     TEXT,        -- storage key (NOT a public URL — see doc 05)
  external_url TEXT,        -- video embed URL or coaching booking link
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX content_blocks_skill_idx ON content_blocks(skill_id, position);
```
*(Spec names this column `file_url`; we store a `file_key` instead and mint
signed URLs on demand — see doc 05. Same intent, safer.)*

### `purchases` (new)
```sql
CREATE TABLE purchases (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id           UUID NOT NULL REFERENCES profiles(id),
  skill_id           UUID NOT NULL REFERENCES skills(id),
  version_at_purchase INTEGER NOT NULL,
  amount_cents       INTEGER NOT NULL,
  stripe_payment_id  TEXT,                       -- PaymentIntent id
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','paid','refunded')),
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (buyer_id, skill_id)                    -- one purchase per buyer/skill
);
CREATE INDEX purchases_buyer_idx ON purchases(buyer_id);
CREATE INDEX purchases_skill_idx ON purchases(skill_id);
```
Note: locker always shows the **current** skill version, not
`version_at_purchase` (that field is for the "Updated to vN" indicator).

### `community_posts` (new)
```sql
CREATE TABLE community_posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id       UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  author_id      UUID NOT NULL REFERENCES profiles(id),
  body           TEXT NOT NULL,
  parent_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE, -- reply
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX community_posts_skill_idx ON community_posts(skill_id, created_at);
```

### `analytics_events` (new)
```sql
CREATE TABLE analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id   UUID REFERENCES skills(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- for storefront-level views
  type       TEXT NOT NULL
               CHECK (type IN ('storefront_view','skill_view','checkout_start','purchase','block_open')),
  buyer_id   UUID REFERENCES profiles(id),  -- nullable (anon storefront views)
  block_id   UUID REFERENCES content_blocks(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX analytics_skill_type_idx ON analytics_events(skill_id, type, created_at);
```

## Row-Level Security (mirror the existing pattern)

The codebase already enables RLS per table with owner-scoped policies. Match it:

- **`skills`**: public `SELECT` where `status = 'published'`; creator full CRUD on
  own rows (`auth.uid() = creator_id`).
- **`content_blocks`**: `SELECT` allowed if the parent skill is published AND the
  caller has a paid `purchase` (gate the *content*; the sales page shows only
  titles/metadata). Creator full CRUD on own skill's blocks.
- **`purchases`**: buyer reads own; **inserts/fulfilment go through the backend
  service role only** (webhook), never client-inserted.
- **`community_posts`**: `SELECT`/`INSERT` only if caller has a paid purchase of
  the skill OR is the creator; author can delete own; creator can delete any.
- **`analytics_events`**: `INSERT` open (events fire from clients incl. anon);
  `SELECT` restricted to the skill's creator. Consider routing writes through the
  backend to avoid abuse.

> **Security note:** never trust the client for access gating. Block content +
> signed URLs + community access are all checked server-side against a paid
> `purchases` row. See doc 05.

## Backend route map (`backend/routes/`)

Existing: `admin, blocks (user-blocking), contact, payments, reports,
stripe-connect, users, verify-college, webhooks`.

Add for v3:

| Route file | Endpoints |
|------------|-----------|
| `skills.js` | CRUD for skills + blocks; `POST /:id/publish`; `POST /:id/version` (bump + notify buyers) |
| `checkout.js` | `POST /:skillId/intent` — create PaymentIntent (destination charge, app fee) + pending purchase |
| `webhooks.js` *(extend)* | on `payment_intent.succeeded` with `metadata.kind='skill'` → mark purchase paid, grant access |
| `locker.js` | `GET /` my purchases; `GET /:skillId` consume view; `GET /block/:blockId/download` → fresh signed URL (verify purchase) |
| `community.js` | list/create posts + replies (purchase-gated) |
| `analytics.js` | `POST /event` ingest; `GET /skill/:id` + `GET /creator` aggregates |

Reuse as-is: `stripe-connect.js` (onboarding/status/balance), `users.js`,
`webhooks.js` skeleton.

## Files to add at a glance (frontend)

- `src/app-pages/Storefront.jsx`, `SkillPublic.jsx`, `SkillBuilder.jsx`,
  `Checkout.jsx`, `Locker.jsx`, `SkillConsume.jsx`, `Dashboard.jsx`
- `src/components/` — `BlockEditor.jsx` (per-type block forms),
  `BlockRenderer.jsx` (buyer view), `SkillCard.jsx`, `CommunityThread.jsx`,
  `AnalyticsCards.jsx`, `PayoutStatus.jsx`
- `src/lib/api.js` — add `skills`, `purchases`, `community`, `analytics` clients
- `src/lib/config.js` — `LEGACY_MODE` flag to park v1 swaps/escrow/gigs/`.edu`

> ⚠️ **Naming clash:** `src/components/BlockButton.jsx` + `backend/routes/blocks.js`
> already exist and mean **user blocking**, not content blocks. Use
> `BlockEditor` / `BlockRenderer` / `content-blocks` naming for Skill blocks to
> avoid confusion.

Phasing and order in [doc 07](07-roadmap-and-implementation.md).
