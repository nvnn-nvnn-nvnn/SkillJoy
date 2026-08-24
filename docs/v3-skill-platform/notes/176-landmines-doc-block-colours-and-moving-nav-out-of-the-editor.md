# 176 — Guide: giving lessons a home, splitting link/product colour, and moving nav out of the editor

Date: 2026-08-21
Migrations: none
Plans: new [04 — Link-in-Bio blocks](plans/04-link-in-bio-blocks.md)

---

## 1 · A numbered note is the wrong home for a recurring trap

The backtick-in-`<style>` bug broke the build four times. It was written up in
notes 167, 170, 173 and 175. Writing it down **four times changed nothing**, and
the reason is structural rather than a failure of attention:

**Numbered notes are a chronological log.** Note 175 is findable this week and
buried by note 200. They answer *"what happened on the 21st?"* — a question
nobody asks when they're mid-bug.

So: `docs/v3-skill-platform/LANDMINES.md`. Eleven traps that have each already
cost a session, **symptom-first**, so you find yours by what you're seeing
rather than by knowing what it's called:

> *"Build fails with a parse error pointing at a line that looks completely
> fine"* → §1
> *"A signed-in user sees 'Please log in' for a moment"* → §2
> *"A component's input is far too tall"* → §3

Linked from the v3 README with a warning block, because a doc nobody is pointed
at is the same as no doc.

The rule at the top is the important part: **when something bites you twice, add
it here.** Twice is the signal — once is bad luck, twice is a property of the
codebase.

**It paid for itself within the hour.** Building the sidebar group below, I hit
the `Icon` destructured-param eslint false positive, recognised it from §11, and
applied the documented fix instead of re-deriving why `varsIgnorePattern`
wasn't covering it.

> **Transferable:** three notes saying the same thing is a signal you're
> logging where you should be indexing — or automating. Both, here: the guard
> script from 175 *and* an entry in the standing doc.

Also saved to memory, so future sessions read it before non-trivial work.

---

## 2 · Link colour: splitting a shared variable before it's a problem

The ask: *"edit and adjust the color for the blocks containing the links, this
was the same issue with the profile layer."*

The obvious fix is one control feeding `--sf-item-bg`, which already drives both
product cards and link buttons. That would have worked today and been wrong
tomorrow, because the link-in-bio spec makes **Links and Products distinct block
types**. One shared colour would collapse a distinction the whole page design
depends on — and un-collapsing it later means a migration.

So two keys, not one:

```js
'--sf-item-bg': color-mix(… item_color || var(--surface) … product_opacity …)
'--sf-link-bg': link_color
  ? color-mix(… link_color … product_opacity …)
  : color-mix(… var(--accent) 10%, var(--sf-item-bg) …)   // the existing look
```

Both feed the *same* opacity slider, and both default to `''` = follow the
theme, so every existing storefront renders byte-identically. Same pattern as
`card_color` (173) and `name_color` (168) — third time, which is a sign it
should become a shared helper if a fourth appears.

One detail: the border tracks the fill when custom
(`color-mix(link_color 62%, black)`) and stays accent-derived otherwise. A
custom fill with an accent border looks like a mistake, not a choice.

> **Transferable:** when a spec you've already read says two things will diverge,
> split the variable *now*. The cost is one extra key today versus a data
> migration later.

---

## 3 · Nav belongs in one place

I built this twice and the first attempt was wrong in an instructive way.

**Attempt 1:** move the editor's Customize / Themes / Links tabs from a row on
top into a left rail *inside the editor*. This is better than tabs — Customize
is a long scrolling column, and a horizontal tab row above it scrolls away, so
the way out of the column disappears exactly when you need it.

**But it was still a second navigation inside a page that already sits inside
the app's sidebar.** Two navs competing, and neither knows about the other.

**Attempt 2 (shipped):** the sections moved *out* of the editor into the app
sidebar, as a collapsible group under **My Page**.

```
My Page  ▾
  Customize
  Templates
  Links
```

The structural win isn't the position, it's that each section became a **route**:

```jsx
<Route path="/storefront/edit" … />
<Route path="/storefront/templates" … />
<Route path="/storefront/links" … />
```

```js
const subTab = pathname.endsWith('/templates') ? 'themes'
  : pathname.endsWith('/links') ? 'links' : 'customize';
```

