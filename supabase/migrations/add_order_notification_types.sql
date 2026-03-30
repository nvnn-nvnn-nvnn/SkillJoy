-- Add order notification types and image_url to dispute_evidence
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
        'message',
        'swap_request',
        'gig_request',
        'swap_accepted',
        'gig_accepted',
        'swap_completed',
        'gig_completed',
        'dispute_filed',
        'dispute_resolved',
        'order_update',
        'order_cancelled'
    ));

-- Add image_url column to dispute_evidence if not exists
ALTER TABLE dispute_evidence ADD COLUMN IF NOT EXISTS image_url text;
