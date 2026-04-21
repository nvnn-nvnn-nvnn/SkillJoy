# 23 — College Email Verification Auth Fix

**Date:** 2026-04-20

## What
Fixed college email verification not working when users clicked the link from their email.

## The Bug
`/api/verify-college` had `authMiddleware` applied to the entire router in `index.js`:

```js
app.use('/api/verify-college', authMiddleware, verifyCollegeRoutes);
```

This blocked the `/confirm` endpoint — the one called when the user clicks the email link.

## Why It Broke
When a user clicks a verification link in their email, it opens in a browser tab. That tab has no active session (no JWT), so `authMiddleware` rejected the request with a 401 before the token was ever checked.

## What is a JWT?
JWT = JSON Web Token. When a user logs in, Supabase issues them a signed token (a long encoded string). The frontend sends it in the `Authorization` header on every API call. `authMiddleware` decodes it to set `req.user` — that's how routes know whose account they're working with.

JWTs expire. A fresh browser tab with no login session won't have one.

## Why `/confirm` Doesn't Need Auth
The `/confirm` route finds the user by token, not by session:

```js
supabase.from('profiles').select(...).eq('college_verify_token', token)
```

It doesn't use `req.user` at all — so requiring a JWT is unnecessary and breaks the flow.

## Why `/send` Still Needs Auth
The `/send` route uses `req.user.id` to know whose profile to update:

```js
.update({ college_email, college_verify_token, ... }).eq('id', req.user.id)
```

Without auth, anyone could send verification emails to arbitrary addresses (spam risk).

## The Fix

**`backend/index.js`** — removed auth from the whole router:
```js
// before
app.use('/api/verify-college', authMiddleware, verifyCollegeRoutes);

// after
app.use('/api/verify-college', verifyCollegeRoutes);
```

**`backend/routes/verify-college.js`** — added auth inline on `/send` only:
```js
const authMiddleware = require('../middleware/auth');

router.post('/send', authMiddleware, async (req, res) => { ... });
router.post('/confirm', async (req, res) => { ... }); // no auth needed
```

## Result
- `/send` → requires login (protects against spam)
- `/confirm` → no login required (works from email link in any browser tab)

## Files Changed
- `backend/index.js` — removed `authMiddleware` from verify-college router
- `backend/routes/verify-college.js` — added `authMiddleware` inline on `/send` only
