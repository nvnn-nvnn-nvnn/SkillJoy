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
        'order_update', 'order_cancelled'
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Message notification trigger
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS TRIGGER AS $$
DECLARE v_recipient_id UUID; v_sender_name TEXT; v_related_type TEXT; v_convo_id UUID;
BEGIN
    IF NEW.swap_id IS NOT NULL THEN
        SELECT CASE WHEN requester_id = NEW.sender_id THEN receiver_id ELSE requester_id END
        INTO v_recipient_id FROM swaps WHERE id = NEW.swap_id;
        v_related_type := 'swap';
        v_convo_id := NEW.swap_id;
    ELSIF NEW.gig_request_id IS NOT NULL THEN
        SELECT CASE WHEN requester_id = NEW.sender_id THEN provider_id ELSE requester_id END
        INTO v_recipient_id FROM gig_requests WHERE id = NEW.gig_request_id;
        v_related_type := 'gig';
        v_convo_id := NEW.gig_request_id;
    ELSE RETURN NEW;
    END IF;
    -- Only notify if there is no existing unread message notification for this conversation.
    -- This prevents a flood of notifications for every message in a thread.
    IF NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = v_recipient_id
          AND type = 'message'
          AND related_id = v_convo_id
          AND read = false
    ) THEN
        SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;
        PERFORM create_notification(v_recipient_id, 'message',
            'New message from ' || COALESCE(v_sender_name, 'Someone'),
            LEFT(NEW.content, 100), v_convo_id, v_related_type);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_new_swap_request() RETURNS TRIGGER AS $$
DECLARE v_name TEXT;
BEGIN
    IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
        SELECT full_name INTO v_name FROM profiles WHERE id = NEW.requester_id;
        PERFORM create_notification(NEW.receiver_id, 'swap_request', 'New swap request',
            COALESCE(v_name, 'Someone') || ' wants to swap ' || NEW.teach_skill || ' for ' || NEW.learn_skill,
            NEW.id, 'swap');
    ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        SELECT full_name INTO v_name FROM profiles WHERE id = NEW.receiver_id;
        PERFORM create_notification(NEW.requester_id, 'swap_accepted', 'Swap request accepted!',
            COALESCE(v_name, 'Someone') || ' accepted your swap request', NEW.id, 'swap');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION notify_new_gig_request() RETURNS TRIGGER AS $$
DECLARE v_name TEXT; v_title TEXT;
BEGIN
    IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
        SELECT full_name INTO v_name FROM profiles WHERE id = NEW.requester_id;
        SELECT title INTO v_title FROM gigs WHERE id = NEW.gig_id;
        PERFORM create_notification(NEW.provider_id, 'gig_request', 'New gig request',
            COALESCE(v_name, 'Someone') || ' requested: ' || COALESCE(v_title, 'your gig'), NEW.id, 'gig');
    ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        SELECT full_name INTO v_name FROM profiles WHERE id = NEW.provider_id;
        SELECT title INTO v_title FROM gigs WHERE id = NEW.gig_id;
        PERFORM create_notification(NEW.requester_id, 'gig_accepted', 'Gig request accepted!',
            COALESCE(v_name, 'Someone') || ' accepted your request for: ' || COALESCE(v_title, 'the gig'), NEW.id, 'gig');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
    AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION notify_new_message();

DROP TRIGGER IF EXISTS trigger_notify_swap_request ON swaps;
CREATE TRIGGER trigger_notify_swap_request
    AFTER INSERT OR UPDATE ON swaps FOR EACH ROW EXECUTE FUNCTION notify_new_swap_request();

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
