# 187 — Twenty templates, an onboarding step to find them, and undoing a size overshoot

Date: 2026-08-24
Migrations: none — presets are code, and the theme lives in a JSONB column

---

## 1 · Six presets became twenty, in five categories

`THEME_PRESETS` had six entries. Twenty now, grouped by `PRESET_CATEGORIES`:

| Category | What it's for | Templates |
|---|---|---|
| Clean & minimal | content first | Clean Light · Paper · Frosted · Monochrome |
| Bold & bright | high contrast, saturated | Citrus · Bubblegum · Electric |
| Dark & moody | deep backgrounds, glow | Midnight Glow · Obsidian · Ember · Deep Sea · Sunset |
| Soft & natural | muted, warm, calm | Sage · Clay · Linen · Forest |
| Retro & playful | effects on purpose | Vaporwave · Terminal · Arcade · Candy Shop |

Each carries a `blurb` — the one line a creator reads before committing. Twenty
unlabelled swatches is a wall; a heading that says *"Content first. Nothing
competing with your links."* lets someone skip four categories in a glance.

### The bug that made me add `BASE`

Presets are **partial** themes merged over the current one. Which means:

> A preset that omits `overlay` leaves the previous preset's **snow still
> falling** over your new minimal theme.

People try templates in sequence — four clicks in ten seconds. So every preset
has to fully describe its look *including the effects it turns off*. Relying on
each author to remember `overlay: 'none'`, `name_fx: 'none'`, `tilt_enabled:
false`, `cursor_fx: 'none'`… guarantees a leak by preset three.

So there is a shared `BASE` spread first in every entry:

```js
const BASE = {
  overlay:'none', name_fx:'none', profile_fx:'none', cursor_fx:'none',
  animated_name:false, tilt_enabled:false, mono_icons:false,
  glow_intensity:0, product_glow:'none', card_blur:0, /* … */
};

{ id:'paper', theme: { ...BASE, mode:'light', bg:'solid', accent:'#1A1916', … } }
```

Now a preset states what it cares about and everything else lands on a known-off
value. **Structural, not remembered.**

> **Transferable:** any "apply a partial over current state" feature needs a
> defined zero. Without it, state leaks between applications and the bug looks
> like the *second* preset is broken.

### The second rule: never hardcode text colour

No preset sets `text_color` or `title_color` to a literal. Those override the
light/dark palette permanently — so a dark preset would leave pale text behind
when someone later picks a light one, and the light preset would look broken
through no fault of its own. `''` means "follow the mode", which is what a
template should almost always do.

### One accessibility fix while writing them

Four accents I first picked were pretty and failed contrast against their own
backgrounds: `#F97316` on cream, `#DB2777` on pink, `#6B8F5E` on bone, `#8A7355`
on beige. All darkened (`#E2620C`, `#C2185B`, `#4F7042`, `#75603F`). A template
someone can't read their own links on is worse than no template.

---

## 2 · The onboarding step: why templates needed one

The templates already existed and were effectively invisible — three clicks deep
behind **Customize → Templates**, a tab most new users never opened. New pages
sat on the default theme forever, which made the whole app look like it had one
design.

So: a new **screen 5, "Your look"**, between Plan and Success.

```
1 Foundations   name + handle + ToS   ← the only REQUIRED screen
2 Discovery     where did you hear about us      (skippable)
3 Use case      what are you here to do          (skippable)
4 Plan          free vs paid                     (intent only)
5 Look          pick a template                  (skippable)   ← new
6 Success       your link, copy it, go
```

It keeps the flow's two existing rules: **one decision per screen**, and
**skipping is free and silent**. Tap-only, no typing.

Three implementation decisions:

**It writes immediately, not on Finish.** `chooseTemplate` patches
`storefront_theme` and advances in one action, so someone who closes the tab on
the success screen still keeps the look they picked. Fire-and-forget like the
other survey patches — a failed theme write must never block finishing signup.

**It uses the same merge as the editor.** `{ ...DEFAULT_THEME, ...preset.theme }`
— one code path, so a look chosen in onboarding and the same look chosen in the
editor cannot drift.

**The swatch is the control.** A template is a visual question. Each tile renders
the real background, the real accent, and stand-ins for the name and a link. A
list of names would make people guess.

