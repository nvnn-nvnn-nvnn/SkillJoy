# 35 — Gig Visibility Audit: Recent Users' Gigs Not Showing

## What changed

### Fix 1: Treat `active = null` as active — `src/app-pages/Gigs.jsx` & `src/app-pages/Profile.jsx`

Both gig queries used `.eq('active', true)` which silently excludes rows where `active IS NULL`. Switched both to `.neq('active', false)`:

```diff
- .eq('active', true)
+ .neq('active', false)
```

### Fix 2: Backfill `university_domain` on college verification — `backend/routes/verify-college.js`

After the `profiles` row is updated with `college_verified = true` and the new `university_domain`, also update any existing gigs that user owns:

```js
await supabase.from('gigs')
    .update({ university_domain: universityDomain })
    .eq('user_id', profile.id)
    .is('university_domain', null);
```

### Fix 3: One-time SQL backfill (run in Supabase SQL editor)

For users who verified before this fix shipped:

```sql
UPDATE gigs g
SET university_domain = p.university_domain
FROM profiles p
WHERE g.user_id = p.id
  AND p.college_verified = true
  AND p.university_domain IS NOT NULL
  AND g.university_domain IS NULL;
```

## Why — the audit

After fixing the stale-closure issue in note 34, gigs from "recent users" still weren't showing. Two separate root causes were silently dropping rows from the result set:

### Root cause A — `active` column nullable, query strict

Devan added the `active` column to the `gigs` table but the original SQL didn't include `NOT NULL DEFAULT true`. So:
- Rows that existed before the column was added had `active = null`
- Rows inserted via UI paths that didn't include `active` in the payload also had `active = null`
- The frontend filter `.eq('active', true)` excludes nulls (Postgres `null = true` evaluates to `null`, not `true`)

Result: any gig with a null `active` value was invisible everywhere.

### Root cause B — `university_domain` set at gig creation, not at verification

Looking at `handleCreateGig` in MyListings:

```js
const universityDomain = (profile?.college_verified && profile?.university_domain) ? profile.university_domain : null;
```

This snapshots `university_domain` **at the moment the gig is created**. So:
- A user who creates a gig BEFORE verifying their college email gets `university_domain = null` on that gig forever
- When they later verify, only their `profiles` row is updated — the gigs are orphaned with null domain
- Other verified users at the same school filter by `.eq('university_domain', X)` and never see the orphaned gigs

This was almost certainly the dominant cause for "recent users" — they sign up, create a gig early, verify later, and their gigs disappear from peers' browse pages.

## How

**Active fix** is purely frontend-side and doesn't require an immediate DB change — `.neq('active', false)` matches both `true` and `null`. Devan can still run the `ALTER TABLE ... NOT NULL DEFAULT true` for cleanliness, but it's no longer urgent.

**University domain fix** is two-part: the backend handler now does a follow-up `UPDATE` scoped to that user's gigs after a successful verification (only touches rows where `university_domain IS NULL` so it never overwrites a user who somehow set it manually). The one-time SQL patches existing data.

**Why backfill at verification time** instead of changing the gig insert logic: gigs created by truly unverified users should stay null — they're not at any school. Only when the user later proves they're a student should their existing gigs become visible to peers.
