# 74 — Delivery UI redesign (contrast + colorblind-safe)

_Session 2026-07-03. The digital delivery controls (file block in the builder)
were "too homogenous" — all one beige tone — and the attached state relied on
green text alone, which colorblind users can't reliably read. Redesigned with
redundant encoding + real contrast._

---

## The accessibility principle applied
**Never encode meaning by color alone.** Every state now carries the meaning in
**icon + shape + text** as well as color, so it's readable regardless of color
perception (WCAG 1.4.1 "Use of Color"):

- **Upload (empty):** a proper **dropzone card** — dashed border, an
  `UploadCloud` icon in an accent-light circle, bold "Choose a file to upload" +
  a hint. Stands out from the panel (white surface vs the beige panel); hover
  turns the border accent + fills accent-light.
- **Attached (success):** a distinct **green-tinted card** with a `CheckCircle2`
  icon **and** the literal words "File attached" + the filename + a "Replace"
  button. The green is a bonus cue, not the only one — the checkmark, the filled
  card shape, and the text all say "done."
- **Error:** an `AlertCircle` icon next to the message (not just red text).
- **Upload / Link toggle:** now has `UploadCloud` / `Link2` **icons**, so the
  active choice is distinguishable by icon, not only the accent fill.
- **Link mode:** a bordered field with a `Link2` prefix icon so it reads as a URL
  input; focus ring uses the accent.

## Contrast fixes
The old flat `surface-alt` label on a `surface-alt` panel had almost no edge.
Now the dropzone is `surface` (white) with a 2px dashed `border-strong`, and the
success card is `green-light` with a `green-mid` border — clear boundaries in
both states. Success-card *text* is `--text` (dark), not green, so it stays
readable; green is carried by the icon + card.

## Files / verify
- `src/components/BlockEditor.jsx` only — `FileField` rewritten (dropzone +
  success card), file-block toggle got icons + a proper link field, styles
  reworked. Reused by the workflow block's file mode too, so it benefits there.
  New lucide icons: `UploadCloud, Link2, CheckCircle2, AlertCircle`.
- `eslint` clean; `npm run build` OK.

## Reusable takeaway (for the rest of the "less vibe coded" pass)
This is the accessibility half of consolidation: state = **icon + text + shape +
color**, never color alone. Apply the same to any status pill, toggle, or
success/error surface across the app. Pairs with [[global-button-reset-landmine]]
(custom buttons must override the global reset).
