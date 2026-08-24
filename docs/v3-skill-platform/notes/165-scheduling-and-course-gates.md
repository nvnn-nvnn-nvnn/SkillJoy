# 165 — Booking/course publish gates, split availability, and a Stan parity audit

Date: 2026-08-21

Two asks: audit what's actually built vs Stan, and improve course building +
1:1 scheduling. This note covers both. Everything below was grepped, not
remembered.

## The mental model behind every change here

**A publish gate should assert "a buyer who pays gets the thing."** That's it.
The builder already had this instinct for digital products — `hasDelivery()`
refuses to publish a digital product with no file. But the same question was
never asked of the other two types that can fail the same way:

| Type | "Buyer gets the thing" means | Was it checked? |
|---|---|---|
| digital | a File block with a file or valid link | yes — `hasDelivery` |
| lead | same | yes — `hasDelivery` |
| **course** | at least one lesson **with content in it** | no — only "a lesson row exists" |
| **coaching** | a slot the creator actually agreed to | no — nothing |

The transferable lesson: *a row existing is not the same as a row being
useful.* Both gaps came from counting rows instead of asking what the buyer
receives.

## 1 · Course: empty lessons could publish

`CourseStructure` reported `onReadyChange(mods.some(m => less.some(...)))` —
"a module has a lesson." But `createLesson` inserts `{ title: '' }` the instant
you click **+ Add lesson**, and its *content* lives on a separate page. So the
sequence "add module → add lesson → navigate back → publish" shipped a course of
blank lessons, and the buyer paid for a progress bar over nothing.

**Fix:** `countLessonBlocks(skillId)` in `lib/course.js` — one query for the
whole course returning `Map<lessonId, blockCount>`:

```js
.from('content_blocks').select('lesson_id')
.eq('skill_id', skillId).not('lesson_id', 'is', null)
```

Why one query and not one per lesson: this runs on every builder load, and the
N+1 version gets slower exactly as a creator's course gets bigger — the worst
scaling direction. Counting client-side off a single-column select is cheaper
than N round-trips *and* cheaper than N `count` queries.

`onReadyChange` now means "at least one lesson **with content**", and the builder
shows which lesson is the problem — a dashed border and a **No content** badge
per lesson, plus `N lessons · M empty` on the module header. The gate and the
visual are the same fact, so "why can't I publish?" is answered on screen rather
than in a modal.

## 2 · Coaching: the default-availability trap

The nastiest find. `generateSlots()` starts with:

```js
const av = availability || DEFAULT_AVAILABILITY;  // Mon–Fri 09:00–17:00
```

That fallback is reasonable *inside* the slot engine, but it meant a creator who
**never opened the availability editor** still showed buyers a full grid of
bookable slots — Mon–Fri 9–5 hours they never agreed to. Buyer books, creator
gets a session at a time they don't work. Nothing errors; that's what makes it
dangerous.

**Fix:** `bookingReadiness(blocks, hasSavedAvailability)` in `SkillBuilder.jsx`.
`profiles.booking_availability === null` is a real signal — it distinguishes
"never configured" from "configured to be closed Monday". Publish now requires
explicitly-saved hours *when any coaching block uses native booking*; blocks on
an external link skip that check (Calendly owns availability there) but must
carry a valid `https://` URL, since a malformed link is the same dead end.

`ready` (the checklist) and `togglePublish()` (the enforcement) were computed
separately and had already drifted — `lead` was enforced but not reflected. Both
now share the same expressions, so the checklist can't say "ready" and then
refuse.

## 3 · Booking times had no timezone anywhere

`BookingWidget` fetched the creator's zone into `avail.tz` and **never rendered
it**. State that is set and never read is usually a missing feature, not dead
code — a useful smell to keep.

The times themselves were always correct: slots are true UTC instants, and
`toLocaleTimeString()` renders them in the *viewer's* zone. The bug was purely
that nothing said so, and a buyer who assumes the grid is in the host's zone
books 3am their own time. Now:

- the slot list is headed `Times shown in America/Chicago (your timezone)`,
  plus `· host is in Europe/Berlin` when the zones differ
- the confirmation line uses `timeZoneName: 'short'` — that line is what people
  screenshot, so it has to be unambiguous standing alone

## 4 · Availability: one window per day → many

