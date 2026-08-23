# 166 — Build-it-yourself guide: reschedule, calendar invites, booking emails, meeting links

Date: 2026-08-21
Follows: `165-scheduling-and-course-gates.md` (which found these four gaps)

This is a **build-it-yourself guide**, not a changelog. Each section leads with
the mental model, then the decision and why the alternatives lose, then the real
code. If you want to re-derive any of it yourself, read the model, stop, and try
it before reading the code.

---

## 0 · The one idea underneath all four features

**A booking is a promise about a moment in the future, held by two people who
are not looking at your app.**

That single sentence decides almost every design choice below. Once a session is
booked, the buyer closes the tab. Where do they actually look before the call?
Their **calendar** and their **inbox**. Neither of those is your app, and neither
of them is something a browser can write to on your behalf.

That is why all four gaps turned out to be *the same gap wearing different
clothes*: everything the booking system knew, it knew only inside a React
component. The work below is mostly about getting that knowledge **out** of the
browser and into the two places people actually check.

---

## 1 · Why the write path had to move server-side first

Before any feature, an architecture decision. Bookings were created straight
from the browser:

```js
// src/lib/booking.js — the old way
await supabase.from('bookings').insert({ ... });
```

That works because RLS proves the buyer paid. RLS is genuinely good here, and it
stays. But RLS can only ever answer **"may this row exist?"** It cannot answer
the two questions scheduling actually needs:

| Question | Can RLS answer it? | Why not |
|---|---|---|
| Did the buyer pay? | ✅ yes | it's a join it can express |
| Is this a slot the host *offers*? | ❌ no | it sees a timestamp, not a weekly rule |
| Who tells the other party? | ❌ no | email needs a secret key |

Question 2 is a real hole, not a theoretical one. The browser's `generateSlots()`
decides which buttons to render — but **anything a browser sends can be edited**.
A hand-written POST could book 3am on a day the host marked unavailable, and
every check would pass.

So: **writes moved to `backend/routes/bookings.js`; reads stayed on the browser.**

