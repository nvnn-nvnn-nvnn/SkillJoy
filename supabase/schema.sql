-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy — Schema REFERENCE (not a runnable bootstrap)
--
-- ⚠️ READ THIS BEFORE TRUSTING THE FILE.
--
-- The source of truth is docs/v3-skill-platform/migrations/ (001–028), applied
-- in order. THIS file is a hand-maintained reading copy, and hand-maintained
-- copies drift — as of 2026-08-21 it had fallen five tables and ~35 columns
-- behind, while still claiming to reproduce the database on a fresh project.
-- Someone who believed that claim would have got a broken DB.
--
-- What it is good for: reading the shape of a table without opening 28 files.
-- What it is NOT: a bootstrap script, or an authority on what production has.
--
-- To reproduce the DB:  run the migrations in order.
-- To see what's REALLY live:  dump it, don't read this —
--   supabase db dump --schema public   (or the Dashboard → Database → Schema)
--
-- When you add a migration, mirror it here in the same pass, or delete this
-- file. A reference that is 90% right is more dangerous than no reference.
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Notifications table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'message', 'swap_request', 'gig_request',
        'swap_accepted', 'gig_accepted', 'swap_completed', 'gig_completed',
        'dispute_filed', 'dispute_resolved',
        'order_update', 'order_cancelled', 'payout_setup_required',
        'chargeback', 'gig_removed',
        -- v3 Skill platform (see migrations/001):
        'skill_update', 'skill_purchase', 'community_reply'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    related_id UUID,
    related_type TEXT CHECK (related_type IN ('swap', 'gig', 'message')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert notifications"
    ON notifications FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID, p_type TEXT, p_title TEXT, p_message TEXT,
    p_related_id UUID DEFAULT NULL, p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
    VALUES (p_user_id, p_type, p_title, p_message, p_related_id, p_related_type)
    RETURNING id INTO v_notification_id;
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_gig_request ON gig_requests;
CREATE TRIGGER trigger_notify_gig_request
    AFTER INSERT OR UPDATE ON gig_requests FOR EACH ROW EXECUTE FUNCTION notify_new_gig_request();


-- ── Favorites table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    favorited_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, favorited_id, type),
    CHECK (user_id != favorited_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favorites"
    ON favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own favorites"
    ON favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own favorites"
    ON favorites FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites(user_id);
CREATE INDEX IF NOT EXISTS favorites_favorited_id_idx ON favorites(favorited_id);


-- ── Gigs: FAQs, tags ─────────────────────────────────────────────────────────

ALTER TABLE gigs ADD COLUMN IF NOT EXISTS faqs JSONB;
ALTER TABLE gigs ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS gigs_faqs_idx ON gigs USING GIN (faqs);

COMMENT ON COLUMN gigs.faqs IS 'Array of FAQ objects {question, answer} for the gig listing';
COMMENT ON COLUMN gigs.tags IS 'Searchable tags for the gig e.g. fast-delivery, remote, beginner-friendly';


-- ── gig_requests: payment escrow fields ──────────────────────────────────────

ALTER TABLE gig_requests
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid',
    ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2),
    ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
    ADD COLUMN IF NOT EXISTS escrow_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS release_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auto_release_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS clearance_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS chat_archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
    ADD COLUMN IF NOT EXISTS dispute_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispute_resolved_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

ALTER TABLE gig_requests DROP CONSTRAINT IF EXISTS gig_requests_payment_status_check;
ALTER TABLE gig_requests ADD CONSTRAINT gig_requests_payment_status_check
    CHECK (payment_status IN ('pending', 'unpaid', 'paid', 'escrowed', 'released', 'cleared', 'disputed', 'refunded', 'withdrawn'));

ALTER TABLE gig_requests DROP CONSTRAINT IF EXISTS gig_requests_gig_id_requester_id_key;
ALTER TABLE gig_requests DROP CONSTRAINT IF EXISTS gig_requests_gig_id_requester_id_unique;
ALTER TABLE gig_requests DROP CONSTRAINT IF EXISTS unique_gig_request;
DROP INDEX IF EXISTS gig_requests_gig_id_requester_id_key;
DROP INDEX IF EXISTS gig_requests_gig_id_requester_id_idx;

CREATE INDEX IF NOT EXISTS idx_gig_requests_payment_status ON gig_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_gig_requests_auto_release_date ON gig_requests(auto_release_date);

COMMENT ON COLUMN gig_requests.payment_status IS
    'unpaid → escrowed → released (14-day clearance) → cleared (funds sent) | disputed → refunded | withdrawn';
