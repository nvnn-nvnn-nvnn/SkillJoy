-- Drop the unique constraint on gig_requests that prevents multiple requests for same gig
-- This allows users to create new requests after completing/cancelling previous ones

-- Find and drop the unique constraint (name may vary)
ALTER TABLE gig_requests DROP CONSTRAINT IF EXISTS gig_requests_gig_id_requester_id_key;
ALTER TABLE gig_requests DROP CONSTRAINT IF EXISTS gig_requests_gig_id_requester_id_unique;
ALTER TABLE gig_requests DROP CONSTRAINT IF EXISTS unique_gig_request;

-- Also drop any unique index that might exist
DROP INDEX IF EXISTS gig_requests_gig_id_requester_id_key;
DROP INDEX IF EXISTS gig_requests_gig_id_requester_id_idx;