**And the success screen names what they chose:** *"Your page is live with the
**Midnight Glow** look."* Screen 5 commits and advances in a single tap, so
without this the choice is never confirmed — and a template changes the entire
page, which is a large thing to have happen silently.

---

## 3 · Undoing the size overshoot

Links went from 30px thumbnails to 120px across this session. That was not
judgement, it was **compounding against a stale baseline**: three rounds of
"make it bigger" were measured against a page that was never reloading (note
186), so each increase was applied on top of one that had never been seen.

Landed between the two:

| Classic | session start | overshoot | now |
|---|---|---|---|
| thumbnail (S) | 30px | 72px | 41px |
| thumbnail (L) | 30px | 108px | 58px |
| label (S / L) | 13.5px | 17 / 22px | 14.5 / 16.5px |
| CTA | — | 16px / 18px pad | 13px / 13px pad |
| grid image | 84px | 168px | 104px |

Big enough to read as a picture; small enough that four links still fit above
the fold.

> **Transferable:** when a series of adjustments all point the same direction
> and none of them land, the problem is the feedback loop, not the step size.
> Fix the loop before making a fourth adjustment — and once it's fixed, expect
> to walk back most of what the broken loop produced.

---

## Files
`src/lib/storefront.js` — `PRESET_CATEGORIES`, `BASE`, 20 presets,
`presetsByCategory()`
`src/app-pages/StorefrontEditor.jsx` — grouped template panel, preview sizing
`src/app-pages/auth/Onboarding.jsx` — screen 5, `chooseTemplate`, success copy
`src/components/LinkBlock.jsx` — sizes walked back

---

## Exercises

1. **Prove the leak.** Delete `...BASE` from the `paper` preset. Apply
   **Vaporwave**, then apply **Paper**. What is still on screen that shouldn't
   be? Now explain why testing presets in isolation would never have caught it.

2. **Check every accent.** `blocks.js` exports `contrast()`. Write a script that
   loads `THEME_PRESETS` and reports the ratio of each preset's `accent` against
   its `bg_color`. Which still fail 4.5:1? Should this be a build guard next to
   `check-style-backticks.cjs` — and what's the argument against?

3. **Break rule 2 deliberately.** Add `text_color:'#FFFFFF'` to a dark preset.
   Apply it, then apply **Clean Light**. Describe what a new user would conclude
   about the app, and how long it would take them to find the cause.

4. **Question the screen's position.** Screen 5 sits after Plan. Argue for
   moving it to position 2, right after the handle. What does each ordering
   optimise for, and which would you A/B first?

5. **Measure the overshoot.** Reconstruct the four thumbnail values this session
   produced (30 → 48 → 64 → 80 → 120 → 46). At which step should the loop have
   been questioned instead of the number, and what evidence was already
   available at that point?

6. **Add a template.** Build a sixth category ("Professional", say) with three
   presets. You'll touch `PRESET_CATEGORIES`, `THEME_PRESETS`, and nothing else
   — confirm that, and say what it tells you about whether this abstraction is
   the right one.

---

## Addendum — the contrast audit, run

Exercise 2 written, then run immediately. Accent against its own background,
all twenty:

```
Paper          16.70    Obsidian       15.70    Terminal       14.98
Monochrome     10.17    Deep Sea       10.09    Forest          8.89
Sunset          7.54    Ember           7.12    Electric        6.25
Arcade          5.81    Linen           5.57    Candy Shop      5.28
Clay            5.11    Sage            5.08    Bubblegum       4.93
Frosted         4.63    Vaporwave       4.50    Midnight Glow   4.48
Citrus          3.22  ← fixed to 4.98 (#E2620C → #B54708)
Clean Light     2.93  ← pre-existing, see below
```

**Citrus** was mine and is fixed. **Clean Light** is not a template bug: its
accent is `#F5634A`, the app's brand colour and the shipped default. Changing it
would restyle every existing storefront that never picked a template, which is a
product decision, not a cleanup — flagged, not touched.

Worth knowing where 2.93 actually hurts: the accent renders as arrow icons, the
link border tint, and glow. It is *not* the CTA button's text colour — that is
white on `color-mix(accent 88%, black)`, which tests separately and passes. So
the failure is on small decorative marks rather than on anything load-bearing.
That is the difference between "fix before shipping" and "flag and decide".

