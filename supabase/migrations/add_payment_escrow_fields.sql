-- Add payment escrow fields to gig_requests table
-- This migration adds fields to track payment status, escrow, and dispute handling

ALTER TABLE gig_requests
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'escrowed', 'released', 'disputed', 'refunded')),
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS escrow_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS release_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_release_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_reason TEXT,
ADD COLUMN IF NOT EXISTS dispute_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_resolved_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

-- Create index for payment status queries
CREATE INDEX IF NOT EXISTS idx_gig_requests_payment_status ON gig_requests(payment_status);
CREATE INDEX IF NOT EXISTS idx_gig_requests_auto_release_date ON gig_requests(auto_release_date);

-- Add comment explaining the payment flow
COMMENT ON COLUMN gig_requests.payment_status IS 'Payment lifecycle: pending -> escrowed (buyer pays) -> released (seller gets paid) OR disputed -> refunded/released';
COMMENT ON COLUMN gig_requests.auto_release_date IS 'Date when payment will auto-release if buyer does not review (3 days after delivery)';
