-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Storefront editor / design control (Phase 7)
-- Run once in the Supabase SQL editor (after 001–005). Idempotent.
--
-- Theme lives in profiles.storefront_theme (jsonb, added in 001):
--   { accent, layout: 'list'|'grid', banner_url, socials: [{type,url}] }
-- This migration adds Skill ordering + a store_links table for the link buttons
-- (external + affiliate) Stan-style storefronts show alongside products.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS skills_sort_idx ON skills(creator_id, sort_order);

-- ── store_links: external / affiliate link buttons on the storefront ──────────
CREATE TABLE IF NOT EXISTS store_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    url         TEXT NOT NULL,
    position    INTEGER NOT NULL DEFAULT 0,
    is_affiliate BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_links_creator_idx ON store_links(creator_id, position);

ALTER TABLE store_links ENABLE ROW LEVEL SECURITY;

-- Anyone can read a creator's links (they're public storefront content).
DROP POLICY IF EXISTS "Store links are public" ON store_links;
CREATE POLICY "Store links are public"
    ON store_links FOR SELECT USING (true);

-- Only the owner manages their links.
DROP POLICY IF EXISTS "Creators manage their links" ON store_links;
CREATE POLICY "Creators manage their links"
    ON store_links FOR ALL
    USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
