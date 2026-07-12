# 122 — Five-task pass: subscribe fix · dark-mode sweep · avatar size · drag-reorder · username change

_2026-07-11. Fable 5, from the Opus-scoped prompt. All five verified: `node --check` on
public.js/users.js + `vite build` clean after each task._

---

## Task 1 — Storefront email capture error (FIXED, root cause)

**Root cause:** `src/lib/subscribers.js` `subscribe()` did a DIRECT anon-key upsert to the
`subscribers` table from the visitor's browser. That write depends entirely on the "Anyone can
subscribe" RLS INSERT policy (migration 008) existing + surviving in prod — if RLS drifts (or the
prod table predates 008's policy), every subscribe throws. It was also unvalidated + unthrottled.
Could not reproduce the exact original error locally (local DB has the policy); the fix removes
the anon-RLS dependency that was the likely cause — and is the right architecture regardless.

**Fix:**
- **`backend/routes/public.js`** — new `POST /api/public/subscribe` { creatorId, email, name?,
  source? }. Server-side email regex, creator-exists check (404), then a SERVICE-ROLE upsert
  (onConflict 'creator_id,email', ignoreDuplicates — mirrors the membership webhook's subscriber
  insert). 400 bad email; 200 { ok:true } even on duplicate (idempotent). Mounted route was
  already unauthenticated behind strictLimiter → rate-limited for free.
- **`src/lib/subscribers.js`** — `subscribe()` now calls that endpoint via apiFetch; same
  throw-on-error contract → `SubscribeForm.jsx` unchanged.

## Task 2 — Dark-mode / contrast sweep (colors only)

- **`var(--text-primary)` is UNDEFINED app-wide** (the system defines `--text`). Replaced all
  **43 occurrences across 11 files**: Admin, Gigs, GigDetails, Notifications, GigModalInfo,
  ReportModal, Swaps, Disputes, Chat, DisputeDetail, MyOrders. Zero remain (grep-verified).
- **Admin.jsx neutrals → vars:** dismissed-report chip (#f3f4f6/#6b7280/#e5e7eb →
  --surface-alt/--text-muted/--border), dismissed borderLeft (#d1d5db → --border-strong), Dismiss
  button neutrals, the finances info box (#f8fafc → --surface-alt).
- **Left as-is (intentional):** all STATUS_COLORS badges + green/red/purple/orange semantic chips
  (readable in both themes by design); the admin "A" avatar (dark circle/white letter — fine in
  both); the toast (dark by design).
- **Footer decision:** left untouched — it's an intentional dark bar with light text, correct in
  both themes.

## Task 3 — Adjustable profile-picture size (theme pattern, no migration)

- `DEFAULT_THEME.avatar_size: 96` (px). Range **64–160** via a "Profile picture size" Slider at
  the top of the editor's Profile panel.
- Storefront: `--sf-avatar-size` in wrapStyle; `.sf-avatar` width/height use it, and the initials
  fallback font scales with it (`calc(size * 0.34)`). (Old default was a hardcoded 100px; the new
  default 96px is visually indistinguishable.)
- Preview: `--lp-avatar-size` = ~70% of the real size (the preview is a mini-storefront);
  `.lp-avatar` + its initials font scale from it.

## Task 4 — Product order: drag-and-drop (ADDITIVE)

- Native HTML5 DnD on the Product-order rows: `draggable` + onDragStart/onDragOver(preventDefault)
  /onDrop/onDragEnd, with `dragIdx`/`dragOver` state for styling (`.dragging` fades the source,
  `.dragover` shows an accent dashed target). A `⠿` grip + grab cursor signal draggability.
- Drop calls the new `dropSkill(from,to)` (splice-based move) → the SAME `reorderSkills()` the
  arrows use. **Up/down buttons kept unchanged** — accessible/touch fallback if drag misbehaves.
- "Coming soon" note replaced with "Drag to reorder — or use the arrows." (shown only with 2+
  products). Unused `Upload` icon import removed.
- **Verified:** `listPublishedSkills` already orders by `sort_order` asc (then created_at desc) —
  the public storefront reflects saved order with no query change.

## Task 5 — Username change with 15-day cooldown

- **Migration `024_username_cooldown.sql`** — `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  username_changed_at TIMESTAMPTZ`. ⚠️ **Must be RUN in prod Supabase before this works** —
  without the column the update 500s. NULL = never changed = change allowed.
- **`backend/routes/users.js`** — new `POST /api/users/username` (behind authMiddleware). Fully
  server-authoritative, in order: (1) normalize (lowercase, [a-z0-9_], ≤20, ≥3); (2) reserved-name
  check — RESERVED_USERNAMES **copied from Onboarding.jsx** (kept in sync manually — noted);
  (3) same-handle no-op (doesn't burn the cooldown); (4) cooldown — 429 + nextChangeAt if
  now < username_changed_at + 15d; (5) case-insensitive uniqueness vs other users (409), with a
  duplicate-key race catch on the update; (6) success → username + username_changed_at=now(),
  returns { username, nextChangeAt }.
- **`src/app-pages/Profile.jsx`** (edit mode) — "skilljoy.me/@" prefixed handle field between name
  and bio. Cooldown computed from profile.username_changed_at: locked → read-only + "You can
  change your username again on {date}"; unlocked → editable with an honest warning ("Changing
  your handle breaks old links… once every 15 days"). Input normalizes as you type. `handleSave`
  calls the username endpoint FIRST and aborts on its error (taken/reserved/cooldown surface in
  the existing error line) before saving name/bio/avatar.

## Deferred / caveats
- **Migration 024 not yet run in prod** (owner action — SQL editor).
- Old `@handle` links break on change (by design; the cooldown limits churn). A
  reserve-old-handle/redirect system is a possible future feature.
- Reserved-usernames list now exists in TWO places (Onboarding.jsx + users.js) — manual sync.
- Task 1: exact original prod error not captured; architecture fix supersedes it.

## Files touched
backend: `routes/public.js`, `routes/users.js` · migration: `024_username_cooldown.sql` ·
frontend: `lib/subscribers.js`, `lib/storefront.js`, `app-pages/Storefront.jsx`,
`app-pages/StorefrontEditor.jsx`, `app-pages/Profile.jsx`, `app-pages/Admin.jsx` + 10 more files
in the `--text-primary` sweep.
