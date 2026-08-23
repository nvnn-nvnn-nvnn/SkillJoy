# 170 — Guide: rebuilding onboarding as five screens, and the centred-column trap

Date: 2026-08-21
Migrations: **031** (must run — onboarding survey columns)

Three pieces: the onboarding rebuild (with its full UX spec), the Settings
contact mask, and a real bug in the cover banner I shipped in note 168.

---

## 1 · Onboarding: why five screens feels shorter than one

### Concept: perceived length tracks EFFORT, not screen count

The instinct when told "add three more onboarding screens" is that conversion
will drop. It usually doesn't, and the reason is worth understanding: people
don't experience a flow as *number of screens*, they experience it as *amount of
work*. One screen with six fields feels heavier than five screens with one
decision each, because every field is a small act of composition and every tap
is not.

So the flow is deliberately front-loaded with the only typing that exists:

| # | Screen | Input type | Required? |
|---|--------|-----------|-----------|
| 1 | Foundations — name, handle, ToS | typing | **yes** |
| 2 | Discovery — where did you hear about us | one tap | skippable |
| 3 | Use case — what are you here to do | taps | skippable |
| 4 | Plan — free vs Pro | one tap | choice only |
| 5 | Success — your link, copy it, go | — | — |

Screens 2–5 are tap-only. That's the whole trick.

### The load-bearing detail: screen 1 writes the real row

```js
async function saveFoundations() {
  …
  await supabase.from('profiles').upsert({ id, email, full_name, username, tos_accepted_at, tos_version });
  setStep(2);
}
```

Everything after this point is a **patch**, not part of a pending transaction.
A user who closes the tab on screen 3 still has a working account, a claimed
handle, and a live page. If the whole flow committed at the end, every added
screen would be a new place to lose an entire signup — which is the *real*
reason multi-step onboarding gets a bad reputation.

> **Transferable:** in a multi-step flow, commit the irreversible thing as early
> as you can and treat the rest as enrichment. Then screen count stops being a
> risk.

### Survey writes are deliberately fire-and-forget

```js
const patchProfile = useCallback(async (patch) => {
  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id);
  if (error) console.warn('[onboarding] survey patch failed:', error.message);
}, [user?.id]);
```

Note this is the *opposite* of the decision in note 167, where silent
`console.warn` saves were the bug. The difference is what's at stake: there, the
user's own authored content was being lost silently. Here it's optional
analytics about how they found us. **A failed research write must never block
somebody from finishing signup.** Same code shape, opposite correct answer —
which is why "never swallow errors" is a rule of thumb, not a law.

### Skip has to be a visible peer of Continue

```css
.onb-skip { padding:14px 20px; border:1.5px solid var(--border-strong);
            border-radius:var(--r-full); /* same height as the CTA */ }
```

Not a grey text link in a corner. A skip people can't find doesn't become a
completion — it becomes an abandon, and you've traded a NULL for a lost account.
Skips are recorded as NULL, which is itself real data: a question most people
skip is a question not worth asking.

### Use case is multi-select, on purpose

"Brand promotion" and "personal store / selling" describe the same creator more
often than not. Forcing one answer produces data that looks clean in a pie chart
and is quietly false. Multi-select gives messier charts and truer answers.

### Free vs Pro without making Free look broken

The trap in a two-plan screen is that making Pro attractive usually means making
Free look crippled — which reads as bait, and costs trust at the exact moment
you're asking for it.

What's used instead: Pro gets an accent border, a soft accent shadow, and a
"For selling" flag. Free keeps a full feature list with real benefits and its
own solid button. The distinction is *emphasis*, not *deprivation*.

The verification requirement is stated plainly on the Pro card rather than
discovered later:

> To sell, we verify your **name, email and phone**. It keeps payouts secure —
> nothing is charged today, and you can add your number later.

That last clause matters — it connects to the [169] decision to make phone
optional at signup. The user is told the requirement exists *and* that it isn't
being demanded right now.

**Plan choice records intent, grants nothing.** `plan_intent` is a stated
preference; the real gate is still the platform subscription checked at publish
in `backend/routes/skills.js`. It's recorded because "chose Pro, never
subscribed" is the single most actionable drop-off signal in the funnel.

### Two accessibility details that are easy to miss

**Focus has to move on step change.** Otherwise a keyboard or screen-reader user
stays parked on the button they just pressed and never hears the new heading:

```jsx
const headingRef = useRef(null);
useEffect(() => { headingRef.current?.focus(); }, [step]);
…
<h1 className="onb-h1" tabIndex={-1} ref={headingRef}>Claim your link</h1>
```

`tabIndex={-1}` makes the heading programmatically focusable without adding it
to the tab order.

**The handle status needs a live region.** It changes asynchronously after a
debounce, so a sighted user sees a tick appear and a screen-reader user gets
nothing. The hint element carries `aria-live="polite"` and the icon is
`aria-hidden` — the text is the accessible source of truth, the icon is
decoration.

### The bug I introduced and caught

The original component had:

```js
if (profile?.username) { navigate('/build', { replace: true }); return; }
```

Correct for a single-screen flow. **Broken the moment screen 1 writes a
username**, because any refresh of the profile store mid-survey would eject the
user out of their own onboarding at step 2. Fixed with a ref so the check runs
exactly once, on arrival — plus an `authLoading` guard, because latching the ref
while the profile is still `null` would skip the prefill when it lands.

> **Transferable:** an effect that redirects based on state your own flow
> *mutates* is a trap. Ask "what happens when this becomes true halfway
> through?"

---

## 2 · Settings: masking editable fields is a different problem

Note 168 masked contact details on the Profile page with partial text
(`d••••••@gmail.com`). That works because those are **read-only displays**.

