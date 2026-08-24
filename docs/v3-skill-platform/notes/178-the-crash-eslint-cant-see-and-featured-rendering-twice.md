# 178 — Guide: the crash eslint can't see, and a link on the page twice

Date: 2026-08-21
Migrations: none (032 still required — see note 177)

Four rounds of "still not working" on the Links page. The cause was one missing
import, and the interesting part is **why nothing caught it**.

---

## 1 · `no-undef` does not see JSX

The crash was `LinkBlockEditor is not defined`. The import was never added:

```jsx
<LinkBlockEditor creatorId={user.id} onChange={reloadLinks} />   // no import
```

`no-undef` is enabled in this project at severity 2. It did not fire. Proven
with a two-line probe:

```jsx
const x = SomeUndefinedValue;              // 'SomeUndefinedValue' is not defined  ✅
return <SomeUndefinedComponent v={x} />;   // (silence)                            ❌
```

Core ESLint's scope analysis doesn't treat a JSX element name as a variable
reference. The rule that does — `react/jsx-no-undef` — lives in
`eslint-plugin-react`, which wasn't installed.

And `vite build` won't catch it either: esbuild transpiles, it doesn't do scope
analysis. So a forgotten component import **passes lint, passes the build, and
crashes at runtime with a white screen.**

> **Transferable:** "lint is clean and it builds" does not mean identifiers
> resolve. In a JSX codebase without `eslint-plugin-react`, every component
> reference is unchecked.

### Fixed properly, after fixing it wrong first

My first attempt was a regex script (like the backtick guard from 175). It
produced **both a false positive and a false negative** — it flagged
`function Styles()` as undefined because my comment-stripping ate the
declaration, and it *missed* the real bug because the component name appeared in
a nearby comment.

A guard that does both is worse than no guard: it trains you to ignore it. I
deleted it and installed the real thing:

```js
plugins: { react },
rules: {
  'react/jsx-no-undef': 'error',
  'react/jsx-uses-vars': 'error',
}
```

Mutation-tested: remove the import →
`875:16  error  'LinkBlockEditor' is not defined  react/jsx-no-undef`.

Bonus: `jsx-uses-vars` also cleared the two long-standing `'Icon' is defined but
never used` false positives (LANDMINES §11), so **the lint baseline dropped
87 → 85** and the workaround in note 172 §… is no longer needed.

> **Transferable:** when a proper tool exists, a hand-rolled heuristic for the
> same job is usually a net negative. The backtick guard was right to be
> bespoke — no rule exists for it. This one wasn't.

---

## 2 · Why I spent four rounds on it

Worth recording honestly, because the debugging was the expensive part, not the
fix.

**The error boundary was hiding the answer.** It rendered *"An unexpected error
crashed this page"* with the real error only in `console.error`. So the person
hitting the crash could tell me nothing, and I guessed three times — DB state,
schema cache, a null return — all plausible, all wrong.

The boundary now shows the message and component stack in a collapsed
`<details>`. One reload after that change produced the exact answer.

> **Transferable:** a generic crash screen makes a bug *unreportable*. If the
> only copy of the error is in a console, you've decided that only developers
> with devtools open can report crashes.

**My own fallbacks made it worse.** I'd deliberately made `listBlocks` return
`[]` on a missing table and `listLinks` fall back to legacy columns, so the
frontend could deploy before migration 032. Good for deploys — but it also meant
a half-applied migration was indistinguishable from an empty account. The editor
now uses `listBlocksResult`, which reports *why* it's empty and shows the
Postgres code on screen.

**Scripted edits failed silently, twice.** The import was missing because a
`node -e` `.replace()` didn't match and I never verified. Then my *mutation
test* of the fix also silently no-op'd — because the file has **CRLF** line
endings and my pattern used `\n`. Note 173 §6 predicted exactly this ("valid but
wrong is the dangerous outcome"); I hit it anyway. Any scripted edit now needs
`if (before === after) throw`.

---

## 3 · Featured links rendered twice

Separate bug, reported alongside: marking a link **featured** left it in the
profile-card block *and* added it to the products section.

```jsx
links.filter(l => l.block_id === b.id)              // every link, incl. featured
…
featuredLinks = withUrl.filter(l => l.featured || …) // the same ones again
```

Both were correct in isolation. Together they put one link on the page twice —
the precise opposite of what "pull this one out of the list" means.

```jsx
links.filter(l => l.block_id === b.id && !l.featured)
```

> **Transferable:** when a flag means "render this somewhere else", the original
> location needs the matching exclusion. Adding the new render site without
> removing the old one is a duplication bug that reads as a layout bug.

---

## 4 · Block list instead of chips

The editor showed blocks as a horizontal row of chips. Replaced with a vertical
list, closer to how beacons organises a page:

```
1 │ Start here          3 links · 1 featured · classic     ↑ ↓
2 │ My shop             5 links · grid                     ↑ ↓
— │ Unsorted            2 links · not in a block
    + Add a block
```

Two reasons the vertical form is right, beyond taste:

- **The blocks ARE a vertical stack on the public page.** The editor should read
  top-to-bottom in the same order, so position 1 obviously means "first thing a
  visitor sees". A chip row implies no order at all.
- **A chip has no room for a summary.** The count, the featured count, and the
  current layout style are what you scan for, and they don't fit on a pill.

Block reorder (`moveBlock` → `reorderBlocks`) is new — previously block order
was fixed at creation.

⚠️ **Caveat on "replicate beacons":** I can't browse, so this is built from the
pattern as I understand it, not from their current UI. If specific details
matter, screenshots would beat my recollection.

---

## Exercises

**1 · Delete the LANDMINES §11 workaround.**
`jsx-uses-vars` fixed the `Icon` false positive properly. Find the places that
work around it (`const Icon = r.icon;` in About.jsx, Header.jsx `NavGroup`) and
decide whether to revert them to destructured params now that they lint clean.

**2 · Make scripted edits fail loudly.**
Every `node -e` replace in this session that silently no-op'd cost a debugging
round. Write a tiny `scripts/edit.cjs` helper that throws when the pattern isn't
found, and normalises CRLF. Then never hand-roll `.replace()` on a source file
again.

**3 · Show the error boundary details in production too?**
It's currently always shown behind a `<details>`. Argue whether a stack trace
should be visible to a creator's *buyers* on a storefront crash — and if not,
how they'd report it instead.

**4 · Audit for other double-renders.**
Featured was one. Are products with a `group_label` rendered both in their group
and anywhere else? Trace `itemGroups` and confirm each item appears exactly
once.

**5 · Block-level colour and text colour.**
Reported as missing and still is: `link_color` is page-global (note 176), so two
blocks can't differ. Move colour onto `layout` and add a text-colour key.
Contrast-check both against the block fill.

**6 · Harder: should the guard have been a lint rule from the start?**
Section 1 says the backtick guard was right to be bespoke and this one wasn't.
State the general rule you'd use to decide, then test it against a third case:
catching a `<style>` block that references a CSS variable never defined.

---

## Files
**Changed** — `eslint.config.js` (+`eslint-plugin-react`, `jsx-no-undef`,
`jsx-uses-vars`), `package.json` (devDependency),
`src/app-pages/StorefrontEditor.jsx` (the missing import),
`src/main.jsx` (error boundary shows the real error),
`src/lib/blocks.js` (`listBlocksResult`), `src/lib/storefront.js` (null guard),
`src/components/LinkBlockEditor.jsx` (diagnostic panel, vertical block list,
block reorder), `src/app-pages/Storefront.jsx` (featured no longer double-renders)
