# 176 — Link product: the render (steps 3–5)

Date: 2026-08-21

Steps 3, 4 and 5 of plan 03 §4, in one pass — profile region filters by
placement, products region renders featured links, grouping and counts include
them. Step 1 (schema) and 2a (editor control) are note 164.

All in `src/app-pages/Storefront.jsx`.

## 1. Splitting the links

```js
const withUrl = links.filter(l => l.url);
const profileLinks  = withUrl.filter(l => l.placement !== 'products');
const featuredLinks = withUrl.filter(l => l.placement === 'products');
```

**`!== 'products'` rather than `=== 'profile'`** — deliberately. A row with a
null, empty or unrecognised placement falls back to the profile pill, which is
what every link did before migration 029. The negative test makes 'profile' the
catch-all; the positive test would have made *unknown* mean *invisible*, and a
link that silently disappears is a much worse failure than one in the wrong spot.

Same reasoning as `glow_enabled !== false` (note 155): when a column is newer
than the rows, write the check so old data lands in the old behaviour.

## 2. Bucketing both sources

`skillGroups` became `itemGroups`, and items are now tagged:

```js
const bucket = (key, item) => { /* create group on first sight, push */ };
for (const s of skills)        bucket((s.group_label || '').trim(), { type: 'skill', data: s });
for (const l of featuredLinks) bucket((l.group_label || '').trim(), { type: 'link',  data: l });
```

Three things fall out of writing it this way:

**Ordering is a consequence of loop order, not a sort.** Both lists already
arrive sorted from the DB — skills by `sort_order`, links by `position` (note
164) — so nothing is sorted here. Products are pushed first, so within any group
products precede links. That *is* the ordering rule from plan 03 §3, and it costs
zero code.

**Interleaving was never attempted, on purpose.** `sort_order` and `position` are
independent sequences that have never been coordinated, so a skill at `2` and a
link at `2` have no defined relationship. Any interleaving rule yields an order
the creator can neither predict nor control, and which can shuffle between loads.
A creator who wants a link first puts it in its own section.

**A group can be created by a link alone.** Those groups sort after all
skill-created ones, since the skills loop runs first. Deterministic, and the
header renders normally.

## 3. The one branch

Everything above the leaf is source-agnostic — grouping, ordering, counting and
the group header never learn there are two tables:

```jsx
{g.items.map(item => item.type === 'link'
  ? <LinkCard    key={`l:${item.data.id}`} link={item.data} theme={theme} />
  : <ProductCard key={`s:${item.data.id}`} skill={item.data} handle={profile.username} theme={theme} />
)}
```

Keys are prefixed `l:` / `s:` because the two tables have independent UUID
spaces. A collision is astronomically unlikely, but the prefix costs nothing and
makes the key self-describing in devtools.

The inline product JSX was extracted to `ProductCard` in the same move — a
ternary between one component and thirty lines of inline markup would have been
unreadable, and the extraction makes the two card types visibly parallel.

## 4. Two gates that had to change

```jsx
{itemGroups.length > 0 && itemGroups.map(...)}   // was: skills.length > 0
```
A store whose only content is featured links has zero skills but real groups.
Gating on `skills.length` would have rendered nothing.

```jsx
<span className="sf-groupcount">{g.items.length}</span>
```
Unchanged line, but its meaning changed — it now counts products **and** links.
That is correct: it describes the section, and a count that ignored links would
under-report what the visitor can see.

The "Nothing here yet" empty state (`skills.length === 0 && links.length === 0`)
needed no change — it already tested both.

## 5. LinkCard vs ProductCard

Same `.sf-card` skeleton, four deliberate differences:

| | Product | Link |
|---|---|---|
| Element | `<Link to>` | `<a target="_blank">` |
| Cover fallback | `Puzzle` | `Link2` |
| Foot, left | price | CTA + arrow |
| Foot, right | `TypeTag` | Affiliate tag + `Link` badge |

**No price on a link card, ever.** A price says "buy this here." A buyer who
clicks expecting checkout and lands on someone else's site is a trust failure,
and it is the one difference that is non-negotiable rather than cosmetic.

`.sf-card-cta` matches `.sf-price`'s weight and size so the two card types line
up in a mixed grid, but is accent-coloured — it reads as an action, not an
amount. The arrow nudges on hover.

The link card keeps `.sf-card`, so it inherits the creator's product
opacity/blur/glow automatically. **Deliberate** — a parallel class would drift
the first time products are restyled and the grid would look broken.

The `Link` badge respects `show_type_badges` for parity: if a creator turned type
badges off, links shouldn't be the one thing still wearing one.

## Verification
`vite build` clean; eslint clean apart from the pre-existing
`react-hooks/set-state-in-effect` at `Storefront.jsx:36`. No `skillGroups`
references remain.

**To test:** a link set to Featured should vanish from under the bio and appear
as a card in the products area. Set its `group_label` to an existing section and
it should move into that section, after the products, with the count going up.

## Still to build (plan 03 §4 step 6)
Editor fields for `description`, `cover_url`, `cta_label`, `group_label` — the
render reads all four, but nothing writes them yet, so today they are always
empty and the card falls back to label + "Open".

## Files
- `src/app-pages/Storefront.jsx`
