-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Skill-platform foundation (Phase 1)
-- Run this once in the Supabase SQL editor. Idempotent (safe to re-run).
-- Adds: profiles.username/bio/storefront_theme + 5 new tables + RLS.
-- Spec: docs/v3-skill-platform/03-architecture-and-data-model.md
-- ─────────────────────────────────────────────────────────────────────────────


-- ── profiles: storefront identity ────────────────────────────────────────────
-- `bio` may already exist from v1 (used in onboarding) — IF NOT EXISTS keeps
-- this safe either way.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS username         TEXT,
    ADD COLUMN IF NOT EXISTS bio              TEXT,
    ADD COLUMN IF NOT EXISTS storefront_theme JSONB;

-- Case-insensitive unique handle for /@username. Stored lowercased by the app;
-- this index enforces uniqueness regardless of case as a backstop.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
    ON profiles (lower(username)) WHERE username IS NOT NULL;

COMMENT ON COLUMN profiles.username IS 'The @handle for the public storefront at /@username';


-- ── skills ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    outcome      TEXT,                       -- one-line promise / subtitle
    cover_url    TEXT,
    price_cents  INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    pricing_type TEXT NOT NULL DEFAULT 'onetime'
                   CHECK (pricing_type IN ('onetime','membership')),
    version      INTEGER NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published')),
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skills_creator_idx   ON skills(creator_id);
CREATE INDEX IF NOT EXISTS skills_published_idx ON skills(creator_id, status);


-- ── content_blocks ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_blocks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    type         TEXT NOT NULL
                   CHECK (type IN ('video','file','prompt','workflow','text','coaching')),
    position     INTEGER NOT NULL DEFAULT 0,   -- ordering in the builder
    title        TEXT,
    body_text    TEXT,        -- prompt / text / workflow content (rich text)
    file_key     TEXT,        -- storage key (NOT a public URL — minted on demand)
    external_url TEXT,        -- video embed URL or coaching booking link
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_blocks_skill_idx ON content_blocks(skill_id, position);


-- ── purchases ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id            UUID NOT NULL REFERENCES profiles(id),
    skill_id            UUID NOT NULL REFERENCES skills(id),
    version_at_purchase INTEGER NOT NULL,
    amount_cents        INTEGER NOT NULL,
    stripe_payment_id   TEXT,                       -- PaymentIntent id
    status              TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','paid','refunded')),
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (buyer_id, skill_id)                     -- one purchase per buyer/skill
);
CREATE INDEX IF NOT EXISTS purchases_buyer_idx ON purchases(buyer_id);
CREATE INDEX IF NOT EXISTS purchases_skill_idx ON purchases(skill_id);


-- ── community_posts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS community_posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id       UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    author_id      UUID NOT NULL REFERENCES profiles(id),
    body           TEXT NOT NULL,
    parent_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE, -- reply
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_posts_skill_idx ON community_posts(skill_id, created_at);


-- ── analytics_events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id   UUID REFERENCES skills(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- storefront-level views
    type       TEXT NOT NULL
                 CHECK (type IN ('storefront_view','skill_view','checkout_start','purchase','block_open')),
    buyer_id   UUID REFERENCES profiles(id),       -- nullable (anon storefront views)
    block_id   UUID REFERENCES content_blocks(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_skill_type_idx ON analytics_events(skill_id, type, created_at);
CREATE INDEX IF NOT EXISTS analytics_creator_idx    ON analytics_events(creator_id, type, created_at);


-- ── notifications: allow the skill_update type ───────────────────────────────────
-- v1 created this CHECK; widen it so version-bump notifications are valid.
-- Superset of EVERY type the app inserts (v1 + v3). Must stay complete or
-- inserts will fail. `NOT VALID` skips re-checking existing rows so legacy data
-- can never block this migration — new rows are still validated.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        -- v1:
        'message', 'swap_request', 'gig_request',
        'swap_accepted', 'gig_accepted', 'swap_completed', 'gig_completed',
        'dispute_filed', 'dispute_resolved',
        'order_update', 'order_cancelled', 'payout_setup_required',
        'chargeback', 'gig_removed',
        -- v3 Skill platform:
        'skill_update', 'skill_purchase', 'community_reply'
    )) NOT VALID;


