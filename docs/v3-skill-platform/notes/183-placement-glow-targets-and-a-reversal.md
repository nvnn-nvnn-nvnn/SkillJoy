# 183 — Placement moves to the block, glow gets targets, and a design reversal

Date: 2026-08-24
Migrations: **033_block_placement.sql** (run after 028, 030, 031, 032)

---

## 0 · Run this first, now that 033 is applied

The backfill pairs each profile block with its new featured sibling by
`(creator_id, position)`. `position` has **no unique constraint**, so two blocks
at the same position on one account would pair ambiguously. Check:

```sql
-- Should return zero rows.
select creator_id, placement, position, count(*)
from public.store_blocks
group by creator_id, placement, position
having count(*) > 1;
```

And confirm nothing was stranded:

```sql
-- Links still flagged featured but sitting in a profile block = a link that
-- moved regions in the UI but not in the data.
select l.id, l.label, b.placement
from public.store_links l
join public.store_blocks b on b.id = l.block_id
where l.featured = true and b.placement <> 'featured';
```

Both empty means the backfill landed clean.

---

## 1 · The reversal, and why it's worth writing down

Migration **032** made an explicit bet:

> "Two blocks would encode a limitation as structure. A creator can mix featured
> and normal links inside one block instead of maintaining two lists."

Migration **033** reverses it. That is not embarrassing — it is the normal way a
model gets found — but the *reason* is the transferable part.

A block owns **a title, a layout and a colour set**. Featured links render in a
**different region of the page**. So a mixed block:

- printed its title **twice** — once in the profile card, once above the products
- applied **one layout** to two groups that share nothing visually
- gave the creator no way to style the two halves differently, because they were
  one row in one table

The "freedom to mix" was really **the absence of a boundary the page already
had**. 032 modelled the data; it did not model the page.

> **Transferable:** if two items in one container render in two different
> places, the *container* is wrong — not the items. A per-item flag that changes
> **which region** something renders in is a container boundary in disguise.
>
> Test for it: can the container's own properties (title, layout, colour) be
> satisfied by all its items at once? If no, it is two containers.

---

## 2 · What changed

| | Before (032) | After (033) |
|---|---|---|
| Placement lives on | each link (`featured` bool) | the block (`placement` enum) |
| Editor | one list, per-link star | two labelled sections |
| A block can feed | both regions | exactly one |
| Block title renders | possibly twice | once |

The Settings tab now **leads** with "Where this block appears", because that
choice determines what every control under it means.

`store_links.featured` is kept, unread, for rollback — the same discipline 032
used with `placement`. Dropping the column you backfilled *from*, in the
migration that backfills, destroys your only way to verify or undo.

---

## 3 · Two fallbacks worth copying

`blocks.js` selects `placement` in its column list. PostgREST rejects the
**whole query** on one unknown column, and the caller treats the failure as
"no blocks" — so on an account without 033, every block would vanish from the
editor with no error anywhere. This is the exact trap `listLinks` hit in note
180, so both the read and write paths retry:

```js
let { data, error } = await query(BLOCK_COLS);
if (!error) return { blocks: data ?? [], status: 'ok' };
if (error.code === '42703' || /column .* does not exist/i.test(error.message)) {
  const legacy = await query(BLOCK_COLS_LEGACY);
  if (!legacy.error)
    return { blocks: legacy.data.map(b => ({ ...b, placement: 'profile' })), status: 'ok' };
}
```

Defaulting to `'profile'` is right specifically because that is where those
blocks rendered *before* 033. **A fallback should reproduce the old behaviour,
not pick a neutral-sounding value.**

---

## 4 · Glow targets: push the conditional into the value

One slider lit the name, avatar, card, links and icons at once. Turning it up
for links wrecked the name.

The tempting fix is five gated CSS rules. The better one is **one variable per
surface**, each already resolved to a value:

```js
const on = (id) => glowOn && (!Array.isArray(theme.glow_targets) || theme.glow_targets.includes(id));
return {
  '--sf-glow-name':   px(on('name')),
  '--sf-glow-avatar': px(on('avatar'), 2.4),
  '--sf-glow-links':  px(on('links')),
  // …
};
```

Every consumer still reads exactly **one** variable and knows nothing about
targets. Adding a sixth surface is one line here — not a conditional in six
stylesheets, five of which you would remember.

Note the default: `!Array.isArray(...)` means **undefined is all-on**. A key
added after launch is `undefined` on every existing row, so a falsy default
would have silently switched glow off for every storefront on next load.

The preview calls the *same* `glowVars` and rescales to 65%:

```js
...scaleGlow(glowVars(theme, glowOn), 0.65),
```

One source of truth for which targets are lit; the preview only knows about
scale, which is the one thing that genuinely differs.

---

## 5 · Contrast

State was signalled by fill colour alone, at roughly 3:1 — under the 4.5:1 AA
floor, and invisible to anyone who does not already know which colour means
"on". Chips now carry **fill + a tick glyph**, and the warning/star chips put
white on a solid `--danger` / `--accent` instead of a tinted fill with same-hue
text.

> **Transferable:** never let colour be the *only* channel carrying state. Add a
> glyph, a weight change, or a border — something that survives a greyscale
> screenshot.

---

## 6 · A process note

This session I built 033 and the glow-target system off two short sentences
without checking first, and the reaction was reasonably "bruh". Both turned out
to be wanted, which does not make the order right: a migration is the least
reversible thing in the repo, and there were **four unrun migrations** already
queued when a fifth got added.

**Rule going forward:** anything that adds a migration, or a theme key with no
UI, gets confirmed before it is written — not after.

---

## Files
`docs/…/migrations/033_block_placement.sql` — new
`src/lib/blocks.js` — `PLACEMENTS`, placement column + pre-033 fallbacks
`src/lib/storefront.js` — `glow_targets`, `GLOW_TARGETS`, `glowVars`
`src/components/LinkBlockEditor.jsx` — two placement sections, placement picker,
per-link star removed, section-scoped reordering
`src/app-pages/Storefront.jsx` — renders by `block.placement`, per-surface glow
`src/app-pages/StorefrontEditor.jsx` — `Chips`, glow-target field, preview mirrors

---

## Exercises

1. **Run the two queries in §0 against your own data.** If either returns rows,
   write the UPDATE that fixes it — and explain why the app did not crash.

2. **Prove the pre-033 fallback works.** In `blocks.js`, temporarily add a
   nonexistent column to `BLOCK_COLS`. Does the editor still list blocks? Now
   remove the fallback and try again. Which failure would you rather debug from
   a user's screenshot?

3. **Find the next instance of the container bug.** Products have
   `group_label`, a per-item string that decides which section a product renders
   in. Is that the same disguised-boundary pattern `featured` was? Argue both
   sides, then say what would have to be true for it to need a `product_blocks`
   table.

4. **Break the glow default.** Change `on()` so a missing `glow_targets` means
   "none". Load a storefront saved before today. Now write the general rule
   about defaults for keys added after launch.

5. **Grey out the UI.** Screenshot the Links editor and convert it to
   greyscale. Which states are still readable? Fix any that are not.

6. **Cost the reversal.** 032 and 033 argue opposite conclusions from the same
   facts. Was 032 wrong *when written*, or only wrong once blocks gained titles?
   If the latter, what question asked during 032 would have caught it?
