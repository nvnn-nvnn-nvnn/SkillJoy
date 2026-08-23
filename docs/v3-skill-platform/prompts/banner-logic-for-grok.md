# Prompt for Grok — SkillJoy storefront banner logic

You are a senior front-end engineer and UI designer. Below is the complete
current implementation of the banner feature on a link-in-bio storefront
product. Critique it and propose concrete improvements. Be specific and
opinionated; point at failure cases I haven't considered.

## Product context

SkillJoy is a link-in-bio / creator storefront (a Stan.store / Linktree
competitor). Each creator gets a public page at `skilljoy.me/@handle`.

The page is a **540px max-width centred column** (`.sf-wrap`, `position:
relative`, `margin: 0 auto`, `padding: 0 18px 96px`). Inside it sits a profile
card (`.sf-panel`) containing avatar, display name, handle, bio, socials, then a
list of products and links.

The creator customizes the page through a theme editor that writes a JSON blob
(`storefront_theme`) on their profile row. Relevant theme keys:

- `banner_url` — uploaded image URL, or empty string
- `banner_style` — `'panel'` | `'cover'`
- `bg` — page background mode: `'canvas' | 'solid' | 'gradient' | 'image' | 'video'`
- `bg_image`, `bg_video`, `bg_color`, `bg_color2`
- `mode` — `'light' | 'dark'` (drives surface/text tokens)
- `card_opacity` — 0 makes the profile card fully transparent ("ghost" mode)
- `profile_fx` — `'none' | 'glow' | 'float'` (float animates the card transform)
- `tilt_enabled` — a wrapper applies a 3D tilt transform on pointer move

**Critical constraint: the page background is user-controlled.** It can be a
flat colour, a gradient, a photo, or a looping video.

## Mode 1 — `banner_style: 'panel'` (original)

A strip inside the profile card, clipped to it.

```css
.sf-panelbanner {
  height: 150px;
  margin: -32px -22px 16px;        /* bleeds to the card's padding edges */
  background: var(--surface-alt) center/cover no-repeat;
  position: relative;
}
.sf-panelbanner::after {           /* darkens the bottom so the avatar reads */
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(20,18,12,.28));
}
.sf-panel-hasbanner .sf-avatar {   /* avatar overlaps up onto the banner */
  margin-top: -58px;
  position: relative;
  z-index: 1;
}
```

## Mode 2 — `banner_style: 'cover'` (new)

Full-bleed across the top of the page, fading out at its lower edge.

```jsx
{theme.banner_url && theme.banner_style === 'cover' && (
  <div className="sf-coverbanner"
       style={{ backgroundImage: `url(${theme.banner_url})` }}
       aria-hidden="true" />
)}
<div ref={tiltRef} className={theme.tilt_enabled ? 'sf-tiltwrap' : undefined}>
  <div className="sf-panel sf-panel-cover"> … </div>
</div>
```

```css
.sf-coverbanner {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);     /* full-bleed breakout from the 540px column */
  width: 100vw;
  height: 340px;
  z-index: 0;
  background: center top/cover no-repeat;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 45%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 0%, #000 45%, transparent 100%);
}
.sf-coverbanner ~ .sf-tiltwrap,
.sf-coverbanner ~ .sf-panel { position: relative; z-index: 1; }

.sf-panel-cover { margin-top: 132px; }   /* card sits down on the image */

@media (max-width: 640px) {
  .sf-coverbanner { height: 240px; }
  .sf-panel-cover { margin-top: 92px; }
}
```

`body { overflow-x: clip; }` absorbs the ~15px overflow that `100vw` causes on
desktop (100vw includes the scrollbar). `clip` rather than `hidden` so `body`
doesn't become a scroll container and break `position: sticky` elsewhere.

## Decisions already made, and why

1. **`mask-image`, not a gradient overlay.** An overlay must fade *into* a known
   colour. The page background is user-controlled (possibly a photo or video),
   so an overlay would smear grey over their image. A mask fades the banner's
   own alpha, so whatever is behind shows through correctly.
2. **Banner is `aria-hidden` + `pointer-events: none`.** Purely decorative; must
   never intercept a click on the avatar or a product card.
3. **Full-bleed via viewport-width breakout**, because the parent is a centred
   540px column and `left:0; right:0` sized it to the column (this was a real
   bug — the "cover" banner rendered only 540px wide).

## What I want from you

1. **Failure cases.** Where does the cover mode break? Consider: very tall or
   very wide source images; a `bg: 'video'` page; `card_opacity: 0` (ghost card
   over a photo banner); `profile_fx: 'float'` and `tilt_enabled` both
   transforming ancestors near a `z-index: 0` sibling; iOS Safari and
   `-webkit-mask-image`; a 4K monitor where `height: 340px` on a `100vw` element
   makes the image look like a thin letterbox strip.
2. **Is the fixed pixel height right?** Should it be aspect-ratio driven, or
   scale with viewport width? What happens to `object-position` / focal point
   when a portrait image is used as a wide cover?
3. **Contrast and legibility.** The display name and avatar sit on top of the
   banner in cover mode. There is currently no scrim and no contrast guarantee —
   a light banner behind dark text in light mode, or vice versa. How would you
   guarantee WCAG AA here without an overlay that fights the mask?
4. **Should the creator control the fade?** Fade height, fade curve, banner
   height, focal point. Which of these actually earn a control, and which are
   better inferred? I want the editor to stay simple.
5. **A third mode worth adding?** e.g. a parallax cover, a blurred-duplicate
   backdrop behind the card, or a banner that scrolls at a different rate.
6. **Simplifications.** Is there a way to get full-bleed without the `100vw` +
   `overflow-x: clip` pair — one that doesn't require a global body rule?

Give concrete CSS. Flag anything above that you think is outright wrong.
