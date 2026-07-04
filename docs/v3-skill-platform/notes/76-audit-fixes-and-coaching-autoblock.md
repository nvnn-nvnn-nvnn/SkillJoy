# 76 — Audit fixes + coaching auto-block

_Session 2026-07-04. Actioned the audit recommendations (note-less review of
digital delivery + coaching) and made coaching products auto-seed a booking
block._

---

## Audit fixes

### Digital delivery
- **File-size guard** (`BlockEditor.handleFile`): rejects uploads over
  `MAX_FILE_MB` (50) with a clear "use a link instead" message, before hitting
  storage. Prevents opaque large-upload failures.
- **URL validation** (`isHttpUrl`): the link-delivery input shows a red border +
  inline error when the value isn't a valid `http(s)://` URL. And `hasDelivery`
  in `SkillBuilder` now requires a **valid** link (not just any truthy string),
  so the publish guard blocks shipping a broken download.

### Coaching booking
- **DB overlap constraint** — migration **016**: the old `bookings_slot_unique`
  index only blocked identical `(creator, start)`. Added a partial GiST
  **exclusion constraint** (`btree_gist`) so overlapping ranges per creator
  (`tstzrange(start,end) &&`) can't both be `booked`. `createBooking`'s error
  matcher now also catches exclusion/overlap violations → the friendly "that slot
  was just taken" message. **Run migration 016** (see its header re: pre-existing
  overlaps).
- **AvailabilityEditor hydration bug** — it seeded `av`/`tz` from `profile` in
  `useState` initializers, which run once. If the profile hydrated *after* mount,
  the editor showed defaults and a Save could **overwrite real availability with
  defaults**. Added a one-time `useEffect` (guarded by a `hydrated` ref) that
  syncs `av`/`tz` when the profile first arrives, without clobbering later edits.
  (Scoped `eslint-disable react-hooks/set-state-in-effect` — this is the valid
  "hydrate local state from an async prop" exception.)

### Not fixed (by design)
- Freebusy **fail-open** stays: a Google error falls back to native slots rather
  than hard-breaking booking. Deliberate tradeoff.
- **Meeting links / calendar invites** on native booking — that's the Phase-2
  feature (needs `calendar.events` scope re-consent + a backend booking route),
  not a quick fix. Still the top coaching TODO.

## Coaching auto-block
Coaching products now **always have a coaching (booking) block**:
- On builder load (`SkillEditor` effect), if `kind === 'coaching'` and no coaching
  block exists, one is auto-added (`addBlock({type:'coaching', booking_minutes:30})`).
  Covers both freshly-created and legacy coaching products.
- `removeBlock` **guards** the last coaching block on a coaching product — trying
  to delete it shows a warning ("Coaching products need a coaching block…") and
  no-ops. Creators can still add/remove *other* blocks freely.

## Verify
`eslint` clean; `npm run build` OK. Manual: create a coaching product → the
Content/Scheduling step already has a coaching block; try to delete it → blocked;
add a File block → deletes fine. Digital: paste a bad delivery link → red error +
Publish stays gated; upload a >50MB file → rejected.