COMMENT ON COLUMN gig_requests.clearance_date IS '14 days after release_date — when Stripe transfer fires';
COMMENT ON COLUMN gig_requests.chat_archived_at IS 'Set 24h after completion (cron) or manually by buyer';


-- ── Dispute evidence table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dispute_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES gig_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);

ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view evidence" ON dispute_evidence FOR SELECT
    USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM gig_requests
        WHERE id = dispute_id AND (requester_id = auth.uid() OR provider_id = auth.uid())
    ));
CREATE POLICY "Users can submit evidence" ON dispute_evidence FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ── profiles: settings, avatar, stripe ──────────────────────────────────────

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT
        '{"swapRequests":true,"gigRequests":true,"messages":true,"reviews":true}'::jsonb,
    ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT
        '{"showEmail":false,"showAvailability":true,"allowMessages":true}'::jsonb,
    ADD COLUMN IF NOT EXISTS avatar_url TEXT,
    ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
    ADD COLUMN IF NOT EXISTS stripe_onboarded BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS offers_gigs BOOLEAN DEFAULT false;


-- ── v3 Skill platform ─────────────────────────────────────────────────────────
-- Full DDL + RLS lives in docs/v3-skill-platform/migrations/001_skill_platform.sql.
-- Mirrored here so this file stays a complete reproduction of the DB.

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS username         TEXT,
    ADD COLUMN IF NOT EXISTS bio              TEXT,
    -- Public storefront content, same class as bio — rendered under the display
    -- name on the page. Private contact details stay in Settings, never here.
    ADD COLUMN IF NOT EXISTS location         TEXT,
    ADD COLUMN IF NOT EXISTS storefront_theme JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx
    ON profiles (lower(username)) WHERE username IS NOT NULL;

CREATE TABLE IF NOT EXISTS skills (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    outcome      TEXT,
    cover_url    TEXT,
    price_cents  INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    pricing_type TEXT NOT NULL DEFAULT 'onetime' CHECK (pricing_type IN ('onetime','membership')),
    kind         TEXT NOT NULL DEFAULT 'digital' CHECK (kind IN ('digital','course','coaching','membership','webinar','lead','bundle')),
    version      INTEGER NOT NULL DEFAULT 1,
    status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skills_creator_idx   ON skills(creator_id);
CREATE INDEX IF NOT EXISTS skills_published_idx ON skills(creator_id, status);
CREATE INDEX IF NOT EXISTS skills_kind_idx      ON skills(creator_id, kind);

CREATE TABLE IF NOT EXISTS content_blocks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    type         TEXT NOT NULL CHECK (type IN ('video','file','prompt','workflow','text','coaching')),
    position     INTEGER NOT NULL DEFAULT 0,
    title        TEXT,
    body_text    TEXT,
    file_key     TEXT,
    external_url TEXT,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_blocks_skill_idx ON content_blocks(skill_id, position);
-- Coaching per-block scheduling (booking_minutes from an earlier migration; buffer + notice from 015).
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS booking_minutes    INTEGER;
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS buffer_minutes     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS min_notice_minutes INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS purchases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id            UUID NOT NULL REFERENCES profiles(id),
    skill_id            UUID NOT NULL REFERENCES skills(id),
    version_at_purchase INTEGER NOT NULL,
    amount_cents        INTEGER NOT NULL,
    stripe_payment_id   TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','refunded')),
    created_at          TIMESTAMPTZ DEFAULT now(),
    UNIQUE (buyer_id, skill_id)
);
CREATE INDEX IF NOT EXISTS purchases_buyer_idx ON purchases(buyer_id);
CREATE INDEX IF NOT EXISTS purchases_skill_idx ON purchases(skill_id);
-- Exactly-once fulfilment claim (see backend/lib/skillFulfillment.js).
-- `status` marks ACCESS, and is written by BOTH the Stripe webhook and the
-- /confirm fast-path, which race — so it cannot also gate the one-time side
-- effects. `fulfilled_at` is the atomic token that decides which caller runs
-- them (receipt email, creator notification, promo redemption, automation).
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ;
-- Backfill: rows paid before this column existed must never re-fire effects.
UPDATE purchases SET fulfilled_at = created_at WHERE status = 'paid' AND fulfilled_at IS NULL;

CREATE TABLE IF NOT EXISTS community_posts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id       UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    author_id      UUID NOT NULL REFERENCES profiles(id),
    body           TEXT NOT NULL,
    parent_post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_posts_skill_idx ON community_posts(skill_id, created_at);

