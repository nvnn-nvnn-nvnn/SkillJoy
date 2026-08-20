# 151 — Brand color swap: seafoam green → coral `#F5634A`

Date: 2026-08-20

## What changed
The app-wide brand accent moved from Caribbean green `#00CC99` to coral `#F5634A`. Almost all of
it was a single edit to the `:root` ramp in `src/index.css` — every button, link, focus ring,
chip, glow and shadow already reads `var(--accent)` / `rgb(var(--accent-rgb) / …)`, so they
followed automatically. Five files hardcode the brand and had to be chased by hand (listed
below).

## The competitive screen (the real driver)
The brief was never "pick a nicer color" — it was **escape the competitors**. Creator-commerce
brand colors are crowded:

| color | who owns it |
|---|---|
| green `#00CC99` | **Fiverr** `#1DBF73`, Upwork, Linktree — why we left |
| periwinkle `#7E8ED8` | **Stan** — the product this UI is already modeled on; rejected |
| coral `#F5634A` | near **Patreon** `#FF424D` and Substack `#FF6719` — **chosen anyway** |
| hot pink | Gumroad `#FF90E8` |
| orange | Etsy `#F1641E` |
| blue | Kajabi, Teachable, Podia, generic SaaS |

Coral's Patreon adjacency is a **known, accepted risk** — raised and overruled deliberately, not
an oversight. Don't "fix" it in a later pass without asking.

**Transferable:** screen a brand color against the competitive set BEFORE doing the palette
work. Three full swaps were spent learning that (green → coral → periwinkle → terracotta → coral).

## The ramp
Derived at the same lightness *deltas* the green ramp used, so every internal relationship
holds. Base is `hsl(9, 89%, 63%)`:

| var | was (green) | now |
|---|---|---|
| `--accent` | `#00CC99` | `#F5634A` |
| `--accent-hover` | `#00A37A` | `#E04A32` |
| `--accent-bright` | `#2FD9AB` | `#FA8A73` |
| `--accent-mid` | `#9FE6D0` | `#F9B7A8` |
| `--accent-light` | `#E0F8F1` | `#FDEBE6` |
| `--accent-rgb` | `0 204 153` | `245 99 74` |
| `--accent-bright-rgb` | `47 217 171` | `250 138 115` |
| `--primary-hover/light/mid` | green tints | coral tints |
| dark-mode `--accent-light` / `--primary-light` | `#0E2E27` | `#331A14` |

`--accent-rgb` **must** stay in sync with `--accent` — it drives every shadow and focus ring.

## ⚠️ Two live constraints this palette carries

### 1. White-on-accent is 3.10:1 — large text only
| accent | white-on-fill | verdict |
|---|---|---|
| green `#00CC99` | **2.08:1** | failed everything — a real defect that shipped for the life of the design system |
| **coral `#F5634A`** | **3.10:1** | ✓ AA for large/bold text + UI components (3:1) · ✗ normal text (4.5:1) |
| terracotta `#B84E29` | 5.05:1 | would have passed outright; not chosen |

Better than what it replaced, but **not** a clean pass. `--accent-foreground` stays `#FFFFFF`.
Keep accent fills to buttons and chips with bold/large labels — **never put 14px regular text on
an accent background.**

### 2. Coral sits ~9° from `--danger`
Brand coral is `hsl(9°)`; `--danger` (`#DC2626`, added in note 153) is `hsl(0°)`. Against the old
green brand, red errors were 160° away and unmistakable. Now they are neighbours, and the pale
tints are close: error `#FEF2F2` vs accent `#FDEBE6`. A saturated red toast still reads, but
error boxes and accent info boxes are muddier than ideal. If this bites, shift `--danger` cooler
toward crimson (`~#D11A3D`, hue 348°) — cheap while few things point at the token.

## Left green on purpose
- `--green` / `--green-light` / `--green-mid` (`#2A7A4B`) — the **semantic success** color
  (paid/completed/verified badges), not the brand. Now that the brand isn't green, success
  reading green is *clearer* than before; previously the two were easy to confuse.
- `.sf-fx-rainbow` / `.lp-fx-rainbow` — `#00cc99` there is one stop in a literal 7-color
  spectrum, not a brand reference.
- `terminal` preset's `#00FF88` (matrix green) and the `leobuilds` demo store accent —
  deliberate palette variety for creator-facing presets/mocks.

## Hardcoded brand colors that must be chased by hand every swap
- `src/lib/storefront.js` — `DEFAULT_THEME.accent` (what a new creator's storefront ships with),
  its `bg_color2` gradient end, and the `clean` theme preset's accent.
- `src/app-pages/StorefrontEditor.jsx` — first swatch of `ACCENT_PRESETS` (the "brand default"
  chip in the picker).
- `src/components/TrialBanner.jsx` and `src/components/SubscribeForm.jsx` — both hardcode the
  brand *on purpose*. `SubscribeForm`'s comment explains why: it's a "Built on SkillJoy" element,
  so it must NOT use the creator's `--accent`, which can be white on some themes and would
  render an accent-bg button invisible.

**Transferable:** an intentional hardcode still needs a grep-able trail. Searching the brand hex
plus its `rgba(r,g,b,…)` spellings finds all five; a variable would have found zero. When you
hardcode a brand color, note the hex in a comment so the next swap's grep catches it.

## Files
- `src/index.css` · `src/lib/storefront.js` · `src/app-pages/StorefrontEditor.jsx` ·
  `src/components/TrialBanner.jsx` · `src/components/SubscribeForm.jsx`
