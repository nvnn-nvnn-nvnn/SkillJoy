-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Commerce depth: discounts (Phase 10)
-- Run once in the Supabase SQL editor (after 001–008). Idempotent.
--
-- Percentage promo codes per creator, applied to ONE-TIME Skill checkouts.
-- Validation + application happen server-side (service role); redemption is
-- counted in the Stripe webhook on successful payment.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    percent_off     INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
    active          BOOLEAN NOT NULL DEFAULT true,
    max_redemptions INTEGER,                       -- null = unlimited
    times_redeemed  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);
-- One code per creator (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS discounts_creator_code_idx
    ON discounts(creator_id, upper(code));

ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;

-- Only the owner manages/reads their codes. (Buyers never read this table —
-- code validation is done server-side with the service-role key at checkout.)
DROP POLICY IF EXISTS "Creators manage their discounts" ON discounts;
CREATE POLICY "Creators manage their discounts"
    ON discounts FOR ALL
    USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- Record which code (if any) a purchase used.
ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS discount_code TEXT;
