-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Memberships / recurring (Phase 6)
-- Run once in the Supabase SQL editor (after 001–004). Idempotent.
--
-- Membership Skills (pricing_type='membership') are sold as Stripe Subscriptions
-- with our application fee. Access is gated on a `paid` purchase row while the
-- subscription is active; it flips to `expired` when the sub ends.
-- ─────────────────────────────────────────────────────────────────────────────

-- Cache the recurring Stripe Price for a membership Skill.
ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Subscription bookkeeping on the purchase row.
ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS current_period_end     TIMESTAMPTZ;

-- Allow an 'expired' purchase status (membership ended / canceled).
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check
    CHECK (status IN ('pending', 'paid', 'refunded', 'expired'));

CREATE INDEX IF NOT EXISTS purchases_subscription_idx ON purchases(stripe_subscription_id);

COMMENT ON COLUMN purchases.current_period_end IS 'For memberships: when the current paid period ends (from Stripe).';
