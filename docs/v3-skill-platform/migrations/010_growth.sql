-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Growth / automation (Phase 11)
-- Run once in the Supabase SQL editor (after 001–009). Idempotent.
--
--   tracking_pixels = { meta, tiktok, ga4 }  — pixel IDs injected on the
--                      creator's public storefront + sales pages.
--   automation_webhook_url — outbound POST target for events (sales) so creators
--                      can wire Zapier/Make/AutoDM tools.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS tracking_pixels        JSONB,
    ADD COLUMN IF NOT EXISTS automation_webhook_url TEXT;
