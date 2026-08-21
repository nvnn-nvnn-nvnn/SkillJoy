# 03 — Link product: data, editor placement, render

**Status: designed, not built.** Implementer: Devv.
Companion to [`../explainers/03-build-a-link-product-module.md`](../explainers/03-build-a-link-product-module.md),
which teaches the reasoning. **This doc makes the calls.** Where they disagree,
this one wins — the module was written before the decisions existed.

**Goal:** affiliate links render as cards down with the products; the profile
link area goes back to socials and community links.

---

## 0. Decisions resolved

| Question (module §2) | Decision |
|---|---|
| New `skills.kind`, extend `store_links`, or new `store_tiles`? | **Extend `store_links`** |
| How do two orderings interleave? | **They don't — links render after products within a group** |
| Where is `group_label` set? | **Per-link dropdown, not the Sections panel** |
| Editor location? | **The existing Links subtab, split by placement** |

**Why extend `store_links`:** the thing being built genuinely *is* a link — no
price, no buyer, no version, no content blocks. Adding presentation to a link is
a far smaller lie than removing commerce from a `skill`, and it avoids carving an
exception into `publishSkill`'s paywall gate, which is the riskiest code in the
app to special-case. It also makes **placement a property of every link**, which
delivers the second half of the ask (a plain link belonging in the product area)
for free rather than as a second feature.

---

## 1. Data

### Migration `028_link_placement.sql`

```sql
ALTER TABLE store_links
  ADD COLUMN IF NOT EXISTS placement   TEXT NOT NULL DEFAULT 'profile'
    CHECK (placement IN ('profile', 'products')),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cover_url   TEXT,
  ADD COLUMN IF NOT EXISTS cta_label   TEXT,
  ADD COLUMN IF NOT EXISTS group_label TEXT;

CREATE INDEX IF NOT EXISTS store_links_placement_idx
  ON store_links(creator_id, placement, position);
```

Current shape for reference: `id, creator_id, label, url, position, is_affiliate,
created_at` (migration 006).

### Field-by-field

| Column | Type | Default | Purpose |
|---|---|---|---|
| `placement` | TEXT, CHECK | **`'profile'`** | Which region renders it |
| `description` | TEXT | null | Card sub-line. Ignored when `placement='profile'` |
| `cover_url` | TEXT | null | Card image. Ignored when `placement='profile'` |
| `cta_label` | TEXT | null | Button text; falls back to `'Open'` |
| `group_label` | TEXT | null | Section. **Must match `skills.group_label` semantics exactly** |

### The four decisions inside that table

**`placement` defaults to `'profile'`, and that is the whole blast-radius
control.** Every existing link row inherits it, so the instant the migration runs
every live storefront renders **byte-identical** to before. New behaviour is
opt-in. Get this wrong and you ship a silent redesign of other people's pages.

**No new ordering column — reuse `position`.** It already exists, is already
per-creator, and is already indexed. It becomes a single sequence spanning both
placements, which is fine because each region sorts its own subset: only
*relative* order matters, and gaps are harmless. Adding `sort_order` alongside
`position` would leave two ordering columns on one table and a permanent question
about which is authoritative.

**`group_label` copies `skills.group_label` exactly** — same name, same TEXT
type, same "null or empty string means ungrouped" convention. The render merges
these two sources by that key (§3). Any divergence here — a different name, or
treating `''` and `null` differently — surfaces as sections that mysteriously
fail to merge.

**`cta_label` is nullable with a render-time fallback**, not `DEFAULT 'Open'`.
A stored default would bake today's copy into every historical row; a fallback
lets the default change later and lets the field mean "creator hasn't chosen."

### Reads that must change — this is the easy-to-miss part

`listLinks()` in `src/lib/storefront.js:254` uses an **explicit column list**:

```js
.select('id, label, url, position, is_affiliate')
```

A column not named there arrives `undefined` with **no error anywhere** — the UI
just never shows it, and it looks like a render bug. Same class of trap the
`location` field hit (note 155). Update to:

