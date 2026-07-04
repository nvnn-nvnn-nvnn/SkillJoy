-- 015 — Coaching scheduling controls (per coaching block). Idempotent.
-- booking_minutes (duration) already exists. Adds a buffer after each session
-- and a minimum-notice window (prevents last-minute bookings). Timezone is a
-- per-creator setting on profiles.booking_timezone (already present).
alter table public.content_blocks add column if not exists buffer_minutes     integer not null default 0;
alter table public.content_blocks add column if not exists min_notice_minutes integer not null default 0;
