# 24 — Matches Page Domain Filter Fix

**Date:** 2026-04-20

## What
Verified users were seeing zero matches on the Matches page. Unverified users could see everyone.

## Why It Broke
The query was filtering to same-university users only when `college_verified` was true:

```js
if (profile?.college_verified && profile?.university_domain) {
    q = q.eq('university_domain', profile.university_domain);
}
```

If no other users share the same `university_domain`, the result is empty — even if there are hundreds of other users on the platform.

## The Fix
Removed the domain filter entirely. Now all users are always fetched. Same-domain users are instead boosted in the scoring algorithm:

```js
const domainBonus = (me.university_domain && p.university_domain === me.university_domain) ? 10 : 0;
const score = theyTeachScore + iTeachScore + domainBonus;
```

## Result
- All users appear as potential matches regardless of verification status
- Same-university users sort to the top (+10 score bonus)
- Verified users no longer see an empty matches page

## Files Changed
- `src/app-pages/Matches.jsx` — removed `.eq('university_domain')` filter, added `domainBonus` to score
- `src/app-pages/Swaps.jsx` — same fix: removed domain filter, added `domainBonus` in `getMatchInfo`
