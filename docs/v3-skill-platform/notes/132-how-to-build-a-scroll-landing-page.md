# 132 — HOW TO: build a Stan/Sellfy-style scroll landing page (teaching note)

_2026-07-13. The techniques behind note 131's `Home.jsx`, explained so you can do it yourself.
Nothing here is SkillJoy-specific — it's the reusable recipe._

---

## 1. Scroll-reveal (the "parallax-ish" effect) — the #1 technique

The thing that makes a landing page feel alive: elements **fade + slide up as they enter the
viewport**. Do NOT do this with a `scroll` event listener — that fires dozens of times a second and
causes jank. Use **`IntersectionObserver`**, which the browser fires only when an element crosses a
threshold.

**The pattern (3 pieces):**

**(a) CSS — the "before" and "after" states + the transition:**
```css
.reveal   { opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.2,.7,.3,1); }
.reveal.in{ opacity: 1; transform: none; }                 /* the destination */
@media (prefers-reduced-motion: reduce) { .reveal { opacity:1; transform:none; transition:none; } }
```
Element starts invisible + shifted down; adding `.in` transitions it to visible + in-place. The
`cubic-bezier(.2,.7,.3,1)` is a soft "ease-out" so it decelerates nicely.

**(b) JS — add `.in` when it scrolls into view:**
```js
useEffect(() => {
  const els = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
  return () => io.disconnect();
}, []);
```
- `threshold: 0.12` → fire when 12% of the element is visible.
- `rootMargin: '0px 0px -8% 0px'` → shrink the trigger zone 8% up from the bottom, so it reveals a
  beat *after* entering, not right at the edge.
- `io.unobserve(e.target)` → reveal ONCE, then stop watching it (don't re-hide on scroll-up).
- The `return () => io.disconnect()` is the effect cleanup (stop observing on unmount).
- Always ship a fallback: `if (!('IntersectionObserver' in window)) els.forEach(el=>el.classList.add('in'))`.

**(c) Stagger** — give siblings increasing `transition-delay` so they cascade in:
```css
.reveal-d1 { transition-delay: .07s; } .reveal-d2 { .14s } .reveal-d3 { .21s }
```
Apply with a template: `className={`lp-card reveal reveal-d${(i % 3) + 1}`}` cycles delays 1→2→3
across a grid.

**True parallax vs this:** literal parallax (background moving slower than foreground) needs a
scroll listener + `transform: translateY(scrollY * 0.3)` and is often janky/touch-hostile. The
reveal + a gentle CSS float animation gives the same "alive on scroll" feel for far less risk. Only
reach for real parallax on ONE hero element if you truly want it.

---

## 2. Landing-page anatomy (the section rhythm)

A converting page is a **vertical rhythm of full-width bands**, each `max-width`-capped inside:
```
Hero (grid: copy | visual)
Testimonials (social proof — trust BEFORE features)
How it works (3 numbered steps)
What it has (feature grid + a dark "differentiator" band)
Pricing (one clear card, the trial)
Final CTA (big accent block)
```
Rules that make it read well:
- **Alternate surfaces** for separation: `var(--bg)` → `var(--surface)` → a **dark band** →
  back. The eye needs the section boundaries.
- **Each section = a `sj-pill` eyebrow + an `<h2>`** (`.lp-head`), centered. Consistency = polish.
- **Testimonials go early** (right after the hero). Social proof before you've even pitched
  features converts better than burying it.
- **One pricing card, not three.** You have one plan — don't invent tiers to fill a table.

---

## 3. The CSS tricks that do the heavy lifting

- **`clamp(min, vw, max)` for fluid type/spacing:** `font-size: clamp(40px, 5.8vw, 68px)` scales
  the headline with the viewport but never smaller than 40 / bigger than 68. No media queries for
  type. Used for every heading + section padding.
- **Ambient glow = a `radial-gradient` positioned absolutely behind content:**
  ```css
  .lp-hero::before { content:''; position:absolute; top:-10%; left:30%; width:60%; height:70%;
    background: radial-gradient(closest-side, rgb(var(--accent-rgb) / 0.14), transparent); z-index:0; }
  ```
  Then `position:relative; z-index:1` on the real content so it sits above the glow. `--accent-rgb`
  (space-separated `0 204 153`) lets you do `rgb(var(--accent-rgb) / 0.14)` for any alpha — that's
  the whole glow system.
- **The phone mockup** is just nested divs: a dark rounded outer (`border-radius:48px`) + a notch
  (absolutely positioned pill) + an inner "screen" with a gradient bg. Add
  `box-shadow: …, 0 0 60px rgb(var(--accent-rgb)/0.28)` for the glow. No image needed.
- **FAQ with zero JS** — native `<details><summary>`:
  ```css
  .lp-faq-q::after { content:'+'; transition: transform .2s; }
  .lp-faq-item[open] .lp-faq-q::after { transform: rotate(45deg); }   /* + becomes × */
  summary::-webkit-details-marker { display:none; }                   /* hide the default triangle */
  ```
- **Theme-aware always:** colors are `var(--text)/--surface/--accent…` so the page works in light
  AND dark. The two dark bands are intentionally hardcoded dark (a design choice, like a footer).

---

## 4. How to extend it yourself

- **Add a section:** copy a `<section className="lp-section">` block → `.lp-head` (pill + h2) →
  your content grid. Add `reveal` (+ `reveal-d#`) classes to animate it in.
- **Swap data:** the page is driven by arrays at the top (`TESTIMONIALS`, `STEPS`, `SELL`,
  `CUSTOM`). Edit the array, the `.map` renders it. To use photo avatars, change the emoji to
  `<img src=…>` in the testimonial `.map`.
- **Change the reveal feel:** bump `translateY(26px)` (distance) or the `.7s` (speed), or swap the
  cubic-bezier. Want it to reveal earlier? raise `threshold` toward 0 or reduce the `rootMargin`.

**The mental model:** a landing page is *data arrays → mapped sections → a reveal observer → theme
vars*. Once you see it as that, adding/reordering/reskinning is just editing arrays and CSS bands.
