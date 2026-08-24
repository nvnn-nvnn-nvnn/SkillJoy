# 04 — Link-in-Bio blocks: the block model, layout styles, and templates

**Status: planned, not started.** Written 2026-08-21 from the product spec.
Supersedes the link half of [03](03-link-product-design.md), which shipped
`placement` as a two-value axis — this generalises that into real blocks.

---

## The one structural problem

Everything in the spec hangs off a single missing concept: **there is no block
model for links.**

Today `store_links` is a flat table of rows belonging to a creator, with a
`placement` column (`'profile' | 'products'`) deciding which of two hardcoded
regions each row renders in. There is no object that owns *a set of links plus
how that set is laid out*.

The spec needs exactly that object — a **Links block** with its own Layout and
Settings. Once it exists, the 4 styles, size, alignment, outline, shadow, block
title, and visibility are all just columns on it. Until it exists, none of them
have anywhere to live.

So the phase order isn't a preference. Phase 1 is a prerequisite for everything
else in the spec.

---

## Prior art (verified, not assumed)

Grepped, not remembered:

- `store_links` — `id, creator_id, label, url, position, is_affiliate,
  created_at` (006), plus `cover_url, cta_label, description, group_label,
  placement` (029). Thumbnails and CTA labels already exist.
- `Storefront.jsx` already buckets products **and** featured links into ordered
  groups by `group_label`, rendering `.sf-grouphead` per group. That grouping
  loop is the closest thing to a block renderer already present, and is the
  natural seam to generalise.
- `theme.layout` (`'list' | 'grid'`) exists but is **page-global** and applies
  only to products.
- `button_style` (`rounded | pill | sharp`), `product_glow`, `product_opacity`,
  `product_blur`, and now `link_color` / `item_color` are all **page-global**
  theme keys. The spec wants several of these **per block**.
- `StorefrontEditor` has a real live preview (`lp-*` mirror of `sf-*`) that must
  be extended in lockstep — note 175's lesson: a preview with different geometry
  is worse than none.

**Nothing here needs to be thrown away.** The block model wraps it.

---

## Phase 1 · The block model (prerequisite)

New table, roughly:

```sql
create table public.store_blocks (
  id          uuid primary key default gen_random_uuid(),
  creator_id  uuid not null references profiles(id) on delete cascade,
  kind        text not null check (kind in ('links','products')),
  title       text,                       -- optional heading above the block
  position    integer not null default 0,
  visible     boolean not null default true,
  layout      jsonb not null default '{}'::jsonb,   -- see below
  created_at  timestamptz default now()
);
```

`store_links` gains `block_id uuid references store_blocks(id) on delete cascade`.

### `layout` as JSONB, not columns

Deliberate. These are presentation knobs that will churn — the spec already
hints a fourth style is undecided. Columns would mean a migration per knob;
JSONB means the shape lives in one place in code (`DEFAULT_BLOCK_LAYOUT`) and
`resolveBlockLayout()` merges defaults, exactly like `resolveTheme` already does
for the page theme. Same pattern, already proven in this codebase.

```js
{ style: 'classic', size: 'medium', align: 'center',
  outline: 'none', shadow: 'none', columns: 2 }
```

