# 34 — Stale Closure Bug: New Accounts Couldn't See Gigs

## What changed

### Fix: Gigs page — `src/app-pages/Gigs.jsx`

`loadGigs(universityDomain)` was reading `profile?.college_verified` directly from the component closure. Refactored to take `collegeVerified` as a second parameter:

```diff
- async function loadGigs(universityDomain) {
+ async function loadGigs(universityDomain, collegeVerified) {
      ...
-     if (profile?.college_verified && universityDomain) query = query.eq('university_domain', universityDomain);
+     if (collegeVerified && universityDomain) query = query.eq('university_domain', universityDomain);
  }
```

And updated the caller:
```diff
- loadGigs(profile?.university_domain);
+ loadGigs(profile?.university_domain, profile?.college_verified);
```

### Fix: Profile page — `src/app-pages/Profile.jsx`

Same bug, worse impact. `loadGigs()` read `myProfile?.college_verified` and `myProfile?.university_domain` from closure, AND the `useEffect` dependency array didn't include `myProfile` at all.

Refactored to take both as parameters and added them to the dependency array:

```diff
- async function loadGigs() {
+ async function loadGigs(collegeVerified, universityDomain) {
      ...
-     if (isOther && myProfile?.college_verified && myProfile?.university_domain) {
-         query = query.eq('university_domain', myProfile.university_domain);
-     } else if (isOther) {
+     if (isOther && collegeVerified && universityDomain) {
+         query = query.eq('university_domain', universityDomain);
+     } else if (isOther && !collegeVerified) {
          setAllGigs([]);
          return;
      }
  }

  useEffect(() => {
      ...
-     loadGigs();
+     loadGigs(myProfile?.college_verified, myProfile?.university_domain);
- }, [user, userId, authLoading]);
+ }, [user, userId, authLoading, myProfile?.college_verified, myProfile?.university_domain]);
```

Also added `.eq('active', true)` to the Profile gig query — was missing entirely, so inactive gigs were showing on other users' profile pages.

## Why

**Root cause:** `profile` from `useProfile()` is `null` on first render — it loads asynchronously after the auth session resolves. The fetch functions ran immediately with `profile = null`, evaluated `profile?.college_verified` as `false`, and either fell through to no filter (Gigs.jsx) or returned an empty array (Profile.jsx).

**Symptom:** New accounts that were properly college-verified, had Stripe set up, etc. couldn't see anyone else's gigs — neither on the browse page nor on individual profile pages. The filter logic never applied because the profile data wasn't ready when it was checked.

**Worse on Profile.jsx:** because `myProfile` wasn't in the `useEffect` dependency array, `loadGigs` never re-ran after the profile loaded. So the empty array stuck around forever.

## How

The pattern: never read async-loaded React state from inside a function that's called from an effect — pass it in as a parameter so the value at call-time is captured explicitly. And always add the relevant fields to the dependency array so the effect re-runs when they change.

Also, `Gigs.jsx` already had `profile?.university_domain` and `profile?.college_verified` in its dependency array, so it *did* re-run — but the closure was still reading stale `profile`. Passing as a parameter is the safer fix.
