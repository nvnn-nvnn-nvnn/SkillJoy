# 158 — Active/Draft filter, and the affiliate link that was already there

Date: 2026-08-20

## 1. Status filter on the products dashboard

`ServicesDashboard` already had a `filter` — but it filters by product **kind** (Digital, Course,
Coaching…). Status is a different question, so it got its own control rather than three more tabs
in that row.

**Why two controls and not one row:** they are independent axes. Folded together, "All" would
mean two different things and you could never ask for *draft courses*. Separate, they compose:
type ∧ status ∧ search.

```js
const visible = services.filter(s =>
  (filter === 'all' || s.kind   === filter) &&
  (status === 'all' || s.status === status) &&
  s.title.toLowerCase().includes(query.trim().toLowerCase())
);
```

**Counts are scoped, not global.** `statusCounts` is computed off the *type-filtered* set, so with
"Course" selected, Draft showing `3` means three draft courses — the number always describes what
you'd actually get if you clicked it. A global count would lie the moment a type was picked.

`statusOf()` already existed (`skills.status === 'published' ? 'active' : 'draft'`), so no data
work — the dashboard was already computing this per card for the status pill.

### Empty state
Previously always "No products here yet" + a New-product button, which after filtering to Draft
with no drafts reads as **data loss**. Now distinguishes "you have none" from "your filters hid
them all", says which filter is responsible, and offers **Clear filters** instead of New product
when filters are what emptied the list.

---

## 2. The affiliate link feature already existed

Asked for "a link that isn't a product, for affiliate links." That is shipped:

| piece | where |
|---|---|
| `store_links` table (`id, label, url, position, is_affiliate`) | `src/lib/storefront.js:249` |
| Editor UI — label, URL, affiliate checkbox, add/remove | `StorefrontEditor.jsx` → **Links → Link buttons** |
| Public render as pill buttons in the profile panel | `Storefront.jsx` → `.sf-linkbtn` |
| `rel="noopener noreferrer sponsored"` when affiliate | `Storefront.jsx:204` |

### What was actually missing
`is_affiliate` **only** set `rel="sponsored"` — a search-engine hint that is completely invisible
to a human. So ticking the box changed nothing any visitor could perceive, while looking like a
disclosure feature.

Added the visible half: an `Affiliate` tag rendered inside the link button, plus an editor note
explaining what the checkbox does and why to leave it on. Disclosure of an affiliate relationship
has to reach the *reader*; `rel` attributes reach crawlers.

**Transferable:** when a flag's only effect is on an attribute robots read, it is not a
user-facing feature yet — it just looks like one in the editor. Check that a toggle changes
something a person can see before calling it done.

**Note:** this changes every existing storefront that already has affiliate links ticked — they
now display the tag. That is the intended correction, but it is a visible change to live public
pages, not just new ones.

## Files
- `src/app-pages/ServicesDashboard.jsx` · `src/app-pages/Storefront.jsx` ·
  `src/app-pages/StorefrontEditor.jsx`
