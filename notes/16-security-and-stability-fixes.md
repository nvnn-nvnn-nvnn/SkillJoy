# Security & Stability Fixes — Audit Followup

## 1. Webhook Null Guard — `backend/routes/webhooks.js`

### Why
If `ADMIN_EMAIL` doesn't match any profile, `adminProfile` is `undefined` and accessing `.id` crashes the webhook handler. Stripe gets no 200 and retries indefinitely.

### What
Both `charge.dispute.created` and `charge.dispute.closed` now build notifications as an array, then conditionally `unshift` the admin notification only if `adminProfile` exists. Logs an error if missing so the issue is visible without crashing.

---

## 2. Webhook Race Guard — `backend/routes/webhooks.js`

### Why
If `payment_intent.succeeded` fires before `/payments/confirm` writes the order, the update silently no-ops with no indication anything went wrong.

### What
Added `.select('id')` after the update. If `updated` is empty, logs:
```
⚠️ RACE/MISSING: order {id} not found or already escrowed — webhook may have arrived before order was created
```

---

## 3. CORS Lockdown — `backend/index.js`

### Why
Dev mode used `origin: '*'`, which is a CSRF risk if deployed without `NODE_ENV=production`.

### What
Dev mode now uses `process.env.FRONTEND_URL` if set, otherwise falls back to `http://localhost:5173`. Production still uses `FRONTEND_URL` exclusively.

---

## 4. Evidence URL Domain Restriction — `backend/routes/payments.js`

### Why
The image URL validator only checked for HTTPS — any domain was accepted, including phishing/malicious sites.

### What
Added a hostname check: the URL must end with the Supabase project host (`SUPABASE_URL` env var, stripped of `https://`). Rejects anything not hosted on SkillJoy storage.

---

## 5. React Error Boundary — `src/main.jsx`

### Why
No error boundary existed — any unhandled render error would crash the entire app with a blank white screen.

### What
Added an `ErrorBoundary` class component wrapping the entire `<App />`. On crash, shows a "Something went wrong" message with the error and a Reload button.
