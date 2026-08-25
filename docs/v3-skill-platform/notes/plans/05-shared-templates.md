# Plan 05 — Creator-authored shareable templates

Status: **planned, not built.** Phase 0 is being built now; phases 1–3 are the
design so today's decisions don't paint them into a corner.

Goal: a creator builds a page — background, music, effects — and shares that
look so others can apply it. Eventually a public gallery with vetting.

---

## 0 · The one hard problem

Everything else here is CRUD. This is the part that decides the architecture:

> **A shared template carries assets that belong to somebody.**

Your background video and your music live in *your* Supabase storage. If a
template just points at those URLs, then when someone applies it:

- every visitor to **their** page streams **your** files on **your** bandwidth
- the day you delete that video, **their** page breaks
- your storage bill scales with other people's traffic

This is exactly why `bg_image`, `bg_video`, `audio_tracks` and `audio_url` sit
in `THEME_PORTABLE_EXCLUDE` today (note 188 §1). Solving *this* is the feature;
the rest is plumbing.

### The fix: two copies, each killing a specific failure

| Step | What happens | Failure it prevents |
|---|---|---|
| **Publish** | Backend snapshots the author's assets into platform-owned `template-assets/{templateId}/` | Author deletes their video → template still works |
| **Apply** | Backend copies snapshot → applier's own storage, rewrites theme URLs | Applier's traffic never touches the author's bucket or bill |

Neither copy is redundant. Drop the publish snapshot and a template rots when
its author tidies up. Drop the apply copy and the platform becomes a CDN for one
creator's video, billed to the platform forever.

After apply, **every user owns their own copy of every asset on their page.**
That is the invariant. It is also what makes deletion, quotas and abuse handling
tractable later — there is never a shared mutable asset with two owners.

### Cost note

Copy-on-apply multiplies storage: 100 people applying a 3 MB video = 300 MB.
Accepted deliberately — storage is cheap and predictable, whereas hotlinked
*bandwidth* is neither, and it lands on someone who didn't opt into it. Revisit
with dedupe-by-hash if it ever bites.

---

## 1 · What a template carries — and what it must never

Extends the existing content/look split that `portableTheme` already enforces.

**Carries:** every `DEFAULT_THEME` key that isn't content · background image or
video · music tracks · all effects, glow targets, shapes, colours.

**Never carries:** display name · bio · avatar · location · socials · links ·
blocks · products · phone/email · anything in the profile row that isn't
`storefront_theme`.

> A template is a LOOK. If applying one could change what your page *says*, it
> is a different feature and a much more dangerous one.

The existing `THEME_PORTABLE_EXCLUDE` stays the default-deny list. Templates
widen it for the four asset keys **only via the copy pipeline** — never by
passing a raw URL through.

---

## 2 · Schema (migration 034, when built)

```sql
create table public.store_templates (
    id            uuid primary key default gen_random_uuid(),
    author_id     uuid not null references public.profiles(id) on delete cascade,
    slug          text not null unique,          -- /t/<slug>
    name          text not null,
    blurb         text,
    theme         jsonb not null,                -- asset URLs already rewritten to the snapshot
    assets        jsonb not null default '[]',   -- [{ key, path, bytes, mime }] — the manifest
    -- 'draft' | 'unlisted' | 'pending' | 'public' | 'rejected'
    -- Unlisted is the whole of phase 1: shareable by link, invisible to browse.
    -- pending/public/rejected exist from day one so the gallery is a state
    -- change, not a migration.
    status        text not null default 'draft',
    install_count integer not null default 0,
    created_at    timestamptz not null default now()
);
```

**Include the gallery states in the first migration even though phase 1 ignores
them.** A status column that gains values later is free; a table that gains a
status column later means backfilling every row and touching every query.

RLS: author manages their own; `select` allowed when
`status in ('unlisted','public')` or `auth.uid() = author_id`.

---

## 3 · Endpoints (`backend/routes/templates.js`)

Both need the service-role client — copying between storage prefixes is not
something a browser session should be able to do.

```
POST /templates            publish: snapshot assets, write row, return slug
POST /templates/:slug/apply  copy snapshot → caller's storage, rewrite, save theme
GET  /templates/:slug       metadata for the preview screen
```

**Publish must validate server-side**, not trust the client: total asset bytes
under quota, MIME allowlist (`video/mp4`, `image/*`, `audio/mpeg`), and every
source path must start with the caller's own `{userId}/` prefix — otherwise
publish becomes an arbitrary-file-copy primitive.

**Apply is idempotent per (user, template).** Re-applying replaces the previous
copy rather than accumulating a new one each time.

---

## 4 · Phases

| Phase | Scope | Status |
|---|---|---|
| **0** | Showcase templates authored in-repo, with music + animated backgrounds | **building now** |
| **1** | Publish + apply by link (`unlisted`), no browsing | planned |
| **2** | Public gallery, `pending` → review → `public` | planned |
| **3** | Remixing, install analytics, author credit on the page | speculative |

### Phase 0 is not a throwaway

The showcase templates are the same data shape as a published one — theme +
asset manifest. Phase 1 adds a *writer* for that shape; it does not change it.
So the work of getting music and animated backgrounds into a preset is work
phase 1 inherits, not work it replaces.

---

## 5 · Vetting (phase 2), decided now because it constrains phase 1

A public gallery means strangers submit backgrounds and music that render
full-screen on other people's pages. Non-negotiable before `status = 'public'`
exists:

- **Human review** on every submission. `pending` is the default; nothing
  auto-promotes.
- **Report + takedown**, with takedown setting `status = 'rejected'` and leaving
  already-applied copies alone — they belong to the applier now (that invariant
  paying off).
- **Audio licensing.** The riskiest surface by far. Music copied into a hundred
  storefronts is redistribution. Phase 2 needs an explicit
  "I have the right to share this" attestation, and probably an allowlist of
  licence-clear sources.
- **Rate limit on publish**, so review can't be flooded.

Phase 1 being link-only is what makes it safe to ship *without* any of this:
there is no discovery surface, so the only people who see a template are people
the author sent it to.

---

## 6 · Open questions

1. Copy-on-apply duplicates identical files. Dedupe by content hash with a
   refcount, or accept the duplication? (Leaning accept — refcounts are how you
   get orphaned assets and double-delete bugs.)
2. Should applying a template be undoable? A "revert to previous theme" needs
   one snapshot of the prior `storefront_theme`. Cheap; probably worth it.
3. Does the applier's page credit the author? Nice for the author, another
   element on someone else's page they didn't choose.
4. What happens to an applied template when the author is deleted? Invariant
   says: nothing — the applier owns their copies. Verify the storage cascade
   doesn't disagree.

---

## 7 · What phase 0 must not do

- Must not put a user-uploaded URL into a preset. The `/templates/` prefix check
  in `check-presets.cjs` is what enforces this, and it stays.
- Must not add a theme key that only makes sense for built-in presets. Anything
  phase 0 adds has to survive being written by a user later.
