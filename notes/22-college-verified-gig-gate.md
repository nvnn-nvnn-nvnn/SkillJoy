# 22 — College Verified Gig Gate

**Date:** 2026-04-20

## What
Gigs page now requires `college_verified = true` on the user's profile. Unverified users see a prompt instead of the gig list.

## Why
Gigs are a university-only feature. Skill Swaps remain open to all users.

## How
`profile` is already available via `useProfile()` in `Gigs.jsx`. Added an early return before the main JSX return:

```jsx
if (!profile?.college_verified) {
    return <unverified prompt with navigate('/profile') CTA>;
}
```

No backend change needed — the gate is purely frontend. The `college_verified` boolean already exists in the `profiles` table.

## UI Update
Restyled the gate prompt to a white card: `background: #fff`, `borderRadius: 20`, `boxShadow`, centered on the page. Matches the app's card contrast pattern.

## Files Changed
- `src/app-pages/Gigs.jsx` — added early return gate at line ~278
