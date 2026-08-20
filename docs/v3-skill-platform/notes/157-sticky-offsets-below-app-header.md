# 157 — Save button no longer scrolls under the app header

Date: 2026-08-20

## The bug
The editor's **Save changes** button lives in `.std-top`, a sticky bar:

```css
.std-top { position:sticky; top:12px; z-index:30; }
```

On narrow viewports (≤900px) the app chrome switches from the left rail to `.sb-topbar`:

```css
.sb-topbar { position:sticky; top:0; height:60px; z-index:190; }
```

So the editor bar parked at 12px — **inside** the header's 0–60px band — and lost the z-index
fight 190 vs 30. Scroll down and Save simply vanished behind the header.

## Why "more margin-top" would not have fixed it
Margin moves an element in normal flow. A sticky element leaves flow the moment it pins, and from
then on only its `top` matters. Extra `margin-top` would push it down while unscrolled and it
would slide under the header exactly as before once you scrolled. **The bug is the sticky offset,
not the spacing.**

## The fix
`--app-header-h` published on `body` from `App.css`, alongside `--shell-offset` from note 155:

```css
body { --shell-offset: 0px; --app-header-h: 0px; }
@media (max-width: 900px) {
  body.has-sidebar { --shell-offset: 0px; --app-header-h: 60px; }
}
```

Every sticky offset in the editor now derives from it:

| element | offset |
|---|---|
| `.std-top` (Save + tabs) | `calc(var(--app-header-h, 0px) + 12px)` |
| `.std-sub` (subnav) | `calc(var(--app-header-h, 0px) + 78px)` |
| `.std-preview` | `calc(var(--app-header-h, 0px) + 78px)` |

Desktop is byte-identical — the variable is `0px` there, because nothing sits above the page when
the nav is a left rail. `.std-preview` cannot currently collide (it is `display:none` below
1100px, and the header only exists below 900px) but uses the chain anyway so it stays correct if
that breakpoint ever moves.

Also added `scroll-margin-top` to `.std-top` with the same value, so anchor/programmatic scrolls
land below the header rather than under it.

**Transferable:** when app chrome is `position:fixed`/`sticky`, its height is layout information
the rest of the app needs. Publish it as a CSS variable once; every sticky offset then derives
from it and stays correct across breakpoints. This is the same lesson as `--shell-offset` — that
one was horizontal, this one is vertical.

## Not fixed — same class of bug, elsewhere
`.dd-sidebar` (`DisputeDetail.jsx:458`) and `.gd-sidebar` (`GigDetails.jsx:633`) are both
`position:sticky; top:20px` and neither unsets sticky when its grid collapses. In the viewport
bands where the mobile topbar exists and the grid has not yet gone single-column, they can tuck
under the header the same way. Left alone as out of scope for this ask — the fix is the same
`calc(var(--app-header-h, 0px) + 20px)`.

## Files
- `src/App.css` (`--app-header-h`) · `src/app-pages/StorefrontEditor.jsx`
