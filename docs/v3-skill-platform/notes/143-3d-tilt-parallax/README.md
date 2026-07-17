# 143 — 3D tilt / parallax: build it yourself

_2026-07-13. A teaching guide. Open `demo.html` in this folder to play with it live — no build step,
no React, just double-click it._

---

## The mental model

A tilt effect feels like 3D, but there's no 3D engine. It's **one transform** driven by **two
numbers**. That's the entire feature:

> Where is the cursor inside this box? Turn that into two rotations. Hand them to CSS.

Everything else is detail. If you understand that sentence, you can rebuild this from scratch.

The split of responsibility matters, and it's the part most tutorials get wrong:

| Job | Who does it |
|---|---|
| Track the pointer, do the math | **JS** |
| Actually rotate the element, smooth it | **CSS** |

JS never touches `transform`. It writes two CSS variables. CSS reads them. Keep that boundary and
the effect stays declarative, transitions come free, and nothing fights over the transform property.

---

## Step 1 — normalize the pointer to 0→1

You get `e.clientX/Y` in *viewport* pixels. Useless on its own — you need "where in **this box**?"

```js
const r = el.getBoundingClientRect();
const px = (e.clientX - r.left) / r.width;   // 0 = left edge,  1 = right edge
const py = (e.clientY - r.top)  / r.height;  // 0 = top edge,   1 = bottom edge
```

Subtract the box's origin → pixels within the box. Divide by its size → a fraction. Now the math is
the same whether the card is 300px or 900px wide. **Normalizing early is why this needs no
per-size tuning.**

## Step 2 — recenter, then scale to degrees

`0→1` is the wrong shape: you want *no* tilt in the middle and opposite tilts at the edges. So
recenter to `-0.5 → 0.5`, double it to `-1 → 1`, multiply by your max angle:

```js
const ry = (px - 0.5) * 2 * max;   // left → -max°,  right → +max°
const rx = (0.5 - py) * 2 * max;   // note: 0.5 - py, not py - 0.5
```

**Why the axes look swapped:** moving the mouse *horizontally* (x) spins the card around its
*vertical* axis — that's `rotateY`. Moving *vertically* rotates around the *horizontal* axis —
`rotateX`. Horizontal input drives Y-rotation. This trips up everyone once.

**Why Y is inverted (`0.5 - py`):** a positive `rotateX` tips the top edge *away* from you. When
your cursor is near the top you want the card leaning toward the cursor, i.e. the top going away —
so the sign flips. Get this backwards and it feels *wrong* in a way you can't name. That's the tell:
if it feels repulsive rather than magnetic, you inverted an axis.

## Step 3 — hand off to CSS via custom properties

```js
el.style.setProperty('--tilt-x', `${rx}deg`);
el.style.setProperty('--tilt-y', `${ry}deg`);
```
```css
.sf-tiltwrap {
  transform: perspective(900px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transform-style: preserve-3d;
  will-change: transform;
  transition: transform .14s ease-out;
}
```

Three things you get for free by doing it this way:
- **`transition` smooths it.** Setting `transform` from JS every frame would fight a transition.
  Setting a *variable* lets CSS interpolate toward the new value — the lag is what makes it feel
  weighty instead of twitchy.
- **The `0deg` fallbacks** mean the CSS is correct before JS ever runs. No flash.
- **Turning it off is trivial** — don't attach the class.

**`perspective()` is the whole illusion.** Without it, `rotateX/Y` is an affine squash — it looks
like the card is being *scaled*, not turned. Perspective adds the vanishing point that makes near
edges bigger. Smaller value = stronger, more dramatic 3D (try `300px` in the demo). Larger =
subtler. 900px is a calm, "expensive" feel.

## Step 4 — don't do it 500 times a second

`pointermove` fires far more often than the screen refreshes. Every extra run is a wasted layout
read. Throttle to one write per frame:

```js
let frame = 0;
function onMove(e) {
  if (frame) return;                 // already queued — drop this event
  frame = requestAnimationFrame(() => {
    frame = 0;
    /* ...measure + write... */
  });
}
```

The `if (frame) return` guard is a **leading-edge throttle**: the first event schedules a frame,
every event until that frame runs is discarded. You physically cannot paint more often than a frame,
so the dropped events cost you nothing visually.

## Step 5 — reset on leave, and clean up

```js
function reset() {
  if (frame) { cancelAnimationFrame(frame); frame = 0; }
  el.style.setProperty('--tilt-x', '0deg');
  el.style.setProperty('--tilt-y', '0deg');
}
el.addEventListener('pointerleave', reset);
```
Without this the card stays frozen mid-tilt when the cursor leaves. Cancel the pending frame too, or
a queued callback lands *after* your reset and re-tilts it. Then remove both listeners in the effect
cleanup, or you leak a listener per re-render.

---

## The one real gotcha: two rules, one property

`.sf-pfx-float` (the existing float effect) already animates the panel's `transform`. Tilt also
wants `transform`. **Only one can win** — CSS has a single `transform` per element, so whichever
loses is silently ignored. Turning on float + tilt together would have made tilt just… not work,
with no error.

The fix is structural, not clever — **give each its own element**:

```jsx
<div ref={tiltRef} className="sf-tiltwrap">   {/* outer: owns tilt's transform  */}
  <div className="sf-panel sf-pfx-float">     {/* inner: owns float's transform */}
```

Nesting composes transforms instead of overwriting them. Whenever two effects want the same CSS
property, an extra wrapper is almost always the answer.

**Transferable:** "these two features conflict" usually means "they're competing for one property on
one element." Add a layer; let each own its own.

## Accessibility

```js
if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
```
Bail before attaching listeners, and null the transform in CSS too. Motion effects trigger vestibular
symptoms for real people — and a user who asked the OS for less motion has *told you* they're one.

---

## Try it

1. Open `demo.html` (this folder) in a browser.
2. Drag the **max tilt** slider to 30 — feel it go from classy to seasick.
3. Drag **perspective** to 200 — that's the vanishing point moving closer.
4. Flip **invert Y** — that's the "feels wrong but you can't say why" bug, on purpose.
5. Toggle **throttle** off and open DevTools' FPS meter on a busy page.

## The real code

- Hook: `useTilt()` in `src/app-pages/Storefront.jsx`
- CSS: `.sf-tiltwrap` in the same file's `StoreStyles()`
- Theme: `tilt_enabled`, `tilt_max` in `src/lib/storefront.js`
- Controls: Profile panel in `src/app-pages/StorefrontEditor.jsx`

Shipped alongside note 142 (splash, overlays, templates).
