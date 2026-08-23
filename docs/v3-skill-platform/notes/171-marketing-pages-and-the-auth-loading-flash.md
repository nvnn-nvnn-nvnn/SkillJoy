# 171 — Guide: the auth-loading flash, and finishing the hardcoded-colour sweep

Date: 2026-08-21
Migrations: none

About page, Contact page, and the build-a-skill crash. Two of the three are the
same bug wearing different clothes — again.

---

## 1 · `if (!user)` is almost always wrong

### The reported symptom

"Fix the build a skill page to reflect sign up, no crashes." Signed out, `/build/:id`
rendered a **blank white page**. Here's why:

```js
export default function SkillBuilder() {
  const user = useUser();
  if (!user) return null;      // ← the entire page
  …
}
```

`return null` renders nothing. Not an error boundary, not a redirect — a white
screen with a working header above it. From the outside that reads as a crash,
which is exactly how it was reported.

`/build/new` had the identical line. `LessonEditor` and `ServicesDashboard` were
less broken but still dead ends: *"Please log in."* with no link to do so.

### The bug underneath, which affects signed-IN users too

`src/lib/stores.jsx` starts like this:

```js
const [user, setUser] = useState(null)
const [loading, setLoading] = useState(true)
```

`user` is **null while auth is still resolving**. So `if (!user)` is true for
every visitor for the first few hundred milliseconds — including people who are
perfectly signed in. A creator hard-reloading `/build/abc` got a flash of blank
(or "please log in") before their own product appeared.

> **The rule:** `!user` does not mean "signed out." It means **"not signed in
> *yet*"** — which is two different states with two different correct UIs. You
> have to check `loading` first, always.

This is the third time this exact trap has appeared in three notes: `PhoneLock`
on the products dashboard (169), the onboarding entry check (170), and now four
builder surfaces. Same shape every time — a boolean that's indistinguishable
between "false" and "not known yet."

### The fix: one hook, three states

`src/lib/useAuthGate.jsx` returns *what to render instead of the page*, or null
when the page should render normally:

```js
export function useAuthGate() {
  const user = useUser();
  const { loading } = useAuth();
  if (loading) return <spinner />;           // not known yet
  if (user) return null;                     // signed in → render the page
  return <SignUpPrompt next={pathname} />;   // genuinely signed out
}
```

Call sites become one line:

```js
const gate = useAuthGate();
if (gate) return gate;
```

A **hook** rather than a `<RequireAuth>` wrapper because these pages compute
state before their first return — wrapping them would mean hoisting all of that
or calling hooks conditionally.

The signed-out state is now a real screen: what the page is for, what's free,
and a CTA carrying `?next=` so signing in returns you where you were trying to
go instead of dumping you on a generic dashboard.

---

## 2 · About and Contact: the same hardcoded-colour bug as 169

Note 169 fixed the legal pages. It did not go looking for other instances —
exercise 1 in that note was literally *"find the rest of the hardcoded
colours."* Here they are.

**About** had section backgrounds baked in:

```css
.ab-modes { background: #E0D5C3; }   /* never darkens */
.ab-mode  { background: #EDE6D8; }   /* never darkens */
```

Same failure as 169: a **hardcoded background silently invalidates every
token-driven colour on top of it.**

And a new variant worth naming — the footer buttons:

```css
.ab-footer-btn {
  border: 1px solid rgba(255,255,255,0.3);
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.1);
}
```

White text, white border, white-ish fill — on a section with **no background at
all**, so it inherited the cream page. Invisible in *light* mode. This had
presumably been broken since the section was written, and nobody noticed because
nobody scrolls to the bottom of an About page.

> **Transferable:** semi-transparent white styling is a *dark-surface* idiom. If
> you copy a component off a dark hero onto a plain section, it disappears. The
> tell is `rgba(255,255,255,…)` with no matching dark background nearby.

**Contact** had `#000` on `#fff` for the back link and `#f0fdf4` / `#86efac` for
the success panel. All tokens now.