The counter-argument (JSONB can't be constrained or indexed) doesn't apply:
nothing queries by layout, and an unknown value falls back to the default.

### Migration of existing links — the decision that matters

Every current creator has links with a `placement`. Two candidate paths:

**(a) Backfill into two default blocks.** Create a `links` block per creator for
each placement in use, and set `block_id`. `placement` becomes redundant and is
dropped later.

**(b) Keep `placement` as a fallback.** `block_id IS NULL` means "legacy, render
in the old region."

**Recommendation: (a).** (b) means the renderer carries two code paths forever,
and note 172's lesson is that dead paths are where bugs hide. (a) is a one-time
backfill with a clear before/after. It must be reversible — write the down
migration before running it.

**Open question:** does a creator with links in *both* placements get two
blocks, or one block plus the featured links folded into the products block?
This decides whether "featured" survives as a concept at all.

---

## Phase 2 · Layout styles

Four styles, per block:

| Style | Shape | Notes |
|---|---|---|
| **Classic** | full-width stacked buttons | today's `.sf-linkbtn` — the default, must be pixel-stable through the migration |
| **Grid** | 2-up (or `columns`) tiles | thumbnail-forward; `cover_url` already exists |
| **Carousel** | horizontal scroll-snap row | CSS scroll-snap, no JS — [02](02-storefront-ui-roadmap.md) already scoped scroll-snap |
| **Cards** | thumbnail + title + description | the widest; uses `description`, already on the table |

"Cards" is the proposed fourth. It earns its place because `description` and
`cta_label` already exist on `store_links` and nothing currently renders them —
so it's the only style that unlocks data the schema already holds.

**Trap:** Carousel on a 540px column needs the full-bleed breakout from note 175
(`left:50%; translateX(-50%); width:100vw`) or it will scroll inside a narrow
box and look broken. Reuse that, don't re-derive it.

**Trap:** `outline` and `shadow` per block will collide with the global
`product_glow` / `button_style` theme keys. Decide precedence *before* building:
recommend block-level wins, page-level is the default it inherits from.

---

## Phase 3 · Products block

Products become a `store_blocks` row of `kind: 'products'` rather than an
implicit region. Same Layout tab; `theme.layout` (global grid/list) folds into
the block's `style` and is backfilled from it.

Free vs Pro, per the spec: Free sells with platform branding and standard fees;
Pro unlocks the branded storefront. The paywall already exists
(`isPlatformLive`, checked at publish) — this needs a *presentation* gate, not a
new billing mechanism. **Do not build a second paywall.**

---

## Phase 4 · Onboarding: Templates vs Create Your Own

Onboarding is currently 5 screens ending on plan choice + success (note 170).
The spec wants a Templates / Create-Your-Own fork.

Cheapest correct version: a **template is a `storefront_theme` JSON blob plus a
starter set of blocks.** `sanitizeThemeImport()` already exists and whitelists
against `DEFAULT_THEME` — templates can reuse it verbatim, which also means a
template can never inject unknown keys.

**Open question:** does picking a template replace onboarding screen 4 (plan
choice), or insert as a 6th screen? Note 170 exercise 6 already questions
whether plan choice belongs in onboarding at all — resolve both together rather
than stacking a 6th screen onto a flow that's already at the limit.

---

## Explicitly out of scope

Per the spec: multi-page sites, custom domains, AI site generation, memberships
beyond digital products. The long-term Lovable-style builder is **not** a
constraint on this design — but the block model is the right foundation for it,
which is a reason to get Phase 1 right rather than to expand it now.

---

## Sequencing

```
1  block model + backfill        ← prerequisite, nothing else lands without it
2  Layout tab + 4 styles         ← the visible payoff
3  Settings tab (title, visibility)
4  products-as-block
5  templates in onboarding
```

Phases 2–5 are independently shippable once 1 is done. Phase 1 is the only one
that touches existing creators' data, so it carries all the migration risk and
should ship alone.

---

## Open questions (answer before Phase 1)

1. Two blocks or one on backfill, and does "featured" survive?
2. Block-level vs page-level precedence for outline/shadow/size.
3. Can a creator have multiple `links` blocks? (The spec implies yes — "block
   title" only makes sense with more than one.) If yes, the editor needs
   block-level reorder, not just link reorder.
4. Does `theme.layout` get removed or kept as the default new blocks inherit?
5. Is per-link `visibility` (spec, Links tab) a column on `store_links` or does
   it fold into the existing publish model?

## Success criteria (from the spec)

- Polished on-brand page in **under 5 minutes**
- Links and products feel distinct but cohesive
- Layout controls feel powerful — the 4 styles are the headline
- Onboarding clearly offers Templates vs Create Your Own