> **Transferable:** writing the exercise made me run it, and running it found a
> real defect in code I had written twenty minutes earlier. If you can state a
> check precisely enough to assign it, you can usually just run it.

---

## Addendum 2 — authoring your own presets

Presets moved out of `storefront.js` into **`src/lib/presets.js`**, a module with
**no imports at all**. That is not tidiness — it is what makes them checkable.

### Why "no imports" is the load-bearing decision

`scripts/check-presets.cjs` validates the **real objects** via dynamic import:

```js
const mod = await import(pathToFileURL(PRESETS).href);
const { THEME_PRESETS, PRESET_CATEGORIES } = mod;
```

That is only possible because `presets.js` pulls in nothing. Had they stayed in
`storefront.js`, importing them would drag in the supabase client, which needs
env vars a build script shouldn't have — so the validator would have had to
**regex the source**. And a regex cannot reliably answer "was `...BASE` actually
spread here?" without re-implementing a JS parser. It would be wrong eventually,
and wrong in the direction of passing.

> **Transferable:** if you want to validate data that lives in code, give it a
> module with no dependencies. The import boundary is what decides whether your
> checker sees objects or text.

### To add one

```js
{ id: 'yourid', name: 'Your Name', emoji: '🎨', category: 'clean',
  blurb: 'One line: who is this for.',
  theme: { ...BASE, mode: 'light', bg: 'gradient',
    bg_color: '#F0F0F0', bg_color2: '#E0E0E0', accent: '#333333',
    button_style: 'rounded', link_shape: 'oval' } },
```

Then `npm run check:presets`. It runs on every build too, so a broken preset
cannot ship.

### What it checks, and why each one earned its place

| Check | The bug it prevents |
|---|---|
| `...BASE` spread | effects leak from the previously applied preset |
| literal `text_color` | dark preset leaves pale text on a later light one |
| unknown theme key | `sanitizeThemeImport` drops typos **silently, forever** |
| bad enum value | `overlay:'lasers'` renders nothing, reports nothing |
| dead category id | the preset never appears in the picker at all |
| duplicate id | one of the two becomes unreachable |
| accent contrast < 3:1 | arrows, borders and glow unreadable |
| `bg:'gradient'` w/o `bg_color2` | renders flat, looks like a bad gradient |
| `bg:'image'`/`'video'` | needs an uploaded asset a preset cannot ship |

**Mutation-tested, 6/6 caught.** A guard that has never failed is a guard you
cannot trust, so each rule was verified by breaking a real preset and confirming
the specific error fires — then reverting. The same discipline as
`backend/lib/ics.test.js`.

### The escape hatch, and why it needs a reason

The very first run failed on **Clean Light**: accent `#F5634A` at 2.93:1.

That is the app's brand colour and the default every existing storefront
already has. Changing it to satisfy a linter would restyle every page that never
picked a template — a product decision wearing a lint fix's clothes.

The tempting move is to lower `MIN_CONTRAST` to 2.9. That silently stops
protecting the other nineteen presets. Instead there is a per-preset opt-out
that **requires a stated reason**:

```js
contrastNote: 'brand default accent; decorative use only on this preset',
```

With it, the error becomes a warning that prints the reason. The guard stays
strict, and the exception is visible in the diff where someone can argue with it.

> **Transferable:** when a guard flags something you intend to keep, add a
> documented per-case exemption — never relax the threshold. A weakened rule
> protects nothing and leaves no trace of the decision.

## Exercises (addendum 2)

7. **Break it six ways.** Re-run the mutation test: remove a `...BASE`, add a
   `text_color`, typo a key, use a dead category, invent an overlay, darken an
   accent to 1.3:1. Confirm each fires with a *specific* message. Which message
   would you not understand a month from now?

8. **Add a check.** Nothing currently verifies `bg_color2` differs enough from
   `bg_color` to read as a gradient. Write it, pick a threshold, and defend the
   number. Should it be an error or a warning?

9. **Attack the exemption.** `contrastNote` accepts any non-empty string.
   Someone could write `'looks fine'`. Is that a problem worth solving in code,
   or is code review the right place? Argue it, then decide whether to add a
   minimum length.

10. **Author three of your own.** Build a category you actually want. Run the
    checker, fix what it reports, and note which check caught something you had
    not thought about — that is the one that justified writing it.