CREATE TABLE IF NOT EXISTS analytics_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id   UUID REFERENCES skills(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('storefront_view','skill_view','checkout_start','purchase','block_open')),
    buyer_id   UUID REFERENCES profiles(id),
    block_id   UUID REFERENCES content_blocks(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS analytics_skill_type_idx ON analytics_events(skill_id, type, created_at);
CREATE INDEX IF NOT EXISTS analytics_creator_idx    ON analytics_events(creator_id, type, created_at);

-- RLS policies for the above: see migrations/001_skill_platform.sql.

-- ── Long-form description (migration 014) ───────────────────────────────────
ALTER TABLE skills ADD COLUMN IF NOT EXISTS description TEXT;

-- ── Post-purchase Options + reviews (migration 012) ─────────────────────────
ALTER TABLE skills ADD COLUMN IF NOT EXISTS promo_video_url     TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS confirmation_message TEXT;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS reviews_enabled      BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS reviews (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id   UUID NOT NULL REFERENCES skills(id)   ON DELETE CASCADE,
    buyer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating     SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (skill_id, buyer_id)
);
CREATE INDEX IF NOT EXISTS reviews_skill_idx ON reviews(skill_id, created_at DESC);
-- RLS: public read; buyer may write/update/delete own review only if paid.
-- Full policies in migrations/012_options_and_reviews.sql.

-- ── Google Calendar tokens (migration 013) ──────────────────────────────────
-- Secret refresh tokens. RLS enabled with NO policies → clients get zero
-- access; only the backend service key reads/writes this. NEVER move these
-- columns onto profiles (profiles is publicly readable).
CREATE TABLE IF NOT EXISTS google_tokens (
    user_id       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    refresh_token TEXT,
    connected     BOOLEAN NOT NULL DEFAULT false,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;

-- ── Courses: sections + lesson progress (migration 017) ─────────────────────
CREATE TABLE IF NOT EXISTS course_sections (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    title      TEXT,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_sections_skill_idx ON course_sections(skill_id, position);
ALTER TABLE course_sections ENABLE ROW LEVEL SECURITY;
-- A lesson is a content_block with a section_id.
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES course_sections(id) ON DELETE CASCADE;

-- migration 018 restructures courses to Modules → Lessons → content:
--   course_sections = MODULE (UI label). course_lessons = LESSON (title/desc).
--   content_blocks.lesson_id = a lesson's content. lesson_progress is per-lesson.
CREATE TABLE IF NOT EXISTS course_lessons (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id    UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    section_id  UUID NOT NULL REFERENCES course_sections(id) ON DELETE CASCADE, -- module
    title       TEXT,
    description TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_lessons_section_idx ON course_lessons(section_id, position);
ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES course_lessons(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lesson_id  UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
    skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id)
);
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
-- Full RLS policies in migrations/018_course_lessons.sql.


-- ═════════════════════════════════════════════════════════════════════════════
-- 021 — Platform subscription (paywall). Creator pays SkillJoy directly (no
-- Connect). Publish-gated: storefront goes live only while status is
-- trialing|active. Full policies + publish trigger in
-- migrations/021_platform_subscriptions.sql.
-- ═════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS platform_subscriptions (
    user_id                UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    status                 TEXT NOT NULL DEFAULT 'none',  -- none|trialing|active|past_due|canceled|unpaid|incomplete
    trial_ends_at          TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    last_dunned_invoice_id TEXT,                          -- dedupes the dunning email
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE platform_subscriptions ENABLE ROW LEVEL SECURITY;
-- Owner-read only; writes are service-role only (billing route + webhook).
-- skills SELECT policy replaced: public read of a published skill now also
-- requires the creator's platform sub to be trialing|active (buyers who own
-- the skill keep read access regardless). Publishing is blocked client-side by
-- the skills_enforce_server_publish trigger — server publish endpoint only.
--
-- ⚠️ The two cross-table checks in that policy use SECURITY DEFINER helpers
-- (public.creator_is_live / public.has_paid_purchase), NOT inline sub-SELECTs.
-- An inline EXISTS on platform_subscriptions (owner-read RLS) is false for
-- public viewers → storefront invisible; and an inline EXISTS on purchases
-- forms a mutual-recursion cycle with the purchases→skills policy. The definer
-- functions bypass the referenced table's RLS to avoid both. Full DDL in
-- migrations/021_platform_subscriptions.sql.


-- ═════════════════════════════════════════════════════════════════════════════
-- BACKFILL 2026-08-21 — sections below were missing from this reference while
-- being live in migrations 006–010 and 028. Restated here in migration order.
-- Policies are abridged to the ones that shape reads; full DDL in the migration
-- named on each heading.
-- ═════════════════════════════════════════════════════════════════════════════


-- ── 006 · store_links (link-in-bio rows) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_links (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    label        TEXT NOT NULL,
    url          TEXT NOT NULL,
    position     INTEGER NOT NULL DEFAULT 0,
    is_affiliate BOOLEAN DEFAULT false,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_links_creator_idx ON store_links(creator_id, position);
ALTER TABLE store_links ENABLE ROW LEVEL SECURITY;
-- Public SELECT (storefront content); owner-only writes.

-- 029 (in flight) adds: cover_url, cta_label, description, group_label, placement.


-- ── 007 · bookings (native 1:1 scheduling) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id      UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    block_id      UUID REFERENCES content_blocks(id) ON DELETE SET NULL,
    creator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    buyer_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_time    TIMESTAMPTZ NOT NULL,
    end_time      TIMESTAMPTZ NOT NULL,
    status        TEXT NOT NULL DEFAULT 'booked'
                    CHECK (status IN ('booked','cancelled','completed')),
    reminder_sent BOOLEAN DEFAULT false,
    created_at    TIMESTAMPTZ DEFAULT now(),
    -- 028 ↓
    meeting_url      TEXT,        -- snapshot of content_blocks.meeting_url at booking time
    buyer_timezone   TEXT,        -- captured from the browser; email formats in it
    rescheduled_at   TIMESTAMPTZ,
    reschedule_count INTEGER NOT NULL DEFAULT 0   -- doubles as the iCalendar SEQUENCE
);
CREATE INDEX IF NOT EXISTS bookings_creator_idx ON bookings(creator_id, start_time);
CREATE INDEX IF NOT EXISTS bookings_buyer_idx   ON bookings(buyer_id, start_time);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_unique
    ON bookings(creator_id, start_time) WHERE status = 'booked';
-- 028: supports the hourly reminder cron's exact filter.
CREATE INDEX IF NOT EXISTS bookings_reminder_due_idx
    ON bookings (start_time) WHERE status = 'booked' AND reminder_sent = false;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
-- SELECT: either party. INSERT: buyer, and only with a paid purchase.
-- UPDATE: either party.
--
-- ⚠️ 016 — the real double-booking guard is an EXCLUSION constraint, because
-- bookings_slot_unique only catches an identical start_time; two sessions of
-- different length can still overlap. Needs btree_gist.
--   ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
--     EXCLUDE USING gist (creator_id WITH =, tstzrange(start_time, end_time) WITH &&)
--     WHERE (status = 'booked');
--
-- NOTE: v3 writes now go through backend/routes/bookings.js on the SERVICE-ROLE
-- client, which BYPASSES every policy above. The route re-checks paid access and
-- validates the slot against the host's availability by hand. RLS still governs
-- the browser's direct reads.


-- ── 008 · subscribers + broadcasts (email marketing) ─────────────────────────
CREATE TABLE IF NOT EXISTS subscribers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    name       TEXT,
    source     TEXT DEFAULT 'storefront',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (creator_id, email)
);
CREATE INDEX IF NOT EXISTS subscribers_creator_idx ON subscribers(creator_id, created_at);
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;
-- INSERT is open to anon (that's the point of a capture form); owner reads.

CREATE TABLE IF NOT EXISTS broadcasts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    subject         TEXT NOT NULL,
    body            TEXT,
    recipient_count INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS broadcasts_creator_idx ON broadcasts(creator_id, created_at);
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
-- Owner SELECT only; rows are inserted service-side after a send.


-- ── 009 · discounts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    percent_off     INTEGER NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
    active          BOOLEAN NOT NULL DEFAULT true,
    max_redemptions INTEGER,                        -- null = unlimited
    times_redeemed  INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);
-- One code per creator, case-insensitive.
CREATE UNIQUE INDEX IF NOT EXISTS discounts_creator_code_idx
    ON discounts(creator_id, upper(code));
ALTER TABLE discounts ENABLE ROW LEVEL SECURITY;
-- Owner-only. Buyers never read this table — codes are validated server-side.


-- ── 028 · content_blocks.meeting_url ─────────────────────────────────────────
-- The creator's standing call link on a coaching block. Copied onto each
-- booking at booking time (see bookings.meeting_url above).
ALTER TABLE content_blocks ADD COLUMN IF NOT EXISTS meeting_url TEXT;


-- ── notifications.type — current full superset (through 028) ─────────────────
-- The CHECK is REPLACED, never appended to, so every new type means restating
-- the whole list. Missing one is a silent insert failure at runtime.
--   'message','swap_request','gig_request','swap_accepted','gig_accepted',
--   'swap_completed','gig_completed','dispute_filed','dispute_resolved',
--   'order_update','order_cancelled','payout_setup_required','chargeback',
--   'gig_removed','skill_update','skill_purchase','community_reply',
--   'booking_confirmed','booking_cancelled','booking_reminder',
--   'booking_rescheduled'
