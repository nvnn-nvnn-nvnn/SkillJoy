# 153 — Danger tokens (errors were painted brand-colored) + Add-product page fixes

Date: 2026-08-20

## The systemic bug the color swap exposed
`src/App.css`:

```css
.toast.error { background: var(--accent); }
```

**Every error toast in the app rendered in the brand color.** Green while the brand was green;
coral after note 151. An error styled in the brand color reads as an info or success chip —
the one thing an error must never look like. `.ap-err` on the Add-product page had the same
shape (`color:var(--accent); background:var(--accent-light)`).

The design system had **no danger token at all**, which is why these reached for `--accent`.
Meanwhile the app was hardcoding the Tailwind red scale in ~120 places: `#DC2626` ×39,
`#EF4444` ×28, `#FCA5A5` ×21, `#FEF2F2` ×16, `#991B1B` ×10.

## Added
The token that should have existed, using the values already dominant in the codebase:

```
--danger: #DC2626;  --danger-hover: #B91C1C;
--danger-light: #FEF2F2;  --danger-mid: #FCA5A5;  --danger-rgb: 220 38 38;
```

Dark mode overrides `--danger-light: #3A1518` — `#FEF2F2` on a dark page is a flashbang.
Fixed `.toast.error` and `.ap-err` to use it.

**Not** migrating the ~120 existing hardcoded reds in this pass — mechanical, wide, and worth
its own diff. The token exists now so new code has somewhere correct to point.

## Add-product page (`/build/new`) fixes
- **Invisible focus ring.** `.ap-card:focus-visible` used `box-shadow:0 0 0 3px
  var(--accent-light)` — a near-white wash on a white card, so keyboard focus was
  effectively undetectable, and the brand swap made it paler still. Now uses the house
  convention from `App.css`: `rgb(var(--accent-rgb) / 0.30)`.
- **Layout jump on create.** `.ap-creating` was appended below the blurb, growing the card and
  shoving the grid mid-click. Now absolutely positioned as a pill in the card's top-right
  (the card was already `position:relative`).
- **Dead-looking grid.** `disabled={!t.built || !!creating}` disables *every* card while one is
  creating, but `.ap-card:disabled` only changed the cursor — so the other cards stayed fully
  lit and looked clickable. Added `.ap-grid-busy` dimming for non-busy cards, plus
  `.ap-card-busy` highlighting the one actually working.
- Added `aria-busy={busy}` — the card previously announced nothing while creating.

## Transferable
When a palette has no token for a role, code borrows the nearest one that exists — and
`--accent` is always nearest. The missing token is what caused the bug; the brand swap only
made it visible. Worth auditing for other roles with no token (warning? info?).

## Files
- `src/index.css` · `src/App.css` · `src/app-pages/AddProduct.jsx`
