-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Email capture + marketing (Phase 9)
-- Run once in the Supabase SQL editor (after 001–007). Idempotent.
--
-- Storefront lead capture → subscribers. Creators send broadcasts (logged here,
-- delivered by the backend via Resend).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscribers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    name       TEXT,
    source     TEXT DEFAULT 'storefront',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (creator_id, email)
);
CREATE INDEX IF NOT EXISTS subscribers_creator_idx ON subscribers(creator_id, created_at);

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon visitors) can subscribe to a creator's list.
DROP POLICY IF EXISTS "Anyone can subscribe" ON subscribers;
CREATE POLICY "Anyone can subscribe"
    ON subscribers FOR INSERT WITH CHECK (true);

-- Only the creator can read / remove their own subscribers.
DROP POLICY IF EXISTS "Creators read their subscribers" ON subscribers;
CREATE POLICY "Creators read their subscribers"
    ON subscribers FOR SELECT USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators remove their subscribers" ON subscribers;
CREATE POLICY "Creators remove their subscribers"
    ON subscribers FOR DELETE USING (auth.uid() = creator_id);


-- ── broadcasts: a log of sent campaigns ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS broadcasts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject         TEXT NOT NULL,
    body            TEXT,
    recipient_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broadcasts_creator_idx ON broadcasts(creator_id, created_at);

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;

-- Reads by the owner. Inserts happen server-side (service role) after sending.
DROP POLICY IF EXISTS "Creators read their broadcasts" ON broadcasts;
CREATE POLICY "Creators read their broadcasts"
    ON broadcasts FOR SELECT USING (auth.uid() = creator_id);
