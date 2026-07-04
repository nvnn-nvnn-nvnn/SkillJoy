# 65 — Builder spacing + overflow pass

_Session 2026-07-02. Follow-up polish to notes 63–64: "text peeking out" +
"space everything out." CSS-only, no logic changes._

## Root cause of the "peeking"
`SkillBuilder`'s `.sb-editbar` (Back · Saved✓ · Delete · Push update · Publish)
was a single non-wrapping flex row. With `.btn` padding at 14×28px, five items
overflow the 680px column on any non-wide viewport → buttons spill past the
edge. Fix: `flex-wrap:wrap` + `row-gap` on `.sb-editbar` and
`.sb-editbar-actions`.

## Spacing changes
- **SkillBuilder** (`src/app-pages/SkillBuilder.jsx`, styles only):
  - `.sb-panel` is now `display:flex; flex-direction:column; gap:20px` — one
    consistent vertical rhythm for every tab, so blocks / price / hints stop
    crowding. Neutralized the old per-element margins/padding that would have
    doubled up (`.sb-pricerow`, `.sb-blockshead`, `.sb-kindrow`, `.sb-h2`,
    `.sb-add`, title/tagline inputs).
  - Wider page gutters (`.sb-wrap` padding 16→20px), more tab padding + bottom
    margin, roomier `.sb-hint` and `.sb-checklist`.
- **AddProduct** (`src/app-pages/AddProduct.jsx`, styles only):
  - Card padding 20→24, grid gap 14→18, more head/sub spacing and line-height.
  - `min-width:0` + `overflow-wrap:anywhere` on cards / `.ap-name` / `.ap-blurb`
    so long titles or blurbs wrap instead of escaping the card.

## Verify
`eslint` clean on both files. (CSS lives in JS template strings, so visual
spacing is best confirmed in the browser — `npm run dev` → New product + the
tabbed builder.)

## The AddProduct card clipping — ACTUAL root cause
The type cards on `/build/new` clipped their blurb out the right side. Took
three tries because the cause was a **global reset**, not the card's own CSS:

```css
/* src/App.css line 4 */
button, .btn { …; white-space: nowrap; … }
```

`.ap-card` is a `<button>`, so it inherited `white-space:nowrap` from this
app-wide rule. Text physically cannot wrap under `nowrap` — width, `min-width:0`,
`overflow-wrap`, and `align-items` are all irrelevant until you defeat it. Fix:
`white-space:normal` on `.ap-card` (cascades to `.ap-name` / `.ap-blurb`).

**LANDMINE for future components:** every bare `<button>` in this app is styled
by `button, .btn { … }` in App.css — it forces `inline-flex`, centered content,
pill radius, AND `white-space:nowrap`. Any custom `<button>` that should hold
multi-line or left-aligned text MUST override `white-space` (and usually
`display`/`justify-content`/`border-radius`). The `width:100%` + `align-items`
tweaks from the earlier attempt are still good hygiene but were not the fix.

## If something still peeks
Point at the specific page. Two distinct flexbox fixes cover most cases:
- **Row overflows** (buttons/tabs spilling sideways) → `flex-wrap:wrap` on the
  row, `min-width:0` on any text child.
- **Column child won't wrap** (text clipping out in a card) → `width:100%` /
  `align-self:stretch` on the text child under `align-items:flex-start`.
