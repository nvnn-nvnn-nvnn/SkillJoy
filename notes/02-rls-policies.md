# Row Level Security (RLS) Policies — April 2026

## What is RLS
Supabase uses PostgreSQL's Row Level Security to enforce data access rules at the database layer. Even if backend code has a bug, RLS prevents unauthorized reads/writes from reaching the data.

RLS policies are written in SQL and run on every query. They use `auth.uid()` to identify the current user.

---

## Key Concepts

**`USING`** — filters rows for SELECT, UPDATE, DELETE (operating on existing rows)
**`WITH CHECK`** — validates rows for INSERT, UPDATE (operating on the new data being written)

**FOR SELECT / INSERT / UPDATE / DELETE** — each operation needs its own policy. SQL keywords are case-insensitive.

---

## Tables Covered

### `profiles`
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profiles (needed for gig pages, match cards, etc.)
CREATE POLICY "Anyone can read profiles" ON profiles
FOR SELECT USING (true);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING (auth.uid() = id);
```

### `gigs`
```sql
ALTER TABLE gigs ENABLE ROW LEVEL SECURITY;

-- Anyone can browse gigs
CREATE POLICY "Anyone can read gigs" ON gigs
FOR SELECT USING (true);

-- Only the owner can create a gig under their own user_id
CREATE POLICY "Owners can insert gigs" ON gigs
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only the owner can edit their own gig
CREATE POLICY "Owners can update gigs" ON gigs
FOR UPDATE USING (auth.uid() = user_id);

-- Only the owner can delete their own gig
CREATE POLICY "Owners can delete gigs" ON gigs
FOR DELETE USING (auth.uid() = user_id);
```

**Why `USING` for UPDATE/DELETE:** These operations target existing rows (the check happens on what's already in the DB).
**Why `WITH CHECK` for INSERT:** There's no existing row to filter — the check runs against the new data being inserted.

### `gig_requests`
```sql
ALTER TABLE gig_requests ENABLE ROW LEVEL SECURITY;

-- Buyer and seller can both see the order
CREATE POLICY "Buyer and seller can view orders" ON gig_requests
FOR SELECT USING (
    auth.uid() = requester_id OR auth.uid() = provider_id
);

-- Buyer creates the request under their own ID
CREATE POLICY "Buyer can create order" ON gig_requests
FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Either party can update (buyer pays, seller delivers, etc.)
CREATE POLICY "Parties can update order" ON gig_requests
FOR UPDATE USING (
    auth.uid() = requester_id OR auth.uid() = provider_id
);
```

### `messages`
```sql
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view messages" ON messages
FOR SELECT USING (
    auth.uid() = sender_id
    OR (swap_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM swaps WHERE id = swap_id
        AND (requester_id = auth.uid() OR receiver_id = auth.uid())
    ))
    OR (gig_request_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM gig_requests WHERE id = gig_request_id
        AND (requester_id = auth.uid() OR provider_id = auth.uid())
    ))
);

CREATE POLICY "Parties can send messages" ON messages
FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
        (swap_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM swaps WHERE id = swap_id
            AND (requester_id = auth.uid() OR receiver_id = auth.uid())
        ))
        OR
        (gig_request_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM gig_requests WHERE id = gig_request_id
            AND (requester_id = auth.uid() OR provider_id = auth.uid())
        ))
    )
);
```

### `ratings`
```sql
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Anyone can read ratings (shown on profile pages)
CREATE POLICY "Anyone can read ratings" ON ratings
FOR SELECT USING (true);

-- Only verified buyers (completed orders) can write ratings
CREATE POLICY "Only verified buyers can write ratings" ON ratings
FOR INSERT WITH CHECK (
    auth.uid() = rater_id
    AND EXISTS (
        SELECT 1 FROM gig_requests
        WHERE (requester_id = auth.uid() AND provider_id = rated_id)
        AND status = 'completed'
        AND payment_status IN ('released', 'cleared')
    )
);
```

### `notifications` and `favorites`
Already had RLS in `schema.sql` at project creation. No changes needed.

### `dispute_evidence`
Already had RLS in `schema.sql`. No changes needed.

---

## Notes
- Backend uses the **service key** (bypasses RLS) for admin operations and cron jobs. This is intentional — the service key is only on the server, never exposed to the client.
- Frontend uses the **anon key** (respects RLS) for all user-facing queries. This means RLS is the safety net for all client-side Supabase calls.
