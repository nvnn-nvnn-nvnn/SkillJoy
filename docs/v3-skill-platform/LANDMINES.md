# Landmines

Traps in this codebase that have **actually bitten**, each at least once. Not
hypothetical best practice — every entry below cost a real debugging session.

Ordered by how easy they are to step on. Symptom first, so you can find yours
by what you're seeing.

Numbered notes are a chronological log and get buried; this file doesn't.
**When something bites you twice, add it here.**

---

## 1 · A backtick inside `<style>` silently ends the CSS

**Symptom** · Build fails with a parse error pointing at a line that looks
completely fine, often far below the real problem.

Components carry CSS as:

```jsx
<style>{`  .foo { … }  `}</style>
```

A backtick **anywhere** inside terminates the template literal early; everything
after it parses as JavaScript. It happens most in CSS *comments*, because
writing a property name in prose is natural:

```css
/* Overrides the `margin` shorthand */   ← breaks the file
/* Overrides the margin shorthand */     ← fine
```

**Cost so far:** four broken builds (notes 167, 170, 173, 175).

**Guard:** `npm run check:styles` — also runs automatically before `vite build`.
Mutation-tested. If you add a new CSS-carrying pattern, extend
`scripts/check-style-backticks.cjs`.

---

## 2 · A component with two returns needs `<Styles />` in BOTH

**Symptom** · A screen looks badly designed — content all present, no spacing,
no borders, no colours. Not an error; it just looks bad.

Components carry their CSS as a `<Styles />` element inside the JSX. If the
component has more than one top-level `return`, every branch needs it:

```jsx
if (isEmpty) return ( …list… );              // ← no <Styles /> = zero CSS
return ( …editor… <Styles /> );
```

Passes lint, passes the build, and looks like a layout problem rather than a
missing element — so you'll debug contrast and spacing for hours. Cost three
rounds on the Links editor (note 179).

**Check:** count top-level returns vs `<Styles />` uses in a file. They should
match (helper components like `Switch` render inside a parent that already has
it, so filter those out).

---

## 3 · `!user` does not mean "signed out"

**Symptom** · A signed-in user sees "Please log in", a blank page, or gets
redirected to `/login` or `/onboarding` for a moment after a reload or sign-in.

`src/lib/stores.jsx` starts as `user = null, loading = true`. So `!user` is true
for **everyone** while auth resolves.

```js
if (!user) return null;                      // WRONG — blank page for everyone, briefly
const gate = useAuthGate(); if (gate) return gate;   // right
```

Use `useAuthGate()` from `src/lib/useAuthGate.jsx`. It distinguishes three
states: loading / signed-out / signed-in.

**Cost so far:** four instances (notes 169, 170, 171, 172), plus one
user-reported sign-in bug. Six unrouted legacy pages still have it — they call
`navigate('/login')` during loading, which would actively eject a signed-in user
if `LEGACY_MODE` were ever switched on.

**Related:** `loading` is set back to `true` when `loadProfile()` runs. It wasn't
until note 172, which is what caused the sign-in bug. Don't remove that.

---

## 4 · Global element styles leak into every component

**Symptom** · A component's input is far too tall; button text clips or refuses
to wrap; a control looks nothing like its CSS says it should.

`src/App.css` styles **bare elements**, not classes:

```css
button, .btn { border-radius: var(--r-full); white-space: nowrap; … }
input, textarea, select { padding: 12px 16px; font-size: 15px; … }
```

So every `<button>` you write is already a nowrap pill, and every `<input>`
already has 12px padding. Composed controls must override explicitly — a search
box that sets its own container padding and forgets `padding: 0` on the input
gets **both**.

Real example: the products search was `8px 14px` (container) + `12px 16px`
(inherited) = a very tall box.

---

## 5 · A hardcoded background breaks correct code on top of it

**Symptom** · Text is invisible in dark mode even though it uses a token.

Tokens encode a *relationship* ("readable on the current surface"). Hardcoding
the surface breaks the relationship while every individual declaration still
looks right in review:

```jsx
<div style={{ background: '#f0ede8' }}>          {/* never darkens */}
  <p style={{ color: 'var(--text-secondary)' }}> {/* correctly flips light */}
```

