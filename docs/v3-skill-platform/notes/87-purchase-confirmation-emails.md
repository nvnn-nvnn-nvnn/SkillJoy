# 87 — Purchase confirmation / thank-you emails

_Session 2026-07-06. One branded confirmation email for every purchase path, and
filling the gap where memberships sent none._

---

## The problem: three purchase paths, inconsistent (and one missing) emails

Purchases arrive three ways, and each fulfils in its own place:
- **one-time (logged in)** → `payment_intent.succeeded` webhook — *had* an inline
  receipt email.
- **guest** → `guestFulfillment.js` — *had* its own inline email (with the magic link).
- **membership** → `checkout.session.completed` webhook — **sent no email at all.**
  New members got an in-app notification and nothing in their inbox.

Two inline templates that drift + one path silently missing = exactly the kind of
inconsistency users notice ("I bought the membership and got nothing").

## The fix: one template, three callers

Added `purchaseThankYou(...)` to
[backend/lib/email.js](../../../backend/lib/email.js) — a single branded
confirmation builder returning `{ subject, html }`. Params flex it across paths:
- `recurring` → membership copy ("You’re in", "/ month", "manage or cancel anytime").
- `note` → the creator's custom `confirmation_message` (HTML-escaped via `esc()`).
- `accessUrl` + `accessLabel` → the Locker link (or the guest **magic link**).
- `footerNote` → extra fine print (guests get the "no password needed" line).

Wired into all three:
- One-time webhook + guest fulfilment: replaced their inline HTML with the shared
  template (same behaviour, one source of truth).
- **Membership webhook: added the email that was missing** — a recurring-flavoured
  thank-you with the Locker link, using `session.customer_details.email` (falls back
  to `session.customer_email` / `getUserEmail`).

## Why one template beats three inline strings

The old code hand-rolled the same `<div style=…><a …>` in three files. The moment
you want to change the button colour, add a logo, or fix a typo, you touch three
places and inevitably miss one — which is *how* the membership path ended up with no
email at all. A shared builder means the confirmation email is defined once;
callers only supply what differs (recurring? note? which link?).

**Lesson:** when the same side effect (an email, a receipt, a notification) fires
from several code paths, define it once and parametrise the differences. Divergent
copies don't just duplicate work — they drift, and drift is where the "wait, this
one does nothing" bugs hide.

## Safety notes
- Every send stays wrapped in try/catch — a mail failure must never break
  fulfilment (the buyer still gets access; only the email is best-effort).
- Creator-supplied `confirmation_message` is escaped (`esc`) before going into HTML.
- All of this still depends on **Resend** being connected with a **verified domain**
  (note 85) — with the shared test sender, only your own Resend email receives.

## Status
`node --check` passes on email.js, webhooks.js, guestFulfillment.js. Not observed at
runtime — needs Resend live + a real purchase on each path. To test: buy one-time,
guest, and membership products (Resend + `stripe listen` running) and confirm each
inbox gets the right flavour of the thank-you email.