### Content, not just colour

Both pages had drifted from the product:

- **About** described "files, videos, prompts, guides" as the whole offer. No
  mention of courses with progress tracking, native 1:1 booking, memberships,
  discount codes, order bumps, email capture, or analytics — all of which ship
  today. Rewritten from the verified feature inventory in note 165.
- **Contact**'s subject dropdown offered *"Payment or escrow issue"* and
  *"Dispute help"* — gig-marketplace concepts from v1. A creator with a payout
  problem had no correct option, and the list quietly advertised a product that
  no longer exists. Replaced with billing / payouts / storefront / account / bug.

Contact also gained a side panel stating response time. A contact form with no
stated turnaround is a form people don't trust they've been heard by.

---

## 3 · A lint false positive worth understanding

Writing About, this appeared:

```
'Icon' is defined but never used  no-unused-vars
```

…on code that clearly uses it:

```jsx
{SELLS.map(({ icon: Icon, label, blurb }) => (
  <span><Icon size={19} /></span>
))}
```

The config explains it:

```js
'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }]
```

`varsIgnorePattern` covers **variables**. `Icon` here is a destructured
**function parameter**, which is governed by `argsIgnorePattern` — not set. So
capitalised component bindings are exempt as variables but not as args.

Two possible fixes. Adding `argsIgnorePattern: '^[A-Z_]'` to the config is the
"correct" one, but it loosens the rule repo-wide for a cosmetic gain. The other
is to match what `AddProduct.jsx` already does:

```jsx
{SELLS.map(s => {
  const Icon = s.icon;    // a VARIABLE → covered by varsIgnorePattern
  return …;
})}
```

Took the second: consistent with existing code, no config change, no loosened
rule. `StorefrontEditor.jsx:45` still carries the same false positive and is
part of the standing 87-problem baseline — worth cleaning up the same way.

---

## Exercises

**1 · Finish the sweep properly.**
169 asked for this and I only did the pages I was pointed at. Run
`grep -rnE "(background|color): *['\"]?(#[0-9a-fA-F]{3,6}|rgba\()" src/` and
triage every hit: foreground (usually survivable), background (breaks
everything on it), or `rgba(255,255,255,…)` (dark-surface idiom in the wrong
place). Fix the last two categories.

**2 · Make `?next=` actually work.**
`useAuthGate` sends `/login?next=/build/abc`, but does the login page read it?
Check. If not, wire it — and handle the case where `next` points somewhere the
user still can't reach after signing in (e.g. another creator's product).
Never redirect to an absolute URL from a query param; explain why in a comment.

**3 · Catch the auth-flash class of bug once.**
Three notes, three instances. Write a tiny helper or lint rule that flags
`if (!user)` in a component that doesn't also reference `loading`. Grep is
fine. Then run it across `src/` and see how many more there are.

**4 · Prove the signed-out gate.**
In a private window, visit `/build`, `/build/new`, `/build/abc`, and
`/build/abc/lesson/xyz`. All four should show the sign-up screen, never a blank
page. Then sign in and hard-reload each — you should see the spinner, never a
flash of "sign in to start building."

**5 · The About page makes claims. Verify them.**
Every bullet on the new About page is supposed to be a shipped feature. Pick
five at random and find the code that implements each. Any you can't find is
either a lie on a public marketing page or a feature you forgot you built —
both worth knowing.

**6 · Decide the lint question properly.**
Section 3 chose the local workaround over fixing the config. Make the opposite
case: add `argsIgnorePattern`, run the linter, and count what it silences that
you actually wanted to see. Then decide which is right and write it down.

---

## Files
**New** — `src/lib/useAuthGate.jsx`
**Changed** — `src/introduction-pages/About.jsx` (tokens + current feature set),
`src/introduction-pages/Contact.jsx` (tokens, current subjects, side panel),
`src/app-pages/SkillBuilder.jsx`, `AddProduct.jsx`, `LessonEditor.jsx`,
`ServicesDashboard.jsx` (all four auth guards)
