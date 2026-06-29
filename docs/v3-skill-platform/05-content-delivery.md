# 05 — Content Delivery

How each block type is stored and served, plus the versioning mechanics.

## Files (`type: file`, and `workflow` when file-based)

- Stored in a **private** Supabase Storage bucket (e.g. `skill-files`).
- `content_blocks.file_key` holds the **storage key**, never a public URL.
- Served via **signed, expiring URLs minted per-download**:
  `GET /api/locker/block/:blockId/download` →
  1. verify the caller has a `paid` purchase of the block's skill,
  2. `supabase.storage.from('skill-files').createSignedUrl(key, 60)` (short TTL),
  3. return the fresh URL; the client redirects/downloads.
- **No permanent public links.** Because links are minted on demand, the buyer
  never hits a broken "expired link" — they just get a new one each time.
- Mirror the existing RLS/owner pattern for bucket policies (private; writes by
  creator, reads brokered by the backend service role).

> This is exactly the private-bucket + per-download signed-URL design v2 already
> specced (`product-files` bucket). Reuse it; just rename to `skill-files`.

## Video (`type: video`)

- **Embed external only** at MVP — pick one: YouTube-unlisted / Vimeo / Mux.
- Store the embed/watch URL in `external_url`; render in an iframe in the
  consume view.
- **Do not build a custom video pipeline / transcoding / hosting.**
- Recommendation: **YouTube-unlisted or Vimeo** for the cheapest MVP; Mux only if
  signed playback / analytics matter later.

## Prompts & text (`type: prompt`, `type: text`)

- Stored as rich text in `content_blocks.body_text`.
- **Prompt blocks get a copy-to-clipboard button** (primary interaction).
- Text blocks render inline as a guide/lesson.

## Workflows (`type: workflow`)

- Either `body_text` (a recipe/JSON pasted inline, copy-to-clipboard) **or** a
  `file_key` (an exported n8n/Zapier/Make file, downloaded via signed URL).
- The builder lets the creator pick text or file per workflow block.

## Coaching (`type: coaching`)

- Stores an **external booking link** (Calendly etc.) in `external_url`.
- Shown to the buyer post-purchase as a "Book your call" button.
- **No native scheduling, no calls hosted by us** at MVP.

## Versioning mechanics

The Skill's `version` integer is the contract between creator updates and buyer
visibility.

**What bumps the version:**
- Editing/adding/removing/reordering content blocks of a **published** skill,
  committed via `POST /api/skills/:id/version` (or auto-bump on publish-edit).
- Pure metadata tweaks (typo in title) need not bump — keep the bump meaningful
  so the "Updated to vN" signal stays trustworthy. *(Open question: auto-bump on
  any block change, or an explicit "Publish update" button? Recommend an
  explicit button so the creator controls when buyers get notified.)*

**On version bump:**
1. `skills.version += 1`, `updated_at = now()`.
2. Notify existing buyers — reuse the existing `notifications` table + the
   `create_notification(...)` SQL function (add a `skill_update` type to the
   `notifications.type` CHECK constraint).
3. Buyers' locker view always reads the **current** blocks (no content
   snapshotting at MVP), so they're already on the latest.
4. The consume view shows an **"Updated to v{N}"** badge by comparing
   `skills.version` to the buyer's `purchases.version_at_purchase`.

**What we do NOT do at MVP:** snapshot/version every block's content, diff
versions, or let buyers view old versions. Just: latest content + a "this got
updated" signal. (Snapshotting is post-MVP if creators ask for changelogs.)
