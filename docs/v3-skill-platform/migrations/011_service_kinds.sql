-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Service kinds (product type)
-- Run once in the Supabase SQL editor (after 001–010). Idempotent.
--
--   skills.kind — what a Skill *is* (a downloadable, a course, a coaching call…).
--                 This is independent of pricing_type, which is *how* it's billed:
--                   kind = 'membership'  → the product is an ongoing membership
--                   pricing_type = 'membership' → billed as a recurring subscription
--                 A coaching call (kind) can still be one-time (pricing_type), etc.
--   Powers the type tabs on the /services dashboard and the "New service" picker.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE skills
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'digital'
        CHECK (kind IN ('digital','course','coaching','membership','webinar','lead','bundle'));

CREATE INDEX IF NOT EXISTS skills_kind_idx ON skills(creator_id, kind);

COMMENT ON COLUMN skills.kind IS 'Product type: digital|course|coaching|membership|webinar|lead|bundle. What it is, not how it bills (see pricing_type).';
