# 69 — Completing the digital product cycle (delivery)

_Session 2026-07-02. Made "digital product" a complete, safe cycle:
create → deliver (file OR link) → sell → pay → download. Expert guide._

---

## What already worked (don't rebuild it)
The digital plumbing existed end-to-end via the generic block system:
- **Create:** type-first picker → builder (notes 63–64).
- **Store:** a `file` block uploads to a private Supabase bucket via
  `uploadBlockFile` → saves `file_key` (+ filename in `body_text`).
- **Sell:** `SkillPublic` sales page shows a type/title outline (no gated content).
- **Pay:** `Checkout` → destination charge (note 62 fixed the Connect side).
- **Deliver:** `Locker` → `BlockRenderer` file block → `getBlockDownloadUrl`
  mints a short-lived signed URL from the backend (purchase-verified).

So the cycle *functioned*. What it lacked was digital-specific completeness.

## The two real gaps (what this note fixes)

### 1. Delivery was upload-only
Stan's digital product = "upload a file **OR** redirect to a URL." We only had
upload, so creators hosting on Drive/Notion/etc. were stuck. **Fix, no schema
change:** reuse the `external_url` column that already exists on blocks (video
and coaching use it).
- `BlockEditor` file block: a segmented **Upload file / Link to file** toggle
  (mirrors the existing workflow block pattern). Mode = `external_url != null`
  (null = upload, the default). Toggling clears the other field so a block is
  never half-upload/half-link.
- `BlockRenderer` file block: `external_url` → an external link button; else
  `file_key` → the existing signed download; else a muted "no file yet."
  Note the public outline never exposes `external_url` (the
  `skill_block_outline` view is type/title only) — the link stays gated.

### 2. You could publish a digital product with nothing to deliver
A digital sale with no file/link = an instant refund/chargeback. **Fix:** a
`hasDelivery(blocks)` guard — a `file` block with a real `file_key` or
`external_url`. Enforced in three places, all driven by the one helper:
- `togglePublish` blocks publish for `kind==='digital'` without delivery (warns).
- The **Publish checklist** shows a digital-only row: "A download to deliver".
- `ready` (drives the Publish-tab hint copy) requires it for digital.

An empty link (`''`) is falsy → correctly does NOT count as delivery, so a
half-filled link can't sneak past the guard.

## Why this is "complete" and not more
v1 stays simple on purpose. Deferred (and fine to defer): creator-controlled
sales-page copy/CTA, multi-file bundles, a dedicated always-present "Delivery"
slot separate from bonus blocks (would need an `is_primary` column — not worth a
migration yet; the guard + hint get us 90% with zero schema change).

## Files
- `src/components/BlockEditor.jsx` — file block upload/link toggle.
- `src/components/BlockRenderer.jsx` — buyer renders link vs signed download.
- `src/app-pages/SkillBuilder.jsx` — `hasDelivery` helper, digital publish guard,
  checklist row, `ready` gate.

## Verify
`eslint` clean on all three; `npm run build` OK. Manual smoke test worth doing:
new Digital product → try to publish with no file (should warn) → add a link →
publish → buy from another account → confirm the Locker shows "Get your
download" and it opens the link.

## Reminder for the next type
This is the first proof of the "share the shell, branch the body" plan
([[per-type-product-builders]]). Coaching is the natural next one — its body is
scheduling/availability, and `BookingWidget` + `AvailabilityEditor` already exist.
