-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Transparent payout trust fields (Phase 5)
-- Run once in the Supabase SQL editor (after 001–003). Idempotent.
--
-- The trust promise (doc 06): "We never freeze your money in silence." Any hold
-- is set by a HUMAN and carries a reason shown to the creator verbatim. These
-- columns are only ever set by an admin/human action — there is no automated
-- code path that flips them.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS payout_held        BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS payout_hold_reason TEXT;

COMMENT ON COLUMN profiles.payout_held IS 'Human-set only. When true, surface the reason to the creator; never auto-set.';
