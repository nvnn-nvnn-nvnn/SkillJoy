# 104 — Title color fix, real brand icons, remove buttons + studio roadmap

_2026-07-08. Bug fixes + the real social logos, plus the recorded roadmap for the
full customization studio._

---

## 1. `title_color` bug (name color wasn't changing) — fixed

The field was half-wired. Three defects:
- Live preview set a **typo'd var** `--lp-bane` (nothing reads it) instead of `--lp-title`.
- `.lp-name` CSS had `var(--lp-title, #5b574e)` **with no `color:` property** → the whole
  declaration was invalid/ignored.
- The **public storefront never applied it at all** (only the editor/preview were touched),
  and the Reset button reset `text_color` instead of `title_color`.

Fixed end-to-end: `DEFAULT_THEME.title_color`; storefront sets `--sf-title` and
`.sf-name { color: var(--sf-title, inherit) }`; preview uses `--lp-title` +
`.lp-name { color: var(--lp-title, inherit) }`; Reset fixed. Title color is separate
from body **text color** (name can differ from bio/muted).

## 2. Real social brand logos ([src/lib/brandIcons.jsx](../../../src/lib/brandIcons.jsx))

**Why they were generic:** the installed `lucide-react` build ships **no brand marks**
(Instagram/TikTok/YouTube/X don't exist as exports — importing them fails the build).
So we can't get them from lucide. Fix: a `BrandIcon` component with **inline SVG
(simple-icons paths, `fill=currentColor`)** for instagram / tiktok / youtube / x, with
website → Globe and unknown → link. No new dependency. Used in both the storefront
socials and the editor's live preview.

## 3. Remove banner / background

Added **Remove banner** and **Remove background** buttons in the Assets panel (they
clear `banner_url` / `bg_image`). Cursor already had a remove.

---

## Roadmap — full customization studio (user spec, 2026-07-08)

Recorded for future passes. What exists ✅ vs to-build 🔲:

**Assets hub:** background image ✅ / video · GIF · live wallpaper 🔲 · audio uploader
+ waveform + player 🔲 · profile picture ✅ (add glow ring 🔲) · custom cursor ✅.

**Profile layout selector:** tabs — Default / Modern / Simplistic / Portfolio 🔲 (big:
needs multiple storefront layout components driven by a `layout_preset` field).

**General:** opacity ✅ · blur ✅ · **profile border** (color / width / radius / animated) 🔲 ·
description bg effects + **typewriter** (speed) 🔲 · username effects (gradient / glow /
animation) — partial (glow via animated_name ✅; gradient/typewriter 🔲) · glass box ✅.

**Color & theme:** accent ✅ · text ✅ · title ✅ · border color 🔲 · **background
tint/overlay** 🔲 · gradient (bg) ✅ · real-time ✅.

**Animations & effects:** mono icons ✅ · animated username ✅ (partial) · hover anim
(cards glow) ✅ · **border animations** 🔲 · **audio volume** 🔲 · more dynamic effects 🔲.

**Widgets / Second tab:** enable a second tab + widgets — YouTube, Spotify, Discord,
Telegram, real-time lyrics, timezone, etc. 🔲 (large: new `widgets` data model + a
widget renderer + editor).

### Suggested build order
1. Profile **border** customization (color/width/radius + animated) — high impact, small.
2. **Background tint/overlay** + border color pickers.
3. **Username gradient / typewriter** effects.
4. **Layout presets** (Default/Modern/Simplistic/Portfolio).
5. **Widgets / second tab** (Spotify/YouTube/Discord…) — biggest, its own initiative.
6. **Audio** (upload + player + waveform) and **video/GIF** backgrounds.

## Status
Build passes.
