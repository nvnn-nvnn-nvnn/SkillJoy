-- Store individual evidence submissions for disputes
CREATE TABLE IF NOT EXISTS dispute_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dispute_id UUID NOT NULL REFERENCES gig_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute_id ON dispute_evidence(dispute_id);

ALTER TABLE dispute_evidence ENABLE ROW LEVEL SECURITY;

-- Buyer or seller on the order can read evidence
CREATE POLICY "Parties can view evidence"
    ON dispute_evidence FOR SELECT
    USING (
        auth.uid() = user_id OR
        EXISTS (
            SELECT 1 FROM gig_requests
            WHERE id = dispute_id
            AND (requester_id = auth.uid() OR provider_id = auth.uid())
        )
    );

-- Any authenticated user can insert their own evidence
CREATE POLICY "Users can submit evidence"
    ON dispute_evidence FOR INSERT
    WITH CHECK (auth.uid() = user_id);
