# Auth Loading Fix + Profile Visibility Fix + Blocked Users in Settings

---

## 1. Admin report links redirecting to /matches

### What was broken
Clicking a reported profile or gig link in the Admin panel (opened in a new tab) would redirect to `/matches` instead of loading the correct page.

### Why
The redirect chain was:
1. New tab opens `/profile/:userId` or `/gigs/:gigId`
2. Auth not yet initialized → `user` is `null` momentarily
3. `if (!user) navigate('/login')` fires too early
4. Login page detects user IS logged in → redirects to `/matches`

### Fix
Both `src/app-pages/Profile.jsx` and `src/app-pages/GigDetails.jsx` now pull `loading` from `useAuth()` (renamed `authLoading` to avoid collision with local loading state) and guard the redirect:

```js
if (authLoading) return;
if (!user) { navigate('/login'); return; }
```

`authLoading` is also added to the `useEffect` dependency array so the effect re-runs once auth resolves.

---

## 2. Other users' profiles not loading

### What was broken
Viewing another user's profile showed "Profile not found" or an infinite spinner.

### Why — two bugs

**Bug 1: Missing fields in `PUBLIC_FIELDS`**
`backend/routes/users.js` defines `PUBLIC_FIELDS` for other-user profile fetches. It was missing `skills_teach`, `skills_learn`, `offers_gigs`, and `points`, so profiles returned from the backend were missing key display data.

**Bug 2: No try-catch in `loadProfile`**
`src/app-pages/Profile.jsx` → `loadProfile()` called `apiFetch` with no try-catch. If the backend was unreachable, `fetch` throws, `setLoading(false)` is never called, and the page spins forever.

### Fix

`backend/routes/users.js` — expanded PUBLIC_FIELDS:
```js
const PUBLIC_FIELDS = 'id, full_name, bio, avatar_url, service_type, availability, college, college_verified, skills_teach, skills_learn, offers_gigs, points';
```

`src/app-pages/Profile.jsx` — wrapped the fetch block in try-catch:
```js
try {
    const res = await apiFetch(`/api/users/profile/${targetId}`);
    if (res.status === 403) { setError('blocked_by_owner'); setLoading(false); return; }
    if (!res.ok) { setError('Profile not found.'); setLoading(false); return; }
    profileData = await res.json();
} catch {
    setError('Could not load profile. Please try again.');
    setLoading(false);
    return;
}
```

---

## 3. Blocked Users list in Settings

### What was added
A new "Blocked Users" section in `src/app-pages/Settings.jsx`, placed between the Privacy section and the Danger Zone.

- Loads the current user's block list on mount via `GET /api/blocks`
- Shows each blocked user's avatar (or initial fallback), name
- "Unblock" button per row — calls `POST /api/blocks/unblock`, removes the entry from the list optimistically
- Empty state: "You haven't blocked anyone."

### Data shape
`GET /api/blocks` returns:
```json
[{ "blocked_id": "uuid", "blocked": { "id": "...", "full_name": "...", "avatar_url": "..." }, "created_at": "..." }]
```
The nested `b.blocked.full_name` / `b.blocked.avatar_url` fields are used (not flat).
