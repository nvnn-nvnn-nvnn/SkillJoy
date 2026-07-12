-- ─────────────────────────────────────────────────────────────────────────────
-- 026 — Product groups. Idempotent. Run once in the Supabase SQL editor.
--
-- Lets a creator bucket their storefront products under headings ("Start here",
-- "Bookings", "Digital products", …). Free-text label per product; the
-- storefront groups by it (first-seen order, preserving sort_order within a
-- group). NULL/'' = ungrouped (rendered first, no heading).
-- ⚠️ Must be RUN in prod before the group UI/render works.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE skills ADD COLUMN IF NOT EXISTS group_label TEXT;
