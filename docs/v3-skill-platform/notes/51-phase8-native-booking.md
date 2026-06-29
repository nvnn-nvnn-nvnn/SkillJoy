# 51 — v3 Build: Phase 8 (Native Booking)

**Date:** 2026-06-23

## Overview

Built **Phase 8 — native booking**, upgrading coaching blocks from
external-link-only to a real availability + slot-booking system. `vite build` +
eslint + `node --check` all clean.

## What changed

- **`migrations/007_booking.sql`** (new — ⚠️ run in Supabase after 001–006):
  `profiles.booking_availability` (jsonb) + `booking_timezone`;
  `content_blocks.booking_minutes`; a `bookings` table with RLS (buyer reads/books
  only Skills they paid for; either party cancels) and a **partial unique index**
  `(creator_id, start_time) WHERE status='booked'` to prevent double-booking;
  widened the notifications CHECK (superset) to add `booking_confirmed`,
  `booking_cancelled`, `booking_reminder`.
- **`lib/booking.js`** (new): availability save, **timezone-correct slot
  generation** (`zonedWallClockToUtc` offset round-trip; slots stored as true UTC
  instants so each viewer sees local time), create/cancel with creator
  notifications, and queries for buyer/creator/block bookings.
- **`components/AvailabilityEditor.jsx`** (new, on Dashboard): per-weekday window
  + session length; saves to the creator profile; shows the timezone.
- **`components/BookingWidget.jsx`** (new): buyer slot picker grouped by day;
  shows/cancels an existing booking; handles the slot-taken race.
- **`BlockEditor.jsx`**: coaching block now has a **Booking link vs Native
  booking** toggle (+ duration). Native = no `external_url` + `booking_minutes`.
- **`BlockRenderer.jsx`**: native coaching renders `<BookingWidget>`; link mode
  unchanged.
- **`Dashboard.jsx`**: "Upcoming sessions" list (creator) beside the availability
  editor.
- **`backend/index.js`**: hourly **reminder cron** → in-app notifications to both
  parties for bookings within 24h (`reminder_sent` guard). Works without email.
- `skills.js` `getSkillWithBlocks` now selects `booking_minutes`.

## Decisions / MVP limits
- **In-app reminders only** (notifications table) — email reminders need
  `RESEND_API_KEY`, not set. Cron is email-ready later.
- **One window per weekday**; no reschedule (cancel + rebook); 14-day booking
  horizon. TZ uses the offset round-trip (DST-boundary slots may be ±1h — rare).
- Native coaching bookings are **included with the Skill purchase** (no separate
  per-session charge at MVP) — buyer must own the Skill to book (RLS-enforced).

## Action required (Devan)
- Run **`migrations/007_booking.sql`** in Supabase (now 7 migrations: 001–007).
  Booking is unusable until this is applied.

## Not verified
- No live smoke test yet (migration 007 not applied; needs a multi-actor setup:
  creator availability + a buyer who purchased a Skill with a native coaching
  block). Build/lint/syntax only.

## Next
Phase 9 — email capture + marketing. Then 10 (discounts/refunds/tax),
11 (pixels/AutoDM/affiliates), 12 (SEO/integrations/admin). Or the deferred
payment-loop verification (needs Stripe test keys). See doc 08.
