# 02 — Storefront UI/UX roadmap

**Status: planned, not started.** Owner: Devv (self-implementing).
Scope: **UI only.** Excludes the AI comms agent (see plan 01).

Candidate features drawn from what guns.lol does that SkillJoy doesn't, filtered
for a product that **sells things** rather than one that's purely a bio-link toy.

---

## Already covered — do not re-add

`DEFAULT_THEME` is at 42 keys. These exist: accent, layout, banner, avatar
(show/shape/size), light/dark mode, bg (canvas/solid/gradient/image/video),
button style, socials, text + title color, card opacity/blur, custom cursor,
mono icons, animated name, product glow/opacity/blur, bio size/weight/glow, glow
enable + intensity, icon glow, name_fx (gradient/rainbow/shimmer/glitch), 7
overlays, audio playlist (+ order, 4-track cap, visitor volume), cursor_fx +
color, profile_fx, group headers, type badges, splash, tilt, location.

**Confirmed absent** (verified by grep, 2026-08-20): favicon, custom fonts,
typewriter/rotating bio, view counter, entrance animations, audio visualizer,
themed scrollbar, per-creator page title, OG/embed customization.

---

## The recipe

Almost every item below is the same four steps (explainer 01 §10):

1. Key + default in `DEFAULT_THEME` (`src/lib/storefront.js`)
2. Read it in `Storefront.jsx` — usually into a `--sf-*` var in `wrapStyle`, or a
   class in `wrapClass`
3. Control in `StorefrontEditor.jsx`, in the right panel
4. **Mirror it in `LivePreview`** — a preview that ignores a setting makes a
   working feature look broken (note 155)

Back-compat rule: read booleans as `key !== false`, never as truthy. Every saved
theme predates your new key and will have it `undefined` (note 155).

---

## Tier 0 — the two already decided

### Accordion / dropdown feed
`group_style: 'open' | 'accordion'`

Cheaper than it looks: `skillGroups` already exists in `Storefront.jsx` (products
bucketed by `group_label`, preserving `sort_order`), and `.sf-grouphead` already
renders title + rule + count pill. You are adding a **render mode**, not
structure.

- Use `<details>` / `<summary>`, not JS state. Keyboard nav, screen readers, and
  browser Ctrl+F "find on page" all work for free; a div-based accordion has to
  reimplement all three and usually reimplements none.
- The existing `.sf-groupcount` pill becomes genuinely informative — it tells you
  what's hidden.
- Decide: does the first group start open? (Yes, probably — an all-collapsed
  storefront looks empty.)

### Section scroll / paged
`scroll_snap: bool`

`scroll-snap-type: y mandatory` on the wrapper + `scroll-snap-align: start` on
`.sf-group`.

⚠️ **Gate it to `@media (pointer: fine)`.** Mandatory snap on mobile fights the
browser's address-bar collapse and reads as a broken/janky page. This is the
single trap in an otherwise trivial feature.

---

## Tier 1 — cheap, high perceived quality

| Feature | Key | Notes |
|---|---|---|
| **Entrance animations** | `entrance_fx` | Stagger fade-up: avatar → name → socials → cards. Highest quality-per-line on this list — a page that *assembles* reads as expensive. `.fade-up` already exists in `App.css`; add `animation-delay` by index. Must respect `prefers-reduced-motion`. |
| **Avatar ring** | `avatar_ring` | Animated conic/gradient border on `.sf-avatar`. guns.lol leans on this hard. Pure CSS. |
| **Bio effects** | `bio_fx: 'none' \| 'typewriter' \| 'rotate'` | Slots into the existing bio group (size/weight/glow). Rotate needs an array of taglines — decide storage shape before building. |
| **Themed scrollbar** | — | `::-webkit-scrollbar-thumb { background: var(--accent) }`. ~10 lines, no key needed. Firefox uses `scrollbar-color`. |
| **Tab identity** | `page_title`, `page_favicon` | Every storefront currently shows "SkillJoy" in the tab. `Seo.jsx` already exists. Favicon needs a `LIMITS` entry (note 159) — small, square, image-only. |

---

## Tier 2 — more work, more differentiating

- **View counter** (`show_view_count`) — **the data already exists.**
  `recordEvent('storefront_view')` fires on every load and `getCreatorEvents`
  reads it. This is a read + a cached count, not a new system. Cache it; do not
  count rows on every public page view.
- **OG / embed customization** (`og_color`, `og_description`) — the card that
  renders when a link is pasted into Discord / iMessage / X. **Commercially the
  highest-leverage item here**, because it is what people see *before* they
  decide to click. `Seo.jsx` is the anchor.
- **Audio visualizer** (`audio_viz`) — Web Audio `AnalyserNode` on the existing
  `<audio>`. Two constraints: same iOS caution as the volume slider (note 162),
  and it's a `requestAnimationFrame` loop, so it must stop when paused and
  respect `prefers-reduced-motion`.
- **Custom fonts** (`font_family`) — already has a "Soon" tile in the General
  panel. Applies via `--font-display`. Subset the Google Fonts request; a full
  family download undoes any perf work elsewhere.
- **Badge row** (`badges: []`) — small chips under the name ("open for work",
  custom text).

---

## Explicitly NOT doing

SkillJoy sells things; guns.lol doesn't. These cost conversion:

1. **Effects that delay content.** Splash is fine — opt-in, and it buys audio
   autoplay via user activation. A 2s intro before a buyer sees a price is not.
2. **More overlays.** Seven exist. Rain variants are noise; the marginal creator
   wants typography and layout control, which is what Tier 1 is.
3. **Anything that grows the bundle carelessly.** Every build already trips the
   500KB chunk warning. Visualizer and custom fonts are the two real-weight items
   — code-split them.

---

## Do this before adding ten more keys

`DEFAULT_THEME` is 42 keys and the **General** panel is where new ones keep
landing. Ten more makes the editor unusable regardless of how good each feature
is — and "the customization page is hard to navigate" was already a complaint
once (note 155).

**Reorganise the editor by what a setting AFFECTS, not by when it was built:**
Name / Avatar / Motion / Audio / Page. The `.std-subgroup` pattern (note 155) is
the tool — a toggle owns its dependent settings, indented under it.

Do this *first*. Retrofitting organisation onto 50 keys is much worse than
onto 42.
