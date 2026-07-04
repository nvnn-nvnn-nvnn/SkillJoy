-- ─────────────────────────────────────────────────────────────────────────────
-- SkillJoy — Full Schema Archive
-- All migrations consolidated in order of application.
-- Run this in the Supabase SQL editor on a fresh project to reproduce the DB.
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
http://localhost:5173/profile
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

CREATE TABLE IF NOT EXISTS lesson_progress (
    user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    block_id   UUID NOT NULL REFERENCES content_blocks(id) ON DELETE CASCADE,
    skill_id   UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, block_id)
);
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
-- Full RLS policies for both in migrations/017_courses.sql.