```js
.select('id, label, url, position, is_affiliate, placement, description, cover_url, cta_label, group_label')
```

Then grep `from('store_links')` and confirm nothing else selects columns.
`addLink` / `updateLink` / `deleteLink` pass objects through and need no change.
`src/lib/demoStores.js:9` documents the link shape in a comment — update it or it
becomes a lie.

### Cover uploads

Reuse the `skill-covers` bucket via `uploadBanner(creatorId, file)` (it already
writes to a `{creatorId}/banner/…` path and returns a public URL). Validate with
the existing `LIMITS.cover` entry — 5 MB, `image/` only (note 159). **No new
`LIMITS` key needed**; a link cover and a product cover are the same kind of
asset with the same constraints.

---

## 2. Editor placement

### Where it lives

Stays in the **Links** subtab — `SUBTAB_HEADS.links`. It is a link; putting it
under Products would imply it has a price and a checkout.

**Restructure the existing "Link buttons" panel** into one panel with a
two-option segmented control at the top:

```
┌─ Links ────────────────────────────────┐
│  [ Profile links ] [ Featured links ]  │  ← Seg, same component as elsewhere
│                                        │
│  …rows for the selected placement…     │
│                                        │
│  [ + Add link ]                        │
└────────────────────────────────────────┘
```

**Why a tabbed single panel rather than two panels or a per-row dropdown:**

- **vs. a per-row dropdown** — placement would be invisible until you inspect
  each row, and the list would mix two things that render nothing alike.
- **vs. two separate panels** — duplicates the row component and the add button,
  and moving a link between placements becomes a bespoke "move" action.
- **The tab makes placement structural.** The editor mirrors the page: two
  regions, pick one, edit what's in it. Adding a link adds it to the tab you're
  looking at, which is the obvious intent.

Keep **Social links** as its own separate panel. Socials are icons driven by
`theme.socials`, not `store_links` rows — different data, different render.

### Row fields, by placement

`placement='profile'` — unchanged from today:
> `label` · `url` · `is_affiliate` checkbox

`placement='products'` — adds, inside a `.std-subgroup` (note 155):
> `cover_url` upload · `description` textarea · `cta_label` input ·
> `group_label` dropdown

**Fields that do nothing must not be shown.** A cover uploader on a pill button
promises something that will never appear. `.std-subgroup` exists for exactly
this conditional-settings pattern and its accent left-rule makes the dependency
legible.

### Section assignment

`group_label` is a **dropdown on the link row**, populated from the groups that
already exist on products, plus `No section`.

Rationale: the Sections panel's job is *naming and ordering sections*. Assigning
an item to a section is per-item everywhere else — a product sets its own
`group_label` in its builder. Making links the one exception would mean managing
sections in two places.

⚠️ A dropdown of existing groups can't create a new one. That's deliberate: a
link should not be able to invent a section, because a section containing only a
link and no products is almost always a mistake. If the creator wants that, they
create the section on the Sections panel first. **Decide if you disagree** — the
alternative is a combobox that allows free text.

### Live preview

`LivePreview` must honour `placement`, or the tab looks broken until you open the
real page — the same failure mode as `glow_enabled` in note 155. Minimum: profile
links render as pills, featured links render as cards, in the right regions.

---

## 3. Render

### The merge

In `Storefront.jsx`, `skillGroups` currently buckets skills by `group_label`.
Generalise it to bucket **normalised items** from two sources:

```js
// Normalise BEFORE grouping, so the grouping logic never learns there are two
// tables. The renderer switches on `type` at the leaf; nothing above it does.
const items = [
  ...skills.map(s => ({ type: 'skill', key: `s:${s.id}`, group: (s.group_label || '').trim(), data: s })),
  ...featured.map(l => ({ type: 'link',  key: `l:${l.id}`, group: (l.group_label || '').trim(), data: l })),
];
```

where `featured = links.filter(l => l.placement === 'products' && l.url)`.

### Ordering — the decision that removes the hard part

**Within a group: all products first, in `sort_order`, then all links, in
`position`.**

