# 172 — Guide: a half-finished palette, and putting both Stripes in one list

Date: 2026-08-21
Migrations: none

Cleanup pass on the things notes 169–171 kept deferring, plus a real fix for the
two-Stripe-accounts confusion.

---

## 1 · Triage before you sweep

Note 169 exercise 1 was "find the rest of the hardcoded colours." Running it:

```
hardcoded backgrounds ......... 163
rgba(255,255,255,…) ...........  25
hardcoded text colours ........ 290
```

478 hits. The instinct is to fix them all. **Don't** — look at where they are
first:

```
 26  src/app-pages/Chat.jsx
 20  src/app-pages/MyOrders.jsx
 19  src/app-pages/MyListings.jsx
 16  src/app-pages/Admin.jsx
 11  src/app-pages/DisputeDetail.jsx
 10  src/app-pages/Gigs.jsx
  8  src/app-pages/Disputes.jsx
```

Every one of those is a **v1 gig-marketplace page behind `LEGACY_MODE`, and
none of them are routed in `main.jsx`.** Roughly 110 of the 163 backgrounds are
in code no user can reach. Fixing them is churn with regression risk and zero
visible benefit.

> **Transferable:** a grep count is not a work estimate. Before a sweep, ask
> which hits are on live paths. "478 problems" became "about 60 that matter."

The other half of triage is that **not every literal is a bug**. `Settings.jsx`
had `background: #fff`, which looks like a textbook dark-mode break — it's the
**knob of a toggle switch**, which is white in both modes on every platform.
Left alone. Same for `.dlg-backdrop { background:rgba(20,18,12,.42) }`: a modal
scrim is meant to be dark regardless of theme.

---

## 2 · The palette was only half a palette

Here's what made the sweep non-trivial. The dark block in `src/index.css`
overrode the tinted **backgrounds**:

```css
:root[data-theme="dark"] {
  --accent-light: #331A14;
  --danger-light: #3A1518;   /* red-50 would flashbang a dark page */
}
```

…and left every matching **foreground** at its light-mode value. Measured on
the real pairs:

```
--danger #DC2626 on --danger-light #3A1518 ....... 3.34:1  FAIL
--danger #DC2626 on --surface      #191B1F ....... 3.57:1  FAIL
--green  #2A7A4B on --surface      #191B1F ....... 3.27:1  FAIL
```

And `--green-light` / `--green` / `--green-mid` had **no dark override at all**,
so the mint-green confirmation panels (save status, "Booked ✅", contact
success) were bright slabs on dark pages.

So swapping literals to tokens naively would have *moved* the bug into the
design system instead of fixing it — arguably worse, because it would then look
correct in review.

**The palette got completed first**, with values chosen by measurement:

```css
--danger: #F87171;      /* on #3A1518 5.84:1 · on surface 6.23:1 */
--green:  #7BD4A0;      /* on #12291D 8.65:1 · on surface 9.66:1 */
--green-light: #12291D;
--green-mid:   #2E5641;
--danger-mid:  #5E2126;
--accent-mid:  #5E3327;
```

Each clears 4.5:1 on **both** its tinted fill and plain surface, so a token pair
is now safe to use anywhere without re-checking.

### The inversion trap that followed

Flipping `--danger` light in dark mode immediately broke something else:

```jsx
<button style={{ background: 'var(--danger)', color: '#fff' }}>Delete</button>
```

Four filled destructive buttons. In dark mode that's now **white on pale red**
(~2.8:1). The fix isn't to un-flip the token — it's to notice that "danger as
text" and "danger as a button fill" are *two different needs* wearing one name:

```css
--danger:       #F87171 (dark) / #DC2626 (light)   /* FOREGROUND — flips */
--danger-solid: #DC2626 (both)                     /* BUTTON FILL — doesn't */
```

`--danger-solid` needs no dark override at all: white on `#DC2626` is 4.83:1 in
either theme.

> **Transferable:** a semantic colour token is not one colour. The moment you
> theme it, "text version" and "fill version" diverge, because they're read
> against opposite backgrounds. Name them separately before you need to.

Worth noting the measurement caught something nobody asked about: the literal
being replaced, `#CE4A3E`, was **4.49:1** against white — already under AA. It
had been the destructive-button colour the whole time.

Final tally: 61 literals → tokens across 20 live files, plus 5 filled buttons
repointed at `--danger-solid`, plus a dark value for Dialog's amber chip.

---

## 3 · The auth-flash class, closed out

Note 171 exercise 3 was "catch this class of bug once." Running the check:

```bash
for f in $(grep -rl "if (!user)" src/ --include=*.jsx); do
  grep -q "loading\|useAuthGate" "$f" || echo "$f"
done
```

Eight files. Six are unrouted legacy pages. Two were live and wrong:

- `Analytics.jsx` — "Please log in." flash
- `Dashboard.jsx` — same

Both now use `useAuthGate()`. Note the legacy six do something *worse* than
flash — they call `navigate('/login')` inside an effect while `user` is still
null during loading, which would actively eject a signed-in user. They're
unrouted, so it's latent; worth fixing before `LEGACY_MODE` is ever switched on.

---

## 4 · One checklist instead of two Stripe accounts

### The actual confusion

Selling has four prerequisites and they lived in four places:

| Requirement | Where it was surfaced |
|---|---|
| Name + handle | onboarding |
| Phone | `/services` lock screen (note 169) |
| **Payouts** — Stripe *Connect* | `/profile` payouts card |
| **Platform plan** — a Stripe *subscription* | a paywall at publish |

