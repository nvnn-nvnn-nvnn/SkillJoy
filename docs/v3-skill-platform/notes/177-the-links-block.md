# 177 — Guide: building the Links block (plan 04, phases 1–2)

Date: 2026-08-21
Migrations: **032** (must run — creates `store_blocks` and **backfills** links)
Plan: [04 — Link-in-Bio blocks](plans/04-link-in-bio-blocks.md)

The block primitive plan 04 said was missing. Schema, a three-sub-page editor,
and four public layout styles.

---

## 1 · Why the sub-pages are the actual feature

The ask was beacons-shaped: a Links block with **Links / Layout / Settings**
across the top. It's tempting to read that as cosmetic — the same controls,
reorganised. It isn't. Those three tabs answer three different questions, asked
at three different times:

| Tab | Question | When you touch it |
|---|---|---|
| **Links** | *What's in this block?* | constantly |
| **Layout** | *How does it look?* | once, then rarely |
| **Settings** | *What is this block?* | once, at creation |

The old editor put all three in one scrolling column. So adding your fifth link
meant scrolling past shadow and outline controls you set weeks ago. **That's
what makes link editors feel like settings screens** — the 90%-frequency task
buried among the 1% ones.

Splitting by *frequency of use*, not by category, is the whole idea. Everything
else here is implementation.

---

## 2 · Schema: what became a column and what didn't

```sql
create table public.store_blocks (
  kind, title, subtitle, visible,
  collapsible, default_collapsed, collapsed_thumb_url,
  position,
  layout jsonb not null default '{}'::jsonb
);
alter table public.store_links add column block_id …, featured …, visible …;
```

**Settings became columns; Layout became JSONB.** Not arbitrary:

- Settings values are *semantic* — `visible` gates rendering, `title` is
  content. They'd plausibly be queried or reported on.
- Layout values are *presentation knobs that will churn.* Plan 04 was written
  with the fourth style still undecided. A column per knob means a migration per
  knob, and nothing ever queries by shadow style.

`resolveBlockLayout()` merges stored layout over `DEFAULT_BLOCK_LAYOUT` — the
same contract `resolveTheme()` already uses, so an unknown or missing key can
never render undefined.

### The backfill, and the column I deliberately didn't drop

Plan 04's open question 1 was: on backfill, one block or two?

**One.** The old `placement` axis had exactly two values, where `'products'`
meant "render this among the products". That is now the per-link `featured`
flag — strictly more expressive, because a creator can mix featured and normal
links inside one block instead of maintaining two lists. Two blocks would have
encoded a limitation as structure.

`placement` is **left in place, unused**, with a `DEPRECATED` comment:

```sql
comment on column public.store_links.placement is
  'DEPRECATED (032). Superseded by store_links.featured. Kept for rollback…';
```

> **Transferable:** never drop the column you backfilled *from* in the same
> migration that backfills. It's the only way to verify the backfill worked or
> reverse it. Dropping it is a separate migration, later, once you trust the
> new path in production.

---

## 3 · The renderer: four styles, one anchor

Four layout styles, and the temptation is four renderers. Don't:

```jsx
<a href={l.url} target="_blank"
   rel={l.is_affiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}>
```

That `rel` handling, the affiliate tag, the fallback icon — identical in all
four. Four renderers means four places for `rel="sponsored"` to drift, and
that one is a legal disclosure, not a detail. So the **style picks a className**
and the markup is shared. Geometry is the only difference, and CSS is better at
geometry than JSX is.

One consequence worth noting: Classic **hides** the thumbnail with
`display:none` rather than omitting the element. Switching Classic → Grid then
never loses an image the creator already uploaded.

### Carousel needed the breakout from note 175

```css
.lkb-carousel .lkb-items {
  width:100vw; margin-left:50%; transform:translateX(-50%);
  padding:2px max(18px, calc(50vw - 270px + 18px));
  scroll-snap-type:x mandatory;
}
```

The page is a 540px centred column, so a carousel confined to it scrolls inside
a narrow box and looks broken. This is the same viewport breakout the cover
banner uses — reused, not re-derived, which is exactly what LANDMINES §6 exists
for. The asymmetric padding puts the first card back in line with the content
above it while the row itself runs edge to edge.

### The renderer degrades rather than breaks

```js
listBlocks(profile.id).catch(() => []),
…
const profileLinks = withUrl.filter(l => !l.block_id && l.placement !== 'products');
```