The module (§4) frames interleaving two independent sequences as the real work.
The better answer is to not do it. `skills.sort_order` and `store_links.position`
were never coordinated — a skill at `2` and a link at `2` have no defined
relationship, so any interleaving rule produces an order the creator cannot
predict *or* control, and it can shuffle between loads. That is the "unstable
sort" trap in §4, and the fix is to remove the ambiguity rather than pick a
tiebreaker.

"Links last in their section" is deterministic, explainable in one sentence, and
still gives full control: a creator who wants a link **first** puts it in its own
section above the others. If true interleaving is ever needed, that is the point
at which `store_tiles` (module §2 Option C) earns its cost.

### Group formation

- A group exists if **any** product or featured link carries that label —
  first-seen order, preserving the existing behaviour.
- A group with only links is allowed and renders its header normally.
- Ungrouped items (`''`) stay the anonymous headerless group, products then links.
- **`.sf-groupcount` counts both.** It currently counts group items; if links are
  excluded it silently under-reports and the pill starts lying.

### The card

Reuse `.sf-card` and add a `.sf-card-link` modifier. **Do not invent a parallel
card class** — it will drift the first time products are restyled, and the grid
will look broken.

```jsx
<a href={l.url} target="_blank"
   rel={l.is_affiliate ? 'noopener noreferrer sponsored' : 'noopener noreferrer'}
   className="sf-card sf-card-link">
  <div className="sf-cover" style={l.cover_url ? { backgroundImage: `url(${l.cover_url})` } : {}}>
    {!l.cover_url && <Link2 size={28} strokeWidth={1.5} />}
  </div>
  <div className="sf-card-body">
    <p className="sf-card-title">{l.label}</p>
    {l.description && <p className="sf-card-outcome">{l.description}</p>}
    <div className="sf-card-foot">
      <span className="sf-card-cta">{l.cta_label || 'Open'} <ArrowUpRight size={14} /></span>
      {l.is_affiliate && <span className="sf-afftag">Affiliate</span>}
      {theme.show_type_badges !== false && <span className="sf-tag"><Link2 size={11} /> Link</span>}
    </div>
  </div>
</a>
```

Structural differences from a product card, and why each is required:

| | Product | Link | Reason |
|---|---|---|---|
| Element | `<Link to>` | `<a href target="_blank">` | It leaves the site |
| Cover fallback | `Puzzle` | `Link2` | Signals category at a glance |
| Foot, left | price | CTA + arrow | **A link must never show a price** — a price says "buy this here", and a buyer who clicks out expecting checkout is a trust failure |
| Foot, right | `TypeTag` | `Affiliate` tag + `Link` badge | `rel="sponsored"` is crawler-only; the visible tag is the actual disclosure (note 158) |

The `Link` badge respects `show_type_badges` for parity — if a creator turned
type badges off, links shouldn't be the one thing still wearing one.

### Profile region

`.sf-links` must filter to `placement === 'profile'`, or **every featured link
renders twice**. This is the most likely bug in the whole feature: the products
region is the new code you're testing, the profile region is old code you aren't
looking at.

### Two styling gotchas

1. **`App.css` styles every bare `<button>`** with `white-space: nowrap` and pill
   radius. If the CTA is ever a `<button>` rather than a `<span>`, the label
   clips. (Known landmine in this codebase.)
2. `.sf-card` inherits `--sf-item-bg` / `--sf-item-blur` from `wrapStyle`, so link
   cards pick up the creator's product opacity/blur automatically. **That is
   correct** — do not opt out, or links will look pasted onto the page.

---

## 4. Build order

Unchanged from the module §7, which is sequenced so the risky part lands last:

1. Migration + `listLinks()` select → verify storefronts are **unchanged**
2. Editor writes the fields → verify persistence, no render change
3. Profile region filters by placement → featured links vanish (correct)
4. Products region renders them, ungrouped, after products → they reappear
5. Grouping + count pill
6. Cover, CTA, affiliate tag, badges

Step 1 is the one to be strict about: if a storefront moved, the default was
wrong, and every later step will hide it.
