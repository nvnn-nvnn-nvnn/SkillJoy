# 117 — Phase 2 effects (bg video, overlays, audio, cursor FX, profile FX) — a teaching note

_2026-07-11. Built on Fable 5 from the Opus Phase-2 audit prompt. This note explains not just
WHAT was added but WHY each decision was made, so the patterns are reusable next time._

---

## The core pattern: how ANY new customization gets added

Every storefront customization in this app follows the **same 4-step loop**. Learn this once and
every future effect is mechanical:

1. **Declare it** in `DEFAULT_THEME` (`src/lib/storefront.js`). This object is the *single source
   of truth* for what a theme can hold. `resolveTheme(stored)` does `{...DEFAULT_THEME, ...stored}`,
   so every field here is guaranteed to exist at read time even on old rows that never had it.
2. **Render it** on the real page (`Storefront.jsx`) — read `theme.<field>` and turn it into a
   class, a CSS variable, or an element.
3. **Control it** in the editor (`StorefrontEditor.jsx`) — a `<Seg>`, `<Slider>`, `<Toggle>`, or
   upload that calls `set({ field: value })`.
4. **Mirror it** in `<LivePreview>` — the same read logic at mini scale.

**Why no database migration?** `profiles.storefront_theme` is a Postgres **jsonb** column — a
schemaless blob. Adding a key to the JSON needs no `ALTER TABLE`. That's the whole reason theming
iterates fast: the "schema" is just `DEFAULT_THEME`.

**The #1 bug in this pattern:** wiring a field into 3 of the 4 places. If it's in the editor but not
`Storefront.jsx`, the creator changes it and nothing happens live. If it's live but not the preview,
the preview lies. Always do all four.

---

## The layering model (this is the mental model for all the visual effects)

The storefront is a stack of layers. Effects slot into specific z-index bands:

```
z: -1   background video  (<video>, fixed, objectFit:cover)        ← behind everything
z: -1   .sf-bg            (color/gradient/image background)
z:  0   .sf-overlay       (rain/snow/vhs, pointer-events:none)     ← above bg, below content
normal  page content      (.sf-panel, products…)                   ← normal document flow
z:  5   .sf-audiopill     (fixed, clickable)                       ← floats over content
z: 60   .sf-fxlayer       (cursor particles, pointer-events:none)  ← top, but click-through
```

Two recurring tricks:
- **`position: fixed`** pins a layer to the viewport (not the scrolling content) — that's how a
  background or overlay stays put while the page scrolls.
- **`pointer-events: none`** makes a layer *visually present but click-through* — essential for
  overlays and the cursor layer, so they don't eat clicks meant for buttons underneath.

---

## Feature 1 — Background video

**Why a `<video>` element and not a CSS background?** CSS `background-image` can't play video. So
video mode renders a real `<video>` pinned behind content:

```jsx
<video className="sf-bgvideo" src={theme.bg_video}
       autoPlay muted loop playsInline aria-hidden="true"
       style={{ position:'fixed', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:-1 }} />
```

Each attribute earns its place:
- **`muted`** — browsers BLOCK autoplay of videos with sound (user-hostile). Muted autoplay is
  allowed. This is non-negotiable: without `muted`, `autoPlay` silently fails.
- **`playsInline`** — without it, iOS Safari hijacks the video into a fullscreen player. This keeps
  it inline as a background.
- **`loop`** — seamless repeat. **`objectFit: cover`** — fills the viewport without distortion
  (like `background-size: cover`).
- **`aria-hidden`** — it's decorative; hide it from screen readers.

Video mode also adds the existing `sf-has-bgimg` class, which applies a text-shadow to the name/bio
so text stays readable over busy footage (same treatment as image backgrounds — reuse, don't
reinvent).

---

## Feature 2 — Overlay effects (rain / snow / vhs)

**Why pure CSS instead of JS/canvas?** These are ambient, repeating patterns — CSS keyframe
animations are GPU-composited and cost ~nothing, no JS on the main thread, no per-frame work in our
code. Reach for canvas/JS only when the motion must react to data. Here it doesn't.

How each is built (all on one fixed `pointer-events:none` `.sf-overlay-*` layer):
- **Rain** — a `repeating-linear-gradient` of thin diagonal streaks, animated by moving
  `background-position` downward (`@keyframes sfRain`). The gradient *is* the rain; we just slide it.
- **Snow** — several `radial-gradient` dots at scattered positions, tiled via `background-size`, and
  the whole tile drifts down + sideways. Cheap "particles" with zero elements.
- **VHS** — a `repeating-linear-gradient` of scanlines + `mix-blend-mode: overlay` (so it interacts
  with the colors beneath, not just sits on top) + a `steps(2)` flicker on opacity for the analog
  jitter feel.

---

## Feature 3 — Site audio, and a real React lesson

**Why is `<AudioPill>` a separate component instead of inline in `Storefront`?**

This is the **Rules of Hooks**. `Storefront()` has early returns:
```js
if (state.status === 'loading') return <…/>;   // ← hooks after this line may not run every render
if (state.status === 'notfound') return <…/>;
```
Hooks (`useState`, `useEffect`, `useRef`) must run **in the same order on every render** — never
after a conditional `return`, never inside an `if`. Audio needs its own state + effect, but those
can only exist in the "ready" branch. **The fix is to extract a child component**: `<AudioPill>` is
only rendered when ready, and *inside* it the hooks run unconditionally. Any time you need
state/effects that only make sense in a post-early-return branch, that's your cue to extract a
component.