The last two are the trap, and it's a genuinely reasonable mistake: a creator
completes Connect onboarding, sees **"Payouts active"**, and concludes their
Stripe is done. Then publishing hits a paywall. Nothing on either screen ever
mentioned the other exists.

Note 168's `BillingSetupModal` explains the distinction — but only *after*
someone is already confused. This puts it in front of the confusion.

### The design

`SetupChecklist` shows all four in one list with progress, and gives the two
Stripe items an explicit money-direction tag:

```
Payouts         [Stripe pays you]      Connected
Platform plan   [You pay SkillJoy]     Start →
```

Those two tags are the highest-value element on the component. They're what
turns "why are there two Stripe things" into an obviously-answered question.

It sits **above** the payouts card on `/profile`, so the complete picture is
read before the partial one.

### The loading rule, third time

```js
if (!profile || stripe === null || billing === null) return null;
```

Three async sources. Rendering before all three resolve would show items
flipping from "to do" to "Done" a beat later — a checklist that briefly lies
about your account. Same principle as `PhoneLock` (169), the onboarding entry
check (170), and `useAuthGate` (171): **a boolean that can't distinguish "false"
from "not known yet" needs a third state.**

---

## Exercises

**1 · Dismiss the checklist when it's done.**
`allDone` currently renders a green "You're set up to sell" card forever. Should
it persist, collapse, or disappear? Pick one and justify it. If it disappears,
where does someone go to re-check payout status?

**2 · Verify the palette rather than trusting this note.**
Write a script that parses both `:root` blocks out of `src/index.css` and
asserts every `--x` / `--x-light` pair clears 4.5:1 in both themes. Run it. Does
`--accent` on `--accent-light` pass in light mode? (Check before assuming — it
wasn't measured here.)

**3 · Fix the legacy `navigate('/login')` bug.**
Six unrouted pages redirect during auth loading. Fix them with `useAuthGate` or
delete the pages. Deleting is a real option — decide whether `LEGACY_MODE` is
ever coming back, and write the answer down somewhere.

**4 · Make the checklist drive onboarding screen 5.**
Onboarding ends on a success screen with quick links. It could end on this
checklist instead — same component, showing 2/4 done. Try it, then argue
whether it's motivating or deflating at that moment.

**5 · The `#CE4A3E` question.**
Measurement found the old destructive-button red was 4.49:1 — under AA. It's
also the brand coral family. Find every remaining use of it as a foreground,
measure each against its actual background, and decide: fix the colour, or
document an exception? Both are defensible; an undocumented near-miss isn't.

**6 · Harder: should `--danger` have flipped at all?**
An alternative design keeps `--danger` fixed and instead lightens only
`--danger-light`, accepting 3.34:1 for a colour used mostly on large text and
icons. Make that case properly, including what WCAG actually requires for
large text and non-text contrast, then say which you'd ship.

---

## Files
**New** — `src/components/SetupChecklist.jsx`
**Changed** — `src/index.css` (completed dark palette + `--danger-solid`),
`src/app-pages/Profile.jsx` (mounts the checklist),
`src/app-pages/Analytics.jsx`, `Dashboard.jsx` (auth gate),
plus 20 files with danger-colour literals swapped for tokens

---

## Addendum — a regression I caused, and how it was found

Reported mid-session: **"on sign in, despite already having an account, it
directs to onboarding."** That was mine, from note 170.

### The chain

Note 170 replaced the onboarding entry check with a run-once ref, to stop the
guard ejecting people mid-survey. It was gated on `authLoading` so it couldn't
latch before the profile arrived. That reasoning was correct — about the
*initial page load*. It was wrong about *signing in*:

```js
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) loadProfile(session.user.id)
  else setLoading(false)              // ← no session: loading goes FALSE here
})
```

Arrive logged out and `loading` is already `false`. Sign in, and
`onAuthStateChange` fires `loadProfile()` — which **never set `loading` back to
`true`**. So for the whole duration of that profile fetch:

```
user     = set          (signed in)
profile  = null         (still loading)
loading  = false        (lying)
```

The guard read that as "signed in, no profile" and kept them in onboarding.

### Two fixes, because there were two bugs

**The honest fix, in `stores.jsx`:** `loadProfile` now sets `loading = true` on
entry. `loading` now means what every consumer already assumed it meant.

**The precise fix, in `Onboarding.jsx`:** the run-once ref was the wrong
mechanism anyway. It conflated two states that look identical from the outside:

| | `profile.username` | correct action |
|---|---|---|
| arrived already onboarded | set | bounce to `/build` |
| just finished screen 1 | set | stay — they're on screen 2 |

A ref that fires once can't tell those apart; it just picks whichever happens
first. Replaced with a flag that names the actual distinction:

```js
const startedFlow = useRef(false);          // set when screen 1 commits
if (profile?.username && !startedFlow.current) navigate('/build');
```

The redirect check now re-runs on every profile change — safe *because*
`startedFlow` makes the two cases distinguishable.

### What I'd take from it

The bug wasn't the ref. The bug was **reaching for "run this once" as a way to
avoid thinking about which state I actually meant.** "Once" is a proxy for a
real condition, and when the proxy and the condition disagree, you get a bug
that only shows up on one entry path — which is exactly why local testing
missed it and a user found it.

Also: `loading` had been lying since long before this session. Nothing depended
on it closely enough to notice until something did.

## Addendum files
`src/lib/stores.jsx` (loading lifecycle), `src/app-pages/auth/Onboarding.jsx`
(startedFlow guard), `src/components/TrialRibbon.jsx` (new, app-wide trial
countdown), `src/main.jsx` (mounts it above the header)
