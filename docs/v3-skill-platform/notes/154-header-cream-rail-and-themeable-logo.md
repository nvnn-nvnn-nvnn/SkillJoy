# 154 — Header: cream rail, and a logo that finally tracks the brand

Date: 2026-08-20

## The complaint
After the coral swap (note 151) the header "was all white." True: `.sidebar` was
`background: var(--surface)` — pure `#FFFFFF` — sitting on the `#FBF8F2` cream canvas, with
zero brand anywhere in it.

## The fill: cream, not coral
Chose `--surface-alt` (`#F4F1EA`) over a coral tint. The white rail was the actual mistake:
it made the rail the *figure* and the white cards the *ground*, which is backwards. Cream rail
→ white cards pop, and the brand shows through the logo and the active nav instead of a
tinted slab.

Three things had to move with it:

| what | why |
|---|---|
| `.sb-link:hover` was `var(--surface-alt)` | that is now the rail's own color — hover would have been **invisible**. Flipped to `var(--surface)`, so hovering lifts a white pill off the cream. |
| `.sb-link.active` label was `var(--accent)` | coral on `--accent-light` is **3.1:1** — fails AA at 14.5px/600. Label is now `--text`; coral moved to the icon + a `--accent-mid` inset ring, which also separates the pill from the cream (accent-light alone is barely a shade off it). |
| `.sb-topbar` was `rgb(255 255 255 / 0.9)` | a **hardcoded white bar that stayed white in dark mode**. Now `color-mix(in srgb, var(--surface-alt) 90%, transparent)`. |

## The logo: `src/components/Logo.jsx` (new)
`skilljoy-green.svg` was imported as an `<img>` in three places. Two problems:

1. Flat `#93E9BE` mint — stale the instant the palette left green, and invisible to every
   grep that chases brand hexes because it lives in an asset, not the source.
2. The "Joy" half had **no fill declared at all** → flat black → invisible against the dark
   surface in dark mode. That bug predates the color work.

An external `<img src="*.svg">` cannot inherit page CSS, so no amount of styling fixes it from
outside. Inlined it as a component instead: "Skill" is `fill="var(--accent)"`, "Joy" is
`fill="var(--text)"`. Both halves now track the theme, in light and dark, forever — **the next
brand swap needs no asset work at all.**

Swapped in at `Header.jsx` (desktop rail + mobile topbar), `auth/Login.jsx`, and
`auth/Onboarding.jsx` — every consumer of that asset.

`Footer.jsx` still uses `skilljoy-logo3.svg` (`#ED9147` orange) and `skilljoy-green-White.svg`
(`#93E9BE` + white). Left alone: those are separate variants sitting on their own backgrounds
and need a look decision, not a mechanical swap.

## Transferable
- **A color living in an asset file is a color your brand-swap grep will miss.** Note 151's
  audit found five hardcoded spots in source and still missed the logo entirely, because
  `.svg` wasn't in the search. Single-color marks belong inline as `var(--…)`, not as assets.
- **Changing a container's background invalidates every state that used that same token.**
  The hover fill and the rail became the same color; nothing errors, the state just silently
  stops existing. Grep the token you're assigning before you assign it.

## Files
- `src/components/Logo.jsx` (new) · `src/App.css` · `src/components/Header.jsx` ·
  `src/app-pages/auth/Login.jsx` · `src/app-pages/auth/Onboarding.jsx`