-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- Mirrors the v1 pattern: enable RLS per table, owner-scoped policies.
-- Server-side fulfilment (purchases, signed URLs) uses the service-role key,
-- which bypasses RLS — these policies govern the public anon/auth client only.
-- ─────────────────────────────────────────────────────────────────────────────

-- skills ----------------------------------------------------------------------
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Published skills are public" ON skills;
CREATE POLICY "Published skills are public"
    ON skills FOR SELECT USING (status = 'published' OR auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators manage their own skills" ON skills;
CREATE POLICY "Creators manage their own skills"
    ON skills FOR ALL USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- content_blocks --------------------------------------------------------------
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

-- Creators manage blocks on their own skills.
DROP POLICY IF EXISTS "Creators manage their skill blocks" ON content_blocks;
CREATE POLICY "Creators manage their skill blocks"
    ON content_blocks FOR ALL
    USING (EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_id AND s.creator_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_id AND s.creator_id = auth.uid()));

-- Buyers with a PAID purchase can read the blocks (the gated content).
-- The public sales page shows titles/metadata via the backend, not this policy.
DROP POLICY IF EXISTS "Buyers read purchased blocks" ON content_blocks;
CREATE POLICY "Buyers read purchased blocks"
    ON content_blocks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM purchases p
        WHERE p.skill_id = content_blocks.skill_id
          AND p.buyer_id = auth.uid()
          AND p.status = 'paid'
    ));

-- purchases -------------------------------------------------------------------
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Buyers read their own purchases; creators see purchases of their skills.
DROP POLICY IF EXISTS "Buyers and creators read purchases" ON purchases;
CREATE POLICY "Buyers and creators read purchases"
    ON purchases FOR SELECT
    USING (
        auth.uid() = buyer_id
        OR EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_id AND s.creator_id = auth.uid())
    );
-- NOTE: no INSERT/UPDATE policy on purpose. Fulfilment is service-role only
-- (the Stripe webhook), never the client.

-- community_posts -------------------------------------------------------------
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- Read/post if you bought the skill OR you're the creator.
DROP POLICY IF EXISTS "Members read community" ON community_posts;
CREATE POLICY "Members read community"
    ON community_posts FOR SELECT
    USING (
        EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_id AND s.creator_id = auth.uid())
        OR EXISTS (SELECT 1 FROM purchases p WHERE p.skill_id = community_posts.skill_id AND p.buyer_id = auth.uid() AND p.status = 'paid')
    );

DROP POLICY IF EXISTS "Members post to community" ON community_posts;
CREATE POLICY "Members post to community"
    ON community_posts FOR INSERT
    WITH CHECK (
        auth.uid() = author_id AND (
            EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_id AND s.creator_id = auth.uid())
            OR EXISTS (SELECT 1 FROM purchases p WHERE p.skill_id = community_posts.skill_id AND p.buyer_id = auth.uid() AND p.status = 'paid')
        )
    );

-- Authors delete their own posts; the skill's creator can delete any post.
DROP POLICY IF EXISTS "Authors or creator delete posts" ON community_posts;
CREATE POLICY "Authors or creator delete posts"
    ON community_posts FOR DELETE
    USING (
        auth.uid() = author_id
        OR EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_id AND s.creator_id = auth.uid())
    );

-- analytics_events ------------------------------------------------------------
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) may record an event; only the skill/storefront creator
-- may read aggregates. (Tighten/route through backend later if abused.)
DROP POLICY IF EXISTS "Anyone can record events" ON analytics_events;
CREATE POLICY "Anyone can record events"
    ON analytics_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Creators read their analytics" ON analytics_events;
CREATE POLICY "Creators read their analytics"
    ON analytics_events FOR SELECT
    USING (
        auth.uid() = creator_id
        OR EXISTS (SELECT 1 FROM skills s WHERE s.id = skill_id AND s.creator_id = auth.uid())
    );
