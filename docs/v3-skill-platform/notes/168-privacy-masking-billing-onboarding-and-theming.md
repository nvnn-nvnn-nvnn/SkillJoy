# 168 — Guide: privacy masking, billing onboarding, and three theming controls

Date: 2026-08-21
Migrations: **030** (must run — `profiles.profile_card_color`)

Five features. Each section is the concept first, then the decision and why the
obvious alternative loses, then the code. **Exercises at the bottom.**

---

## 1 · Contact details, hidden by default

### Concept: a privacy control people turn off isn't a privacy control

The naive version masks everything:

```
Email   ••••••••••••••••
Phone   ••••••••••
```

That's *more* private per-glance and **worse in practice**, because it tells the
owner nothing. You can't confirm which of your two addresses is on file, so the
control's cost is "reveal it every single time" — and people respond by leaving
it revealed. You've built a toggle whose steady state is off.

The real threat here isn't a determined attacker with your screen. It's
**incidental exposure**: screen-sharing on a call, a screenshot in a bug report,
someone walking past. Those are all *glances*. So mask the identifying part and
keep the identifying-*which* part:

```js
function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  if (!domain) return '••••••••';
  return `${name.slice(0, 1)}••••••@${domain}`;   // fixed-length run
}
```

Note the run is **fixed-length**, not `'•'.repeat(name.length)`. Matching the
real length leaks it, and length plus domain narrows a guess a lot more than
people expect.

### Deliberately not persisted

```js
const [showContact, setShowContact] = useState(false);
```

Tempting to remember the choice in `localStorage`. Don't. The first time you
demo your dashboard on a call after having revealed it once, the preference
defeats the entire feature. **Default-safe beats convenient** when the cost of
being wrong is asymmetric — a re-click costs a second, a leak doesn't.

Two small details that make the mask real rather than decorative:

```css
.pf-contactval.masked { user-select: none; font-variant-numeric: tabular-nums; }
```

`user-select:none` stops a "hidden" value being selected and copied — without
it, the text is right there in the DOM. Tabular figures stop the visible last-4
from shifting as the dots render.

---

## 2 · The billing modal: name the thing that's confusing

### Concept: an accurate error is not a helpful one

```
No billing account yet — subscribe first.
```

Every word is true. It is still useless, and the reason is worth internalising:
**it answers a question the user didn't ask.** They asked "manage my billing."
It replied with a fact about internal state.

What actually confuses people is that SkillJoy has **two unrelated Stripe
relationships**:

| | direction | where |
|---|---|---|
| Stripe Connect | money flows **to** the creator | `/profile` → Payouts |
| Platform plan | money flows **from** the creator to SkillJoy | billing |

A creator who finished Connect onboarding reasonably believes "my Stripe is set
up." Then they hit that error and have no way to learn a second thing exists.

So `BillingSetupModal` leads with the disambiguation — before any steps, because
that's the misunderstanding — then the three steps, then the action.

### The interception pattern

Rather than changing the server message (it's correct, and other callers may
want it), the UI catches that specific failure and swaps the surface:

```js
catch (e) {
  if (/no billing account/i.test(e.message)) setModal('no-account');
  else setErr(e.message);
}
```

Matching on message text is fragile and I'd normally push back on it. It's
acceptable *here* because the string is defined in this same repo
(`backend/routes/billing.js`) — not a third-party API. **If that message ever
changes, this silently degrades to a raw error** rather than breaking, which is
the right failure direction. A proper fix is an error *code* on the response;
noted as an exercise below.

### The state that rendered nothing

`TrialBanner` returned `null` for `status === 'none'`. Correct when the account
is empty — the paywall is explained at publish time, and nagging a new signup is
noise. **Wrong once products exist**, because then a creator can build a full
catalogue with no indication anywhere that none of it is reachable.

```js
if (billing.status === 'none') {
  if (!productCount) return modalEl;   // nothing built → stay quiet
  return <>📦 {productCount} products built, none of them live …</>;
}
```

The count is only fetched in that one state — it's the only place the number
changes what renders.

---

## 3 · Profile card colour: store a key, not a colour

### Concept: user-chosen colours are a contrast problem in disguise

The obvious build is `<input type="color">` → save the hex. It fails in two ways
that only show up later:

1. **Dark mode.** One hex can't serve both themes. `#F8F1E2` is a warm card on
   white and a glaring slab on a dark page. The stored value is really *two*
   values.
2. **Unreadable output.** Nothing stops white-on-white. You've given people a
   way to break their own page, and it's your bug report.

So the column stores a **preset key**, and the palette lives in code:

```js
{ key: 'sand', label: 'Sand',
  light: { tint: '#F8F1E2', edge: '#E6D6B8', accent: '#8A6A23' },
  dark:  { tint: '#332C1E', edge: '#4E4430', accent: '#D9BC77' } }
```

Three consequences worth having: contrast is checked once up front; retuning a
preset later is a CSS change, not a data migration; and adding one needs no
migration at all (unknown keys fall back to default).

### The media-query problem

A `style` attribute **cannot contain a media query**. So the inline style ships
*both* palettes as variables and the stylesheet chooses:

```jsx
<div className="pf-hero pf-hero-tinted" style={cardColorVars(cardColor)}>
```
```css
.pf-hero-tinted { background: var(--pfc-tint); border-color: var(--pfc-edge); }
@media (prefers-color-scheme: dark) {
  .pf-hero-tinted { background: var(--pfc-tint-dark); border-color: var(--pfc-edge-dark); }
}
```

