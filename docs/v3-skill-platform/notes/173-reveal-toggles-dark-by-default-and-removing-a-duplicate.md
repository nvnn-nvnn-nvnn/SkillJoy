# 173 — Guide: three shapes of reveal toggle, dark by default, and deleting a card I'd just made redundant

Date: 2026-08-21
Migrations: none

Small pass, but four of the five items turn on a distinction worth naming.

---

## 1 · The same feature, three different mechanisms

"Hide this by default" has now been built three times in this codebase, and
each one needed a *different* implementation. That's not inconsistency — the
mechanism is dictated by what the value is doing on screen.

| Where | Value is | Mechanism | Why not the others |
|---|---|---|---|
| Profile contact rows (168) | read-only display | partial text mask `d••••••@gmail.com` | nothing to type into; keeps *which* value it is |
| Settings email/phone (170) | editable input | `type` swap → `password` | can't text-mask a field you're editing — you'd be typing into dots |
| Settings passwords (this) | editable secret | `type` swap → `text` | same as above, but inverted: the field is *already* masked |

The mistake to avoid is copying the *mechanism* from the last time instead of
re-deriving it from the requirement. A partial mask on an editable field means
the displayed value and the real value disagree, which is worse than no privacy
control at all.

### One toggle for all three password fields

```jsx
<input type={showPasswords ? 'text' : 'password'} … />  // current
<input type={showPasswords ? 'text' : 'password'} … />  // new
<input type={showPasswords ? 'text' : 'password'} … />  // confirm
```

Per-field toggles look more granular and are worse. **The reason people reveal
a password is to check it — and most often, to check that "new" and "confirm"
match.** Revealing one while the other stays dotted doesn't answer that
question, so you end up toggling both anyway.

`showPasswords` is deliberately separate from `showContact`. Revealing your
email address on a shared screen is a much smaller exposure than revealing a
password you're mid-way through typing, and one control shouldn't decide both.

---

## 2 · Dark by default, and a crash waiting in `localStorage`

```js
// before
return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
// after
return 'dark';
```

Following the OS preference is the usual advice and it's defensible. The
argument against it here: it hands the brand's first impression to a setting we
don't control, so roughly half of new visitors see a look that was never
art-directed. A saved choice still wins, so anyone who prefers light gets light
and keeps it.

### The bug found while changing one line

`getTheme()` and `setTheme()` both touched `localStorage` unguarded:

```js
const saved = localStorage.getItem(KEY);   // can THROW
```

`localStorage` doesn't just return null when unavailable — **accessing it
throws** in Safari private mode and whenever a browser is set to block site
data. And `applyTheme(getTheme())` runs at module scope in `main.jsx`, *before
first paint*:

```js
applyTheme(getTheme())     // ← a throw here takes down the entire app
```

So on a browser with site data blocked, the whole site rendered nothing. Both
calls are now wrapped in try/catch: theme falls back to the default, and a
change still applies for the session even if it can't be persisted.

> **Transferable:** `localStorage` is not a safe read. Treat every access as
> throwing, and be especially careful when it runs before render — the blast
> radius there is the whole application, not one feature.

---

## 3 · Colour and opacity are two controls, not one

The storefront profile card had an opacity slider driving:

```js
'--sf-panel-bg': `color-mix(in srgb, var(--surface) ${theme.card_opacity ?? 100}%, transparent)`
```

Adding a colour could have meant storing `rgba()` and having one field carry
both. It doesn't:

```js
'--sf-panel-bg': `color-mix(in srgb, ${theme.card_color || 'var(--surface)'} ${theme.card_opacity ?? 100}%, transparent)`
```

`card_color` feeds the *same* mix, so the opacity slider behaves identically
whether or not a colour is set, and `''` keeps the old surface-following
behaviour untouched for every existing storefront.

> **Transferable:** when adding a dimension to an existing control, feed it into
> the existing expression rather than replacing the expression. The old
> behaviour then survives as the default for free, and you don't need a
> migration to backfill anything.

Same pattern as `name_color` in note 168: `''` means "follow the theme," and the
editor says which mode you're in — *"Following your theme surface, which adapts
to light and dark"* vs *"Fixed colour — it no longer follows light/dark mode, so
check both."*

---

## 4 · Deleting a card I'd created the redundancy for

Flagged in review: *"there is already a payouts section in profile, that can be
redundant."* Correct — and it was **my** redundancy, introduced one note
earlier. `SetupChecklist` (172) added a "Payouts → Connect" row directly above a
card whose empty state was a "Set up payouts" button.

