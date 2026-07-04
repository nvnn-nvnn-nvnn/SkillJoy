# 72 — Google Calendar connect + freebusy (coaching) — expert guide

_Session 2026-07-03. First "branch the body" for coaching: connect a creator's
Google Calendar so their real busy times subtract conflicting booking slots.
Scope chosen with the user: **connect + freebusy only, augmenting** native hours
(no event writing yet)._

---

## The model (why it's built this way)
- **Read-only.** Scope is `calendar.readonly`; we only query freebusy. No events
  are created. (Event push + Meet links = a future phase needing `calendar.events`.)
- **Augment, don't replace.** Native weekly availability (`profiles.booking_availability`)
  stays the "hours I offer." Google freebusy *subtracts* real conflicts. Creators
  without Google keep working exactly as before.
- **Fail-open everywhere.** Any Google/network error → empty busy list → booking
  falls back to native slots. Google can never *break* booking, only refine it.

## SECURITY — the one thing to never get wrong
The OAuth **refresh token is a secret**. `profiles` is publicly readable
(storefronts/Discover query it unauthenticated), and Supabase RLS is
**row-level** — a readable row exposes every column. So a token on `profiles`
would be one `select('...')` from any anon client.

→ Tokens live in their **own table `google_tokens`** (migration 013) with **RLS
enabled and NO policies**: anon/authenticated get zero access. Only the backend
**service key** (which bypasses RLS) reads/writes it. The frontend only ever
learns a boolean (`connected`) via `/api/google/status`. **Never move these
columns onto profiles.**

## OAuth flow (plain fetch, no googleapis dep — Node 22 has global fetch)
`backend/routes/google.js`, mounted at `/api/google` **without** global auth
(the callback has no Authorization header):
- `GET /connect` (auth) → returns Google consent URL. State = the creator's uid,
  **HMAC-signed** (`crypto`, 10-min expiry) so the open callback can trust it.
- `GET /callback` (open) → verify state → exchange `code` for tokens → upsert
  `google_tokens` (refresh_token + connected). `access_type=offline` +
  `prompt=consent` guarantees a refresh token. Redirects to
  `${FRONTEND_URL}/dashboard?google=connected`.
- `GET /status` (auth) → `{ connected, configured }`.
- `POST /disconnect` (auth) → clears the row.
- `GET /freebusy/:creatorId?start&end` (auth) → refreshes an access token from
  the creator's stored refresh token, POSTs Google `freeBusy`, returns
  `{ busy: [{start,end}] }`. Fail-open → `{ busy: [] }`.

`configured()` gates on the 3 env vars; unconfigured → `/status` reports
`configured:false` and the UI shows "not set up yet" instead of a broken button.

## Frontend
- `src/lib/google.js` — `getGoogleStatus`, `startGoogleConnect` (redirects to
  Google), `disconnectGoogle`, `getCreatorFreebusy`.
- `src/components/GoogleCalendarConnect.jsx` — self-contained connect/disconnect
  card (fetches its own status). Dropped into **two** places: the builder's
  coaching block (native booking) and `AvailabilityEditor` (the availability home
  + where the OAuth callback lands).
- `src/components/BookingWidget.jsx` — after `generateSlots`, fetches the
  creator's freebusy for the next ~15 days and **drops any slot overlapping a
  busy interval** (`ss < be && se > bs`). Wrapped in try/catch → fail-open.

## ⚠️ SETUP REQUIRED (you must do this — I can't)
1. **Run migration** `docs/v3-skill-platform/migrations/013_google_calendar.sql`
   in the Supabase SQL editor.
2. **Google Cloud Console:** create a project → enable **Google Calendar API** →
   configure **OAuth consent screen** (External; add the `calendar.readonly`
   scope; add yourself as a test user while unverified) → create an **OAuth
   client (Web application)** → copy Client ID + Secret → add redirect URIs:
   - local: `http://localhost:3001/api/google/callback`
   - prod:  `https://<your-railway-url>/api/google/callback`
3. **Backend env** (`backend/.env` locally, Railway vars in prod):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/google/callback   # match per env
   ```
   Restart the backend after adding them.

## Test
Builder → coaching product → native booking → **Connect** → Google consent →
back to dashboard. Put a busy event on your Google primary calendar during your
native hours → open the product in a buyer's Locker → that slot is gone. Remove
the event → it reappears. Disconnect → back to pure native slots.

## Next (future phase, deliberately not built)
Event push: on booking, create a calendar event + Google Meet link + invite the
buyer. Needs the `calendar.events` scope (re-consent) and a POST to the Calendar
events API in `createBooking`'s server path. See [[per-type-product-builders]].

## DEFERRED by the user (2026-07-04) — shows "Soon"
User is holding off on the Google Cloud setup for now (thought it might cost —
note: Calendar API + OAuth is actually **free**, no billing account needed within
quota; revisit anytime). The whole feature is code-complete and gated on the 3
env vars + migration 013 (both migration and code are already in place; only the
Google Cloud OAuth client is missing).

Until those env vars exist, `configured()` is false → `/api/google/status`
returns `configured:false` → **`GoogleCalendarConnect` now renders a "Soon"
badge** ("Auto-sync your calendar to block busy times…") instead of the old
"isn't set up on the server yet" text. This makes it read as an intentional
coming-soon feature, matching the other "Soon" cards (Options tab, product-type
picker). The moment the env vars are added, the same component flips to the live
Connect button automatically — no code change needed.

**To turn it on later:** create the Google Cloud OAuth client (steps above),
set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI`, restart
the backend. Done.
