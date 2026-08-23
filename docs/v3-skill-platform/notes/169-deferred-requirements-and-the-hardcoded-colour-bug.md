# 169 — Guide: moving a requirement instead of removing it, and why one hardcoded background broke dark mode

Date: 2026-08-21
Migrations: **none**

Two independent pieces of work that happen to teach opposite lessons about
where a rule should live.

---

## 1 · Phone: optional at signup, required to sell

### Concept: friction should sit where the user already wants something

Phone was mandatory in onboarding:

```js
if (!phone.trim()) { setError('Please enter your phone number.'); return; }
```

The instinct behind that is sound — the platform genuinely needs it, because
`backend/routes/skills.js` refuses to publish without it:

```js
const missing = ['full_name', 'username', 'phone'].filter(f => !profile?.[f]?.trim?.());
if (missing.length) return res.status(400).json({ code: 'PROFILE_INCOMPLETE', missing });
```

But *when* you ask decides how many people answer. At signup the creator has
invested nothing, has no evidence the product is worth anything, and is being
asked for a phone number by a site they met ninety seconds ago. That is the
single worst moment in the entire funnel to make a demand.

**The requirement didn't go away — it moved.** It now surfaces at `/services`,
where the creator arrived because they want to build something. Same ask, but
now it can be paid for with a reason: *this is what unlocks selling*.

> **Transferable:** you cannot delete a real requirement, but you can almost
> always move it. Ask at the moment the user wants something from you, not the
> moment you want something from them.

### Why a lock, not a banner

The dashboard behind it genuinely cannot be used — you can't publish anything —
so a dismissible banner would be a lie: it would imply the page works and this
is optional advice. `PhoneLock` replaces the dashboard entirely, states what
unlocks, and includes the trial terms so the number and the payoff are in the
same eyeline.

### Two details worth stealing

**Don't flash the lock at people who don't need it.**

```js
if (profile === null) return <p>Loading…</p>;   // store hasn't resolved
if (!profile.phone?.trim()) return <PhoneLock />;
```

`useProfile()` returns `null` while loading. Skipping that check means every
creator with a phone number sees the lock screen flash before their dashboard.
A brief loading line is far cheaper than a false accusation.

**No local `saved` flag.** My first version had `const [phoneSaved, setPhoneSaved]`
purely to force a re-render, and eslint correctly flagged it as never read.
That was a real smell, not a lint nit: `PhoneLock` writes through `setProfile`,
`useProfile()` subscribes to that store, so the update re-renders this component
on its own and the gate simply stops matching.

> **Transferable:** if you're adding state whose only job is to trigger a
> re-render, the data you actually changed probably already lives somewhere
> reactive. Find it instead.

**Validation is deliberately loose** — 7+ digits after stripping formatting.
Phone formats vary enormously by country, and a strict regex rejects real users
to catch typos it can't detect anyway. Verification is a separate problem;
don't half-solve it in a format check.

---

## 2 · Legal pages: one hardcoded background broke the whole page

### The bug

Three pages (Terms, Privacy, Refund) each carried the same two literals:

```jsx
<p style={{ color: '#000' }}>Last updated: …</p>

function Section({ title, children }) {
  return (
    <div style={{ background: '#f0ede8', … }}>
      <p style={{ color: 'var(--text-secondary)' }}>{children}</p>
    </div>
  );
}
```

Dark mode is `data-theme="dark"` on `<html>`, which reassigns the tokens in
`src/index.css`. Tokens adapt; literals cannot. So in dark mode:

- `#000` on a dark page → near-invisible
- `#f0ede8` stayed a **light** card, while `var(--text-secondary)` inside it
  correctly flipped to a **light** colour → light-on-light, unreadable

### The concept worth extracting

The text colour was already a token and still broke. **A hardcoded background is
worse than hardcoded text**, because it silently invalidates every correct,
token-driven colour sitting on top of it. Tokens encode a *relationship* —
"readable on the current surface" — and hardcoding the surface breaks the
relationship while leaving each individual declaration looking fine in review.

> **Rule:** if you hardcode one colour in a themed system, make it a
> foreground. Never a background.

### What replaced it

A shared `LegalPage` component taking `{ title, updated, intro, sections }`, so
the three pages are now content-only. Beyond fixing the colours:

- **Cards → rules.** The boxed sections were what made it read like a form, and
  the card background was the exact thing that broke. Sections are now separated
  by a `1px solid var(--border)` line.
- **~68ch measure, 1.75 line-height.** The old full-width 760px paragraphs were
  a wall. Line length is most of readability.
- **Sticky table of contents** (chips on mobile). Legal pages are *reference*
  documents — people arrive looking for one clause, not to read top to bottom.
- **Real `<section>` + `<h2>` with generated anchor ids**, so clauses are
  linkable and the page is navigable by screen reader. `scroll-margin-top`
  keeps an anchored heading clear of the fixed header.
- **Real `<ul>`s.** Refund faked bullets with `'\n\n• …'` and
  `whiteSpace: pre-line`; those don't wrap properly and read as one run-on
  paragraph to a screen reader.

Also fixed in passing: Privacy §8 linked `mailto:privacy` — a broken href with
the correct address as its visible text.

---

## Exercises

**1 · Find the rest of the hardcoded colours.**
This bug almost certainly isn't confined to three pages.
`grep -rnE "(background|color): *['\"]?#[0-9a-fA-F]{3,6}" src/` — triage the
hits into *foreground* (usually survivable) and *background* (breaks everything
on top). Fix the backgrounds first.

**2 · Make the lock screen honest about what's still missing.**
The publish gate needs `full_name`, `username`, **and** `phone`. `PhoneLock`
only handles phone. Extend it to detect which of the three are missing and
render a field for each, so a creator who somehow lacks a username isn't
unlocked into a dashboard that will still refuse to publish.
→ `src/components/PhoneLock.jsx`, and see the `missing` array the server
already returns.

**3 · Add a "why do you need this?" disclosure.**
Some people will not enter a phone number without knowing why. Add an expandable
row that explains verification and payout security. Use `<details>`/`<summary>`
before reaching for React state — decide for yourself whether the native
element is enough here, and write down why.

**4 · Prove the legal pages are readable in both modes.**
Using `contrastRatio()` from `src/lib/storefront.js`, write a script that reads
the light and dark token values out of `src/index.css` and asserts
`--text-secondary` on `--surface` clears 4.5:1 in both. Then break one token on
purpose and confirm the script fails — an assertion you haven't seen fail isn't
one yet (see note 166 §3b).

**5 · Deep-link the TOC.**
Anchors jump but the URL doesn't change, so a reader can't share
"Terms → Payments & Escrow". Sync the visible section to the hash as the user
scrolls, and highlight the active TOC entry. `IntersectionObserver`, not a
scroll listener — and think about which section wins when two are on screen.

**6 · The harder question: should the phone gate be server-enforced?**
Right now `/services` is gated in the browser. Publishing is genuinely protected
server-side, so nothing unsafe happens — but a determined user can reach the
builder. Decide whether that matters, and write your reasoning in a comment.
Consider: what is actually being protected, and is a *lock screen* a security
control or a UX affordance? (There's a defensible answer either way; the point
is to name which one you built.)

---

## Files
**New** — `src/components/PhoneLock.jsx`, `src/introduction-pages/LegalPage.jsx`
**Changed** — `src/app-pages/auth/Onboarding.jsx` (phone optional),
`src/app-pages/ServicesDashboard.jsx` (phone gate + TrialBanner),
`src/introduction-pages/Terms.jsx`, `Privacy.jsx`, `RefundPolicy.jsx`
(content-only, on the shared layout)