`weekly[day]` has **always** been an array, and `generateSlots` has always
looped `for (const r of rules)`. Only the editor was capped, via
`av.weekly?.[key]?.[0]`. So a coach working 9–12 and 2–5 had to publish their
lunch break as bookable.

Lifting the cap touched **only the editor** — no migration, no change to the
slot engine or storage format. Worth internalising: when the data model is
already general and the UI isn't, the UI is the whole fix.

Added `+ Add window` / `✕` per row, with new windows starting an hour after the
previous one ends so the common case needs no typing and never overlaps.

Also added `dayProblem()` validation — a window ending before it starts, or
overlapping a sibling, produces **zero slots silently**. The editor now flags it
inline and `save()` refuses. Silent-empty is a worse failure than an error,
because nothing looks broken.

## 5 · Defence in depth on progress

`listMyProgress` filtered only by `skill_id`. RLS **is** correct here —
`018_course_lessons.sql` has
`lesson_progress_own ... using (user_id = auth.uid())` — so this was not a live
bug. Added the explicit `user_id` filter anyway: if that policy is ever loosened,
an unscoped query doesn't error, it just quietly counts other buyers' rows and
renders a wrong "8/10 · 80%". RLS stays the security boundary; the filter keeps
the *number* right regardless.

## Corrections to earlier assumptions

- `supabase/migrations/` is empty — the real migrations live in
  `docs/v3-skill-platform/migrations/` (027 files). `supabase/schema.sql` is a
  partial mirror and does not contain `bookings`; the migrations are the source
  of truth.
- Booking overlap is handled **properly** at the DB level —
  `016_booking_no_overlap.sql` adds a gist exclusion constraint on
  `tstzrange(start_time, end_time)` per creator. `createBooking` catching that
  violation and reporting "That slot was just taken" is the right pattern.

## Stan.store parity — verified inventory

**Has, and comparable:** link-in-bio storefront + heavy theming, digital
products, courses w/ progress, memberships, webinars, lead magnets, native 1:1
booking (+ Google Calendar freebusy), Stripe Connect payouts, discount codes,
order bumps, email capture + broadcasts, analytics/events, tracking pixels,
reviews, guest checkout, community threads.

**Missing / stubbed:**

| Gap | State |
|---|---|
| `coaching` as a creatable product type | `built: false` in `productTypes.js` — **the entire path works**; see below |
| Reschedule a booking | absent (book/cancel only) |
| Calendar invite (.ics) | absent — Google is read-only freebusy, never writes the event |
| Booking confirmation emails | absent — in-app notifications only (`email.js` has 0 booking templates) |
| Meeting link (Zoom/Meet) | absent — nothing generates or stores a call URL |
| Date overrides / holidays | absent |
| Affiliates | "Soon" card |
| Bundles | `built: false` |
| Upsells (post-purchase) | absent (order bumps exist; thank-you upsell does not) |
| Custom domains | absent |
| Course drip / free preview lesson / certificates | absent |

**The `built: false` disconnect is the headline.** `productTypes.js` marks
coaching unbuilt, so `/build/new` shows it as "Soon" and refuses to create one —
yet `SkillBuilder` seeds a coaching block for `kind === 'coaching'`, labels the
middle step "Scheduling", protects that block from deletion, `BlockEditor` has
full native config (duration / buffer / minimum notice), `BookingWidget` books,
`016` enforces no-overlap, and `backend/index.js` runs an hourly reminder cron.
Coaching is reachable *only* as a block inside another product type.

Left as-is deliberately: the Dashboard carries a "Bookings are a work in
progress" banner, so `built: false` reads as **matching that decision**, not as
a stale flag. Flipping it is a product call — and the three gaps that make it
premature are concrete: no reschedule, no calendar invite, no meeting link.

## Files
- `src/lib/course.js` — `countLessonBlocks`, user-scoped `listMyProgress`
- `src/components/CourseStructure.jsx` — empty-lesson badges, content-aware ready
- `src/components/CoursePlayer.jsx` — pass `user.id`, effect dep
- `src/components/BookingWidget.jsx` — timezone header + `timeZoneName`
- `src/components/AvailabilityEditor.jsx` — multi-window, validation, save guard
- `src/app-pages/SkillBuilder.jsx` — `bookingReadiness`, aligned `ready`
