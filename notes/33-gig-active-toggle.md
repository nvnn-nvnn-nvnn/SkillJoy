# 33 — Gig Active Toggle + Gigs Page Filter Fix

## What changed

### Feature: `setActiveGig` — `src/app-pages/MyListings.jsx`

Added a `setActiveGig(gigId, active)` async function that updates the `active` column in Supabase and optimistically updates local `myGigs` state. Shows a toast on success or error.

Each gig card in the "My Gigs" tab now has a **Deactivate / Activate** quick-toggle button alongside Edit and Remove — no need to open the edit form just to pause a listing. The button style flips to a green tint when the gig is currently inactive. An "Inactive" pill badge also renders next to the price when `gig.active === false`.

### Fix: `active` not saved on create/update

The `payload` object in `handleCreateGig` was missing `active: gigActive`. The form had the toggle UI and state but was never persisting the value to the DB.

### Fix: `resetForm` boolean bug

`setGigActive('true')` (string) was corrected to `setGigActive(true)` (boolean). The string `'true'` is always truthy in JS, so deactivating a gig and then hitting Cancel would silently reset the toggle to a truthy-but-wrong value on the next open.

### Fix: Gigs page not filtering by `active` — `src/app-pages/Gigs.jsx`

`loadGigs()` fetched every gig with no `active` filter. Added `.eq('active', true)` to the Supabase query so inactive gigs are excluded from the browse page.

## Why

**Toggle feature** — Providers needed a way to temporarily hide a gig without deleting it (e.g. fully booked, away, seasonal). The `active` column already existed in SQL but there was no UI or save logic wired up.

**Gigs page filter** — Without the filter, deactivated gigs still appeared on the browse page, making the toggle pointless from the buyer's perspective.

## How

- `setActiveGig` does a targeted `.update({ active })` scoped to `user_id` (safe, respects RLS)
- Quick-toggle button calls `setActiveGig(gig.id, gig.active === false)` — flips whatever the current state is
- `active: gigActive` added to payload alongside all other fields in `handleCreateGig`
- `.eq('active', true)` added to the `loadGigs` query chain in Gigs.jsx

**Note:** Gigs created before the `active` column existed have `active = null` in the DB. `.eq('active', true)` excludes nulls, so those gigs won't show on the browse page until backfilled. Run in Supabase SQL editor:
```sql
UPDATE gigs SET active = true WHERE active IS NULL;
```
Or swap the filter to `.neq('active', false)` to treat nulls as active.
