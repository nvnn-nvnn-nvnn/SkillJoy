# 136 — Storefront editor reorg + stronger glow + avatar shape

Date: 2026-07-13

## Goal
Revamp the customization studio so controls are grouped by **purpose**, not thrown into a
grab-bag "Assets / Animations & Effects" pile. User's framing: a **General** section for
ambiance (background effects, music, etc.), a **Color** section (accent, text, title), and
"organize everything like that." Plus **stronger glow** effects and more profile controls.

## New panel structure (Customize tab, `StorefrontEditor.jsx`)
Old panels were: Profile · Assets · General(opacity+bio) · Color & Theme · Animations & Effects · Product order.
The old "General" mixed profile-card glass with bio typography; "Animations & Effects" was a 12-control dump.

New, purpose-based panels:
1. **Profile** (`User`) — picture (upload / show / **shape** / size), display name, bio, **bio typography**
   (size/weight/glow), **profile-card glass** (opacity/blur), **profile-card motion** (glow/float),
   handle note. This is the "more features for the profile editor" ask — everything about *you* lives here now.
2. **Background** (`Image`) — background type + solid/gradient colors + image/video upload + banner.
3. **General** (`Sparkles`) — ambiance: overlay effect (rain/snow/vhs), **glow intensity**, name effect,
   animated username, monochrome icons, **site music**, cursor effect + custom cursor. ("background effects, music, etc.")
4. **Color** (`Palette`) — mode (light/dark), accent, text color, title color.
5. **Products** (`LayoutGrid`) — product layout, button style, product glow, product opacity/blur.
6. **Product order** (`SlidersHorizontal`) — unchanged drag/reorder.

Also removed the dead commented-out "Bio Size" block and the stray `title_color` default of `#fff`
(now `#ffffff` so the native color input shows a valid value).

## New feature: avatar shape
- `DEFAULT_THEME.avatar_shape` (`'circle' | 'rounded' | 'square'`) in `src/lib/storefront.js`.
- Wired through: `Storefront.jsx` sets `--sf-avatar-radius` and `.sf-avatar` uses it; the editor's
  live preview sets `--lp-avatar-radius`; the editor avatar thumbnail reflects the shape inline; new
  "Picture shape" segmented control in the Profile panel. circle=50% · rounded=26% · square=14%.

## Stronger glow
- **Glow intensity slider max 40 → 80** (`glow_intensity`).
- `--sf-glow-strong` multiplier **1.6 → 2.4**; preview multipliers **0.6/1.0 → 0.65/1.4**.
- Bumped the accent color-mix percentages everywhere glow is applied:
  - Name: single drop-shadow @85% → **layered** drop-shadow @100% + a second @55% at the strong radius (bloom).
  - Avatar: 60% → **85%**. Profile card/panel: 42% → **62%**. Links: 55% → **78%**.
  - Product glow — soft: 22px/24% → 26px/38%; strong: 38px/48% → **34px@62% + 60px@34% layered**;
    hover states pushed further. Mirrored in the editor preview (`.lp-glow-*`).
- Glows are still driven by `var(--sf-glow*)` which is `0px` when intensity is 0, so **zero-glow themes are unchanged** (drop-shadow/box-shadow at 0 blur = invisible).

## Files
- `src/lib/storefront.js` (avatar_shape default)
- `src/app-pages/Storefront.jsx` (avatar radius var, stronger glow CSS)
- `src/app-pages/StorefrontEditor.jsx` (panel reorg, avatar-shape control, glow max, preview mirrors)

## Follow-ups / ideas
- "Name overlays" + "Custom fonts" still Soon tiles in General.
- Could add a one-click **theme preset** picker (bg+accent+effects bundle) — Phase 2 roadmap item.

## Learn — build-it-yourself
**Mental model:** drive many visual effects from *one* number, in CSS, not JS.

1. **One var, fed into blur.** `--sf-glow` is a pixel value piped into `drop-shadow(0 0 var(--sf-glow) …)`
   and `box-shadow`. When it's `0px` the shadow is invisible — so a single slider covers "off" through
   "intense" with **zero special-casing** for the off state.
2. **Tie color to the theme, automatically.** `color-mix(in srgb, var(--accent) 85%, transparent)`
   means the glow is always the creator's accent — change the accent, the glow follows, no JS.
3. **Layer shadows for "bloom."** A tight core (`--sf-glow` @100%) plus a wide halo
   (`--sf-glow-strong` @55%) reads as a real glow; one flat blur reads as a drop shadow. Stacking is
   the whole trick.
4. **Derive, don't duplicate.** `--sf-glow-strong = glow * 2.4` is computed once from the input, so
   everything scales together from the single slider. Raising the max (40→80) needed no other change.

**Transferable:** any "intensity" control (glow, blur, opacity, shake) is cleanest as one CSS custom
property consumed in several places, with related magnitudes derived from it.
