# 106 — Bio effects + link separation (done) · Product groups (build-it guide)

_2026-07-08._

---

## Done (automated)

**Bio effects** — added `bio_weight` (300–800) + `bio_glow` (0–20px drop-shadow) to
the theme, alongside the `bio_size` you'd started. Fixed two bugs in your `bio_size`:
`DEFAULT_THEME` had it as the string `"15px"` (→ CSS rendered `15pxpx`, invalid) — now a
number `15`; and `.lp-bio` had a stray `)` (`var(--lp-bio-size))`) that killed the rule.
Applied via `--sf-bio-*` vars on `.sf-bio` (font-size / font-weight / `filter:drop-shadow`
for the glow). Sliders added to the General panel; mirrored in the preview.

**Link buttons separated from products** — `.sf-linkbtn` is now its own look: a centered
**accent-tinted pill** (no product-card border box), and it's **decoupled** from the product
`.sf-btn-*` (button style) and `.sf-glow-*` rules, so links no longer inherit the product
shape/glow. Same in the preview.

---

## Product groups — how to build it (do this yourself)

Goal: a creator tags each product with a **group** ("Coaching", "Templates"…), and the
storefront renders one **labeled section per group**.

### The data-model decision (understand this first)
Two ways to model "a product belongs to a group":

1. **Denormalized — a `group_label` column on `skills`** (recommended for v1). Each product
   carries its own group name as free text. Simplest: no join, no extra table.
   - Trade-off: renaming a group = updating every product with that label; and you can't
     order/rename groups independently. Fine for v1.
2. **Normalized — a `product_groups` table** (id, creator_id, name, position) + a
   `group_id` FK on skills. Lets you rename a group once and order groups explicitly.
   - More moving parts (a table, its own CRUD, RLS). Overkill until creators ask for group
     ordering. **Skip for now.**

Go with **#1**. Everything below assumes `group_label`.

### Step 1 — Migration (Supabase)
```sql
ALTER TABLE skills ADD COLUMN IF NOT EXISTS group_label TEXT;
```

### Step 2 — Load the field in BOTH queries (the gotcha)
`group_label` must be in the SELECT of every query that needs it, or it comes back
`undefined`. Two places:
- **`SKILL_COLS`** in `src/lib/skills.js` — so the builder can read/write it
  (`listMySkills`, `getSkillWithBlocks` use `SKILL_COLS`).
- **`listPublishedSkills`** in `src/lib/skills.js` — the storefront's query. Add
  `group_label` to its `.select(...)` so the public page can group.

Forgetting the storefront one is the classic bug: it'll work in the builder, be blank on
the live page.

### Step 3 — Builder input
In the builder (`SkillBuilder.jsx`, Options or Basics step), add a text input:
```jsx
<input value={skill.group_label ?? ''} onChange={e => patchSkill({ group_label: e.target.value })}
  placeholder="Group (optional) — e.g. Coaching" />
```
`patchSkill` already debounce-saves. Optionally offer existing groups as a datalist.

### Step 4 — Group + render on the storefront
Grouping is a **pure client-side transform** — no extra query. In `Storefront.jsx`, turn the
flat `skills` array into ordered groups:
```js
// Preserves first-seen order; '' key = ungrouped.
const groups = skills.reduce((acc, s) => {
  const key = (s.group_label || '').trim();
  (acc[key] ||= []).push(s);
  return acc;
}, {});
```
Then render a section per group — a heading when the key is non-empty, the product list
under it. Decide where ungrouped (`''`) products go (top, bottom, or an "Other" header).
Reuse the existing `.sf-list` for each group's products.

### Nuances to decide
- **Group order:** `reduce` gives first-seen order. Want manual ordering? That's when you'd
  move to model #2 (a `position` on groups). Defer.
- **Ungrouped placement:** first, last, or hidden under "Other" — your call.
- **Links stay separate** from grouped products (they're their own section already).

### The mental model
Product groups = **one denormalized column + a client-side group-by + a section renderer.**
No new query, no join. The only backend touch is the migration + adding the column to two
SELECTs. Everything else is a `reduce` and a `.map` over its entries.
