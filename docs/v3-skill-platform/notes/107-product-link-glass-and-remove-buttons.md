# 107 — Product/link glassmorphism + better remove buttons

_2026-07-09._

---

## Product + link glassmorphism (done)

Same technique as the profile panel, now on `.sf-card` (products) and `.sf-linkbtn` (links).

**Theme fields** (`storefront.js` DEFAULT_THEME):
- `product_opacity` (40–100, default 100) — item fill opacity.
- `product_blur` (0–24px, default 0) — backdrop blur behind items.

**Wiring:**
- `Storefront.jsx` `wrapStyle`: `--sf-item-bg = color-mix(in srgb, var(--surface) {opacity}%, transparent)`
  and `--sf-item-blur = {blur}px`.
- `.sf-card { background: var(--sf-item-bg, var(--surface)); backdrop-filter: blur(var(--sf-item-blur,0px)); }`
- `.sf-linkbtn { background: color-mix(in srgb, var(--accent) 10%, var(--sf-item-bg, var(--surface))); backdrop-filter: blur(...); }`
  — accent tint mixed **into** the translucent surface, so links keep their identity but go glassy too.
- Preview mirrors it: `--lp-item-bg` / `--lp-item-blur` on `.lp-card` + `.lp-linkbtn`.
- Two sliders in the **Animations & Effects** panel, under Product glow.

**The gotcha to remember:** `backdrop-filter: blur()` only does anything when the fill is
translucent — blur frosts what's *behind* the element. At opacity 100 the blur is a visual
no-op. Frosted glass = opacity ~60–80 **+** blur ~8–16px, over a background image.
(Always ship the `-webkit-backdrop-filter` twin for Safari.)

---

## Remove buttons (done)

Image-remove actions (avatar / background / banner / cursor) were plain gray `.std-textbtn`
text. Now `.std-removebtn`: an `<X>` icon-pill with a bordered surface that turns **red on
hover** (`#ef4444`, 8% tint bg). Reads as the destructive action it is.

Text *resets* (text color / title color) deliberately stay `.std-textbtn` (lighter weight) —
resetting a value ≠ removing an uploaded asset.
