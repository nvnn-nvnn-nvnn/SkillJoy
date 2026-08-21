# 164 — Link placement: schema + the read that had to change

Date: 2026-08-20

Step 1 of the link-product build (plan 03 §4). **Schema only — no UI, no render
changes.** After this, storefronts render exactly as before; the columns simply
exist and are readable.

## Migration `029_link_placement.sql` (written and run by Devv)

```sql
ALTER TABLE store_links
    ADD COLUMN IF NOT EXISTS placement TEXT NOT NULL DEFAULT 'profile'
    CHECK (placement IN ('profile', 'products')),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS cover_url TEXT,
    ADD COLUMN IF NOT EXISTS cta_label TEXT,
    ADD COLUMN IF NOT EXISTS group_label TEXT;
```

Prior shape (migration 006): `id, creator_id, label, url, position,
is_affiliate, created_at`.

### Why `placement` defaults to `'profile'`
There is exactly one insert path for links — `createLink()` at
`StorefrontEditor.jsx:325` — and it has only ever produced links that render as
pills inside the profile panel. So **every existing row is semantically a profile
link**, and `'profile'` is the only default that leaves live storefronts
byte-identical after the migration. Defaulting to `'products'` would have
relocated every creator's links into their product grid on deploy.

`NOT NULL DEFAULT` also backfills existing rows for free (Postgres 11+ stores the
default in the catalog rather than rewriting the table), which is why **no
`UPDATE` statement was needed**.

> **The rule, generalised:** a `DEFAULT` fills existing rows with *one shared
> value*. You need an `UPDATE` only when the correct value **differs per row** —
> which is exactly why `fulfilled_at` (note 152) needed
> `SET fulfilled_at = created_at` and this doesn't.

### One column is an enum, four are free text
A first pass applied `NOT NULL DEFAULT 'profile' CHECK (… IN ('profile','products'))`
to all five columns. That would have made a cover image URL, a button label, and
a section name each legally required to be the literal string `"profile"` or
`"products"` — the database would have rejected every real value.

Only `placement` is a fixed set of options. `cover_url`, `cta_label`,
`description` and `group_label` hold whatever the creator supplies, so they are
plain nullable `TEXT` with no default and no constraint. An existing link
genuinely has no cover image; **empty is the honest value**, and `NOT NULL` would
be asserting something false about the data.

`group_label` deliberately mirrors `skills.group_label` exactly — migration 026
is just `ADD COLUMN IF NOT EXISTS group_label TEXT`. Same name, same type, same
`NULL`/`''`-means-ungrouped convention, because the render will merge the two
sources on that key.

### `position` reused, no `sort_order` added
`store_links` already has `position INTEGER NOT NULL DEFAULT 0`, indexed
`(creator_id, position)`. Adding `sort_order` alongside it would leave two
columns both claiming to order the same rows and a permanent question about which
is authoritative.

The apparent problem — one sequence now spans two placements — is not one,
because each region sorts its own subset. Only *relative* order matters and gaps
are harmless: links at `0,1,2,3` with #2 moved to products gives profile `0,1,3`
and products `2`, both correct.

## The read that had to change — `listLinks()`

`src/lib/storefront.js`. Two edits:

```js
.select('id, label, url, position, is_affiliate, placement, description, cover_url, cta_label, group_label')
.eq('creator_id', creatorId)
.order('position', { ascending: true })
.order('created_at', { ascending: true });
```

**1. The column list.** Grepping `from('store_links')` finds five call sites, but
only this one names columns:

| Call site | Needs updating? |
|---|---|
| `listLinks` — `.select('id, label, …')` | ✅ **yes** — explicit list |
| `addLink` — bare `.select()` | no — no arguments returns every column |
| `updateLink` / `deleteLink` / reorder | no — they don't select |

> **Transferable:** the thing to grep for after a schema change is not the table
> name, it's **explicit `.select('a, b, c')` lists**. A column missing from one
> arrives as `undefined` with no error at any layer — the UI just never shows it,
> which reads as a render bug. Same trap the `location` field hit (note 155).

**2. A sort tiebreaker.** `createLink()` sets `position: links.length`, so a
delete-then-add can produce two links sharing a position. Equal sort keys let
Postgres return rows in **any** order, which surfaces as the list visibly
reshuffling between page loads. `created_at` as a secondary sort makes it
deterministic — the same pattern `listPublishedSkills` already uses
(`sort_order` then `created_at`).

## State after this note
- Migration run in Supabase ✅
- `listLinks` returns the new columns ✅
- `vite build` clean, eslint clean ✅
- **Storefronts unchanged** — which is the actual success condition for step 1.
  Anything moving here would mean the default was wrong, and every later step
  would hide it.

Next: plan 03 §4 step 2 — editor writes the fields, still no render change.

## Files
- `docs/v3-skill-platform/migrations/029_link_placement.sql` (new)
- `src/lib/storefront.js` (`listLinks`)
