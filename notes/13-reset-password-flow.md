# Full Password Reset Flow — `src/app-pages/auth/Login.jsx`

## Why
Users who forgot their password had no recovery path — they were locked out with no way back in.

---

## What
Added a `'new-password'` mode to the login page that intercepts the Supabase recovery session and shows a "Set a new password" form with two fields (new password + confirm password).

Full mode flow: `signin` → `reset` (send email) → user clicks link → `new-password` (set password) → `/matches`

---

## How

### Sending the reset email
`supabase.auth.resetPasswordForEmail(email, { redirectTo })` is called in `'reset'` mode. The redirect URL uses an env variable so it works in both dev and production:

```js
redirectTo: (import.meta.env.VITE_SITE_URL ?? window.location.origin) + '/login'
```

Set `VITE_SITE_URL=https://skilljoy.me` in production. Also add `https://skilljoy.me/login` to Supabase's **Redirect URLs** allowlist.

---

### Intercepting the recovery session (race condition fix)

When the reset link is clicked, Supabase parses the token from the URL hash and establishes a session immediately. The `AuthProvider` in `stores.jsx` picks this up and sets `user` before the Login page finishes mounting — so `useEffect(() => { if (user) navigate('/matches') })` fires and redirects away before any recovery logic can run.

Fix: read `window.location.hash` **synchronously during state initialization**, before any effects run. The hash (`#access_token=xxx&type=recovery`) is still present at this exact moment:

```js
const isRecovery = useRef(window.location.hash.includes('type=recovery'));
const [mode, setMode] = useState(() =>
    window.location.hash.includes('type=recovery') ? 'new-password' : 'signin'
);
```

This means `isRecovery.current` is already `true` before the redirect effect fires, blocking navigation:

```js
useEffect(() => {
    if (user && !isRecovery.current) navigate('/matches');
}, [user, navigate]);
```

---

### Setting the new password

```js
} else if (mode === 'new-password') {
    if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    if (newPassword !== confirmPassword) throw new Error('Passwords do not match.');
    const { error: e } = await supabase.auth.updateUser({ password: newPassword });
    if (e) throw e;
    isRecovery.current = false;
    navigate('/matches');
}
```

After a successful update, the user is **signed out** and returned to the signin form with a success message. This forces a clean fresh login with the new credentials rather than silently continuing the recovery session:

```js
await supabase.auth.signOut();
isRecovery.current = false;
setMode('signin');
setSuccess('Password updated! Please sign in with your new password.');
```

---

### Email branding
Configure SMTP in Supabase via **Resend** (smtp.resend.com, port 465, username `resend`, password = Resend API key). Customize the reset email template under **Authentication → Email Templates → Reset Password**.
