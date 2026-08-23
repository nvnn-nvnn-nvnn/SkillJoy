# 174 — Guide: asking for a preferred name, and the column that still says otherwise

Date: 2026-08-21
Migrations: none

Sign-up now collects **email + preferred name**, with phone optional. The
interesting part isn't the form — it's what the change revealed about a field
that had been mislabelled since v1.

---

## 1 · "Full name" was never a full name

The signup form asked for **Full name**, required, `autoComplete="name"`:

```jsx
<label htmlFor="name">Full name</label>
<input autoComplete="name" placeholder="Maya Chen" required />
```

Now trace where that value goes. `profile.full_name` renders as:

- the `<h1>` on the public storefront at `/@handle`
- the display name in the profile card
- the name in booking confirmation emails sent to buyers
- the "Someone booked a session" notification to the creator

Every one of those is a **public display name**. The field was never used as a
legal name for anything — no verification, no payouts (Stripe Connect collects
its own legal identity, separately and properly), no invoicing.

So the app was asking for a legal name, using it as a nickname, and publishing
it. That's the worst combination available: maximum data collected, minimum
justification.

> **Transferable:** before adding a field, follow the value to every place it's
> rendered. If it ends up on a public page, you're asking for a public name —
> label it that way, or stop asking for the private version.

### What changed

```jsx
<label htmlFor="name">Preferred name</label>
<input autoComplete="nickname" placeholder="Maya" required />
<span className="field-hint">
  What you want to be called — this shows on your public page.
  No need for your full or legal name.
</span>
```

`autoComplete="nickname"` rather than `"name"` is load-bearing, not cosmetic.
Leaving `autoComplete="name"` would have the browser helpfully autofill the
user's saved *legal* name into the field we specifically decided shouldn't hold
one — undoing the change for anyone with autofill on, which is most people.

> **Transferable:** `autocomplete` is a data-collection decision, not a
> convenience setting. It tells the browser which stored value to hand over.

Also aligned: Onboarding's "Your name" and the Profile editor's placeholder.

---

## 2 · The column is still called `full_name`, and that's deliberate

`full_name` appears in ~30 call sites across the frontend, the backend publish
gate, four email templates, the booking route, and RLS-adjacent queries. A
rename means a migration plus every one of those, with a window where old and
new code disagree about a column that gates publishing.

The privacy ask was about **what we collect**, and that's now fixed. The column
name is an internal accuracy problem, not a privacy one.

What matters is that the mismatch is *documented where someone will hit it*
rather than left to be rediscovered — there's a comment at the write site in
`Login.jsx` saying plainly that the column holds a preferred name despite its
name. An undocumented mismatch is how the next person re-adds a "full name"
label in good faith.

Exercise 2 below is the rename, done safely, if you want it.

---

## 3 · Phone: consistent at last

Phone was still `required` at signup, even though note 169 made it optional in
onboarding and moved the requirement to `PhoneLock` on `/build`. So the two
entry paths disagreed: sign up with email and phone was mandatory; sign up with
Google and it wasn't.

Now optional in both, and the metadata write is conditional:

```js
options: {
  data: {
    full_name: name.trim(),
    ...(phone.trim() ? { phone: phone.trim() } : {}),
  },
}
```

The spread matters — writing `phone: ''` would store an empty string, and
`profile.phone?.trim()` checks elsewhere would then be testing a value that
exists but is meaningless. Absent is a cleaner "not provided" than empty.

> **Transferable:** when a field becomes optional, decide whether "not provided"
> is `null`/absent or `''`. Pick one, and make sure every reader agrees. Two
> representations of empty is a bug generator.

---

## 4 · Saying what you don't collect

```jsx
<p className="login-privacy">
  <ShieldCheck size={14} />
  We don't ask for your legal name or address. Just a name to show,
  and an email to reach you.
</p>
```

Marking a field "optional" is weaker than it looks — people read it as *"we'll
ask again later"*, because that's usually true. Stating the boundary explicitly
is what makes the optional label credible. It costs one line and it's the only
thing on the form that says what happens to the data.

---

## 5 · Password reveal, now on every password field in the app

Note 173 added reveal to Settings. Login had four password inputs with none.
Now covered: sign-in, sign-up, and the two recovery fields (one toggle for both
— revealing "new" while "confirm" stays dotted doesn't answer the question
you're revealing to answer).

Reveal matters *most* on signup, where you're inventing a password with nothing
to check it against.

One implementation note worth keeping:

```css
.pw-wrap { position: relative; display: flex; }
.pw-wrap input { padding-right: 44px; }
.pw-eye { position: absolute; right: 4px; … }
```

The button is positioned over an input whose padding was widened — **not** an
input wrapped in a bordered flex row. The wrapping version means
reimplementing the border, focus ring and radius on a `div`, and they then
drift from the global input styling the first time anyone touches it.

---

## Exercises

**1 · Find the other places that still say "name".**
`grep -rn "Full name\|full name\|Your name" src/` — and check the email
templates in `backend/lib/email.js` too. Anywhere a buyer is shown a creator's
"name", is the copy consistent with it being a chosen display name?

**2 · Rename the column, safely.**
The four-step expand/contract: (a) migration adding `display_name`, backfilled
from `full_name`; (b) a trigger keeping both in sync; (c) move all ~30 readers
across; (d) drop `full_name`. Do (a) and (b) and stop — then say what would have
to be true before you'd run (c). Note the backend publish gate reads
`full_name`, so it has to move in the same deploy as the frontend, or publishing
breaks.

**3 · Decide what happens to existing full names.**
Every current user signed up under the old label, so `full_name` genuinely
contains legal names for them — and those are on public storefronts right now.
Should they be prompted to shorten it? Is that a one-time banner, a Settings
hint, or nothing? There's a real argument for nothing; make it or reject it.

**4 · Check the Google path.**
OAuth signup pulls `meta.full_name` from the Google profile — which *is* a legal
name, and it bypasses this form entirely. So the privacy improvement only
applies to email signup. What should the Google path do? (Options: accept it,
prompt to edit at onboarding, or pre-fill only the first word.)

**5 · Make the optional phone provably optional.**
Sign up with no phone, then walk the whole path: onboarding → `/build` →
PhoneLock → publish. Does any step assume a phone exists? Check
`backend/routes/skills.js` and the booking emails.

**6 · Harder: is "required" right for preferred name?**
It's the only remaining required field beyond email and password. A handle is
claimed at onboarding anyway, and `@handle` could serve as the display name
until one is set. Argue for dropping it, then say what the storefront `<h1>`
renders in the meantime.

---

## Files
**Changed** — `src/app-pages/auth/Login.jsx` (preferred name, optional phone,
password reveal, privacy note, field styles),
`src/app-pages/auth/Onboarding.jsx` + `src/app-pages/Profile.jsx` (label
alignment)
