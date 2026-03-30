-- Add 'withdrawn' to payment_status allowed values
-- Drop old constraint and recreate with 'withdrawn' included

ALTER TABLE gig_requests
DROP CONSTRAINT IF EXISTS gig_requests_payment_status_check;

ALTER TABLE gig_requests
ADD CONSTRAINT gig_requests_payment_status_check
CHECK (payment_status IN ('pending', 'unpaid', 'paid', 'escrowed', 'released', 'disputed', 'refunded', 'withdrawn'));

-- Update comment to reflect new value
COMMENT ON COLUMN gig_requests.payment_status IS 'Payment lifecycle: pending -> escrowed (buyer pays) -> released (seller gets paid) OR disputed -> refunded/released, or withdrawn (buyer cancelled)';
