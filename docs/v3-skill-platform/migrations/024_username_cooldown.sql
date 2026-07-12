-- ─────────────────────────────────────────────────────────────────────────────
-- 024 — Username change cooldown. Idempotent. Run once in the Supabase SQL editor.
--
-- Tracks WHEN a creator last changed their handle so the backend can enforce
-- "at most once per 15 days" (backend/routes/users.js POST /username).
-- NULL = never changed → a change is always allowed.
-- ⚠️ The feature silently never-cooldowns until this runs in prod.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_changed_at TIMESTAMPTZ;
