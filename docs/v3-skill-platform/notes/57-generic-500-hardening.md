# 57 — Pre-launch hardening: stop leaking internal errors in 500s

**Date:** 2026-07-08

## Why
Every backend catch block returned `res.status(500).json({ error: err.message })`,
leaking internal DB/Stripe/stack details to clients. Pre-launch fix (the owner is
flipping Stripe test→live).

## What changed
- **`backend/lib/http.js`** (new): `serverError(res, err)` — logs the real error
  server-side, returns generic `{ error: 'Something went wrong. Please try again.' }`.
- Swapped **~70 sites across 14 route files** to `serverError` (admin, checkout,
  guest, locker, blocks, marketing, public, skills, stripe-connect, payments,
  reports, verify-college, users, webhooks). Applied via sed + import injection.
- Two string-built leaks hand-fixed to friendly category messages (admin resolve
  refund → "Refund failed. Please try again."; verify-college → "Email delivery
  failed. Please try again.") with the detail logged.

## Preserved
All intentional **4xx** messages (validation / friendly errors) are unchanged —
only unexpected **500s** were genericized.

## Verified
`node --check` on all routes ✓ · every `serverError` call has its import ✓ ·
`grep` shows 0 remaining `.message` in 500 responses ✓ · backend boots ✓.

## Action
Redeploy the backend to pick this up (live). No frontend/DB changes.
No Sentry (per the owner) — errors go to server logs.