Settings has the same values as **editable inputs**, and a text mask there is
nonsense — you'd be typing into dots, and the value you're editing wouldn't be
the value shown. So the mechanism changes while the contract stays the same:

```jsx
<input type={showContact ? 'email' : 'password'} value={email} … />
<input type={showContact ? 'tel'   : 'password'} value={phone} … />
```

`type="password"` is the browser's own reveal affordance. One toggle covers both
fields, and — same as Profile — the state is **not persisted**, so a
screen-share always starts safe.

> **Transferable:** the same requirement ("hide this by default") gets different
> implementations depending on whether the value is displayed or edited. Copying
> the mechanism instead of the requirement is how you end up typing into dots.

---

## 3 · The centred-column trap (a real bug in note 168's banner)

Note 168 shipped `banner_style: 'cover'` — "full-bleed across the top of the
page." It wasn't. Here's what shipped:

```css
.sf-coverbanner { position:absolute; top:0; left:0; right:0; height:340px; }
```

And here's the parent:

```css
.sf-wrap { max-width:540px; margin:0 auto; padding:0 18px 96px; position:relative; }
```

`left:0; right:0` resolves against the **nearest positioned ancestor** — which
is the 540px centred column. So the "cover" banner rendered exactly as wide as
the card. It looked like a slightly-wider panel banner, and I described it in
the note as full-bleed without ever rendering it.

### The fix, and the cost that comes with it

Escaping a centred parent means going through the viewport:

```css
.sf-coverbanner {
  position: absolute; top: 0;
  left: 50%; transform: translateX(-50%);
  width: 100vw;
}
```

`100vw` **includes the scrollbar**, so on desktop this overflows the document by
~15px and produces a horizontal scrollbar. Absorbed at the root:

```css
body { overflow-x: clip; }
```

`clip`, not `hidden` — and this distinction is the part worth remembering.
`overflow: hidden` makes the element a **scroll container**, which silently
breaks `position: sticky` for every descendant. `overflow: clip` clips without
creating one. On `body`, that difference is the whole site.

> **Transferable:** `position:absolute` with `left:0; right:0` doesn't mean "the
> page." It means "the nearest positioned ancestor." Any time you want true
> full-bleed from inside a centred layout, you need a viewport-unit breakout —
> and you inherit the scrollbar problem that comes with it.

Also fixed: the card needed `margin-top` in cover mode so it sits *on* the image
rather than flush at the top. Done with an explicit `.sf-panel-cover` class
rather than `:has()` — the component already computes the panel's classes, so
there's no reason to make the stylesheet re-derive it.

---

## 4 · Same mistake, third time: backticks in a template literal

The build broke because I wrote this inside a `<style>{\`…\`}</style>`:

```
/* — "overflow-x: clip" on body absorbs that. */
```

…except I originally used backticks around the property name, which terminated
the template literal mid-CSS. Note 167 documented this exact trap. I hit it
again anyway.

The honest lesson isn't "be careful" — it's that a rule you have to remember at
the moment of writing is a rule you will break. **Anything inside a
`<style>{\`…\`}</style>` block must use straight quotes, never backticks**, and
the check that actually catches it is running `npm run build` before claiming
anything works.

---

## Deploy

```
1. docs/v3-skill-platform/migrations/031_onboarding_survey.sql   ← required
2. frontend
```

Without 031, screens 2–4 write to columns that don't exist. Those writes are
fire-and-forget, so onboarding still *completes* — you just silently collect
nothing. Run it first.

---

## Exercises

**1 · Make the survey resumable.**
Someone who closes the tab on screen 3 has an account but no survey data, and
they'll never see those screens again (the entry check sends them to `/build`).
Use `onboarding_completed_at IS NULL` to offer a one-time "finish setting up"
prompt. Decide where it belongs — and whether it should be dismissible forever.

**2 · Cover-banner focal point.**
`background: center top/cover` crops a portrait image badly. Add a focal-point
control (a 3×3 grid, or a click-to-set point) writing `banner_focal` to the
theme, and map it to `background-position`. Nine presets or free coordinates —
argue for one. (See note 168 §3 on presets vs free values.)

**3 · Prove the full-bleed fix.**
Set a cover banner, then check for a horizontal scrollbar at 320px, 768px, 1440px
and 2560px, in a browser with overlay scrollbars (macOS) and one with classic
scrollbars (Windows). If `overflow-x: clip` were removed, which of those four
would regress? Verify rather than reason about it.

**4 · Guard the backtick trap for real.**
Write a check that fails when a `<style>{\`…\`}</style>` block contains a
backtick. A lint rule is the proper answer; a grep in a pre-commit hook is the
one you'll actually ship this week. Do the grep, then decide if the rule is
worth it.

**5 · Instrument the funnel.**
`recordEvent()` already exists in `src/lib/metrics.js`. Fire a step-view event
for each onboarding screen, then answer with real data: which screen loses the
most people, and is the Skip rate on screen 2 high enough that the question
should be deleted?

**6 · The harder one: is screen 4 in the right place?**
Asking someone to pick a plan *before* they've seen the product is a
conventional but questionable choice — they have no basis for the decision yet.
Argue both sides, then design the alternative (plan choice deferred to first
publish, where the paywall already lives) and say what you'd measure to decide
between them.

---

## Files
**New** — `docs/v3-skill-platform/migrations/031_onboarding_survey.sql`,
`docs/v3-skill-platform/prompts/banner-logic-for-grok.md`
**Changed** — `src/app-pages/auth/Onboarding.jsx` (full rebuild),
`src/app-pages/Settings.jsx` (contact reveal toggle),
`src/app-pages/Storefront.jsx` (cover-banner full-bleed fix),
`src/index.css` (`overflow-x: clip` on body)