If migration 032 hasn't run, `listBlocks` fails, `blocks` is `[]`, every link
still has `block_id === null`, and the **legacy flat list renders exactly as
before**. Deploy order stops being load-bearing — the frontend can ship first
and simply do nothing new until the migration lands.

> **Transferable:** when adding a table the UI reads, make the empty result
> indistinguishable from the old behaviour. It turns a deploy-ordering
> constraint into a non-event.

---

## 4 · Blurbs: a picker you have to click through is not a picker

Every option carries prose:

```js
{ id: 'carousel', label: 'Carousel',
  blurb: 'A row that swipes sideways. Keeps a long list short, but people miss what’s off-screen.' }
```

Two rules I held to:

**The blurb for the SELECTED option stays visible.** Tooltips only tell you
about things you're *not* using. The one you most need to second-guess is the
one you picked.

**Say the downside.** "People miss what's off-screen" for Carousel; "anything
collapsed gets far fewer clicks" for the collapse toggle. Copy that only sells
teaches nothing, and a creator who finds out about the tradeoff from their own
analytics three weeks later has been failed by the UI.

---

## 5 · Two smaller decisions

**Collapse is a real `<button>` with `aria-expanded`.** It toggles rather than
navigates. Without `aria-expanded` a screen reader has no way to know the block
opened — the visual chevron is the only feedback, which is no feedback at all
for some users.

**Deleting a block deletes its links** (`ON DELETE CASCADE`), and the confirm
says so with the actual count: *"This also deletes the 6 links inside it."* A
cascade the user isn't told about is a data-loss bug wearing a feature's
clothes.

---

## 6 · Cleanup the swap forced

Replacing the flat link panel orphaned five helpers (`createLink`,
`patchLinkLocal`, `saveLink`, `onLinkCover`, `removeLinkRow`), a state variable,
and three imports. Lint caught every one.

The survivor is `reloadLinks` — the block editor owns link writes now, but
`StorefrontEditor` still holds a copy of `links` for the live preview, so it has
to refresh after each write or the preview and the editor disagree. That's the
`onChange` prop.

Also: `reorderLinks` takes an **array of IDs**, not `{id, position}` objects. I
wrote the wrong shape first and only caught it by reading the function. Worth
checking a signature rather than assuming it, especially for functions whose
name implies an obvious shape.

---

## Deploy

```
1. docs/v3-skill-platform/migrations/032_store_blocks.sql   ← creates + BACKFILLS
2. frontend
```

The frontend is safe to deploy first (§3), but the editor's Links tab will show
"No link blocks yet" until 032 runs. The rollback block is at the bottom of the
migration; `placement` still holds the original values.

---

## Exercises

**1 · Verify the backfill before trusting it.**
After running 032:
`select count(*) from store_links where block_id is null;` → should be 0.
`select count(*) from store_links where featured <> (placement = 'products');`
→ should also be 0. If either isn't, the rollback block is right there.

**2 · Drag to reorder.**
There's a `GripVertical` icon that does nothing — reordering is ↑/↓ buttons.
Add real drag. Keep the buttons: they're the keyboard-accessible path, and
dragging alone would be a regression for anyone not using a mouse.

**3 · Per-block colour.**
`link_color` (note 176) is page-global, but blocks now exist. Move it onto
`layout` so two blocks can look different. Then answer: does the page-level
control remain as the default new blocks inherit, or go away?

**4 · Make the live preview show blocks.**
`LivePreview` still renders the flat `lp-linkbtn` list. Until it renders
`LinkBlock`, the Layout tab has no live feedback — which note 175 argued is
worse than no preview. This is the biggest remaining gap.

**5 · Products as a block.**
Plan 04 phase 3. `store_blocks.kind` already accepts `'products'` and nothing
creates one. What does its Layout tab contain, and does `theme.layout` (global
grid/list) get backfilled into it or removed?

**6 · Harder: should `visible: false` links reach the browser at all?**
Hidden links are filtered client-side in `LinkBlock`, so they're in the page
source. For a link parked before launch, that may leak something. Move the
filter into the query — then say what that costs the editor, which needs to see
hidden links to unhide them.

---

## Files
**New** — `docs/v3-skill-platform/migrations/032_store_blocks.sql`,
`src/lib/blocks.js`, `src/components/LinkBlockEditor.jsx`,
`src/components/LinkBlock.jsx`
**Changed** — `src/lib/storefront.js` (link columns),
`src/app-pages/StorefrontEditor.jsx` (block editor replaces the flat panel,
dead helpers removed), `src/app-pages/Storefront.jsx` (renders blocks, legacy
list narrowed to block-less links)
