# 75 — Coaching scheduling controls (duration / buffer / min-notice / tz)

_Session 2026-07-04. First of the coaching build passes. Adds real scheduling
config to native booking. No external deps. (Google Meet links, in-checkout
slot-picking, and group/webinars are later passes.)_

---

## What shipped
Per-coaching-block controls in the builder (native booking mode):
- **Session length** — select up to **480 min** (`15/30/45/60/90/120/180/240/360/480`,
  formatted "1 hr 30 min" etc.). Was a fixed 15–90 select.
- **Buffer after** — `0/5/10/15/30` min gap enforced after each booked call.
- **Minimum notice** — `No minimum … 2 days`; blocks last-minute bookings.
- **Timezone** — an IANA-zone `<select>` in `AvailabilityEditor` (uses
  `Intl.supportedValuesOf('timeZone')`, falls back to the current zone). Saved via
  the existing `saveAvailability` (`profiles.booking_timezone`).

## The slot logic (the real work)
`generateSlots` was refactored from positional args to an **options object**
`generateSlots(availability, tz, { daysAhead, minutes, bufferMinutes,
minNoticeMinutes, booked })`:
- **Minimum notice** → slots must start after `now + minNoticeMinutes`.
- **Buffer** → each existing booking blocks `[start − buffer, end + buffer]`; a
  candidate slot is dropped if `[slotStart, slotEnd]` overlaps any blocked range
  (interval overlap: `startMs < be && endMs > bs`). This replaced the old exact
  start-time `Set` match, so overlaps of *any* length are handled, not just
  identical starts.
- `listBlockBookings` now also selects `end_time` (needed for the interval math).
- `BookingWidget` passes the block's `booking_minutes / buffer_minutes /
  min_notice_minutes` and the booked intervals; the Google freebusy subtraction
  (note 72) still runs after, unchanged.

## Data
Migration **015** adds `content_blocks.buffer_minutes` + `min_notice_minutes`
(both `int default 0`). `getSkillWithBlocks`'s block select now includes them (and
the block save path already handles arbitrary columns). **Run migration 015**
before testing or the new fields won't persist. Mirrored into `schema.sql`.

## Verify
`eslint` clean; `npm run build` OK. Manual: coaching product → native booking →
set length 45 min, buffer 15, min-notice 1 day → in a buyer's Locker, confirm no
slots appear within 24h and there's a 15-min gap around any existing booking.

## Next coaching passes (chosen order pending)
- **Google Meet links + calendar invites** on booking — needs the
  `calendar.events` scope (re-consent) + a backend booking route (booking is
  currently client-side). Zoom = separate OAuth, deferred.
- **In-checkout slot-picking** — move booking from the post-purchase Locker into
  the buy flow.
- **Group calls / webinars** + attendee limits — new data model.
See [[per-type-product-builders]].
