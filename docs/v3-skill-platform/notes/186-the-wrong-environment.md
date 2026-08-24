# 186 — Three rounds of "still too tiny", and none of it was the code

Date: 2026-08-24
Migrations: none

---

## What happened

Sizes were raised three times. Each time the report came back "still too tiny",
"nothing there", "did you do anything?". Each time the response was to raise the
numbers again and look for a CSS bug.

The page being looked at was **the deployed SkillJoy site**, not the local dev
server. None of the changes had been deployed. Every measurement was of code
from before the session started.

The work itself was fine. What burned the rounds was never establishing *which
build was on screen*.

---

## The tell that was there the whole time

Two ports were listening: `5173` (Vite dev) and `3000`. That was noticed and
mentioned twice — as a footnote, after the code changes, phrased as "worth a
hard refresh". It was never turned into the first question.

And there was a stronger signal available and ignored: the built bundle was
grepped and **confirmed to contain the new CSS**:

```
$ grep -o "lkb-label{[^}]*}" dist/assets/*.js
lkb-label { font-weight:800; font-size:18px; … }
```

At that moment the possibilities collapsed to two: either something overrides
the rule at runtime, or **the browser isn't running this bundle**. The second
was never checked. The response was to change the numbers again — which cannot
distinguish between those two cases, and so produced another inconclusive round.

> **Transferable:** when the source is verified correct and the symptom
> persists, stop changing the source. Every further edit produces the same
> ambiguous result. The next move is to prove *what is executing*, not to write
> more of what already isn't.

---

## The rule

**Before the second attempt at a visual bug, establish the environment.** Not
after; not as a footnote to a fix.

- Which URL, exactly? `localhost:5173`, `localhost:3000`, or the live domain?
- Dev server or a built bundle? A built bundle needs a rebuild *and* a reload.
- If it's deployed, when was it last deployed, and from which commit?

One question — "what URL are you looking at?" — would have saved three rounds.
It costs one line and it is never wasted.

### The cheap instrument

A build marker makes this self-answering. Vite exposes the mode, so a corner
badge in dev, or a `<meta name="build" content="…">` stamped with the commit
SHA, turns "which build is this?" from a conversation into a glance. That was
offered late in the session and should have been the *first* suggestion.

---

## Two questions that separate the failure modes

Collected across notes 184–186, since each was a different flavour of "it
doesn't show up":

| Symptom | Question | Answer found in |
|---|---|---|
| Code correct, nothing renders | Is the result off-screen or clipped? | 184 §1 (`overflow:hidden` ancestor), 185 §1 (no layout class) |
| Value never appears | Can anything *write* it? | 184 §2 (`cta_label` had no editor field) |
| Change has no effect | Is this build even running? | **this note** |

The third is the cheapest to check and was checked last.

---

## Also in this round

The CTA field was an **unlabelled input between Description and URL**, visually
identical to both. A placeholder is not a label — it disappears the moment you
type, and it never says the field produces a whole new element on the page.

It is now a captioned box with a dashed border and, underneath, **a live preview
of the button**: the real pill if there is text, or *"No button on this link"* in
grey if there is not. That preview is the shortest possible answer to "did that
do anything?" — and it would have localised this bug immediately, because it
distinguishes an empty field from a broken renderer without leaving the editor.

> **Transferable:** for any field whose output is a *new element* rather than
> text in an existing slot, show the element. The empty state ("no button") is
> the load-bearing half.

---

## Files
`src/components/LinkBlockEditor.jsx` — captioned CTA field + live preview
`src/components/LinkBlock.jsx` — thumbnails 96px base (80 S / 120 L),
grid 168px, carousel 180px
`src/app-pages/StorefrontEditor.jsx` — preview mirrors, at ~65%

Classic thumbnails across the session: **30px → 72px (S) / 108px (L)**.

---

## Exercises

1. **Add the build marker.** Stamp the commit SHA into the page at build time
   and render it in a dev-only corner badge. Decide whether it should also ship
   in production — what's the argument each way?

2. **Write the checklist.** Turn the table above into a five-line comment at the
   top of `LANDMINES.md`: for a "doesn't show up" report, the order to check
   things in. Order matters more than completeness — put the cheapest check
   first and defend that ordering.

3. **Cost the rounds.** Count the edits made after `grep` confirmed the CSS was
   in the bundle. How many changed behaviour? What would the *correct* next
   action have been at that exact moment?

4. **Find the other empty states.** `ImagePick` shows "Add image" when blank.
   Which other editor fields produce a new element on the page but show nothing
   when empty? Add the missing empty states.

5. **Generalise the instrument.** Beyond a build marker, name two more cheap
   instruments that would make an environment mismatch self-evident. For each,
   say what it costs to add and what class of bug it retires permanently.
