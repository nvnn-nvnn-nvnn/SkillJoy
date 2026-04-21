# 26 — Delete Account Fix

## What changed

### `backend/routes/users.js`

**Added `DELETE /api/users/account` endpoint** that actually deletes the user:

1. Deletes the user's row from the `profiles` table
2. Deletes the auth user via `supabase.auth.admin.deleteUser(userId)` (requires the service-role key the backend already uses)
3. Returns `{ success: true }` or an error message

### `src/app-pages/Settings.jsx`

**Fixed `deleteAccount()` function** — Previously it just called `supabase.auth.signOut()` and navigated to `/login` without deleting anything. Now it:

1. Calls `DELETE /api/users/account` via `apiFetch`
2. Waits for the backend to confirm deletion
3. Signs out and navigates to login only on success
4. Shows an error toast if deletion fails instead of silently navigating away

## Why

The old code gave users the impression their account was deleted when it wasn't — it only logged them out. Their profile, data, and auth record all remained in the database. This is both a trust issue and potentially a compliance issue (users expect "delete" to mean delete).

## How

- The backend uses `supabase.auth.admin.deleteUser()` which requires the service-role key — this is why deletion must go through the backend, not the client
- Profile deletion happens first; if that fails, the auth user is preserved so nothing is left in a half-deleted state
- The endpoint is behind `authMiddleware` so only the authenticated user can trigger it
- `apiFetch` automatically attaches the user's session token for auth
