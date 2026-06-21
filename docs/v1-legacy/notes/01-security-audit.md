# Security Audit — April 2026

## What was done
A full security audit of the SkillJoy codebase, identifying and fixing HIGH and MEDIUM severity vulnerabilities.

---

## IDOR Fix — `/api/users/profile/:userId`

**Why:** Any authenticated user could fetch any other user's full profile including private fields (email, stripe_account_id, etc.) just by knowing their UUID.

**How:** Added a `PUBLIC_FIELDS` constant in `backend/routes/users.js`. The endpoint now checks `req.user.id === userId`. Own profile returns full `*` select; other users return only public-safe fields.

```js
const PUBLIC_FIELDS = 'id, full_name, bio, avatar_url, service_type, availability, college, college_verified';
const isOwnProfile = req.user.id === userId;
.select(isOwnProfile ? '*' : PUBLIC_FIELDS)
```

---

## Payment Race Condition Fix — `/api/payments/release`

**Why:** Two concurrent requests could both pass the `payment_status === 'escrowed'` check and release the same payment twice.

**How:** Moved the check into the UPDATE itself. The DB atomically checks the condition and updates in one operation. If `released` row comes back null, the update was blocked by a concurrent change — returns 409.

```js
.update({ payment_status: 'released', ... })
.eq('id', orderId)
.eq('payment_status', 'escrowed')  // ← atomic check+act
.select('id').single();

if (!released) return res.status(409).json({ error: 'Order state changed. Refresh and try again.' });
```

---

## Dispute Check Before Release

**Why:** A disputed order could still have its funds released if someone hit the release endpoint directly (e.g. via API).

**How:** Added an explicit status check before the release logic:

```js
if (order.status === 'disputed') {
    return res.status(400).json({ error: 'Cannot release payment while order is disputed' });
}
```

---

## Evidence Sanitization — `/api/payments/submit-evidence`

**Why:** The evidence textarea accepted unlimited text, and image URLs weren't validated — a user could submit a local file:// URL or a non-HTTPS URL.

**How:**
- Added 5000 char limit on description
- HTTPS-only URL validation using `new URL()` and checking `protocol === 'https:'`

---

## CSRF Protection

**Why:** State-changing API endpoints had no CSRF token requirement.

**How:** The app uses JWT Bearer tokens sent in the `Authorization` header. Browser-native CSRF attacks (form posts, img tags) cannot set custom headers, so Bearer token auth is inherently CSRF-safe. No additional token needed.

---

## Removed Hardcoded Admin Email Fallback

**Why:** The admin route had `|| 'techkage@proton.me'` as a fallback — if `ADMIN_EMAIL` env var was not set, anyone knowing that email could gain admin access in a misconfigured deployment.

**How:** Changed to throw on startup if `ADMIN_EMAIL` is not set:

```js
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (!ADMIN_EMAIL) throw new Error('ADMIN_EMAIL env var is not set');
```

---

## Removed .env from Git History

**Why:** The `.env` file containing Supabase keys and Stripe secret keys was accidentally committed to git, making secrets visible to anyone with repo access.

**How:** Used `git-filter-repo` to rewrite history and remove the file entirely. Keys were rotated manually after removal. `.env` was added to `.gitignore`.

---

## Cron Job Timeout Wrapping

**Why:** If a Supabase query or Stripe API call hung, the cron job would never finish, potentially blocking Node's event loop or causing silent failures.

**How:** Added a `withTimeout(ms, fn)` helper that races the async function against a rejection timer:

```js
function withTimeout(ms, fn) {
    return Promise.race([
        fn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Cron timed out after ${ms}ms`)), ms)),
    ]);
}
```

Applied to all 3 crons: auto-release (30min), clearance (30min), chat archive (5min).

---

## Stripe Account Verification Before Transfer

**Why:** If a seller's Stripe Express account existed but had `payouts_enabled: false` (e.g. incomplete onboarding), the transfer would fail silently or error.

**How:** Added `payouts_enabled` check fetched via `stripe.accounts.retrieve()` before attempting transfer in the clearance cron. Skips the transfer and logs a warning if payouts are not enabled.
