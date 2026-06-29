# 44 — v3 Build: Phase 2 (Skill Builder)

**Date:** 2026-06-22

## Overview

Built **Phase 2 — the Skill builder**, the make-or-break creator screen. Follows
[43](43-phase0-phase1-build.md). `vite build` + eslint clean on all new files.

Architecture note: skill/block CRUD stays **client-side via Supabase + RLS** (the
Phase 1 data layer already covers it) rather than the `backend/routes/skills.js`
that doc 07 sketched. A backend route would duplicate RLS-guarded logic; we
reserve the backend for things needing the service-role key or secrets (Stripe,
signed downloads, webhooks — Phase 3). Doc 07 Phase 2's backend item is therefore
intentionally skipped.

## What changed

### Storage
- **`docs/v3-skill-platform/migrations/002_storage_buckets.sql`** (new, idempotent
  — ⚠️ run in Supabase after 001): creates buckets `skill-covers` (public) and
  `skill-files` (private) + folder-owner RLS on `storage.objects`. Object paths
  are `{creatorId}/{skillId}/{uuid}-{name}`, so `(storage.foldername(name))[1]`
  scopes writes to the uploading creator.
- **`src/lib/storage.js`** (new): `uploadCover` → public URL; `uploadBlockFile`
  → returns the private storage **key** (stored in `content_blocks.file_key`,
  never a URL); `getOwnerFilePreviewUrl` (short-lived signed URL for the
  creator's own preview).

### Components / pages
- **`src/lib/blockTypes.js`** (new): the 6 block types + icons/labels/hints
  (`BLOCK_TYPES`, `BLOCK_META`). Split into its own module so BlockEditor can
  stay a component-only export (react-refresh lint rule).
- **`src/components/BlockEditor.jsx`** (new): edits one content block; renders a
  different form per type — video/coaching = URL field, prompt/guide = textarea,
  file = upload, workflow = segmented "paste recipe / upload file". Up/down
  reorder + delete. File display name stashed in `body_text`.
- **`src/app-pages/SkillBuilder.jsx`** (rewritten from the stub): two modes via
  the same route component —
  - `/build` → **list**: grid of my Skills (cover, draft/published pill, price)
    + "New Skill" (creates a draft, navigates to it).
  - `/build/:skillId` → **editor**: cover upload, inline title/outcome, price +
    one-time/membership toggle, the block list, an "+ Add content block" popover
    menu, and Publish/Unpublish + Delete. **Debounced autosave** (600ms) for
    skill meta and per-block edits; cover/publish/delete save immediately.
    Publish guard: requires a title + ≥1 block.

## Decisions / MVP simplifications
- **Reorder = up/down buttons**, not drag-and-drop (no extra lib; mobile-safe).
- **Plain textareas** for prompt/guide/workflow bodies — rich text is post-MVP.
- Workflow text-vs-file mode is **inferred** from whether `file_key` is set;
  switching modes clears the other field.

## Action required (Devan)
- Run **`migrations/002_storage_buckets.sql`** in Supabase (after 001) — uploads
  fail without the buckets + policies.
- (Still pending from 43) run **001** if not done yet.

## Next
Phase 3 — sell + deliver: public `Storefront.jsx` + `SkillPublic.jsx`,
`backend/routes/checkout.js` (destination charge + pending purchase), webhook
fulfilment branch (`metadata.kind='skill'`), `backend/routes/locker.js`
(signed-URL downloads), `Checkout.jsx`, and the buyer `Locker`/`SkillConsume`
+ `BlockRenderer`. This is the proof-of-concept milestone. See doc 07.
