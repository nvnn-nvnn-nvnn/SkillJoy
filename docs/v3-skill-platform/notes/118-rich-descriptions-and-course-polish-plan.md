# 118 — Rich product/lesson descriptions + course polish (DONE) + audio autoplay

_2026-07-11. "Phase 3" in the owner's words = the product-CREATION upgrade (better
description editor + course polish). NOT note-108's Phase 3 (R2/Bunny infra), which stays
deferred as premature — the delivery loop already works on Supabase Storage (see note 116 /
locker.js audit)._

## Audit (current state)

- **Product description** = a plain `<textarea>` (`SkillBuilder.jsx` ~L424, `skill.description`),
  rendered as plain pre-wrap text on the product page (`SkillPublic.jsx` ~L86, `.sp-desc`
  `white-space:pre-wrap`). No bold/bullets/headings. **Currently XSS-safe** (no
  `dangerouslySetInnerHTML` anywhere).
- **Course** (`CoursePlayer.jsx`) is already decent: Modules → Lessons → content blocks
  (`BlockRenderer`), per-lesson progress bar, mark-complete. Weak spots: lesson descriptions are
  plain text; every module/lesson renders expanded at once (long scroll on big courses).

## The safe upgrade: markdown (NOT raw HTML)

Store descriptions as **markdown**; render with **react-markdown WITHOUT rehype-raw**. That means
raw HTML/`<script>` in the text is shown as literal characters, never executed — XSS-safe *by
construction*, no sanitizer needed. This is why it's a Fable-appropriate task even though "rich
text" is normally an Opus/security concern: markdown-without-raw-HTML removes the danger.

## What the Fable pass does (see the prompt / next note)

1. `react-markdown` dependency added.
2. A reusable **`<MarkdownEditor>`** — bigger textarea + a formatting toolbar (bold, italic,
   bullet/numbered list, heading, link) that inserts markdown syntax at the cursor, + a
   Write/Preview toggle. Replaces the plain description textarea in the builder.
3. A reusable **`<Markdown>`** renderer (react-markdown, no raw HTML, `target=_blank rel=noopener`
   on links) — replaces the plain `.sp-desc` render on the product page, and renders lesson
   descriptions in the CoursePlayer (markdown degrades gracefully, so old plain-text descriptions
   still look right).
4. **Collapsible course modules** in CoursePlayer (accordion; first module open by default).

## Implemented (Fable 5, same day)

- **`react-markdown@10.1.0` added — WITHOUT rehype-raw** (verified absent from package.json).
  Raw HTML typed by a user renders as literal text, never executes. No dangerouslySetInnerHTML
  anywhere.
- **`src/components/Markdown.jsx`** — the single safe renderer. Links forced to
  `target=_blank rel="noopener noreferrer nofollow"`; scoped `.md` stylesheet (theme-aware vars,
  headings/lists/code/blockquote/hr/img). Returns null on empty.
- **`src/components/MarkdownEditor.jsx`** — toolbar (Bold/Italic/Heading/Bullets/Numbered/Link)
  inserts syntax at the textarea selection (selectionStart/End + setSelectionRange restore;
  `onMouseDown preventDefault` on tool buttons so clicking a tool doesn't blur the selection);
  Write|Preview tabs (Preview renders via <Markdown>); rows=10 default, resize:vertical.
- **Wired:** SkillBuilder description → <MarkdownEditor> (+ "Supports markdown" hint);
  SkillPublic `.sp-desc` → <Markdown> (dropped white-space:pre-wrap — markdown owns breaks now);
  CoursePlayer lesson descriptions → <Markdown>.
- **Collapsible course modules** — module header is now a button (aria-expanded) with a rotating
  ChevronDown caret + a "done/total" lesson count per module; open-set state, FIRST module open
  by default; progress bar + mark-complete + BlockRenderer untouched.

## Audio autoplay change (owner request, same pass)

`AudioPill` (Storefront.jsx) now tries to **play unmuted immediately on load**. Browsers block
unmuted autoplay without prior interaction — that's a hard platform policy, not fixable in code —
so it's layered: (1) attempt `a.play()` on mount (succeeds when the browser allows it, e.g.
returning visitors with engagement history); (2) if rejected, one-time `pointerdown`/`keydown`
listeners start the music on the FIRST interaction anywhere on the page; (3) the pill stays a
manual toggle. Cleanup removes listeners + pauses on unmount. Net effect: music starts as
"automatically" as the web platform permits.

## Audio button bug — FIXED (Opus, same day)

Symptom: pausing the audio "turned it on again / spammed," plus console errors.

Two real bugs in the first (Fable) autoplay cut:
1. **Orphaned Audio (the spam).** It used `new Audio(url)` inside the effect. React **StrictMode**
   (dev) mount→unmount→remount runs the effect twice → TWO Audio objects. The effect cleanup
   raced the async `play().catch()`, so a leaked first Audio kept its armed window listener. A
   click then played BOTH tracks, and `audioRef` only pointed at one → `toggle` paused one while
   the orphan looped on = two overlapping tracks you couldn't fully stop.
2. **Pause-then-replay.** The window `pointerdown` "start on first interaction" listener fired on
   the very click used to pause, immediately replaying it.

Fix: let **React own ONE `<audio ref>` element** (no hand-rolled instances → no leak); drive the
`playing` icon from the element's **real `onPlay`/`onPause` events** (can't desync); add an
**`interacted` ref** (set on the pill's `onPointerDown`/`toggle`) so the auto-starter checks
`!interacted.current` and never undoes a manual pause; proper effect cleanup removes listeners +
pauses, guarded by a `cancelled` flag against the unmount/async race.

Reusable lesson: for media, **don't mirror element state into React state manually** — bind to the
element's own events, and let React manage the element (ref in JSX) rather than `new Audio()`.

## Deliberately NOT in this pass (future / Opus)
- WYSIWYG/HTML editors (Tiptap etc.) — raw HTML = sanitization burden; markdown avoids it.
- Course BUILDER UX overhaul (drag-reorder modules/lessons, etc.) — needs its own spec.
- R2/Bunny media infra (note 108 Phase 3) — deferred until media volume justifies it.
