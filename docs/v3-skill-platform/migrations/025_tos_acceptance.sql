-- ─────────────────────────────────────────────────────────────────────────────
-- 025 — Persist Terms-of-Service acceptance. Idempotent. Run once in the
-- Supabase SQL editor.
--
-- Onboarding forces an "I agree to the Terms" checkbox; this records WHEN it
-- was accepted and WHICH version (proof of consent, not just a UI gate).
-- Version string comes from TOS_VERSION in src/lib/config.js.
-- ⚠️ Must be RUN in prod before the app persists acceptance — until then the
-- upsert will error on the unknown columns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tos_version TEXT;