That split is worth internalising as a general rule. Reads are safe to leave with
RLS because RLS is *exactly* an access-control question. Writes with side effects
(money, email, other people's calendars) want a server, because the side effects
need secrets and the validation needs rules RLS can't express.

> ⚠️ **The trap in doing this.** The route uses the **service-role** client, which
> **bypasses RLS entirely**. The moment you move a write server-side, every
> protection RLS was silently giving you is gone and you must re-implement it by
> hand. That's why `POST /api/bookings` re-checks the paid purchase — not
> because it's paranoid, but because nothing else is checking any more.

---

## 2 · Slot validation, and the DST trap

**Model:** the browser *produces* a list of offered times; the server *validates*
one that came back. Different jobs, and the second one cannot trust the first.

Lives in `backend/lib/slots.js` — deliberately its own module, not buried in the
route, so it can be tested without spinning up Express.

### The deliberate divergence from the client

```js
// client — generateSlots()
const av = availability || DEFAULT_AVAILABILITY;   // Mon–Fri 9–5 fallback

// server — slotProblem()
if (!availability?.weekly) return 'This host hasn’t published their availability yet.';
```

Same situation, opposite behaviour, **on purpose**. On the client the fallback is
a convenience. On the write path it would mean *"host never configured
availability" silently equals "host is free 9–5"* — the exact trap note 165's
publish gate closes. A fallback that is helpful in a renderer is a security bug
in a validator.

### Timezones: let Intl do it

The instinct is to compute an offset and add it. **Don't.** Offsets are not
constant — they change twice a year, on different dates per country, and some
zones have half-hour offsets. Hand-rolled offset arithmetic works all year and
then breaks on the last Sunday in March.

```js
function zonedDayAndMinutes(date, tz) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    let hour = parseInt(parts.hour, 10);
    if (hour === 24) hour = 0;   // some ICU builds render midnight as 24 under hour12:false
    return { dayKey: ..., minutes: hour * 60 + parseInt(parts.minute, 10) };
}
```

`Intl` ships a full timezone database and already knows every DST rule. Verified
against the real boundary — 2026-11-01, the US fall-back Sunday:

```
15:00Z -> local sun 09:00   (Oct 25, CDT = UTC-5)
16:00Z -> local sun 10:00   (Nov 1,  CST = UTC-6)
```

Same wall-clock hour, different UTC instant, handled without a line of offset
maths.

### The midnight trick

One subtle line worth stealing:

```js
const finish = minutes + durationMinutes;          // NOT zonedDayAndMinutes(endDate)
const fits = windows.some(w => minutes >= toMinutes(w.start) && finish <= toMinutes(w.end));
```

Converting the *end instant* separately looks equivalent and isn't. A session
running past midnight would come back as minute 0 **of the next day** and
compare as comfortably inside the window. Adding the duration to the start keeps
it in one number line, so an overrunning session simply fails to fit.

Tested, including the case that only exists because of the split-window work in
note 165 — a booking landing in a coach's lunch gap:

```
PASS | inside morning window (10am CDT, 60m)  -> bookable
PASS | DURING LUNCH (12:30pm CDT) -> reject   -> outside the host’s available hours
PASS | overruns window end (11:30am +60m)     -> outside the host’s available hours
PASS | exactly fills window (9-12)            -> bookable
PASS | null availability refused (no 9-5 fallback)
```

---

## 3 · Calendar invites (.ics) — three fields do all the work

**Model:** an `.ics` file is the universal "add to calendar" format. Google,
Apple and Outlook all import it. `backend/lib/ics.js` builds it by hand — it's a
text format, and a dependency for ~130 lines is a poor trade.

The spec is long; **three fields** are where the bugs live, and each one fails
*silently*:

| Field | Job | Failure if wrong |
|---|---|---|
| `UID` | permanent identity of the event | new UID on reschedule → attendee has **two** sessions on two days |
| `SEQUENCE` | revision counter | not higher than last time → the update is **ignored** |
| `METHOD` | `REQUEST` = happening/moved, `CANCEL` = remove | cancelled session **stays** on their calendar |

This is why `UID` is derived from the booking id and needs no column:

```js
const bookingUid = (id) => `booking-${id}@skilljoy.app`;
```

…and why `reschedule_count` doubles as `SEQUENCE`. Those two facts together are
the entire reason **reschedule is a row UPDATE, not a cancel-plus-insert** (§4).

### The two mechanical details that break real clients

**Line folding.** RFC 5545 caps lines at **75 octets**; longer ones split with
CRLF + a leading space. Long meeting URLs cross this constantly, and a strict
parser rejects the *whole file* rather than truncating one line. Note it folds on
**octets, not characters** — splitting mid-UTF-8-character corrupts the file:

```js
while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
```

(`10xxxxxx` is a UTF-8 continuation byte, so that loop walks back to a character
boundary.)

**CRLF is mandatory.** LF-only files are rejected outright by Outlook.

Verified output — note `\;` and `\,` escaping, the fold with its continuation
space, and the em-dash surviving intact across a fold:

```
SUMMARY:Deep Work Coaching\; Session 1\, part 2 — with Ana
LOCATION:https://zoom.us/j/9998887776?pwd=averyverylongpasswordtokenthatgoe
 sonandon
--- lines over 75 octets: 0
--- CRLF used: true
```

### 3b · Why that verification wasn't good enough (and what replaced it)

The output above is a **single example**. It looked like proof and wasn't — and
this is the most transferable lesson in this note.

To check the UTF-8 claim honestly, delete the continuation-byte walk-back and
see whether anything notices. Doing exactly that:

```
FAIL | 2-byte é intact at every fold offset 55..100  {"pad":66,...}
FAIL | 3-byte → intact at every fold offset 55..100  {"pad":65,...}
FAIL | 4-byte 🎯 intact at every fold offset 55..100  {"pad":64,...}
PASS | hostile SUMMARY round-trips byte-exact        ← the one-example test
```

**The single-example check passed with the bug present.** A multi-byte character
only corrupts if it lands *across* the boundary, so one string either hits that
window or it doesn't. The fix is to sweep a character across every offset from
55 to 100 bytes, which guarantees hitting it for 2-, 3- and 4-byte characters.

That sweep now lives in `backend/lib/ics.test.js` — a plain script, no framework,
exits non-zero on failure:

```
node backend/lib/ics.test.js
```

Then the same question about the test itself: **does it catch anything?** Five
deliberate mutations of `ics.js`, each a plausible real mistake:

| Mutation | Caught by |
|---|---|
| final join `CRLF` → `LF` | CRLF between properties |
| fold join `CRLF` → `LF` | CRLF between properties |
| stop escaping `;` | semicolon and comma escaped |
| hardcode `SEQUENCE:0` | SEQUENCE strictly increases |
| keep `VALARM` on CANCEL | CANCEL carries no VALARM |

All five caught, clean source still passes. Building that harness also exposed a
flaw in the test: the LF mutants originally **crashed** with
`Cannot read properties of undefined` instead of reporting. Detection was fine
(non-zero exit), diagnosis was terrible — the error pointed at the test, not the
encoder. So the line-ending assertions now run *first*, before any property
lookup, and `getProp` says which of the two causes it is.

> **Transferable:** "I ran it and looked at the output" is not verification, it's
> a demo. Verification is knowing what would have to break for the check to fail,
> and confirming it actually does. Applies well beyond `.ics`.
>
> **Honest limitation:** this validates the encoder against the spec as I've read
> it. It does not prove Google Calendar and Outlook accept the file — that needs
> a real import, which is worth doing once before you rely on invites.

---

## 4 · Reschedule: move the row, don't recreate it

**The whole design follows from §3.** Because a calendar updates an event by
matching `UID` and comparing `SEQUENCE`, keeping the same **row** is what keeps
the same **event**.

Cancel-and-rebook would produce: a cancellation notice, a hole where the session
was, and a second event beside it. One `UPDATE` produces: the existing event
moves. Same user intent, completely different experience.

```js
.update({
    start_time, end_time,
    rescheduled_at: new Date().toISOString(),
    reschedule_count: (existing.reschedule_count || 0) + 1,  // = the new SEQUENCE
    meeting_url: block?.meeting_url || null,
    reminder_sent: false,   // ← the easy one to miss
})
```

**`reminder_sent: false` is the line people forget.** A session whose 24h
reminder already fired, then moved to next week, would never remind again — the
cron only looks at `reminder_sent = false`. Resetting it re-arms the reminder for
the new time.

Two smaller judgement calls, both about who a rule protects:

- **The host is exempt from their own minimum notice.** That rule exists to stop
  *buyers* booking last-minute; a host fixing a clash an hour out is the normal
  case, not an abuse.
- **The old booking is held until the new slot is picked.** `moving` is a mode
  flag on the existing widget, so an abandoned reschedule loses nothing. Compare
  the naive version — cancel first, then show the picker — which can strand a
  buyer with no booking at all if nothing suitable is free.

The UI reuses the *entire* slot picker rather than duplicating it. The only
difference between booking and moving is which function the click calls:

```jsx
if (moving && mine) await rescheduleBooking(mine.id, slot.start, slot.end);
else await createBooking({ skillId, blockId: block.id, start: slot.start, end: slot.end });
```

---

## 5 · Emails — and the timezone question that forces a schema change

**Model:** in-app notifications are for people already in your app. Email is for
everyone else, which after checkout is almost everyone.

Building these surfaced a problem the UI had been dodging for free. The browser
renders instants in the viewer's own zone automatically — it never had to *know*
anyone's timezone. **A server has no such luxury**: to format
`"Thu, Aug 21 at 2:00 PM"` it must name a zone. The creator's is on
`profiles.booking_timezone`. The buyer's was **never stored**.

Formatting both emails in the creator's zone would tell the buyer a time that
isn't theirs — the single most damaging thing a booking email can do. Hence
migration 028:

```sql
alter table public.bookings add column if not exists buyer_timezone text;
```

Captured from the browser at booking time (`localTimezone()`), then each
recipient's mail renders in **their own** zone with an explicit `Shown in …`
note. Same fix applied to the reminder cron, which had been calling bare
`toLocaleString()` — silently using **the server's** zone, so a Railway box on
UTC told everyone the wrong hour.

**Transferable lesson:** moving logic from client to server turns implicit
context into required data. The browser knew the timezone for free; the server
has to be told. Expect a schema change every time work crosses that boundary.

### Best-effort, always

```js
try { await sendEmail({ ... }); }
catch (e) { console.error(`Booking ${kind} email failed for ${r.email}:`, e.message); }
```

The row is already committed by the time this runs. A booking that succeeded
must **never** be reported as failed because Resend was down.

Same reasoning, sharper, in the cron: the email loop must not block
`reminder_sent = true`. If a throw skipped that flag, the next hourly run would
re-notify the same booking — **every hour until the session started**.

---

## 6 · Meeting links: pick the boring option

A session with a confirmed time and nowhere to meet is not a booked session.

**Decision: a standing room link the creator sets on the coaching block**
(Zoom personal room, a permanent Meet link) — not a per-booking generated one.

Why not auto-generate? Creating a unique Meet link per booking requires Google
Calendar **write** scope. The integration currently requests **read-only
freebusy**, which is a much easier consent screen and a much smaller blast radius
if a token leaks. Trading that for per-session links is a real cost, and a
standing room link solves ~95% of it for one text field.

Then one non-obvious storage decision — the link is **snapshotted onto the
booking**, not joined through to the block:

```sql
alter table public.content_blocks add column if not exists meeting_url text;  -- the source
alter table public.bookings      add column if not exists meeting_url text;   -- the snapshot
```

Two reasons, both about things that already left your control:

1. `block_id` is `ON DELETE SET NULL`. Delete the block and every past booking is
   stranded with no record of where the call was.
2. **The .ics is already in their calendar and the email is already in their
   inbox**, both with a fixed URL. Reading live would let those silently
   disagree with what the buyer was actually sent.

Reschedules re-copy the current link, so updating your Zoom room *does*
propagate — just at an explicit, auditable moment rather than invisibly.

---

## 7 · What I did NOT do, and why

- **Did not flip `coaching` to `built: true`.** These four gaps were the stated
  blockers, and they're now closed — but that's still a product call, and the
  Dashboard's "work in progress" banner is a deliberate decision that isn't mine
  to reverse. Flip `built: true` in `src/lib/productTypes.js` when you're ready;
  nothing else needs to change.
- **Did not add date overrides / holidays.** Genuinely missing, but independent
  of these four.
- **Known pre-existing gap, unchanged:** `listBlockBookings` filters slots by
  bookings *on that block*, while the DB exclusion constraint is per **creator**
  across all products. So a slot taken by a *different* product still renders as
  free and fails at insert with "That slot was just taken." Correct, never
  double-books — just a worse experience than filtering up front.

## 8 · Deploy order

The migration is **not optional and must run first** — several columns are read
by the new code path.

```
1. docs/v3-skill-platform/migrations/028_booking_meeting_and_reschedule.sql
2. backend  (new route + libs + cron changes)
3. frontend
```

Frontend before backend would point `createBooking` at a `/api/bookings` route
that doesn't exist yet, and booking would fail outright.

## Files
**New** — `backend/lib/ics.js`, `backend/lib/ics.test.js`, `backend/lib/slots.js`,
`backend/routes/bookings.js`,
`docs/v3-skill-platform/migrations/028_booking_meeting_and_reschedule.sql`
**Changed** — `backend/index.js` (mount + reminder emails/timezones),
`backend/lib/email.js` (attachments + 4 booking templates),
`src/lib/booking.js` (writes → API, reschedule, .ics download),
`src/components/BookingWidget.jsx` (reschedule mode, join, add-to-calendar),
`src/components/BlockEditor.jsx` (meeting link), `src/lib/skills.js` (column)