**Why `useRef` and not `useState` for the Audio object?** (The lint literally blocked the first cut.)
- `useState` is for **values you render**, and React expects you to *replace* them via the setter,
  not mutate them. Mutating a state value (`audio.loop = true`) is a bug — React won't know it
  changed, and the lint `react-hooks/immutability` flags it.
- `useRef` is a **mutable box that survives re-renders** and does NOT trigger a render when you
  change `.current`. An `<audio>` element is an imperative object you poke at (`.play()`,
  `.pause()`) — it's not render data. That's the textbook `useRef` use case.

```js
const audioRef = useRef(null);
useEffect(() => {
  const a = new Audio(url); a.loop = true; audioRef.current = a;
  return () => { a.pause(); audioRef.current = null; };   // ← cleanup on unmount / url change
}, [url]);
```

**Why start paused?** Same autoplay policy as video — audio-with-sound can't autoplay. So the pill
starts paused and the *first user tap* calls `.play()` (a user gesture, which browsers allow).
`playing` is tracked in `useState` because it DOES drive render (the Volume2 vs VolumeX icon).

**The cleanup return** is the important habit: an effect that creates something (an Audio object, a
listener, a DOM node, a timer) should return a function that tears it down. Skip it and you leak —
the audio keeps playing after you navigate away.

---

## Feature 4 — Cursor particles, and why it's careful

`<CursorFx>` is also its own component (same Rules-of-Hooks reason). Inside, a `useEffect` sets up a
`mousemove` listener that spawns little divs at the pointer. The interesting parts are all about
**not melting the browser**:

- **Throttle** — only spawn one particle per ~28ms (`if (now - last < 28) return`). A mousemove
  fires dozens of times per second; unthrottled you'd create hundreds of nodes.
- **Cap** — never more than 24 particles alive at once (`if (childCount >= 24) remove oldest`).
  Bounds the DOM so a fast mouse can't grow it without limit.
- **Self-destruct** — each particle removes itself after 650ms (`setTimeout(() => p.remove(), 650)`),
  matching its fade-out animation.
- **Teardown** — the effect's cleanup removes the listener AND the whole layer on unmount. Without
  removing the listener you'd have a dangling handler firing forever = a memory leak.

Particles are cheap plain DOM nodes + a CSS fade animation (no React re-renders per particle — that
would be far too slow). It's deliberately **not** simulated in the LivePreview (a comment says so):
particles follow the *real* cursor over the whole window, which makes no sense inside a small preview
box.

---

## Feature 5 — Profile FX, and accessibility

`profile_fx` adds `sf-pfx-glow` (pulsing accent shadow) or `sf-pfx-float` (gentle vertical bob) to
`.sf-panel`. The lesson here is **`prefers-reduced-motion`**:

```css
@media (prefers-reduced-motion: no-preference) {  /* only animate if the user hasn't opted out */
  .sf-pfx-float { animation: sfPfxFloat 4.5s ease-in-out infinite; }
}
@media (prefers-reduced-motion: reduce) {          /* opted out → static equivalent */
  .sf-pfx-glow { box-shadow: 0 0 24px …; }         /* the glow, but not pulsing */
}
```

Some people get motion sickness / vestibular discomfort from looping motion and set "reduce motion"
in their OS. Gating decorative animation behind `no-preference` (and giving a static fallback under
`reduce`) is the right, low-effort way to respect that. Do it for any looping/bobbing/pulsing effect.

---

## Editor wiring notes

- The Assets **"Soon" tiles** for video/audio and the **"Particle effects"** tile were placeholders;
  they're now real controls (tiles removed). Only "Custom fonts" is still Soon.
- `uploadTo(file, setBusy, apply, uploader = uploadBanner)` gained an optional `uploader` arg so
  video + audio reuse the exact same busy-state + error handling as the image uploads — one helper,
  three upload types.

---

## ⚠️ OWNER ACTION — Supabase dashboard (code can't do this, and here's why)

Uploads land in the **`skill-covers` public bucket**, which was set up for images. A Supabase bucket
enforces **allowed MIME types** and a **file-size limit** server-side — these are *storage config*,
not app code, so the app physically can't change them:

1. **Allowed MIME types** — add `video/*` + `audio/*` (Storage → skill-covers → Edit bucket). If the
   bucket has no MIME restriction set, nothing to do.
2. **File-size limit** — image buckets are often capped ~5MB; a background video needs ~50MB. Raise it.

Until both are set, the new upload buttons throw a storage error. Test only makes sense after this.

**Cost caveat:** serving video from Supabase Storage bills egress per view — it adds up fast on a
video background that loads on every page visit. This is precisely the problem the **R2/Bunny media
move (note 108, Phase 3)** solves: cheap/zero-egress object storage + CDN for heavy media, Supabase
just holds the metadata.

---

## Files touched
`src/lib/storefront.js` (5 fields) · `src/lib/storage.js` (+uploadBgVideo, +uploadAudio) ·
`src/app-pages/Storefront.jsx` (+AudioPill, +CursorFx, video/overlay layers, FX CSS) ·
`src/app-pages/StorefrontEditor.jsx` (controls + preview mirrors).

`vite build` ✅. Not yet tested against a real bucket (blocked on the MIME/size config above).

## Test order (after bucket config)
small mp4 → Background 'Video' → check live + preview → each overlay Seg → audio pill (tap to play) →
move mouse on the live page for cursor trail → profile glow/float. On a phone, confirm the bg video
actually plays (some mobile browsers refuse autoplay even muted — the poster/fallback matters there).
