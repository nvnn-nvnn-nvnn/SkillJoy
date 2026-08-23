# 168 — Link card editor fields (step 6)

Date: 2026-08-21

Final step of plan 03 §4. Note 167 shipped the render, which already read
`description`, `cover_url` and `cta_label` — but nothing wrote them, so every
featured card fell back to label + "Open" + a link icon. This closes that.

All in `src/app-pages/StorefrontEditor.jsx`.

## What a featured link now has

| Editor field | Column | Renders as |
|---|---|---|
| Label | `label` | card title (header) |
| **Subheader** | `description` | line under the title |
| Link | `url` | the destination |
| **Image** | `cover_url` | card cover — falls back to a link icon |
| **Button text** | `cta_label` | the CTA — falls back to "Open" |
| Affiliate link | `is_affiliate` | `rel="sponsored"` + visible tag |
| Where it shows | `placement` | which region renders it |

## Conditional on placement

The three new fields sit inside `{l.placement === 'products' && (...)}`, wrapped
in `.std-subgroup` (note 155).

A profile pill renders **none** of them — it's a label, a URL, and an arrow. A
cover uploader on a pill would promise something that can never appear, and the
accent left-rule on `.std-subgroup` makes the dependency visible rather than
something you discover by toggling placement and watching fields appear.

## The cover upload

Could not reuse `uploadTo()`. That helper writes a **theme key** (`set({ banner_url })`);
this writes a **row** (`saveLink(id, { cover_url })`). Different destinations, so
a separate `onLinkCover(id, e)`.

Three decisions in it:

**`savingLinkCover` holds a link id, not a boolean.** With a bool, uploading one
cover would put every link row into "Uploading…" simultaneously. Comparing
`savingLinkCover === l.id` scopes the spinner to the row that's actually busy —
the general pattern for per-row async state in a list.

**Validated with `LIMITS.cover`**, the same rule as a product cover: 5 MB,
images only. It's the same kind of asset going into the same `skill-covers`
bucket, so inventing a separate limit would be arbitrary. No new `LIMITS` key
(note 159).

**`e.target.value = ''` in the `finally`.** Without it, re-picking the same file
fires no `change` event and the button looks dead. Same fix as note 159 §Step 4;
it belongs in `finally` so it runs on the error path too.

## Empty string vs null on save

Text fields save `e.target.value.trim() || null`, not the raw value:

```js
onBlur={e => saveLink(l.id, { description: e.target.value.trim() || null })}
```

Clearing a field should store `NULL`, not `''`. The render tests
`{l.description && ...}` — both are falsy so it works either way today, but
storing `''` means "the creator set this to empty" while `NULL` means "never
set." Only the second is true, and a future query like
`WHERE description IS NOT NULL` would be quietly wrong otherwise.

Note `patchLinkLocal` still gets the **raw** value on every keystroke — trimming
during typing would eat spaces as you type them. Trim on save, not on change.

## The preview mirrors the fallback

The 64px preview renders `<Link2 size={20} />` on a dashed border when
`cover_url` is empty — exactly what `LinkCard` does on the storefront. So "no
image → link icon" is visible in the editor *before* uploading, rather than
being discovered on the live page. The `std-note` underneath says it in words
too.

One CSS detail: `.std-removebtn` is shared and right-aligns itself with
`margin-left:auto`, which pushed it out of this narrow column. Overridden with
`margin:0` locally rather than changing the shared rule — the alignment is
correct everywhere else it's used.

## Verification
`vite build` clean; eslint clean apart from the pre-existing unused `Icon` at
line 45.

**To test:** set a link to Featured, add a subheader, upload an image, set button
text. The card in the products area should show all three. Remove the image and
the link icon should come back in both the editor preview and the live card.

## Status
Plan 03 is now **fully built** — schema (164), render (167), editor (168).
Remaining from the design doc but deliberately deferred:
- `group_label` has no editor control yet, so featured links can only land in the
  ungrouped section. The column exists and the render honours it.
- The Links panel is still one flat list; plan 03 §2 proposed splitting it by
  placement with a tab.

## Files
- `src/app-pages/StorefrontEditor.jsx`
