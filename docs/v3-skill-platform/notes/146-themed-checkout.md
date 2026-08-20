# 146 — Themed checkout (creator accent + mode on the pay page)

Date: 2026-07-18

## What & why
`Checkout.jsx` was a generic gray form with a hardcoded Stripe orange (`#D4522A`). A buyer flowing
from a heavily-customized storefront hit a page that looked like a different product — a trust break
at the exact moment money changes hands. Checkout now pins the creator's **accent + light/dark
palette** (and nothing else). Roadmap: note 108, Phase 1 "Themed checkout."

## Learn — build-it-yourself

**Mental model: theming a payment page is three separate surfaces, each themed differently.**

1. **Your own DOM** → pin CSS variables. The storefront already pins its palette via
   `.sf-mode-light/.sf-mode-dark`; checkout sets the *same variables inline* on `.ck-wrap`
   (`--bg --surface --text --accent …`). Every existing `.ck-*` rule and global `.btn` rule reads
   vars, so the whole page re-skins without touching markup. **Both files now read one
   `MODE_PALETTES` constant** (`src/lib/storefront.js`) — the storefront interpolates it into its
   CSS template, checkout builds a style object — so the two surfaces physically cannot drift.
2. **The Stripe iframe** → you cannot CSS it. It's themed only through the `appearance` API on
   `<Elements options>`: `theme: 'night'|'flat'` from the creator's mode, `colorPrimary` from their
   accent, `colorBackground/colorText` from the same palette. Appearance is fixed at mount —
   fine here, because `clientSecret` already gates when `<Elements>` mounts.
3. **The browser's own UI** (autofill, scrollbars, native inputs) → `colorScheme: mode` on the
   wrapper, or dark stores get blinding white autofill dropdowns.

**The contrast system (the careful part).** Creators pick ANY accent, including `#F8FAFC`
(near-white). Two different questions, two helpers in `storefront.js`:
- Text **on** the accent (pay button): `readableOn(hex)` compares WCAG contrast of white-vs-black
  against the accent's relative luminance and returns the winner → wired to `--accent-foreground`,
  and `.ck-wrap .btn-primary` re-pins `background/color` locally so the answer wins over whatever
  the global stylesheet says. Fun finding: even the default green fails white text (~2:1) — the old
  hardcoded white was already sub-AA.
- The accent **as** text (bump price): `contrastRatio(accent, surface) >= 4.5 ? accent : palette.text`
  → `--ck-accent-text`. Verified: pale mint on white = 1.05:1 → falls back; hot pink on dark =
  6.36:1 → keeps the accent.

**Fail-open fetch.** `getProfileTheme(creatorId)` (`profiles.js`) selects only `storefront_theme`,
returns `{}` for "creator never themed" (defaults still match their store) and `null` on any error.
Checkout fires it **non-blocking** after the skill loads — a slow/failed theme query can never
delay or break payment; `null` keeps today's app-default look. Revenue path > pretty path.

**Restraint as a decision.** Only accent + mode travel. Bg video, overlays, glow, audio, cursor FX,
tilt are deliberately excluded (commented in code): a pay page with rain effects and autoplaying
music reads as a scam. Calm = converting.

**Semantic danger.** Errors were accent-colored (`.ck-err` used `--accent`) — with a mint theme,
"payment failed" would render in cheerful green. Now `--ck-danger` (`#dc2626`, `#f87171` on dark).
Error color is semantics, not branding.

## Files
- `src/lib/storefront.js` — `MODE_PALETTES`, `contrastRatio()`, `readableOn()`
- `src/lib/profiles.js` — `getProfileTheme()`
- `src/app-pages/Storefront.jsx` — palette CSS now interpolates `MODE_PALETTES`
- `src/app-pages/Checkout.jsx` — theme fetch, `pin` vars, `appearance`, `.ck-bg` canvas, contrast CSS

## Verify (manual)
Hot-pink dark store, pale-mint light store, and an unthemed creator → all must give a legible,
on-brand checkout across guest + logged-in, promo, bump, one-time + membership. All six statuses
(`loading|notfound|error|promo|pay|guest-success`) render inside the pinned Shell; no logic changed.
