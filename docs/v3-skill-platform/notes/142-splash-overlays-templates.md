# 142 — Splash screen, new overlays, theme templates

Date: 2026-07-13

Three guns.lol-style additions. (3D tilt shipped in the same batch — it has its own folder:
`143-3d-tilt-parallax/`, because it's the one worth studying.)

---

## 1. Splash / click-to-enter

**Theme:** `splash_enabled: false`, `splash_text: 'click to enter'`.

**The insight — it's a bugfix wearing a costume.** Note 139 documented that browsers block audio
autoplay, so site music only started once the visitor happened to click something. A splash screen
*manufactures that click.* Gate the page behind "click to enter" and the browser grants the document
**user activation** — so music starts on enter, reliably, every time.

Implementation is the whole trick in two lines (`Storefront.jsx`):
```jsx
{splashOn && <Splash text={theme.splash_text} onEnter={() => setEntered(true)} />}
{theme.audio_tracks?.length > 0 && !splashOn && <AudioPill tracks={theme.audio_tracks} />}
```
`AudioPill` **mounts after** the click. Its existing `play()`-on-mount then succeeds, because
activation is already granted. No change to AudioPill at all — the fix is purely *when* it mounts.

`splashOn = theme.splash_enabled && !entered`. Splash off → behaves exactly as before.
Keyboard accessible (Enter/Space), `role="button"`, and the pulse respects `prefers-reduced-motion`.

**Transferable:** when a browser policy blocks you, don't fight it — design a UI that satisfies it.

## 2. New overlays: stars · particles · matrix

Extends the existing `overlay` enum (`none|rain|snow|vhs|stars|particles|matrix`) — no new plumbing,
the storefront already renders `<div className={`sf-overlay sf-overlay-${theme.overlay}`} />`.

All three are **pure CSS, zero JS** (same trick as the existing rain):
- **stars** — layered `radial-gradient` dots + one shared opacity twinkle.
- **particles** — accent motes; the tile scrolls by exactly its own height (`-260px`) so the loop is
  seamless. Same seamless-tile trick as `sfRain`'s `-9px 64px`.
- **matrix** — a column grid (`repeating-linear-gradient`) + a falling light band, scrolled one tile.

`stars` uses `--text` so it works on light and dark; `particles`/`matrix` use `--accent`, so they
recolor with the creator's theme for free.

Mirrored in the editor's live preview (`.lp-overlay-*`) at a smaller tile size.

## 3. Templates — presets + import/export

**Presets** (`THEME_PRESETS` in `src/lib/storefront.js`): Midnight Glow · Clean Light · Vaporwave ·
Frosted · Terminal · Sunset. Each is a **partial theme**, applied by merging:
```js
function applyPreset(p) { setTheme(t => ({ ...t, ...p.theme })); }
```
Merging (not replacing) is the important bit — name, bio, avatar, socials, links, products and
uploaded assets all survive. A preset only restyles. Presets explicitly reset `text_color`/
`title_color` to `''` so a previous custom color doesn't fight the new look.

**Export** — `JSON.stringify(theme)` → Blob → download `skilljoy-theme-<handle>.json`.

**Import** — parse the file, then `sanitizeThemeImport()` **whitelists** it: only keys that exist in
`DEFAULT_THEME`, and only when the value's type matches the default's. Unknown/mistyped keys are
dropped. Never spread a parsed file straight into state you're about to persist to a profile row.

## Files
- `src/lib/storefront.js` — splash/tilt defaults, `THEME_PRESETS`, `sanitizeThemeImport`
- `src/app-pages/Storefront.jsx` — `Splash`, splash gating, new overlay CSS
- `src/app-pages/StorefrontEditor.jsx` — Templates panel, splash + overlay controls, preview mirrors

## Gotchas hit
- `resolveTheme` had to move **above** the early returns in `Storefront.jsx` so `useTilt` is called
  unconditionally (rules of hooks). It's safe on a null profile — it falls back to `DEFAULT_THEME`.
- The overlay `Seg` now has 7 options, so `.std-seg` got `flex-wrap:wrap` + `min-width:60px` on
  buttons — otherwise the labels squeeze to nothing.

## Follow-ups
- Splash/tilt aren't simulated in the editor's live preview (control-only, like cursor FX).
- Export includes asset URLs (bg image/video, audio) — importing someone else's theme hotlinks their
  storage. Consider stripping asset keys from export, or copying assets on import.
