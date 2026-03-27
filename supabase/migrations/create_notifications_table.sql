-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('message', 'swap_request', 'gig_request', 'swap_accepted', 'gig_accepted', 'swap_completed', 'gig_completed')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    related_id UUID,
    related_type TEXT CHECK (related_type IN ('swap', 'gig', 'message')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
    ON notifications FOR DELETE
    USING (auth.uid() = user_id);

-- System can insert notifications (we'll use service role for this)
CREATE POLICY "Service role can insert notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_related_id UUID DEFAULT NULL,
    p_related_type TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
    VALUES (p_user_id, p_type, p_title, p_message, p_related_id, p_related_type)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for new messages
CREATE OR REPLACE FUNCTION notify_new_message() RETURNS TRIGGER AS $$
DECLARE
    v_recipient_id UUID;
    v_sender_name TEXT;
    v_related_type TEXT;
BEGIN
    -- Determine recipient and related type
    IF NEW.swap_id IS NOT NULL THEN
        -- Get the other person in the swap
        SELECT CASE 
            WHEN requester_id = NEW.sender_id THEN receiver_id 
            ELSE requester_id 
        END INTO v_recipient_id
        FROM swaps WHERE id = NEW.swap_id;
        
        v_related_type := 'swap';
    ELSIF NEW.gig_request_id IS NOT NULL THEN
        -- Get the other person in the gig request
        SELECT CASE 
            WHEN requester_id = NEW.sender_id THEN provider_id 
            ELSE requester_id 
        END INTO v_recipient_id
        FROM gig_requests WHERE id = NEW.gig_request_id;
        
        v_related_type := 'gig';
    ELSE
        RETURN NEW;
    END IF;

    -- Get sender name
    SELECT full_name INTO v_sender_name FROM profiles WHERE id = NEW.sender_id;

    -- Create notification
    PERFORM create_notification(
        v_recipient_id,
        'message',
        'New message from ' || COALESCE(v_sender_name, 'Someone'),
        LEFT(NEW.content, 100),
        COALESCE(NEW.swap_id, NEW.gig_request_id),
        v_related_type
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for new swap requests
CREATE OR REPLACE FUNCTION notify_new_swap_request() RETURNS TRIGGER AS $$
DECLARE
    v_requester_name TEXT;
BEGIN
    IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.requester_id;
        
        PERFORM create_notification(
            NEW.receiver_id,
            'swap_request',
            'New swap request',
            COALESCE(v_requester_name, 'Someone') || ' wants to swap ' || NEW.teach_skill || ' for ' || NEW.learn_skill,
            NEW.id,
            'swap'
        );
    ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.receiver_id;
        
        PERFORM create_notification(
            NEW.requester_id,
            'swap_accepted',
            'Swap request accepted!',
            COALESCE(v_requester_name, 'Someone') || ' accepted your swap request',
            NEW.id,
            'swap'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for new gig requests
CREATE OR REPLACE FUNCTION notify_new_gig_request() RETURNS TRIGGER AS $$
DECLARE
    v_requester_name TEXT;
    v_gig_title TEXT;
BEGIN
    IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status != 'pending') THEN
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.requester_id;
        SELECT title INTO v_gig_title FROM gigs WHERE id = NEW.gig_id;
        
        PERFORM create_notification(
            NEW.provider_id,
            'gig_request',
            'New gig request',
            COALESCE(v_requester_name, 'Someone') || ' requested: ' || COALESCE(v_gig_title, 'your gig'),
            NEW.id,
            'gig'
        );
    ELSIF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.provider_id;
        SELECT title INTO v_gig_title FROM gigs WHERE id = NEW.gig_id;
        
        PERFORM create_notification(
            NEW.requester_id,
            'gig_accepted',
            'Gig request accepted!',
            COALESCE(v_requester_name, 'Someone') || ' accepted your request for: ' || COALESCE(v_gig_title, 'the gig'),
            NEW.id,
            'gig'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_message();

DROP TRIGGER IF EXISTS trigger_notify_swap_request ON swaps;
CREATE TRIGGER trigger_notify_swap_request
    AFTER INSERT OR UPDATE ON swaps
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_swap_request();

DROP TRIGGER IF EXISTS trigger_notify_gig_request ON gig_requests;
CREATE TRIGGER trigger_notify_gig_request
    AFTER INSERT OR UPDATE ON gig_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_gig_request();
