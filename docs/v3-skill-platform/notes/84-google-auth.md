# 84 — Google auth (OAuth sign-in)

_Session 2026-07-06. Added "Continue with Google" to the login flow. Dashboard
config (Google Cloud OAuth client + Supabase provider) done by the user; this note
covers the code + the one non-obvious gotcha._

---

## Config (done outside the code — user completed)
- **Google Cloud Console:** OAuth 2.0 Web client; authorized redirect URI =
  `https://<project-ref>.supabase.co/auth/v1/callback`; consent screen with
  email + profile scopes.
- **Supabase:** Authentication → Providers → Google (enabled, client id + secret).
  Authentication → URL Configuration → Site URL + Redirect URLs include the app
  origins (`http://localhost:5173`, prod). Missing redirect URLs = the OAuth
  round-trip bounces to the wrong place.

## Code

### 1. The button — [src/app-pages/auth/Login.jsx](../../../src/app-pages/auth/Login.jsx)
`signInWithGoogle()` → `supabase.auth.signInWithOAuth({ provider: 'google', options:
{ redirectTo } })`. `redirectTo` = `VITE_SITE_URL ?? origin` + `/login`, preserving
any `?redirect=` so the buyer/creator still lands where they were headed. Button
shown only in `signin`/`signup` modes (not reset/new-password), with an inline
Google-logo SVG and `.btn-google` styles that override the global bare-button reset.

### 2. Centralized post-auth routing — the gotcha
There is **no DB trigger** creating `profiles` rows — the profile is upserted in
[Onboarding.jsx](../../../src/app-pages/auth/Onboarding.jsx). And OAuth logins arrive
via the session (the `user` effect), NOT through `submit()`. Previously the
onboarding gate ("has full_name + username?") lived only in the password
`submit()` path — so a brand-new Google user would skip onboarding and land
**profile-less on /build**.

Fix: moved the gate into the `user` effect so it runs for EVERY auth path:

```js
useEffect(() => {
  if (!user || isRecovery.current) return;
  (async () => {
    const { data: profile } = await supabase
      .from('profiles').select('full_name, username').eq('id', user.id).maybeSingle();
    if (!profile?.full_name || (!LEGACY_MODE && !profile?.username)) navigate('/onboarding');
    else navigate(redirectTo);
  })();
}, [user, navigate, redirectTo]);
```

The password `submit()` branch was simplified to just sign in and let the effect
route — password + Google now share one code path.

### 3. Onboarding name prefill
A new Google user has no profile row, so `fullName` would start blank. Added an
`else` branch that prefills from `user.user_metadata.full_name || .name` (what
Google returns), so they don't retype it.

## Test
1. `/login` → **Continue with Google** → consent → back to app.
2. First time → `/onboarding` with the Google name prefilled → set username → `/build`.
3. Returning (profile complete) → straight to `/build` (or the preserved `?redirect=`).

## Watch on first real run
- Redirect lands cleanly (depends on Supabase Redirect URLs matching the exact origin).
- New user routes to `/onboarding`, not a profile-less `/build` — if it skips, the
  routing effect isn't firing.

## Status
Build passes. Not runtime-verified here (needs the live Google/Supabase config + a
browser); this was the wall on prior verifies too.