Two cards asking for the same thing, three inches apart, don't read as one
requirement stated twice. They read as **two different requirements**.

The fix isn't to delete either wholesale — the card still holds things a
checklist shouldn't: the escrow/clearing/available/in-transit breakdown and the
Stripe dashboard link. So the card now renders *only once payouts are
connected*:

```jsx
{isOwnProfile && stripeStatus?.onboarded && ( … )}
```

…which made its internal `? :` and the `handleStripeOnboard` function dead code.
Both removed, with a comment saying where onboarding moved to.

> **Transferable:** when you add a summary surface (a checklist, a dashboard, an
> overview), go looking for what it just made redundant *in the same change*.
> Otherwise you've added a surface and left a contradiction.

---

## 5 · The Pro badge, and the limit RLS puts on it

A plan badge next to the name: `Pro` · `Pro trial · 9d left` · `Payment issue` ·
`Free plan`. Two decisions:

**It renders `null` while billing is loading**, not "Free". Defaulting to Free
would flash the wrong answer at a paying customer for the length of a request —
the fourth appearance of the "not known yet ≠ false" rule in this run of notes
(169 PhoneLock, 170 onboarding, 171 useAuthGate, 172 SetupChecklist).

**It shows "Free plan" rather than nothing** when you're not Pro. The ask was to
see whether you're Pro *or not*; an absent badge is ambiguous with "still
loading."

### The honest limitation

The badge only appears on **your own** profile. `platform_subscriptions` is
owner-read under RLS, so a visitor querying someone else's plan gets nothing —
there is no data to render, not a missing feature. A public badge needs either a
public column on `profiles` or the existing `creator_is_live` SECURITY DEFINER
function exposed. That's a product decision (do you *want* plan status public?),
not an oversight.

---

## 6 · The backtick trap, third variant

Notes 167 and 170 both recorded breaking a build with a backtick inside a
`<style>{\`…\`}</style>` template literal. This time it was a different route to
the same place: writing JSX through `node -e` in bash, where the shell ate a
template literal before Node ever saw it —

```
${trialDaysLeft(billing.trial_ends_at)}d left
```

became `bad substitution`, and `null` became `command not found`. The file was
written with a syntax error and the build caught it.

The pattern across all three: **generating code through a layer that also
interprets the syntax you're generating.** The fix isn't care, it's avoiding the
layer — precise multi-line edits go through the editor, not through a shell
string. Scripted replacement stays for mechanical, single-token work.

---

## Exercises

**1 · Auto-hide the revealed passwords.**
`showPasswords` stays on until toggled off or the page unmounts. Add a timeout
that re-masks after 30s of no typing. Then decide whether the same rule should
apply to `showContact` (168 exercise 2 asked the same thing) — and whether one
shared hook should own both.

**2 · Audit every `localStorage` access in the codebase.**
`grep -rn "localStorage" src/` — how many are unguarded? Which of those run
before first paint? Fix the pre-paint ones first; they're the ones that can
white-screen the app.

**3 · Warn on an unreadable card colour.**
`card_color` accepts anything, including a colour that makes the bio unreadable
against it. Use `contrastRatio()` from `src/lib/storefront.js` to warn in the
editor. Compare with note 168 §3, where the *profile* card used fixed presets
specifically to prevent this — argue why the storefront deserves free choice
when the profile card didn't.

**4 · Decide whether Pro should be public.**
Section 5 stops at the RLS boundary. Work out what you'd actually want: a public
"Pro" badge on `/@handle` is social proof, but it also advertises who is paying.
If you want it, add a `plan_public` boolean and a policy that exposes only the
boolean — never the billing row.

**5 · Make dark-by-default provable.**
Clear `localStorage`, hard reload, confirm dark. Then set the OS to light and
reload — still dark? Then pick light in Settings and reload — still light? Three
cases, and the middle one is the behaviour change; make sure it's the one you
want before this reaches users.

**6 · Harder: kill the code-generation-through-bash pattern.**
Section 6 says the fix is avoiding the layer. Prove it: find the edits in this
session's git diff that were written via `node -e`, and identify which ones
could have silently produced *valid but wrong* code rather than a syntax error.
Those are the dangerous ones — a build failure is the good outcome.

---

## Files
**Changed** — `src/app-pages/Settings.jsx` (password reveal),
`src/lib/theme.js` (dark default + guarded storage),
`src/lib/storefront.js` + `src/app-pages/Storefront.jsx` + `StorefrontEditor.jsx`
(`card_color`), `src/app-pages/Profile.jsx` (plan badge, payouts card now
onboarded-only, dead handler removed)
