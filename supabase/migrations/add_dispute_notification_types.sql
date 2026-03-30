-- Add dispute notification types to the check constraint
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
        'dispute_resolved'
    ));