**Rule:** if you hardcode one colour, make it a foreground. Never a background.

**Watch for** `rgba(255,255,255,…)` — a dark-surface idiom. Copied onto a light
section it disappears entirely. (The About footer buttons were invisible in
*light* mode for months this way.)

**Not every literal is a bug:** a toggle knob is white in both modes; a modal
scrim is dark in both. Check intent before "fixing".

---

## 6 · A semantic colour token is two colours

**Symptom** · A destructive button becomes white-on-pale-red in dark mode.

`--danger` is a **foreground** and flips light in dark mode so it stays readable
on dark surfaces. That makes it wrong as a button fill.

```css
color: var(--danger);             /* text/icon — flips */
background: var(--danger-solid);  /* filled button — same in both modes */
```

Same split will be needed for any other token used both ways.

**Also:** dark-mode overrides must cover the *foreground*, not just the tinted
background. `--danger` on `--danger-light` measured **3.34:1** before note 172
because only the background had been darkened.

---

## 7 · `position:absolute; left:0; right:0` sizes to the column, not the page

**Symptom** · A "full width" element is 540px wide.

`.sf-wrap` is `max-width:540px; position:relative`. Absolute children resolve
against **it**, not the viewport. True full-bleed needs a viewport breakout:

```css
left:50%; transform:translateX(-50%); width:100vw;
```

`100vw` includes the scrollbar, so this overflows ~15px on desktop — absorbed by
`overflow-x: clip` on `body`. **`clip`, not `hidden`:** `hidden` makes `body` a
scroll container and silently breaks `position:sticky` site-wide.

---

## 8 · Several hardcoded px values describing one shape

**Symptom** · A layout looks wrong at one breakpoint, or after someone changes
"just the height".

The cover banner had height `340px`, card offset `132px`, and a mask fading at
`45%` — three independently chosen numbers for one shape. They were already
inconsistent the day they shipped, and only one of two breakpoints had a
matching offset.

Derive from one variable:

```css
.sf-wrap { --sf-cover-h: 300px; }
.sf-panel-cover { margin-top: calc(var(--sf-cover-h) * 0.62); }
```

Candidates still unchecked: the avatar overlap (`-58px`) against the panel
banner height (`150px`).

---

## 9 · `localStorage` throws — it doesn't return null

**Symptom** · Entire app renders nothing in Safari private mode, or with site
data blocked.

*Accessing* `localStorage` raises. And `applyTheme(getTheme())` runs at module
scope in `main.jsx`, **before first paint** — so an unguarded read there white-
screens the whole application, not one feature.

Wrap every access. Be strictest about anything running pre-render.

---

## 10 · Where the schema actually lives

- **Source of truth:** `docs/v3-skill-platform/migrations/` (001–031), applied
  in order.
- `supabase/migrations/` is **empty**. Don't trust it.
- `supabase/schema.sql` is a hand-maintained *reading copy*. It had drifted five
  tables and ~35 columns behind while claiming it could rebuild the database,
  and carried a pasted URL that broke it for ~7 weeks.
- For what's really live: `supabase db dump --schema public`.

**`notifications.type` is a CHECK constraint that gets REPLACED, not appended
to.** Adding a type means restating all 21. Miss one and inserts fail silently
at runtime.

---

## 11 · Most grep hits are in dead code

**Symptom** · A cleanup task looks like 478 problems.

The v1 gig-marketplace pages (`Chat`, `MyOrders`, `MyListings`, `Admin`,
`Disputes`, `DisputeDetail`, `Gigs`, `Rewards`) are behind `LEGACY_MODE` and
**not routed in `main.jsx`**. Roughly 110 of 163 hardcoded backgrounds live
there.

Before any sweep, check which hits are on live paths. A grep count is not a work
estimate.

---

## 12 · Tooling gotchas

**Node scripts need `.cjs`.** `package.json` has `"type": "module"`, so a `.js`
script using `require()` fails.

**eslint `varsIgnorePattern` doesn't cover destructured params.** The config sets
`varsIgnorePattern: '^[A-Z_]'`, which exempts `const Icon = x.icon` but *not*
`({ icon: Icon }) => …`. The latter reports a false `no-unused-vars`. Assign
inside the body, as `AddProduct.jsx` does.

