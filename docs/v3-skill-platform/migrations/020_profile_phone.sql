-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Profile phone number
-- Run once in the Supabase SQL editor. Idempotent.
--
-- Collected at account creation (name + phone), before the user claims a handle.
-- Stored plain (capture only, not SMS-verified).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS phone TEXT;
