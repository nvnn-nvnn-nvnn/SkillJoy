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

**Validate everything before writing anything.** Validating while copying leaks
partial state on failure *and* reports only the first problem — so the user fixes
one thing, retries, and learns about the next. Two phases (measure all → report
all → then write) fixes both at once. Note 189 §4c: a failed template save was
leaving orphaned files in storage that nothing referenced and nothing would clean
up.

**A field being set is not a field being used.** When copying state, copy what
the *renderer* reads — its conditions are the specification. A theme with
`bg: 'image'` still had a 7MB `bg_video` from an earlier experiment, and the
first version of the template saver dutifully copied it. (Note 189 §4a.)

**Enumerate assets from the schema, not from memory.** `banner_url` and
`cursor_url` were missed by the template saver's asset list — two of six keys
holding uploaded URLs. Grep `DEFAULT_THEME` for every URL-valued key and diff it
against whatever list you're maintaining. (Note 189 §4b.)

**`curl` status 000 ≠ 404.** `000` is connection refused — nothing is listening.
`404` means the server is up and your route is wrong. Confusing them sends you
debugging the wrong layer. Pairs with §15.

---

## 16 · A scrollable "page" is not a page

The live preview is a **scroll container** (`height:100%; overflow-y:auto`); the
real storefront scrolls the document. Full-bleed layers do not port between them.

- `position:absolute; inset:0` inside a scroll container resolves against the
  **visible box**, not the scrollable content height — so backgrounds, video and
  overlay effects stop at the first screenful. (Note 190 §1.)
- `position:fixed` is the live page's answer and is *wrong* in the preview — it
  escapes the frame and covers the editor.
- The scroll-container equivalent is `position:sticky; top:0` with a negative
  margin cancelling the height it adds.

**Percentage margins resolve against WIDTH — vertical ones too.**
`margin-bottom:-100%` on a 300×600 frame pulls back 300px, not 600px. Use a
length. `height:50%` is half the height; `margin-top:50%` is half the width.

**Growing a layer turns latent z-index bugs into live ones.** A positioned
element paints above a non-positioned sibling regardless of DOM order — harmless
while the layer is small, breaking once it covers everything.

---

## 17 · A losing control must say it's losing

The block → featured → page → theme cascade is correct, and the page-level shape
picker still felt broken: every block carried a concrete `layout.shape` left over
from a pre-note-180 default, so the page setting could never win and nothing said
why. One dead control discredits the ones beside it — colour was working fine and
got reported as broken too.

**Anywhere a cascade exists, the lower level needs to be able to say "something
above me is winning, here's what, here's how to stop it."** The fix is feedback
plus a one-click clear that writes the *inherit* value — never a change to the
precedence rule, and never guessing a replacement.

Inverse of §13: there the control existed and nothing listened; here everything
listens and something nearer the element is louder.

---

## 18 · `??` next to `?:` always wants parentheses

`a ?? b ? c : d` parses as `(a ?? b) ? c : d`. In `StorefrontEditor` this made an
*animated* background take the plain-solid branch — and it survived a build, a
lint pass and several screenshots because the solid branch painted the animated
ground colour, so the wrong answer looked almost right.

The mixed-operator bugs that survive are the ones whose wrong output resembles
the right one.

---

## 19 · "They paid" is not "they own this identity"

Guest checkout wanted to sign the buyer in after payment instead of sending them
to their inbox. The obvious implementation is an **account takeover for the price
of the product**:

```
open a $1 product → type victim@example.com → pay → get a session as the victim
```

Every individual check passes — the PaymentIntent is real, verified server-side,
and its metadata matches the skill. The gap is between *this payment is genuine*
and *this person owns that inbox*. Nothing in a checkout flow ever proves the
second.

**Rule:** any flow that converts "paid" into an identity — a session, a linked
account, a password reset — must prove identity separately.

The gate used here: issue a session **only when this transaction created the
account**. A brand-new shadow account holds exactly the thing just bought, so
there is nothing to steal; an account that already existed gets the emailed link,
which proves inbox ownership first. `findOrCreateBuyer` returns
`{ id, created }`, and `created` is a security signal, not a statistic.

**When you remove a payment step, find what the payment was PROVING and replace
it explicitly.** The free-claim route has no PaymentIntent, so its authorisation
is the price itself, re-read server-side — never trusted from the client.
"It's free so it doesn't matter" is how a free endpoint ends up granting a paid
product. (Note 191.)

---

## 20 · `upsert(..., { ignoreDuplicates: true })` silently drops your columns

`findOrCreateBuyer` wrote `full_name` via an upsert with `ignoreDuplicates`, and
a DB trigger creates the profile row the instant the auth user is made — so the
row always already existed and the name was dropped for **every** guest buyer,
paid and free, for as long as the feature has shipped.