**Don't generate JSX through `node -e`.** The shell interprets backticks and
`${…}` before Node sees them, producing mangled code — sometimes a syntax error
(lucky), sometimes valid-but-wrong (not). Use the editor for multi-line edits;
keep scripting for mechanical single-token work.

**Lint baseline is 87 problems** (72 errors, 15 warnings), almost all
`react-refresh/only-export-components` in legacy files. A change should not move
that number.

**Mixed line endings break multi-line search-and-replace.** Files carry CRLF
from git checkout, but anything a node script writes lands as LF — so a file
edited twice has both. A multi-line anchor copied from `sed -n` output then
matches nothing and the replace is a **silent no-op**. Normalise before matching:

```js
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
```

Always assert the anchor exists (`if (!s.includes(old)) throw`) — without it the
script reports success and nothing changed. This is the same failure that caused
the missing-import crash in note 178.

**Lint baseline is now 85 problems** (70 errors, 15 warnings). A change should
not move that number.

---

## 13 · A control exists and nothing downstream listens

Three instances in one week, all the same shape: a slider or picker in the
editor, wired to a theme key, that no renderer reads.

- Page-level `link_shape` was applied only as a wrap class (`.sf-lnk-oval
  .sf-linkbtn`) — and `.sf-linkbtn` is the *legacy flat list*, not `LinkBlock`.
  Setting a page shape did nothing to any block. (Note 181 §3)
- `LivePreview` computed link fill from `product_opacity`, so the Links panel's
  own opacity slider moved nothing in the preview. (Note 181 §4)
- `--sf-glow` / `--sf-icon-glow` had no consumer in `LinkBlock` at all, so links
  stopped glowing the moment they became blocks. (Note 182 §1)

**Cause:** when you replace a renderer, the *data* migration gets checked. The
**presentation contract** — which CSS variables the old markup consumed — does
not come along, and nothing errors.

**Before deleting old markup:** grep its class for every `var(--…)` it read, and
confirm the replacement reads them all.

**A class-based style cannot fall back to a variable-based one.** If a value has
to participate in a cascade, it must be a variable, not a class.

---

## 14 · Don't add a migration to answer an offhand sentence

Migrations are the least reversible thing in the repo, and unrun ones stack —
there were four queued when a fifth got written off a one-line remark. It
happened to be wanted; the order was still wrong.

Confirm before writing: **anything that adds a migration, or a theme key with no
UI to set it.** Everything else, just build.

**A wrapper that only carries CSS variables still participates in layout.** A
`<div style={someVars}>` with no `className` sits flush against its parent while
everything around it is inset — the content renders correctly and looks like it
is missing. Cost a round of "featured links don't show in the preview" in note
185. If a div's only attribute is a style object, ask whether it also needs a
class.

**Multipliers on a design token opt an element out of the scale.**
`.lkb-classic .lkb-thumb { width: calc(var(--lkb-thumb) * 0.66) }` meant raising
`--lkb-thumb` moved Classic two-thirds as much as every other style — invisible
across one increment, obvious across three, and it produced three consecutive
"still too tiny" reports. When a token change doesn't show, check whether the
element *derives* from the token rather than using it.

**Judge sizing on the smallest combination, not the default.** Style multiplier
× size token compounds; Classic + S was 30px while the default was 62px.

---

## 15 · "It doesn't show up" — check in this order

Three different root causes wore this same symptom in one session. Cheapest
check first:

1. **Is this build even running?** Which URL — `localhost:5173`, `:3000`, or the
   live domain? A built bundle needs a rebuild *and* a reload; a deployed site
   needs a deploy. Ask before the second attempt at any visual bug, not after.
   (Note 186 — three rounds were spent editing code while looking at production.)
2. **Can anything write the value?** A column with no editor field is
   unreachable, not unused. (Note 184 §2 — `cta_label`.)
3. **Is the result off-screen or clipped?** An `overflow:hidden` ancestor, or a
   wrapper with no layout class. (Notes 184 §1, 185 §1.)

**When the source is verified correct and the symptom persists, stop editing the
source.** Further edits produce the same ambiguous result. Prove what is
executing instead.
