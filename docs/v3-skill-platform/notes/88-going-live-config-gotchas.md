# 88 — Going-live debugging saga: five config gotchas (none were code)

_Session 2026-07-07. After guest payments was built, taking it live surfaced a
chain of failures. Every single one was environment/config — the app code held up
throughout. This note is the field guide so future-you recognises these fast._

---

## 0. The meta-lesson

**When something that "should work" doesn't, suspect the environment before the
code — especially anything involving `.env`, external services, or a browser.**

We burned real time chasing five separate issues. Zero were bugs in the app. The
throughline: config lives in places that don't reload, don't match, or get
intercepted — and the symptom rarely points at the real cause. Learn the tells.

Two habits that would have short-circuited most of this:
1. **Restart the backend after ANY `.env` change.** Node reads env once at startup.
2. **Read the full error payload** — the culprit is often literally in it (see §1).

---

## 1. "No such destination: 'acct_…'" — Stripe platform mismatch

**Symptom:** checkout / guest-intent threw `No such destination: 'acct_1Tqhs8…'`,
`param: transfer_data[destination]`. Re-onboarding made a *new* account id but the
error persisted.

**Root cause:** a Stripe **connected account belongs to the one platform key that
created it.** We'd rotated `STRIPE_SECRET_KEY` across Stripe accounts, so the
stored `acct_…` lived under an *old* platform while the charge ran under the
*current* one. Different platform → "no such destination."

**The tell (this is the good part):** the raw error's `request_log_url` was
`dashboard.stripe.com/**acct_1TF1d1EO4L6TAYQJ**/test/…` — that path segment is the
platform account making the call. It didn't match the destination's owner →
mismatch proven, no guessing.

**Fix:** clear the stale id (`update profiles set stripe_account_id = null,
stripe_onboarded = false …`), then re-onboard **under the currently-running key**,
then buy. Also hardened `GET /status` to self-heal a stale account instead of
throwing (note 86).

**Lesson:** cached external ids (`acct_`, `price_`, customer ids) are only valid
for the credentials that made them. Rotate creds → orphaned ids. Pick ONE Stripe
account and stop swapping keys.

## 2. Emails "not sending" — four sub-gotchas in a row

Chased "no confirmation email" through *four* layers, each masking the next:

1. **Backend not restarted** after adding `RESEND_API_KEY` → `new Resend(undefined)`
   → silent fails. (Restart. Every. Time.)
2. **The idempotency short-circuit.** Backend logged `guest fulfil: already paid` —
   the buyer already owned the product, so fulfilment `return`ed *before* the email
   send. Re-buying the same product+email never re-attempts the email. Test with a
   **fresh email** (Gmail `+tag` trick makes distinct buyers).
3. **Resend unverified-domain restriction (403).** With the shared
   `onboarding@resend.dev` sender, Resend **only delivers to your own account
   email.** Everything else → `403 validation_error`. (And `+tag` addresses count as
   *different* recipients, so the tag trick backfires for delivery testing.)
4. **`RESEND_FROM` domain typo.** After verifying a domain we set the from-address
   to `@skilljoy.app`, but the verified domain was `skilljoy.me` → `403 domain not
   verified`. The `from` domain must exactly match a verified domain.

**The tell each time:** the backend console. `Resend error: { … }` and the per-caller
`… receipt failed:` warnings named the exact problem. `✅ … fulfilled` with no error
line = the send actually worked.

**Lesson:** email has a stack of gates (key loaded? path reached? domain verified?
from-address matches?). Walk them in order using the server logs — don't guess which
layer is failing.

## 3. Magic link "otp_expired" — single-use tokens

**Symptom:** clicking the emailed magic link redirected to
`/locker/…#error=access_denied&error_code=otp_expired`.

**Root cause:** magic-link OTPs are **single-use and short-lived.** The failing
clicks were on stale/reused links (we'd tested repeatedly). A *fresh, prompt,
single* click succeeded — the redirect came back with
`#access_token=…&type=magiclink`, a valid session.

**Watch for:** email clients (Gmail, Outlook, corporate proxies) **pre-fetch links
to scan them**, which can consume the one-time token before the human clicks →
`otp_expired` even on a "fresh" link. If real users hit this intermittently, the fix
is an intermediate `/claim` page that only completes sign-in on a real click (a
scanner's GET can't consume it). Not needed yet — happy path works.

**Lesson:** one-time tokens + email = a race with link scanners. Works in testing,
can bite at scale; know the `/claim`-page mitigation exists.

## 4. White screen in one browser but not another — ad blocker

**Symptom:** the Locker (and everything) white-screened in the normal browser but
worked in the VS Code embedded browser. Console:
`GET /src/lib/analytics.js net::ERR_BLOCKED_BY_CLIENT`.

**Root cause:** an **ad blocker** (uBlock/Brave/etc.) blocks any script literally
named `analytics.js` **by filename**, regardless of content. In `vite dev`, modules
are served unbundled, so `/src/lib/analytics.js` is a real request → blocked → the
import fails → the app crashes to a white screen. `ERR_BLOCKED_BY_CLIENT` is the
signature of an extension, not the server.

**Nuance:** this is **dev-only** — a production `vite build` bundles everything into
one hashed chunk, so there's no `analytics.js` request to block. (The
`analytics_events` Supabase insert *can* still be blocked by URL in prod, but it's
fire-and-forget, so it only drops some events — no crash.)

**Fix:** renamed `src/lib/analytics.js` → `src/lib/metrics.js` + updated 6 imports.
Neutral name dodges filter lists. (Left function names + the `analytics_events`
table as-is; only the served filename caused the crash.)

**Lesson:** `ERR_BLOCKED_BY_CLIENT` = a browser extension, not your code. Never name
a shipped script `analytics.js`, `ads.js`, `tracking.js`, etc.

---

## Pre-launch checklist distilled from all this
- [ ] **One** Stripe account; its `sk_…` in local **and** Railway; never rotate mid-stream.
- [ ] Restart the backend after every `.env` edit (local) / redeploy (Railway).
- [ ] Resend: domain **verified**, `RESEND_FROM` uses that **exact** domain, set in prod too.
- [ ] Test emails with a **fresh** buyer email (not one that already owns the product).
- [ ] Magic links: click fresh/once; know the `/claim` mitigation if scanners bite.
- [ ] No shipped script named `analytics.js` (or similar blocker-bait).

**TL;DR:** guest payments + the whole platform were functionally correct the entire
time. Going live is its own skill — a gauntlet of restart-your-env, match-your-keys,
verify-your-domain, and mind-the-browser gotchas. When "correct" code misbehaves,
read the error payload and suspect the environment first.
