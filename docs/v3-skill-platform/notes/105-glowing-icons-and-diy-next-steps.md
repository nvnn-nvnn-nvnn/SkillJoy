# 105 — Glowing social icons + DIY guide for next storefront iterations

_2026-07-08. Icons made bare + glowing. Next iterations (bio size, link restyle,
product groups) will be coded manually — this note is the how-to, not the code._

---

## Done: glowing bare social icons

- Icons are now **bare** (removed the circle bg/border/box-shadow on `.sf-social`).
- **Glow** = `filter: drop-shadow(0 0 7px color-mix(--accent 55%))`; hover stacks two
  drop-shadows + turns accent. Same on the preview `.lp-social`.
- Files: `Storefront.jsx` (`.sf-social` / `.sf-socials`, `BrandIcon size={23}`),
  `StorefrontEditor.jsx` (`.lp-social`, `size={20}`).

**Technique reference:**
- `filter: drop-shadow()` hugs the SVG shape (unlike `box-shadow` = rectangle). Stack
  multiple for intensity.
- SVG uses `fill="currentColor"` → fill tracks the element's `color` → theme-aware.
  (Root cause of the earlier "color won't change" bug: global `a { color: var(--primary) }`
  overrode `.sf-social`; fixed by setting `color` explicitly on the class.)

---

## DIY — next iterations (patterns to follow yourself)

### 1. Adjustable bio size
- Theme: add `bio_size` (default 15) to `DEFAULT_THEME` in `src/lib/storefront.js`.
- Storefront (`Storefront.jsx`): in `wrapStyle`, `'--sf-bio-size': `${theme.bio_size||15}px``;
  CSS `.sf-bio { font-size: var(--sf-bio-size, 15px); }`.
- Editor: a `<Slider min={13} max={24} suffix="px" value={theme.bio_size ?? 15}
  onChange={v => set({ bio_size: v })} />` in the General panel; mirror `--lp-bio-size`
  on `.lp-bio` in the preview.
- No migration — `storefront_theme` is jsonb.

### 2. Links styled differently from products
- They're already separate classes: products = `.sf-card`, links = `.sf-linkbtn`. Just
  restyle `.sf-linkbtn` (it currently mirrors the card border). Ideas: full-width **pill**
  (`border-radius: var(--r-full)`), centered label, filled/outline accent, no cover.
- The button-style + glow classes already scope both (`.sf-btn-* .sf-linkbtn`,
  `.sf-glow-* .sf-linkbtn`) — decide if links should opt out of those.

### 3. Group products (the real feature)
- **Data:** simplest = `skills.group_label TEXT` (a new migration, e.g.
  `020_...`/next number). Per-product free-text group ("Coaching", "Templates").
- **Builder:** a "Group" input in the product Options/Basics (writes `group_label`
  via the existing `patchSkill`).
- **Storefront:** group `skills` by `group_label` (null → "Ungrouped"/no header), render a
  labeled section per group above each `.sf-list`. Reuse `listPublishedSkills` (add
  `group_label` to its select / `SKILL_COLS`).
- Optional later: group ordering, collapsible sections.

_Convention going forward: storefront customization iterations are user-coded; notes
capture the pattern + gotchas, not full implementations._
