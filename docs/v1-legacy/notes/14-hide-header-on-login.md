# Hide Header on Login Page — `src/components/Header.jsx`

## Why
During the password reset flow, Supabase establishes a recovery session which sets `user` as non-null. The Header component only hid itself when `!user`, so it was visible and fully interactive on the `/login` page during the recovery flow — a security concern since the user could navigate away mid-reset.

## What
The header is now invisible and non-interactive on the `/login` route at all times, regardless of auth state.

## How
One line added to the existing null-return guard in `Header.jsx`:

```js
// Before
if (loading || !user) return null;

// After
if (loading || !user || currentPath === '/login') return null;
```

`currentPath` was already available via `useLocation()` — no new imports or state needed.
