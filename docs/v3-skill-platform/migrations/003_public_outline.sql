-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Public Skill outline view (Phase 3)
-- Run once in the Supabase SQL editor (after 001/002). Idempotent.
--
-- content_blocks RLS hides gated content (body_text / file_key / external_url)
-- from non-buyers — correct. But the public sales page still needs to show a
-- "what's inside" teaser: just the TYPE and TITLE of each block, for PUBLISHED
-- Skills. This view exposes ONLY those safe columns. Views run with the owner's
-- privileges, so they bypass content_blocks RLS — which is exactly why we list
-- only non-sensitive columns here.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW skill_block_outline AS
SELECT cb.id, cb.skill_id, cb.type, cb.title, cb.position
FROM content_blocks cb
JOIN skills s ON s.id = cb.skill_id
WHERE s.status = 'published';

-- No body_text / file_key / external_url here — never expose gated content.
GRANT SELECT ON skill_block_outline TO anon, authenticated;
