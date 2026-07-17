# 144 — Dedicated Themes page

Date: 2026-07-13

## What changed
Templates outgrew being one panel buried in the Customize tab (note 142). Promoted to a **third
top-level tab** in the storefront editor: **Customize · Themes · Links**.

- `SUBTAB_HEADS` map replaces the old two-way ternary for the section heading (`customize ? … : 'Links'`),
  which doesn't survive a third tab.
- The **live preview lives outside the subTab conditionals**, so it stays on screen on the Themes
  tab — click a preset, watch the page change. That's the whole reason this belongs as a tab in the
  editor rather than a separate route.

## Theme cards: real previews, not emoji
Each card now paints the preset's **actual** look instead of an emoji:
- `swatchStyle(theme)` renders the preset's real background (gradient / solid / mode canvas).
- An accent dot + accent bar + muted bar mock a profile card.
- `presetTags(theme)` derives a 3-word summary from the preset itself — "Dark · Stars · Shimmer" —
  so it can never drift from what the preset actually does.

**Bug caught during build:** the muted line used `currentColor`, which inherits `--text` — a dark
line on a dark swatch = invisible. Fixed by setting `color` on the swatch inline from the preset's
own `mode`, so `currentColor` resolves against the swatch's background, not the app's.

## Theme files carry LOOK only (fixes note 142's follow-up)
New `THEME_PORTABLE_EXCLUDE` in `src/lib/storefront.js` — `socials`, `audio_tracks`, `audio_url`,
`banner_url`, `bg_image`, `bg_video`, `cursor_url` are stripped from **both** export and import:
- **socials/music are content, not style.** Importing a theme should never replace your own links
  with the exporter's — that was a real bug in the 142 implementation, since `sanitizeThemeImport`
  whitelisted every `DEFAULT_THEME` key including `socials`.
- **asset URLs would hotlink the exporter's storage** — breaks when they delete it, and bills them
  for your traffic.

`portableTheme(theme)` (export) and the exclusion in `sanitizeThemeImport` (import) share one Set,
so the two directions can't disagree.

**Edge case handled:** a theme with `bg: 'image'` but no `bg_image` (because we never carry it)
would render a blank background — `sanitizeThemeImport` downgrades `image`/`video` → `canvas`.

## Files
- `src/lib/storefront.js` — `THEME_PORTABLE_EXCLUDE`, `portableTheme()`, hardened `sanitizeThemeImport()`
- `src/app-pages/StorefrontEditor.jsx` — Themes tab, theme cards, `swatchStyle`/`presetTags`, CSS

## Idea worth considering
New accounts now land on `/storefront/edit` (note 141) with `subTab` defaulting to `customize` —
20+ controls. Defaulting a **first-time** creator to the Themes tab instead would give instant
gratification (one tap → good-looking page) before asking them to tune anything. Not done; would
need a "has customized before" signal.
