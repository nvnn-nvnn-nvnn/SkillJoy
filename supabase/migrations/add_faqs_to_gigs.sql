-- Add FAQs column to gigs table
ALTER TABLE gigs ADD COLUMN faqs JSONB;

-- Add index for better query performance on FAQs
CREATE INDEX IF NOT EXISTS gigs_faqs_idx ON gigs USING GIN (faqs);

-- Add comment to document the column
COMMENT ON COLUMN gigs.faqs IS 'Array of FAQ objects with question and answer fields for gig listings';
