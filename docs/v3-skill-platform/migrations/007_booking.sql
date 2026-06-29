-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy v3 — Native booking (Phase 8)
-- Run once in the Supabase SQL editor (after 001–006). Idempotent.
--
-- Coaching blocks can be either an external link (existing) OR a native bookable
-- session. Creators set weekly availability; buyers who own the Skill book a slot.
-- ─────────────────────────────────────────────────────────────────────────────

-- Creator weekly availability (JSON) + timezone for slot generation/display.
--   booking_availability = { slot_minutes, weekly: { mon:[{start:'09:00',end:'17:00'}], ... } }
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS booking_availability JSONB,
    ADD COLUMN IF NOT EXISTS booking_timezone     TEXT;

-- A coaching block with booking_minutes set (and no external_url) = native booking.
ALTER TABLE content_blocks
    ADD COLUMN IF NOT EXISTS booking_minutes INTEGER;

-- ── bookings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    block_id     UUID REFERENCES content_blocks(id) ON DELETE SET NULL,
    creator_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    buyer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    status       TEXT NOT NULL DEFAULT 'booked'
                   CHECK (status IN ('booked','cancelled','completed')),
    reminder_sent BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bookings_creator_idx ON bookings(creator_id, start_time);
CREATE INDEX IF NOT EXISTS bookings_buyer_idx   ON bookings(buyer_id, start_time);
-- No two active bookings can hold the same creator slot.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_unique
    ON bookings(creator_id, start_time) WHERE status = 'booked';

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Read: the buyer or the creator.
DROP POLICY IF EXISTS "Parties read bookings" ON bookings;
CREATE POLICY "Parties read bookings"
    ON bookings FOR SELECT
    USING (auth.uid() = buyer_id OR auth.uid() = creator_id);

-- Book: only the buyer, and only if they own (paid for) the Skill.
DROP POLICY IF EXISTS "Buyers book purchased skills" ON bookings;
CREATE POLICY "Buyers book purchased skills"
    ON bookings FOR INSERT
    WITH CHECK (
        auth.uid() = buyer_id
        AND EXISTS (SELECT 1 FROM purchases p
                    WHERE p.skill_id = bookings.skill_id
                      AND p.buyer_id = auth.uid()
                      AND p.status = 'paid')
    );

-- Cancel/complete: either party may update their booking.
DROP POLICY IF EXISTS "Parties update bookings" ON bookings;
CREATE POLICY "Parties update bookings"
    ON bookings FOR UPDATE
    USING (auth.uid() = buyer_id OR auth.uid() = creator_id);

-- ── notifications: add booking types (full superset) ──────────────────────────
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'message', 'swap_request', 'gig_request',
        'swap_accepted', 'gig_accepted', 'swap_completed', 'gig_completed',
        'dispute_filed', 'dispute_resolved',
        'order_update', 'order_cancelled', 'payout_setup_required',
        'chargeback', 'gig_removed',
        'skill_update', 'skill_purchase', 'community_reply',
        'booking_confirmed', 'booking_cancelled', 'booking_reminder'
    )) NOT VALID;