`useState('customize')` became a derivation from the URL. That single change
buys browser-back between sections, shareable links, and deletes the switcher
from the editor entirely.

> **Transferable:** local tab state and a route are the same thing wearing
> different clothes, and the route version is strictly better once more than one
> surface needs to point at a tab. If you catch yourself building a nav inside a
> page that already has a nav, that's the tell.

### Two decisions inside the group

**Open state is derived, never stored.** `open = active` — if you're anywhere
under `/storefront`, the group is open. A remembered toggle would let you sit on
`/storefront/links` with the group collapsed, so the nav would be actively
hiding where you are. That's the one thing nav must never do.

**The parent is a `<Link>`, not a `<button>`.** It has a real destination
(Customize). Making it a pure toggle would break middle-click and
open-in-new-tab for nothing; the chevron is decoration on a working link.

I deleted the rail rather than keeping both. Leaving the losing version around
"just in case" is how you get two navigations that disagree.

---

## 4 · Plan 04, and the finding that shaped it

The link-in-bio spec became
[plans/04-link-in-bio-blocks.md](plans/04-link-in-bio-blocks.md). Writing it
surfaced one thing that reorders the entire spec:

**There is no block model for links.** `store_links` is a flat table with a
`placement` column choosing between two hardcoded page regions. There's no
object that owns *a set of links plus how that set is laid out*.

Every other item in the spec — the 4 layout styles, size, alignment, outline,
shadow, block title, visibility — is a property of a block. **None of them have
anywhere to live until that object exists.** So Phase 1 isn't a preference, it's
a hard prerequisite, and it's the only phase that touches existing creators'
data, so it ships alone.

The plan also records verified prior art rather than assumptions: the group
bucketing loop in `Storefront.jsx` is already the closest thing to a block
renderer, `cover_url`/`description`/`cta_label` already exist on `store_links`
(which is why "Cards" is the proposed 4th style — it's the only one that unlocks
data the schema already holds), and `sanitizeThemeImport()` can back templates
verbatim.

Five open questions are listed as **answer before Phase 1**, the biggest being
how existing links get backfilled into blocks.

---

## Exercises

**1 · Add the next landmine yourself.**
Next time something bites twice, add it to `LANDMINES.md` before fixing it —
writing the symptom line first forces you to say what you actually observed,
which is usually where the diagnosis is.

**2 · The colour-key helper.**
`card_color`, `name_color`, `link_color`, `item_color` all follow one shape:
`'' = follow theme`, else a fixed colour, with a matching editor control and
reset. Write `useThemeColor(key, fallback)` + a `<ColorField>` and convert one
of them. Then decide if converting the other three is worth the churn.

**3 · Deep-link a section.**
Now that `/storefront/links` is a route, find the places that say "edit your
links" and point them at it directly instead of at `/storefront/edit`. Start
with `SetupChecklist` and the empty states.

**4 · Should Products be in the group too?**
`/build` is a sibling of My Page in the sidebar. But the spec makes products a
*block on the page*. Argue whether Products belongs under My Page, stays
top-level, or appears in both — and what "appears in both" costs.

**5 · Answer plan 04's question 1.**
On backfill, does a creator with links in both placements get two blocks, or one
plus the featured links folded into products? Write the migration both ways in
SQL and pick based on which down-migration you'd rather run at 2am.

**6 · Harder: is derived-open right at every size?**
On mobile the sidebar is a drawer. Deriving open-state from the route means the
group is always expanded there too, pushing other items down. Check it at 380px
and decide whether mobile wants different behaviour — and if so, whether that
contradicts §3's reasoning or is a genuine exception.

---

## Files
**New** — `docs/v3-skill-platform/LANDMINES.md`,
`docs/v3-skill-platform/notes/plans/04-link-in-bio-blocks.md`
**Changed** — `docs/v3-skill-platform/README.md` (links LANDMINES),
`plans/README.md` (indexes 04, marks 03's link half superseded),
`src/lib/storefront.js` (`link_color`, `item_color`),
`src/app-pages/Storefront.jsx` (separate link/item fills),
`src/app-pages/StorefrontEditor.jsx` (two colour controls, section from route,
tab row removed), `src/components/Header.jsx` (`NavGroup`),
`src/App.css` (sub-nav styles), `src/main.jsx` (two new routes)
