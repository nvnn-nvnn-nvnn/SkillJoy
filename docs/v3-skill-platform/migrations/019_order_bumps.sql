-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Order bumps (checkout conversion)
-- Run once in the Supabase SQL editor. Idempotent.
--
-- An order bump offers ONE of the creator's other one-time products as an add-on
-- at checkout, optionally at a discounted price. Because the bump is the same
-- creator's product, it rides the existing single PaymentIntent + single transfer
-- (one platform fee on the combined total). Fulfilment grants a 2nd purchase row.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE skills
    -- The product offered as an add-on at this product's checkout (same creator).
    ADD COLUMN IF NOT EXISTS order_bump_skill_id  UUID REFERENCES skills(id) ON DELETE SET NULL,
    -- Optional override price for the bump at checkout (cents). NULL → the bump
    -- product's own price_cents is used.
    ADD COLUMN IF NOT EXISTS order_bump_price_cents INTEGER,
    -- Optional headline shown on the bump offer, e.g. "Add the templates pack".
    ADD COLUMN IF NOT EXISTS order_bump_blurb      TEXT;

COMMENT ON COLUMN skills.order_bump_skill_id IS 'Another product of the same creator offered as an add-on at checkout.';
COMMENT ON COLUMN skills.order_bump_price_cents IS 'Discounted bump price in cents; NULL uses the bump product''s own price.';
