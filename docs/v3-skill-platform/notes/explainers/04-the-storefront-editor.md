# 04 — The storefront editor, feature by feature

_A walkthrough doc. For each major thing the editor can do — background, glow,
overlays, the cursor effect, the splash, the music, the drag-to-order sections —
this explains **the trick that makes it work**, points at the real code, and
names the trap you'd fall into rebuilding it._

Read [01 §6](01-how-the-app-works.md) first if you haven't. That explains the
**engine** (one JSON blob → CSS custom properties → two consumers). This doc
assumes it and goes feature by feature.

Two things live elsewhere on purpose and are not repeated here:
- **3D tilt** has its own build-it-yourself guide with a runnable demo:
  [`../143-3d-tilt-parallax/README.md`](../143-3d-tilt-parallax/README.md).
- **The generic recipe** for adding a new customization key is 01 §10.

Exercises are at the bottom — one per major feature.

---

## 1. The map: two files, one blob, four layers

| Piece | File | Job |
|---|---|---|
| The shape of a theme | [`src/lib/storefront.js`](../../../../src/lib/storefront.js) | `DEFAULT_THEME`, `resolveTheme`, palettes, presets, link CRUD |
| The editor | [`src/app-pages/StorefrontEditor.jsx`](../../../../src/app-pages/StorefrontEditor.jsx) | controls → `theme` state → `<LivePreview>` → one save |
| The public page | [`src/app-pages/Storefront.jsx`](../../../../src/app-pages/Storefront.jsx) | `theme` → CSS variables → `<StoreStyles>` |
| Routes | [`src/main.jsx:118`](../../../../src/main.jsx#L118) `/storefront/edit`, [`:136`](../../../../src/main.jsx#L136) `/:handle` | |

Every visual feature below is *some* combination of: a key in `DEFAULT_THEME`, a
control in the editor, a CSS custom property on the public wrapper, and a rule in
`StoreStyles` that reads that property.

### The render layer stack

The public page is a stack of fixed layers with content floating in normal flow
between them. Knowing the order explains most "why is my effect invisible" bugs:

```
 z 200/190  app shell (sidebar rail / mobile topbar)  ← NOT part of the storefront
 z 100      .sf-splash          click-to-enter gate
 z  60      .sf-fxlayer         cursor particles      ← lives on <body>, see §8
 z  20      .sf-editbtn         owner "Edit" pill
 z   5      .sf-audiodock       music play/volume
 z   1      .sf-panel           profile card (glass)
 z   0      .sf-overlay         rain / snow / stars / matrix …
 z  -1      .sf-bg / .sf-bgvideo   background fill or video
```

Everything from `.sf-panel` down is inside `<div className={wrapClass}>`, which is
where all the CSS variables get pinned
([`Storefront.jsx:113`](../../../../src/app-pages/Storefront.jsx#L113)).
`.sf-fxlayer` is the exception — and that exception is a whole section (§8).

---

## 2. Background — five modes, one element

**Key:** `bg` (`canvas | solid | gradient | image | video`), plus `bg_color`,
`bg_color2`, `bg_image`, `bg_video`.

The whole thing is one ternary chain producing a style object
([`Storefront.jsx:96`](../../../../src/app-pages/Storefront.jsx#L96)):

```js
const bgStyle =
  theme.bg === 'solid'    ? { background: theme.bg_color } :
  theme.bg === 'gradient' ? { background: `linear-gradient(160deg, ${theme.bg_color}, ${theme.bg_color2})` } :
  (theme.bg === 'image' && theme.bg_image) ? { backgroundImage: `url(${theme.bg_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } :
  undefined;
```

Three ideas hide in those five lines:

**1. `undefined` is a real branch.** `canvas` produces *no* inline style, so
`.sf-bg { background: var(--bg); }` wins — and `--bg` comes from the mode palette
(§3). "Canvas" isn't a colour, it's *"don't override the palette."* That's why
switching light↔dark visibly changes a canvas background but not a solid one.

**2. Video can't be a background-image**, so it's a *sibling element*, not a
branch of `bgStyle` — a real `<video autoPlay muted loop playsInline>` pinned at
`zIndex: -1`. `muted` is load-bearing: without it the browser refuses to autoplay
and you get a frozen first frame.

**3. `theme.bg === 'image' && theme.bg_image`** — the mode and the asset are
separate keys, so "image mode with no image uploaded yet" is a reachable state.
Every consumer must handle it or the page renders a blank div over the palette.

There is also a **readability rule** that fires for image/video only:

```css
.sf-has-bgimg .sf-name, .sf-has-bgimg .sf-handle, .sf-has-bgimg .sf-bio {
  text-shadow: 0 1px 14px rgba(0,0,0,.5);
}
```

A photo has unknown luminance under every pixel of text. A solid or gradient
doesn't — the creator picked it and can see the result. So the halo is applied
*only* where the app genuinely cannot predict contrast.

**The banner is not a background.** `banner_url` renders *inside* the profile
panel, pulled edge-to-edge with negative margins (`margin:-32px -22px 16px`) and
clipped by the panel's `overflow:hidden` so its top corners inherit the panel's
radius. That's the standard trick for "full-bleed child inside a rounded box."

---

## 3. Mode palettes, accent, and the two colour overrides

**Keys:** `mode`, `accent`, `text_color`, `title_color`.

`MODE_PALETTES` in [`storefront.js`](../../../../src/lib/storefront.js) is the
single source of truth for eight colours per mode (bg, surface, surfaceAlt, text,
textSecondary, textMuted, border, borderStrong). `StoreStyles` interpolates it
into **both** `.sf-mode-light` and `.sf-mode-dark`:

```js
.sf-mode-light { --bg:${MODE_PALETTES.light.bg}; --surface:${…}; … }
.sf-mode-dark  { --bg:${MODE_PALETTES.dark.bg};  --surface:${…}; … }
```

> **Why pin *both* instead of just overriding dark?** A logged-in visitor may have
> the *app* in dark mode (`data-theme="dark"` on `<html>`, see
> [`src/lib/theme.js`](../../../../src/lib/theme.js)). If the storefront only
> defined the dark case, a light-mode storefront would inherit the visitor's dark
> app variables and render wrong. **The creator's choice must beat the visitor's
> choice on the creator's page**, and the only way to guarantee that is to define
> both sides explicitly at a more specific scope.

`--accent` is set from `theme.accent` and then almost never used raw. It's nearly
always run through `color-mix`:

```css
border-color: color-mix(in srgb, var(--accent) 32%, transparent);
background:   color-mix(in srgb, var(--accent) 10%, var(--sf-item-bg, var(--surface)));
```

That's the accent system in one line: **one creator-picked hex generates an entire
tinted family** — borders at 30%, fills at 10–16%, glows at 55–85% — with no
second colour input and no palette generation code.

`text_color` and `title_color` are *overrides*, and empty string means "don't
override" — note there's no `null` anywhere, because `<input type="color">` can't
represent absence. Setting `text_color` re-derives the whole text ramp:

```js
wrapStyle['--text'] = theme.text_color;
wrapStyle['--text-secondary'] = `color-mix(in srgb, ${theme.text_color} 72%, transparent)`;
wrapStyle['--text-muted']     = `color-mix(in srgb, ${theme.text_color} 50%, transparent)`;
```

One input, three coherent values. If it only set `--text`, the secondary/muted
tiers would still be palette-coloured and the page would look half-themed.

**The unused half:** `contrastRatio()` and `readableOn()` are exported and used
for the themed checkout, but the editor does **not** warn a creator who picks,
say, a near-white accent on a light background. That's a real gap (exercise 3).

---

## 4. Glass — opacity + blur, and why it's `color-mix`, not `opacity`

**Keys:** `card_opacity`, `card_blur` (profile panel) and `product_opacity`,
`product_blur` (cards + link buttons).

```js
'--sf-panel-bg':   `color-mix(in srgb, var(--surface) ${theme.card_opacity ?? 100}%, transparent)`,
'--sf-panel-blur': `${theme.card_blur ?? 0}px`,
```

```css
.sf-panel {
  background: var(--sf-panel-bg, var(--surface));
  backdrop-filter: blur(var(--sf-panel-blur, 0px));
}
```

> **The key decision: fade the *fill*, not the *element*.** `opacity: .7` on
> `.sf-panel` would fade the text, the avatar, the borders and every child with
> it. `color-mix(… var(--surface) 70%, transparent)` produces a translucent
> **background colour** — children stay fully opaque. This is *the* difference
> between "frosted glass" and "the whole card is ghosted."

`backdrop-filter` is what makes it read as glass rather than as a weak tint: it
blurs *whatever is behind the element*, which is only interesting when something
is back there. Hence the editor's hint — _"Lower opacity + more blur = frosted
glass over your background"_ — glass with a plain canvas behind it looks like
nothing at all.

Both are always paired with the `-webkit-` prefix; Safari still needs it.

**Edge case worth copying:** `card_opacity: 0` isn't just "invisible fill." It
adds `.sf-panel-ghost`, which also clears the border and box-shadow:

```jsx
${theme.card_opacity === 0 ? ' sf-panel-ghost' : ''}
```

Without it, a 0%-opacity panel would still show a 1px outline and a drop shadow —
a floating rectangle around nothing. **When a slider hits an endpoint that changes
the *meaning* of the element, the endpoint usually needs its own class.**

The two sliders have different minimums on purpose: the panel goes to 0 (fully
ghost), products stop at 40 (a product card at 0% is an unreadable buy button).

---

## 5. The glow system — one number, layered shadows, and a toggle that remembers

**Keys:** `glow_enabled`, `glow_intensity` (0–80), `icon_glow` (0–60),
`bio_glow` (0–20), `animated_name`, `product_glow` (`none|soft|strong`).

### 5a. One slider drives three layers

The social-icon glow is the clearest example of the pattern:

```css
.sf-social {
  filter:
    drop-shadow(0 0 calc(var(--sf-icon-glow, 10px) * 0.3) color-mix(in srgb, var(--accent) 90%, transparent))
    drop-shadow(0 0 var(--sf-icon-glow, 10px)             color-mix(in srgb, var(--accent) 55%, transparent))
    drop-shadow(0 0 calc(var(--sf-icon-glow, 10px) * 2.2) color-mix(in srgb, var(--accent) 38%, transparent));
}
```

Tight bright core → mid halo → wide faint wash. One number, three stacked
shadows, `calc()` doing the ratios. Real neon has exactly this falloff; a single
`drop-shadow` looks like a sticker with a shadow.

Note **`filter: drop-shadow`, not `box-shadow`** — `box-shadow` glows the element's
*rectangle*. `drop-shadow` glows the rendered alpha, so an SVG icon glows in the
shape of the icon.

The same `--sf-glow` / `--sf-glow-strong` pair (`strong = intensity × 2.4`) feeds
the name, the avatar ring, the panel and the link buttons, which is what makes one
"Glow intensity" slider feel like a coherent whole-page effect.

### 5b. The toggle that doesn't destroy your settings

```js
'--sf-glow': glowOn ? `${theme.glow_intensity ?? 0}px` : '0px',
```

Turning glow off **collapses the variables to `0px`; it never zeroes the stored
values.** Flip it back and the creator's exact 34px/22px settings return. The
editor mirrors this — the sliders unmount from view but their values stay in the
blob.

> **Generalise it:** a master switch should change *how state is read*, not
> *what state is*. Anything that clears values on toggle-off is a data-loss bug
> wearing a UI hat.

Two related subtleties:

**`glow_enabled !== false`, not `!!glow_enabled`.** Themes saved before this key
existed have it `undefined`. `!!undefined` is `false` — every existing store
would have gone dark on deploy. Written as `!== false`, `undefined` means "on,"
which is what those stores looked like. This pattern is used for every
later-added default-on key: `show_avatar`, `show_group_headers`, `show_type_badges`.

**`animated_name` is gated on `glowOn` in the class list, not just in CSS:**

```js
glowOn && theme.animated_name ? 'sf-anim-name' : '',
```

Because `@keyframes sfNameGlow` animates a **hardcoded** `text-shadow: 0 0 18px`.
It doesn't read `--sf-glow`, so collapsing the variable wouldn't stop it. The one
effect that doesn't go through the variable is the one that needs an explicit
gate — **find those before shipping a master switch.**

---

## 6. Name effects — painting text with a gradient

**Key:** `name_fx` (`none|gradient|rainbow|shimmer|glitch`). Applied as a class
on the wrapper (`sf-fx-rainbow`), targeting `.sf-name` inside.

Three of the four are one trick:

```css
.sf-fx-gradient .sf-name, .sf-fx-rainbow .sf-name, .sf-fx-shimmer .sf-name {
  color: transparent;
  background-clip: text; -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sf-fx-rainbow .sf-name {
  background-image: linear-gradient(92deg, #ff2d75, …, #ff2d75);
  background-size: 220% auto;
  animation: sfNameRainbow 4.5s linear infinite;
}
@keyframes sfNameRainbow { to { background-position: 220% center; } }
```

Put a gradient behind the text, clip it to the glyph shapes, make the text itself
transparent. **You animate `background-position`, never the colours** — moving a
background is compositor-cheap; interpolating gradient stops is not.

Two details that are easy to get wrong:
- The rainbow gradient **starts and ends on the same colour** (`#ff2d75`), and
  `background-size` matches the scroll distance (`220%`). Both are required for a
  seamless loop — otherwise it visibly snaps every 4.5s.
- Both `color: transparent` and `-webkit-text-fill-color: transparent` are set.
  WebKit needs the second; other engines use the first.

`glitch` is the odd one out — it's pure `text-shadow` offsets in red/cyan on
`steps(1)` timing, firing only between 88% and 100% of the cycle so it reads as an
occasional artefact rather than a strobe.

Every one of these has a `prefers-reduced-motion: reduce` kill switch.

---

## 7. Overlays — rain, snow, stars, matrix, all in pure CSS

**Key:** `overlay`. One fixed, `pointer-events:none` div at `z-index: 0`, class
`sf-overlay-${theme.overlay}`. **No JS, no particles, no canvas** — every effect
is a repeating background image scrolled by an animation.

The rain is the whole technique in four lines:

```css
.sf-overlay-rain {
  background-image: linear-gradient(107deg, transparent 0 45%, color-mix(…) 47% 51%, transparent 53% 100%);
  background-size: 9px 64px;
  animation: sfRain .55s linear infinite;
}
@keyframes sfRain { to { background-position: -9px 64px; } }
```

> **The seamless-loop rule:** the animation must translate the background by
> **exactly one tile** (`9px × 64px` tile → `-9px, 64px` shift). Land on any other
> number and the pattern jumps at the loop boundary. Every overlay here obeys it —
> snow shifts `220px`, particles `-260px`, matrix `220px`. When you build a new
> one, this is the single thing to get right.

The rest are variations:
- **Snow / stars / particles** — several `radial-gradient` dots at scattered
  percentages inside one tile, then scrolled. Random-looking, zero randomness.
- **Stars** don't move at all; only `opacity` animates, so the whole field twinkles
  together. One animated property for the cheapest possible effect.
- **VHS** is `repeating-linear-gradient` scanlines with `mix-blend-mode: overlay`
  so it *interacts* with the page instead of sitting on top of it.
- **Matrix** layers two backgrounds — a static column grid plus a falling light
  band — with two `background-size` values and two positions in one animation.

Colour sourcing is deliberate: snow/stars/rain mix from `var(--text)` (they must
be visible against the page's own contrast), while particles/matrix mix from
`var(--accent)` (they're brand decoration).

---

## 8. The cursor — two completely different features

This is the one that trips people up, because "cursor" in the editor means **two
unrelated implementations** sharing a panel.

### 8a. `cursor_url` — a custom pointer image. Pure CSS.

```js
if (theme.cursor_url) wrapStyle.cursor = `url(${theme.cursor_url}), auto`;
```

One line. The `, auto` fallback is mandatory — browsers reject a `cursor` value
with no keyword fallback, and reject oversized images, which is why the upload
limit for `cursor` is 1MB (the tightest in `LIMITS`).

### 8b. `cursor_fx` — particle trail / sparkle. Imperative DOM.

[`CursorFx` at `Storefront.jsx:467`](../../../../src/app-pages/Storefront.jsx#L467).
Unlike everything else in this doc, it renders **nothing** (`return null`) and does
all its work in an effect:

```js
const layer = document.createElement('div');
layer.className = 'sf-fxlayer';
layer.style.setProperty('--sf-fx-color', color);
document.body.appendChild(layer);

function onMove(e) {
  const now = performance.now();
  if (now - last < 28) return;                 // ~36 spawns/sec ceiling
  last = now;
  if (layer.childElementCount >= CURSOR_FX_MAX) layer.firstChild?.remove();
  const p = document.createElement('div');
  p.className = `sf-fxp sf-fxp-${kind}`;
  p.style.left = `${e.clientX}px`;
  p.style.top  = `${e.clientY}px`;
  layer.appendChild(p);
  setTimeout(() => p.remove(), 650);
}
```

**Why not React state?** Because you'd be calling `setState` ~36 times a second
with an array of ephemeral particles, re-reconciling the entire storefront on
every mouse move. Particles have no semantics, no interactivity, and a 650ms
lifetime — **React's job is state that matters, and this isn't it.** Raw DOM nodes
plus a CSS animation is both simpler and an order of magnitude cheaper.

Three defences make it safe:

| Defence | What it is | Prevents |
|---|---|---|
| `now - last < 28` | spawn throttle | one node per mousemove event (hundreds/sec) |
| `childElementCount >= CURSOR_FX_MAX` | hard cap of 24 | unbounded growth if timers lag |
| `layer.remove()` in cleanup | unmount teardown | orphaned layer + listener on navigate |

Belt *and* braces: each particle also self-removes after 650ms, matching the CSS
animation duration. If those two numbers drift apart you get either flickering
(timer shorter) or a growing pile of invisible nodes (timer longer).

> ### ⚠️ The landmine: the layer escapes your theme
> ```js
> // The layer lives on <body>, OUTSIDE the storefront wrapper — so the
> // creator's pinned --accent doesn't reach it. Pin the color here instead.
> layer.style.setProperty('--sf-fx-color', color);
> ```
> `--accent` is set on `.sf-wrap`. CSS variables inherit down the **DOM tree**, and
> `document.body.appendChild` puts the layer *outside* that subtree. So
> `background: var(--accent)` inside `.sf-fxp` would resolve to the *app's* accent,
> not the creator's — the particles would silently be the wrong colour on every
> themed page.
>
> The fix is to pass the resolved colour in and pin it on the layer itself. That
> is also exactly what made `cursor_fx_color` (an independent particle colour)
> possible for free — the component already took a `color` prop:
> ```jsx
> <CursorFx kind={theme.cursor_fx} color={theme.cursor_fx_color || theme.accent} />
> ```
> `'' || theme.accent` is the "unset means follow the accent" idiom used for
> `text_color` and `title_color` too.
>
> **This applies to anything portalled to `<body>`** — modals, tooltips, toasts.
> If it isn't inside the themed wrapper, it doesn't get the theme.

Note the effect's dependency array is `[kind, color]`: changing either tears the
whole layer down and rebuilds it. Correct, and cheap, because there's no state to
preserve.

**Not simulated in the preview** — deliberately. The comment says so:
`{/* Cursor FX (cursor_fx) intentionally NOT simulated in the preview */}`. A
small preview pane can't meaningfully show a viewport-wide pointer trail.

---

## 9. 3D tilt — JS does math, CSS does the transform

**Keys:** `tilt_enabled`, `tilt_max`. Hook:
[`useTilt` at `Storefront.jsx:426`](../../../../src/app-pages/Storefront.jsx#L426).

Full teaching guide with a runnable demo:
[`../143-3d-tilt-parallax/README.md`](../143-3d-tilt-parallax/README.md). The
one-paragraph version: normalise the pointer to 0→1 inside the element, recentre
to −1→1, scale to degrees, write `--tilt-x` / `--tilt-y`, and let CSS own the
`transform`. Writes are throttled to one per frame with `requestAnimationFrame`.

Two things specific to how it's wired *here*:

**The hook is called before the early returns.**
```js
const theme = resolveTheme(state.profile?.storefront_theme);
const tiltRef = useTilt(state.status === 'ready' && theme.tilt_enabled, theme.tilt_max);
```
`Storefront` returns early for `loading` and `notfound`. A hook after those returns
would violate the rules of hooks, so both `resolveTheme` and `useTilt` run
unconditionally — which is safe precisely because `resolveTheme(undefined)` returns
`DEFAULT_THEME`. **`resolveTheme` being total is what makes the hook ordering legal.**

**Tilt gets its own wrapper element:**
```jsx
<div ref={tiltRef} className={theme.tilt_enabled ? 'sf-tiltwrap' : undefined}>
  <div className="sf-panel … sf-pfx-float">
```
> `.sf-pfx-float` already animates the panel's `transform`. Two rules cannot own
> one property — the animation would simply win and tilt would do nothing. Giving
> each effect its own element in the tree is the general fix for *any* two features
> that both want `transform`.

---

## 10. Splash — a vibe that solves a technical problem

**Keys:** `splash_enabled`, `splash_text`. Component at
[`Storefront.jsx:406`](../../../../src/app-pages/Storefront.jsx#L406).

State is one boolean in the page: `const [entered, setEntered] = useState(false)`,
and `const splashOn = theme.splash_enabled && !entered`.

The interesting part isn't the gate, it's the ordering:

```jsx
{splashOn && <Splash text={theme.splash_text} onEnter={() => setEntered(true)} />}
{theme.audio_tracks?.length > 0 && !splashOn && <AudioPill tracks={theme.audio_tracks} />}
```

> **The click buys "user activation."** Browsers block audio autoplay until the
> visitor has interacted with the document. `AudioPill` is **not rendered** while
> the splash is up, so its mount-time `play()` happens *after* a real click — and
> succeeds. A "click to enter" screen is the most reliable autoplay unlock there
> is, and it's the reason the editor's hint reads _"also lets your music autoplay."_

Accessibility is hand-rolled because it's a `<div>`, not a button:
`role="button"`, `tabIndex={0}`, and an `onKeyDown` handling both `Enter` and
`Space` (with `preventDefault()` on Space, or the page scrolls underneath).

### The centring landmine

```css
.sf-splash { position:fixed; top:var(--app-header-h, 0px); right:0; bottom:0; left:var(--shell-offset, 0px); }
```

Not `inset: 0`. A logged-in visitor has the app shell on screen — a **248px
sidebar rail** on desktop, or a **60px top bar** on mobile
([`App.css:306`](../../../../src/App.css#L306)) — and those paint *over* the
splash (z-index 190/200 vs 100). A viewport-sized fixed layer centres its text
against space the visitor cannot see: ~124px too far left on desktop, ~30px too
high on mobile.

**Centring only works if your box matches what is actually visible.** `.sf-loading`
uses the identical offset chain so the spinner and the gate agree on where centre is.

And a second, subtler centring bug, fixed in the CSS:

```css
.sf-splash-text { text-align:center; max-width:min(32ch, 84vw); margin-right:-.24em; }
```

- `text-align:center` — flex centres the **box**; with no `text-align` the wrapped
  lines *inside* that box sit flush left. Creator text is up to 40 chars at 14px
  uppercase with `.24em` tracking, so it wraps on any phone.
- `margin-right:-.24em` — `letter-spacing` adds space after the **last** glyph of
  every line, so centred tracked text optically sits half a space left of centre.
  Cancel it with a negative margin equal to the tracking.

---

## 11. Site music — one `<audio>`, a playlist, and a volume probe

**Keys:** `audio_tracks: [{url, name}]` (max 4, `MAX_AUDIO_TRACKS`), plus a
deprecated `audio_url`. Component:
[`AudioPill` at `Storefront.jsx:289`](../../../../src/app-pages/Storefront.jsx#L289).

### The architecture in one sentence

React renders **one** `<audio ref>` element, the playlist index is state, and the
button's icon is driven by the element's **real** `onPlay`/`onPause` events.

```jsx
<audio ref={audioRef} src={current?.url} loop={single} onEnded={onEnded}
       onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
```

> **Never track playback with your own boolean.** If `toggle()` set
> `setPlaying(true)` directly, the icon would lie the moment the browser blocked
> playback, the track errored, or the OS paused it. Derive UI state from the
> element's events and it *cannot* desync.

`new Audio()` in an effect would also work — and would double-instantiate under
React StrictMode, leaking a second player. Letting React own the element avoids it.

### Single track vs playlist

```jsx
loop={single}                                    // 1 track → the browser loops it
function onEnded() {
  if (single) return;
  setIdx(i => (i + 1) % tracks.length);          // N tracks → advance and wrap
}
```

Two mechanisms because they're genuinely different problems: the browser can loop
one file natively; wrapping a list needs the app.

A separate effect resumes playback when `idx` changes, guarded by a `didMount`
ref so it doesn't fight the autoplay logic on the first render.

### Autoplay, and not undoing the user

```js
a.play().catch(() => {
  if (cancelled || interacted.current) return;   // blocked → wait for a gesture
  window.addEventListener('pointerdown', start);
  window.addEventListener('keydown', start);
});
```

Try to autoplay; if the promise rejects, arm one-shot global listeners to start on
the first interaction. The `interacted` **ref** is the important bit: clicking the
pill sets it on `pointerdown`, which fires *before* the window listener sees the
same click. So if the visitor deliberately pauses, the auto-starter never
resurrects it. **A ref, not state — this must be readable synchronously inside a
listener and must not trigger a render.**

### Volume: a probe, not an assumption

```js
const probe = a.volume === 0.5 ? 0.4 : 0.5;
a.volume = probe;
setCanSetVolume(a.volume === probe);   // did the write stick?
a.volume = startVolume;
```

iOS Safari **ignores** `volume` on media elements entirely (system volume only) —
the assignment is a silent no-op with no feature flag to detect it. So the code
writes a value and reads it back. If it didn't stick, the slider isn't rendered at
all. **A control that does nothing is worse than no control.**

Volume persists in `localStorage` under `sj-site-volume`, deliberately **not**
namespaced per creator — "how loud I want site music" is a property of the person,
not of whose page they're on. Every read/write is wrapped in `try/catch` because
Safari private mode *throws* on `localStorage` rather than returning null.

### Two more details worth stealing

- **`volume` is a DOM property, not an HTML attribute.** `<audio volume={0.85}>`
  is silently dropped and the element stays at 1. It must be assigned to the
  element (`a.volume = …`, or a `ref` callback — which is how the editor's track
  previews do it). Hence `SITE_AUDIO_VOLUME` being exported and used in both files.
- **The editor's track list is keyed by `tr.url`, not by index.** With an index
  key, reordering would keep each `<audio>` DOM node in place and just swap its
  `src` — a playing preview would jump to a different song. A stable key moves the
  actual node.

The 4-track cap is a **product** decision, not a technical one, enforced in the
editor before the upload even starts (no point spending a round trip and a storage
object on a track that can't be added). It's a guardrail on the creator's own page,
not a security boundary — the theme is a JSON blob the client writes.

---

## 12. Uploads — one funnel, two layers of limit

Five different uploads (avatar, banner, background image, background video,
cursor) all go through one function
([`StorefrontEditor.jsx:237`](../../../../src/app-pages/StorefrontEditor.jsx#L237)):

```js
async function uploadTo(file, setBusy, apply, uploader = uploadBanner, kind = 'banner') {
  if (!file) return;
  const check = validateUpload(kind, file);
  if (!check.ok) { setErr(check.error); return; }
  setBusy(true);
  try { const url = await uploader(user.id, file); apply(url); }
  catch (e) { setErr(e.message); }
  finally { setBusy(false); }
}
```

Each caller supplies only what differs — which busy flag, what to do with the URL,
which uploader, which rule in `LIMITS`:

```js
const onCursor  = (e) => uploadTo(e.target.files?.[0], setSavingCursor, (url) => set({ cursor_url: url }), uploadBanner, 'cursor');
const onBgVideo = (e) => uploadTo(e.target.files?.[0], setSavingBgVideo, (url) => set({ bg_video: url, bg: 'video' }), uploadBgVideo, 'bgVideo');
```

Note `onBgVideo` sets **two** keys — uploading a video also switches `bg` to
`'video'`, because nobody uploads a background video and then wants to hunt for
the mode switch.

`onAudioAdd` deliberately does *not* use the funnel: it **appends to an array**
rather than replacing a value, and it has a cap check before the type check. When
a caller's shape genuinely differs, forking is honest; bending the funnel to fit
it would make the funnel worse for the five that do fit.

> **Two limit layers, and you need both**
> ([`src/lib/uploadLimits.js`](../../../../src/lib/uploadLimits.js)):
> - **`LIMITS` in the browser** — instant, specific, human feedback *before* any
>   bytes move. **This is UX, not security** — anyone can call the Supabase storage
>   API directly with their own anon key.
> - **`file_size_limit` on the bucket** (migration `027_upload_limits.sql`) — the
>   authoritative limit, unbypassable, but produces a generic opaque error.
>
> If you change a number in one place, change it in the other or they drift.

`validateUpload` returns `{ok:false, error}` rather than throwing, because every
caller wants to *render* the message, not catch it. Type is checked before size —
"that's not an image" is more useful than "that's too big" when someone picked the
wrong file entirely.

---

## 13. The live preview — a deliberate second implementation

[`LivePreview` at `StorefrontEditor.jsx:87`](../../../../src/app-pages/StorefrontEditor.jsx#L87)
is **not** the real `Storefront` component in a box. It's a parallel mini
implementation: `lp-` classes, `--lp-*` variables, its own copy of every overlay
keyframe, its own name-effect rules.

**Why not just render `<Storefront>` scaled down?** Because `Storefront` fetches by
`useParams()` handle, records metrics, injects tracking pixels, mounts real audio,
and pins `position: fixed` layers to the viewport. Every one of those is wrong
inside a ~400px editor pane. Reusing it would mean threading a `preview` prop
through all of them — and a component with a "pretend" mode is a component with two
behaviours to keep correct.

The cost is real and worth being honest about: **two implementations that must be
kept in sync by hand.** Where they intentionally differ, it's scaled:

```js
'--lp-avatar-size': `${Math.round((theme.avatar_size ?? 96) * 0.7)}px`,  // ~70% scale
'--lp-glow':        glowOn ? `${(theme.glow_intensity ?? 0) * 0.65}px` : '0px',
'--lp-icon-glow':   glowOn ? `${(theme.icon_glow ?? 10) * 0.65}px` : '0px',
```

A 60px glow in a small pane would swallow the whole preview, so it scales
*effects*, not just sizes. That's the difference between a *thumbnail* and a
*faithful* preview.

Three things it copies exactly, and must:
- `glow_enabled !== false` — if the preview ignored it, the toggle would look
  broken until you opened the live page.
- The `card_opacity === 0 → lp-ghost` endpoint class.
- The links-inside-the-profile-panel placement.

Three things it deliberately skips: cursor FX (§8), the splash gate, and the tilt
hook — all viewport-scale effects with no meaning in a small pane.

> **One real drift risk to know about:** `.lp-mode-dark` hardcodes `#1b1c20` /
> `#121316` instead of interpolating `MODE_PALETTES` the way `StoreStyles` does.
> They match today because they were copied. Nothing keeps them matching. (Exercise 8.)

---

## 14. Presets, export, import — three flavours of merge

### Presets merge, they don't replace

```js
function applyPreset(p) { setTheme(t => ({ ...t, ...p.theme })); }
```

Every entry in `THEME_PRESETS` is a **partial** theme. Spreading it over the
current one means the creator's name, bio, avatar, socials, links, products and
uploaded assets all survive — a preset restyles, it never resets. That single spread
is the entire feature.

The preset cards preview the *actual* look rather than an emoji: `swatchStyle()`
paints the preset's real background, a dot shows its accent, and `presetTags()`
generates a three-word summary (`"Dark · Stars · Shimmer"`) by inspecting the
partial. So adding a preset to the array is genuinely all you have to do — the card
builds itself.

Note the presets explicitly set `text_color: ''` and `title_color: ''`. Without
that, a creator's leftover custom text colour would survive into a preset designed
around the palette and look broken. **A partial merge means you must explicitly
clear anything your look assumes is default.**

### Export strips content

```js
const THEME_PORTABLE_EXCLUDE = new Set([
  'socials', 'audio_tracks', 'audio_url',
  'banner_url', 'bg_image', 'bg_video', 'cursor_url',
]);
```

A theme file carries **look, never content or assets**, for two separate reasons:
socials and music are someone's *identity*, not styling; and asset URLs would
hotlink the exporter's storage — breaking when they delete the file, and billing
them for someone else's page views.

### Import whitelists, it doesn't validate

```js
for (const key of Object.keys(DEFAULT_THEME)) {     // iterate OUR keys, not theirs
  if (THEME_PORTABLE_EXCLUDE.has(key)) continue;
  if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
  const def = DEFAULT_THEME[key];
  if (Array.isArray(def)) { if (Array.isArray(val)) out[key] = val; continue; }
  if (typeof def === typeof val) out[key] = val;    // shape must match the default
}
```

> **Iterate over your own schema, never over the input.** Looping
> `Object.keys(raw)` with a blocklist means any key you forget to block gets
> written into the profile row. Looping `Object.keys(DEFAULT_THEME)` means an
> unknown key is *structurally impossible* to import. Same idea as an allowlist
> firewall rule.

Type-matching against the default's `typeof` is a cheap, decent shape check. It's
not exhaustive — a hand-edited file can still set `glow_intensity: 99999` — but
this is the creator's own page, so the failure mode is "your page looks silly,"
not "you compromised something."

The final touch is a UX repair, not a security one:

```js
if (out.bg === 'image' || out.bg === 'video') out.bg = 'canvas';
```

The importer has no `bg_image` (it's excluded), so image mode would render a blank
div. Fall back to something that looks intentional.

---

## 15. Sections & product order — a feature with no table

**The core trick:** a "section" is just a distinct `group_label` across the
creator's products. There is **no sections table, no sections column, no sections
API.**

```js
const sections = (() => {
  const map = new Map();
  for (const s of skills) { const k = lbl(s); if (!map.has(k)) map.set(k, []); map.get(k).push(s); }
  for (const name of extraSections) if (!map.has(name)) map.set(name, []);
  return [...map.entries()].map(([label, items]) => ({ label, items }));
})();
```

- **Section order is derived from product order.** `Map` preserves insertion order,
  and `skills` is sorted by `sort_order`, so first-seen label wins. The public page
  buckets products with the *identical* loop
  ([`Storefront.jsx:81`](../../../../src/app-pages/Storefront.jsx#L81)) — **the
  editor literally cannot disagree with the page**, because both derive from the
  same ordering rather than storing an order separately.
- **Renaming a section** = re-labelling every product in it (`Promise.all` of
  `updateSkill`).
- **Deleting a section** = setting those products' labels to `null`. Nothing is
  destroyed; they fall into Ungrouped. The button says "Remove section" for that
  reason.
- **`''` is a real section** — the anonymous bucket, rendered as "Ungrouped" in the
  editor and with no heading on the page.

**`extraSections` is the one piece of state this design forces.** A section with no
products has no rows to derive from, so it cannot exist in the database. It's
tracked in local state until something is dropped into it, then removed:

```js
setExtraSections(xs => xs.filter(x => x !== targetLabel));  // it has a product now
```

Consequence worth knowing: **an empty section does not survive a page refresh.**
That's inherent to derive-don't-store, and it's the price you pay for the editor
never drifting from the page.

### Drag and drop, with two fallbacks

Native HTML5 DnD, no library. Two drop targets with different meanings:

| Drop on | Handler | Meaning |
|---|---|---|
| a `.std-sec` (section body) | `moveSkillTo(dragId, sec.label)` | append to this section |
| a `.std-orderrow` (product) | `moveSkillTo(dragId, sec.label, s.id)` | insert *before* this product |

The row's handlers call `e.stopPropagation()` so a drop on a product doesn't also
fire the section's handler — the inner target is more specific and must win.

`moveSkillTo` rebuilds the whole ordered array, sets state **optimistically**, then
persists label + order. The "no anchor" branch is subtle:

```js
const last = rest.map(lbl).lastIndexOf(targetLabel);
next = last < 0 ? [...rest, updated] : [...rest.slice(0, last + 1), updated, ...rest.slice(last + 1)];
```

Insert after the section's *last* member, not at the array end — because section
order is derived from position, a non-contiguous section would silently split into
two sections with the same name.

> **Drag reaches neither touch nor keyboard.** So every drag action has a
> non-drag equivalent: a `<select>` per row for "which section," and ▲▼ buttons
> (`nudge`) for ordering. This isn't polish — HTML5 DnD simply does not fire on
> touch, so without these the feature is unusable on a phone.

One more detail: the section-name input is **uncontrolled** (`defaultValue`) and
saves on `blur`, with `key={sec.label}` so an external rename re-seeds it.
Controlled + save-on-change would fire an `updateSkill` per keystroke.

---

## 16. Link buttons — the one part that isn't in the blob

`store_links` is a real table with real CRUD in
[`storefront.js`](../../../../src/lib/storefront.js): `listLinks`, `addLink`,
`updateLink`, `deleteLink`, `reorderLinks`. Why a table and not theme keys? Links
are **rows** — they're created, deleted, reordered, and will eventually need
per-row columns (cover, description, CTA). The theme blob is for *settings*.

That difference shows up in the save model, which is genuinely different from the
rest of the editor:

| | Theme keys | Links |
|---|---|---|
| Edit | mutates local state | mutates local state |
| Persist | on **Save changes** | **immediately**, per field |

`patchLinkLocal(id, patch)` updates the list; `saveLink(id, patch)` writes to the
DB — text inputs on `blur`, checkbox and segmented control on `change` (a segmented
control has no blur moment). Deletion is optimistic: the row disappears, then the
delete fires.

Two things in `listLinks` are load-bearing:

```js
.select('id, label, url, position, is_affiliate, placement, description, cover_url, cta_label, group_label')
.order('position', { ascending: true })
.order('created_at', { ascending: true })
```

- **An explicit column list** means a new column arrives as `undefined` in the UI
  with no error anywhere. New columns must be added in both the migration and here.
- **`created_at` is a tiebreaker, not decoration.** `createLink` sets
  `position: links.length`, so a delete-then-add produces duplicate positions — and
  Postgres may return equal sort keys in *any* order, which shows up as the list
  visibly reshuffling between page loads.

Affiliate links get both halves of a disclosure: `rel="sponsored"` (a crawler hint
only) **and** a visible "Affiliate" tag. An affiliate relationship has to be
disclosed to the *reader*, not just to Google.

> **A half-built seam, on purpose:** `placement` (`profile | products`) is in the
> schema (migration 029, [note 164](../164-link-placement-schema-and-select.md))
> and has a working editor control — but grep `placement` in `Storefront.jsx` and
> you'll find nothing. The public page still renders every link inside the profile
> panel. The control saves a value the page ignores. That's exercise 9.

---

## 17. Save — one write, and what isn't in it

```js
const themeToSave = { ...theme, audio_tracks: tracks, audio_url: tracks[0]?.url || '' };
const patch = {
  bio: bio.trim(), storefront_theme: themeToSave,
  full_name: name.trim() || profile.full_name,
  location: location.trim() || null,
  avatar_url: avatarUrl || null,
  tracking_pixels: Object.keys(tp).length ? tp : null,
  automation_webhook_url: webhookUrl.trim() || null,
};
await updateStorefront(user.id, patch);
setProfile({ ...profile, ...patch });
```

Every visual setting is one JSONB column, so adding a feature adds **zero** to this
function. What is *not* in the blob, and why:

| Field | Column | Why not the blob |
|---|---|---|
| `bio`, `full_name`, `avatar_url`, `location` | own columns | queried, indexed, and shown *outside* the storefront (discover, cards, SEO) |
| link buttons | `store_links` rows | rows, not settings (§16) |
| product order & sections | `skills.sort_order` / `group_label` | belongs to the product |
| uploaded files | Supabase storage | the blob holds the **URL**, never the bytes |

`audio_url` is written on every save purely to keep the deprecated single-track
field pointed at track 1, so anything still reading it stays correct. The mirror
image lives in `resolveTheme`, which promotes a legacy `audio_url` into a one-item
`audio_tracks` playlist on read. **Write-side and read-side back-compat are two
separate jobs and you usually need both.**

`setProfile({ ...profile, ...patch })` afterwards keeps the cached profile in sync
so navigating away and back doesn't show stale data.

---

## 18. Landmine index

Every one of these is a bug that actually happened here.

| # | Landmine | Where it bit |
|---|---|---|
| 1 | Portalled elements escape your CSS variables | cursor FX layer on `<body>` (§8) |
| 2 | Two rules can't own one property | tilt vs float, both wanting `transform` (§9) |
| 3 | `!!undefined === false` breaks default-on keys | `glow_enabled`, `show_avatar` (§5b) |
| 4 | A hardcoded animation ignores your variables | `sfNameGlow`'s 18px shadow (§5b) |
| 5 | `opacity` fades children; `color-mix` fades the fill | glass panels (§4) |
| 6 | Fixed layers must match the *visible* box | splash centring vs the app rail (§10) |
| 7 | `letter-spacing` breaks optical centring | splash text `margin-right:-.24em` (§10) |
| 8 | `volume` is a property, not an attribute | site music (§11) |
| 9 | Index keys swap `src` instead of moving nodes | playlist reorder (§11) |
| 10 | Equal sort keys → nondeterministic row order | `store_links.position` (§16) |
| 11 | Explicit `.select()` lists silently drop new columns | `listLinks` (§16) |
| 12 | Browser-side limits are UX, not security | `LIMITS` vs bucket `file_size_limit` (§12) |
| 13 | Blocklist-style imports leak unknown keys | `sanitizeThemeImport` (§14) |
| 14 | Background loops must shift by exactly one tile | every overlay (§7) |
| 15 | `App.css` styles bare `<button>`s as nowrap pills | any custom button in either file |

---

# Exercises

Do these in order-ish; the later ones assume the earlier ones. Each names what to
build, a hint about where the same shape already exists, and how to know you're done.

---

**1. Add a new overlay: `bubbles`** *(warm-up — the full add-a-feature loop)*

Add a seventh option to `overlay`: slow accent-coloured circles drifting upward.

*Do:* add the `<Seg>` option in the General panel, the `.sf-overlay-bubbles` rule
in `StoreStyles`, and the `.lp-overlay-bubbles` mirror in the editor's styles.
*Hint:* start from `.sf-overlay-particles` — same structure, bigger radii, add a
ring (`radial-gradient` with a transparent centre) instead of a filled dot.
*Verify:* watch the loop boundary for 30 seconds full-screen. If you see a jump,
your `@keyframes` shift doesn't equal your `background-size` height (§7). Then check
the preview pane animates too — if it doesn't, you added one rule and forgot the mirror.

---

**2. Make the cursor trail fade through two colours** *(the portal trap, on purpose)*

Right now particles are one colour. Give the trail a start and end colour so each
particle fades from `cursor_fx_color` toward the accent as it dies.

*Do:* add a `cursor_fx_color2` key, a second colour row in the editor, and pass it
to `<CursorFx>`.
*The trap:* your first instinct will be to write `var(--accent)` in the
`.sf-fxp-trail` rule. **It will resolve to the wrong colour** and you may not notice
if your test store's accent happens to match the app's. Re-read §8 before you debug it.
*Verify:* set a storefront accent that is nothing like the default coral, leave
`cursor_fx_color` empty, and confirm the particles follow the *creator's* accent.
*Then think:* should `''` for colour2 mean "no fade" or "fade to accent"? Whichever
you pick, make the reset button and the default agree.

---

**3. Warn on unreadable colour combinations** *(use the code that's already there)*

`contrastRatio()` and `readableOn()` are exported from `storefront.js` and the
editor never calls them. A creator can currently pick the near-white accent — it's
in `ACCENT_PRESETS` — and their handle becomes invisible on a light background.

*Do:* under the Accent field, show an inline warning when the accent's contrast
against the current mode's `MODE_PALETTES[mode].bg` drops below 3:1.
*Think about:* warn or block? Which pairs actually matter — accent-on-bg,
text-on-bg, title-on-bg? A creator using accent only for a *glow* doesn't care about
text contrast at all, so a warning on every low-contrast accent is noise.
*Verify:* pick the near-white swatch in light mode (warns) and in dark mode (doesn't).
*Stretch:* put the warning in the preview pane instead — closer to the thing it describes.

---

**4. Give the splash a second style** *(state, not just CSS)*

Add `splash_style` (`fade | typewriter`). Typewriter reveals `splash_text` one
character at a time before the "click to enter" pulse begins.

*Hint:* this needs real state inside `Splash` — a `useState` index and an interval.
Clean the interval up on unmount.
*Constraints:* the gate must still be clickable from character one (someone in a
hurry shouldn't have to wait), and `prefers-reduced-motion: reduce` must render the
full text instantly.
*Verify:* enable reduced motion in your OS and confirm you get the whole string with
no animation. Then check the click still unlocks audio autoplay (§10) — if you moved
the `AudioPill` mount, you broke the one thing the splash is actually for.

---

**5. Preview the background *video* correctly** *(a bug hunt)*

The preview renders `<video className="lp-bgvideo">` for `bg === 'video'`. Upload a
background video, then toggle `bg` back and forth between `video` and `gradient`
several times while watching the preview pane and your CPU.

*Find:* does the element unmount, or does React keep a paused video decoding? What
happens with a file at the `LIMITS.bgVideo` max in a ~400px pane?
*Do:* whatever your findings justify — a `key` to force remount, `preload="none"`,
a poster frame, or pausing when it's off-screen.
*Verify:* the browser's task manager, not vibes. Record the number before and after.
*Then think:* the live storefront has the same element at full size. Does your fix
belong there too?

---

**6. Persist empty sections** *(the design tradeoff, made explicit)*

Create a section, don't drop anything in it, refresh. It's gone (§15) —
`extraSections` is local state and an empty section has no rows to derive from.

*Do:* make it survive. There are at least three ways, and they are not equal:
 - (a) a `section_order: string[]` key in the theme blob,
 - (b) a real `store_sections` table,
 - (c) accept it and remove the "Add section" button, forcing rename-on-drop.

*Pick one and write down why in a note before coding.* Then ask the question that
decides it: if sections become stored, **what happens when stored order and derived
product order disagree?** Today that's unrepresentable. Options (a) and (b) both make
it representable — so you now own a reconciliation rule that doesn't currently exist.
*Verify:* create an empty section, refresh, drag a product in, drag it back out. The
section should behave the same at every step.

---

**7. Two-finger friendly reordering** *(accessibility, real)*

The ▲▼ `nudge` buttons move a product one slot in the **global** `skills` array — so
a product at the top of section B moves *into* section A without its `group_label`
changing. Try it: the row jumps sections visually on the next render.

*Do:* make `nudge` section-aware — moving within a section reorders inside it;
moving past the edge either stops, or moves to the adjacent section *and* updates the
label. Decide which, deliberately.
*Hint:* `moveSkillTo` already knows how to insert before an anchor. You may be able
to express `nudge` in terms of it rather than writing new ordering logic.
*Verify:* with three sections and two products each, every ▲▼ press must leave the
editor and the public page in agreement. Open `/@yourhandle` in a second tab and
refresh after each press.

---

**8. Kill the palette drift in the preview** *(refactor, small and satisfying)*

`.lp-mode-dark` hardcodes `#1b1c20` and `#121316`; `StoreStyles` interpolates
`MODE_PALETTES`. They match by copy, not by construction (§13).

*Do:* make the preview interpolate `MODE_PALETTES` too, and add a `.lp-mode-light`
block rather than leaning on `.lp` defaults.
*Verify the refactor honestly:* change `MODE_PALETTES.dark.surface` to something
lurid like `#ff00ff`, reload, and confirm **both** the preview and the live page turn
lurid. Then change it back. If only one changed, you didn't finish.
*Then:* grep for other hardcoded copies of those hexes. The themed checkout claims to
consume the constant — check that it actually does.

---

**9. Ship link `placement`** *(the real one — a half-built feature)*

`placement` is in the schema, `listLinks` selects it, and the editor writes it.
`Storefront.jsx` ignores it entirely (§16). A creator can set "Featured" today and
nothing happens.

*Do:* render `placement === 'products'` links **below** the profile panel, in the
products area, as cards — using `description`, `cover_url` and `cta_label`, which are
all already columns and all currently unused.
*Read first:* [`03-build-a-link-product-module.md`](03-build-a-link-product-module.md)
is the design doc for exactly this. It gives you the decisions and the traps and no
finished code. This exercise is "now actually build it."
*Traps to expect:* `group_label` exists on `store_links` too — should a featured link
be able to sit inside a product section? If yes, the bucketing loop in
[`Storefront.jsx:81`](../../../../src/app-pages/Storefront.jsx#L81) has to merge two
differently-shaped lists with two independent ordering columns (`position` vs
`sort_order`). That is the hard part, and it is the whole point of the exercise.
*Verify:* a link set to Featured appears as a card below the panel and **stops**
appearing as a pill inside it. Set it back to Profile and the reverse. The affiliate
tag must survive both.

---

**10. Theme presets that respect what you already changed** *(judgement, no right answer)*

Applying a preset overwrites ~18 keys (§14). If a creator has spent an hour tuning
`glow_intensity: 42` and `avatar_shape: 'square'`, one click destroys it with no undo.

*Do:* pick one and build it —
 - a confirm step listing exactly which of *their* settings will change,
 - an "Undo" that restores the pre-preset theme (state snapshot, no DB involved —
   remember nothing has saved yet),
 - or a preview-on-hover that applies the preset only while the pointer is over the card.

*Think about:* which one would you actually want as a user? The last is the most fun
and the most likely to feel janky — if you build it, make sure moving the mouse away
restores *exactly* the prior theme, including keys the preset didn't set.
*Verify:* tune three unrelated settings, hover/apply/undo, then diff the theme object
against a snapshot you took first. Log it — don't eyeball the page.

---

**Stretch — a "reset to default" that isn't a lie.** There's no way to get back to
`DEFAULT_THEME`. Add one. Then answer the questions it raises: does reset clear the
uploaded banner, background image and music, or only the styling? (What does
`THEME_PORTABLE_EXCLUDE` suggest?) Does it delete the storage objects, or orphan
them? Should it save immediately or stage the change like everything else in this
editor? Every one of those has a defensible answer and a wrong one, and getting them
right requires understanding §12, §14 and §17 together.

---

_Written 2026-08-23, describing the editor as of commit `b1f4e7d`. If you change how
a **mechanism** works (not just a value), update the matching section here._
