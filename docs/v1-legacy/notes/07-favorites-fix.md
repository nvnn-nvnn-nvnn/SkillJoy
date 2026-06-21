# Favorites Fix

## What was broken

Favoriting gigs appeared to do nothing — the star icon wouldn't persist and no favorites were saved.

## Root Cause

Two issues:

1. **Missing `type` column** — The `favorites` table was created with only `id, user_id, favorited_id, created_at`. The frontend code (`Gigs.jsx`) queries and inserts with a `type: 'gig'` field, so every insert would fail (column doesn't exist) and every select would return empty.

2. **No RLS policies** — The `favorites` table had RLS enabled with no policies, meaning all reads and writes were blocked for the anon/authenticated keys used by the frontend.

## Fix

Run in Supabase SQL editor:

```sql
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'gig';

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites" ON favorites
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites" ON favorites
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites" ON favorites
FOR DELETE USING (auth.uid() = user_id);
```

## No code changes needed

The frontend logic in `src/app-pages/Gigs.jsx` (`loadFavorites` and `toggleFavorite`, lines 79–95) was correct all along — optimistic update, rollback on error, proper Supabase queries. It just needed the table to match.