Two things had to be true: a trigger racing ahead of the upsert, and a flag that
turns a conflict into a no-op rather than an update. Neither is visible at the
call site.

Found by reading a smoke-test row, not by reading the code. **When an upsert
carries data you care about, verify the row afterwards** — and backfill only
when the field is empty, so you never overwrite something the user set later.

---

## 21 · A colour set on a container is undone by any child that re-sets it

`.sf-card` correctly read `--sf-item-fg`; `.sf-card-title` and `.sf-price` then
hardcoded `var(--text)`. So the product text-colour control painted nothing but
the card border, and had done since it shipped.

**When a colour control does nothing, check the LEAF, not the root.** The
variable, the emitter and the container were all correct — the two elements that
actually show text were not listening. (Note 192 A.)

Do not reach for `!important`: it fixes the symptom and hides the disagreement,
so the next colour control fails the same way.

---

## 22 · Splitting one option into two is a data migration

`glow_targets` had one `links` entry covering profile AND featured links.
Splitting it meant every theme saved beforehand listed `links` but not
`featured` — read naively, every existing storefront silently loses its featured
glow, something no creator switched off.

```js
if (id === 'featured') return t.includes('featured') || t.includes('links');
```

**The old value has to keep meaning what it meant.** Same class of problem as a
nullable column default: the rows that already exist are the hard part, not the
ones you are about to write. (Note 192 D.)

---

## 23 · When you move JSX, count what renders

Restructuring the storefront sections into an order-driven lookup left the
ORIGINAL inline JSX in place underneath, so every section rendered twice. A
glance at the page would have shown something plausible.

Caught by counting class occurrences per renderer instead:

```
featured  live=1  preview=1
videos    live=1  preview=1
```

**After any move-don't-rewrite refactor, grep for the moved markers and assert
the count.** Duplicate renders look fine and clash on React keys.

---

## 24 · Do not sandbox a cross-origin embed

A `sandbox` without `allow-same-origin` gives the iframe a **unique opaque
origin** — which isolates the frame from ITSELF, not just from you. YouTube and
TikTok players need their own cookies, their own localStorage and same-origin
calls to their own API; an opaque origin denies all three and the player fails,
usually showing nothing at all.

**A cross-origin iframe is already fully isolated by the same-origin policy.**
It cannot read your DOM, cookies or storage, sandbox or no sandbox.
`allow-same-origin` restores the frame's access to ITS OWN origin, never yours —
so on a third-party embed the attribute buys no protection and removes
capabilities the embed needs. YouTube's own published snippet ships no sandbox.

`sandbox` is for frames you would otherwise trust: same-origin, `srcdoc`, or
user-supplied HTML.

**What actually restricts an embed:** `allow="…"` is a permissions policy where
anything unlisted is denied — that is the real control. Plus `referrerPolicy`
and `loading="lazy"`.

**It builds and lints cleanly.** The failure only appears when a real player
initialises, so an embed has to be loaded, not just compiled. (Note 192
addendum.)

---

## 25 · Check which mechanism the threat needs

Three times now a DEFENSIVE measure caused the problem instead of preventing
one:

- §188 — a blanket ban on preset background images: right reason, wrong scope,
  blocking the legitimate case with the illegitimate
- §191 — auto sign-in genuinely WAS an account takeover; the fix was a narrow
  gate, not abandoning the feature
- §192 — a sandbox that protected nothing and disabled everything

The pattern: a real threat is identified, then a countermeasure is applied
without checking **which specific mechanism** the threat actually requires.
Ask what the attacker needs, and block that — not the nearest available switch.

---

## 26 · A boolean default lives in TWO places

```js
if (theme?.bg_video_mobile === false)   // default ON  — unset means play
if (theme?.bg_video_mobile !== true)    // default OFF — unset means poster
```

The constant in `DEFAULT_THEME` and every comparison that reads it must agree.
Flip one without the other and the answer depends on whether the user has ever
opened the editor and saved — which is close to unreproducible from a bug
report. **Flip both, or neither.** (Note 192 addendum 2.)

---

## 27 · Once the switch exists, stop arguing about its position

`bg_video_mobile` went hardcoded-off → setting-on → setting-off → setting-on in
about two hours, each flip with a paragraph defending the new direction.

Two different sizes of decision were being treated as one:

- **whether the control exists** is architecture — get it wrong and a feature is
  unreachable; fixing it later touches every consumer
- **which way it points** is a preference — one line, and the product owner is
  already looking at the toggle

The first earns reasoning. The second earns a question, or just doing it.
Defending a default costs more than flipping it.

**The exception:** conditions the END USER set are not preferences and are not
overridable — `prefers-reduced-motion`, Save-Data. Check those before any theme
setting, unconditionally.
