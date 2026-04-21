# 29 — Gig University Domain Gate

## What changed

### `src/app-pages/Profile.jsx`

**Added `useProfile` import and `myProfile` variable** to access the viewer's own profile (distinct from the viewed user's profile which is local state).

**Rewrote `loadGigs()` to filter by university domain when viewing another user's profile:**

- If the viewer is college-verified, only gigs matching their `university_domain` are returned via `.eq('university_domain', myProfile.university_domain)`
- If the viewer is not college-verified, no gigs are shown at all (`setAllGigs([])` early return)
- Viewing your own profile is unaffected — all your gigs show regardless

### `src/app-pages/GigDetails.jsx`

**Added `useProfile` import and `myProfile` variable.**

**Added a domain check after the gig loads** — if the gig belongs to another user and has a `university_domain`:

- If the viewer's domain doesn't match or they aren't college-verified, they're redirected to `/gigs` with a toast: "This gig is only available to students at the same university."
- Your own gigs are always accessible regardless of domain

### `src/app-pages/Gigs.jsx` (no change)

Already had this filter at line 119: `if (profile?.college_verified && universityDomain) query = query.eq('university_domain', universityDomain);`

## Why

Without this, there were two bypass routes around the existing marketplace domain filter:

1. **Profile page** — visiting `/profile/:userId` showed all of that user's gigs with no domain check, so a user at University A could see and click into gigs posted by a student at University B
2. **Direct URL** — visiting `/gigs/:gigId` loaded any gig regardless of domain, so sharing a link would bypass the marketplace filter entirely

The marketplace filter was only half the picture. Gigs need to be gated at every entry point — marketplace, profile, and direct access — otherwise the domain restriction is just cosmetic.

## How

- `useProfile()` returns the logged-in viewer's own profile from the auth store (already synced on login). This gives us `myProfile.university_domain` and `myProfile.college_verified` without an extra fetch.
- Profile.jsx uses Supabase's `.eq()` filter server-side so non-matching gigs never leave the database. The `isOther` check ensures the filter only applies when viewing someone else's profile — your own gigs are always visible to you.
- GigDetails.jsx does the check client-side after the single gig loads, since there's no list to filter. If the domain doesn't match, it redirects before rendering anything.
- Gigs without a `university_domain` (posted by non-verified users) are still visible to everyone — the gate only applies when the gig has a domain set.