**Transferable:** when per-user data has to vary by media query, pass the data
as custom properties and let CSS pick. Don't try to compute the answer in JS —
you'd have to subscribe to the media query and re-render.

### NULL vs 'default'

```js
profile_card_color: cardColor === 'default' ? null : cardColor
```

NULL means "no override." Writing the literal `'default'` would make the column
mean "someone opened the picker once," which is a different fact and one you'd
eventually have to un-learn.

---

## 4 · Cover banner: mask, don't overlay

### Concept: fading INTO a background you don't control

The intuitive fade is a gradient overlay from transparent to the page colour.
It works — right up until someone sets a photo or video background, and the fade
becomes a grey smear over their image because it was fading into a colour that
is no longer what's behind it.

A **mask** fades the banner's own alpha instead. Whatever is behind shows
through correctly, always:

```css
.sf-coverbanner {
  position:absolute; top:0; left:0; right:0; height:340px; z-index:0;
  -webkit-mask-image:linear-gradient(180deg, #000 0%, #000 45%, transparent 100%);
          mask-image:linear-gradient(180deg, #000 0%, #000 45%, transparent 100%);
}
```

The rule: **an overlay needs to know what's behind it; a mask doesn't.** Anywhere
the background is user-controlled, reach for the mask.

Two supporting details: the element is `aria-hidden` + `pointer-events:none`
(it's decoration and must never eat a click on the avatar), and it lives
*outside* the panel — full-bleed across the page means it can't be a child of a
centred, clipped card.

---

## 5 · Name colour: hide controls that can't work

`name_fx` (gradient/rainbow/shimmer) paints the name with `background-clip:text`
and `-webkit-text-fill-color:transparent`. A solid `color` underneath is
**completely invisible** in that state.

So the control only renders when no effect owns the name:

```jsx
{(!theme.name_fx || theme.name_fx === 'none') && ( <Field label="Name colour"> … )}
```

Offering a control that visibly does nothing is worse than not offering it —
the user concludes the app is broken, and they're not wrong.

Default is `''` (inherit), not a hex, because inherit **adapts to light/dark**
and a fixed colour doesn't. When someone does set one, the hint says so plainly:
*"Fixed colour — it stays the same in light and dark mode, so check both."*

---

## Deploy

```
1. docs/v3-skill-platform/migrations/030_profile_card_color.sql   ← required
2. frontend
```

`banner_style` and `name_color` need **no** migration — they live in the
existing `storefront_theme` JSONB, `resolveTheme` merges them from
`DEFAULT_THEME`, and `sanitizeThemeImport` whitelists against those same keys,
so import/export picked them up for free.

---

## Exercises

Roughly increasing difficulty. Each one is real work in this codebase.

**1 · Make the mask honest about phone numbers.**
`maskPhone` shows the last 4 digits. For a 10-digit US number that's fine; for a
7-digit local number it reveals most of it. Change it to reveal at most the last
4 *and* never more than half the digits. Write three assertions first
(10-digit, 7-digit, 4-digit) and make them pass.
→ `src/app-pages/Profile.jsx`

**2 · Auto-hide contact details after inactivity.**
Reveal, then walk away — it stays open. Add a timer that re-masks after 60s,
resetting on interaction. Watch for the trap: a naive `setTimeout` in the
toggle handler leaks if the component unmounts first.
→ Hint: `useEffect` with a cleanup, keyed on `showContact`.

**3 · Replace the error-string match with an error code.**
Section 2 admits `/no billing account/i` is fragile. Return
`{ error, code: 'NO_BILLING_ACCOUNT' }` from `backend/routes/billing.js`, plumb
it through `openBillingPortal`, and branch on the code. Note how `SkillBuilder`
already does exactly this with `e.code === 'SUBSCRIPTION_REQUIRED'` — copy that
pattern.
→ `backend/routes/billing.js`, `src/lib/billing.js`, `TrialBanner`, `Settings`

**4 · Add a preset and prove it's readable.**
Add one colour to `PROFILE_CARD_COLORS`. Then use the `contrastRatio()` helper
already in `src/lib/storefront.js` to write a throwaway script asserting every
preset's `tint` clears 4.5:1 against the text colour in *both* modes. Does your
new one pass? Does every existing one?
→ `src/lib/profileCard.js` + a script like `backend/lib/ics.test.js`

**5 · Make the cover banner height a setting.**
Currently hardcoded at 340px (240 on mobile). Add `banner_height` to
`DEFAULT_THEME` with a slider. The interesting part: the mobile override is in
CSS but the value now comes from JS — solve it with a custom property and
`min()` rather than a second breakpoint in the style attribute.

**6 · Warn on unreadable name colours.**
`name_color` currently accepts anything, including white-on-white. Using
`contrastRatio()`, show an inline warning in the editor when the chosen colour
fails 4.5:1 against the resolved card background. Do **not** block the save —
decide for yourself why warning beats blocking here, and write the reason in a
comment. (Compare: section 3 chose to prevent the problem entirely by removing
free choice. Why is a different answer defensible for the name?)

---

## Files
**New** — `src/components/BillingSetupModal.jsx`, `src/lib/profileCard.js`,
`docs/v3-skill-platform/migrations/030_profile_card_color.sql`
**Changed** — `src/app-pages/Profile.jsx` (contact masking, card colour),
`src/components/TrialBanner.jsx` (none+products state, modal),
`src/app-pages/Settings.jsx` (modal, actionable 'none' state),
`src/lib/storefront.js` (`banner_style`, `name_color`),
`src/app-pages/Storefront.jsx` (cover banner, name colour),
`src/app-pages/StorefrontEditor.jsx` (both controls + live preview)
