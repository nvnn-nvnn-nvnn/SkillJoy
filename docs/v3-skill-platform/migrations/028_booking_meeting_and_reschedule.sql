-- ─────────────────────────────────────────────────────────────────────────────
-- 028 — Meeting links + reschedule support for native bookings. Idempotent.
--
-- Three things a booked session was missing:
--   1. somewhere for the call to actually happen (a meeting URL)
--   2. a record that it moved (reschedule), which calendar invites need in
--      order to REPLACE the old event instead of creating a duplicate
--   3. a notification type for the move
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1 · Meeting link ─────────────────────────────────────────────────────────
-- On the block: the creator's standing call link (Zoom personal room, Meet, …),
-- edited in the coaching block editor.
alter table public.content_blocks
    add column if not exists meeting_url text;

-- On the booking: a SNAPSHOT of that link, copied at booking time.
--
-- Why snapshot rather than always join through to the block:
--   · block_id is ON DELETE SET NULL — deleting the block would otherwise strand
--     every past booking with no way to see where the call was
--   · the .ics file and confirmation email are already in the attendee's
--     calendar and inbox with a fixed URL. Reading live would let those silently
--     disagree with what the buyer was actually sent.
-- Reschedules re-copy the current block link, so updating your Zoom room does
-- propagate — just at an explicit, auditable moment rather than invisibly.
alter table public.bookings
    add column if not exists meeting_url text;

-- ── 1b · Buyer timezone ──────────────────────────────────────────────────────
-- The creator's zone lives on profiles.booking_timezone, but the buyer's was
-- never stored — the UI got away with it because the browser renders instants
-- locally on its own. Email can't: the server has to pick a zone when it
-- formats "Thu, Aug 21 at 2:00 PM", and picking the creator's would tell the
-- buyer a time that isn't theirs. Captured from the browser at booking time.
alter table public.bookings
    add column if not exists buyer_timezone text;

-- ── 2 · Reschedule tracking ──────────────────────────────────────────────────
-- reschedule_count doubles as the iCalendar SEQUENCE number. Per RFC 5545 a
-- calendar client treats (same UID, higher SEQUENCE) as "this event moved" and
-- updates in place; a missing/equal SEQUENCE can leave the stale event behind.
-- The UID itself is derived from the booking id, so it needs no column.
alter table public.bookings
    add column if not exists rescheduled_at   timestamptz,
    add column if not exists reschedule_count integer not null default 0;

-- ── 3 · Notification type ────────────────────────────────────────────────────
-- Full superset re-stated (the constraint is replaced, not appended to).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
    check (type in (
        'message', 'swap_request', 'gig_request',
        'swap_accepted', 'gig_accepted', 'swap_completed', 'gig_completed',
        'dispute_filed', 'dispute_resolved',
        'order_update', 'order_cancelled', 'payout_setup_required',
        'chargeback', 'gig_removed',
        'skill_update', 'skill_purchase', 'community_reply',
        'booking_confirmed', 'booking_cancelled', 'booking_reminder',
        'booking_rescheduled'
    )) not valid;

-- ── 4 · Let the reminder cron send a SECOND reminder after a move ────────────
-- reminder_sent is reset to false on reschedule (done in the app, not here) so
-- a moved session still gets its 24h nudge at the NEW time. Without that, a
-- booking rescheduled after its reminder fired would never remind again.
-- Index supports the hourly cron's exact filter.
create index if not exists bookings_reminder_due_idx
    on public.bookings (start_time)
    where status = 'booked' and reminder_sent = false;
