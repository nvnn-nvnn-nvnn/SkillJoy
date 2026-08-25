# 192 — Page order, embedded videos, and four controls that painted nothing

Date: 2026-08-25
Migrations: none — every key here is JSONB in `storefront_theme`

Six pieces of work. Four of them were **existing controls that had never done
anything**, which is the pattern of the day and the reason this note leads with
it rather than with the new features.

---

## 1 · Four dead controls, four different ways to be dead

| Control | Why nothing happened |
|---|---|
| Product text colour | the card set `--sf-item-fg`; its own children overrode it |
| Page-level link shape | every block carried a concrete `shape` that outranked it |
| CTA button colour | derived from the block *text* colour, no independent control |
| Glow on featured links | shared one target with profile links |

They look like one bug and are four. Worth separating, because the fix for each
is different and only one of them was a mistake in the usual sense.

### 1a · Overridden by its own children

```css
.sf-card       { color: var(--sf-item-fg, var(--text)); }   /* set correctly */
.sf-card-title { color: var(--text); }                      /* threw it away */
.sf-price      { color: var(--text); }
```

The control wrote the theme key, the wrap emitted the variable, and the card
consumed it — then the two elements that actually show text hardcoded
`--text`. So the only thing that control ever painted was the card's border.

The preview had **no** `--lp-item-fg` at all, so it agreed with the bug.

> **Transferable:** setting `color` on a container only works if nothing inside
> re-sets it. When a colour control does nothing, check the leaf, not the root.

### 1b · Correctly outranked, silently

Page-level `link_shape` was being beaten by `layout.shape` on every block —
which is the cascade working exactly as designed (block → page → theme).

Note 180 §2 changed the block default to `''` so blocks *inherit*. Blocks
created before that carry a concrete value, and nothing migrated them. So an
account that never touched a block-level shape control still overrides the page
on every block.

The cascade is right. What was wrong is that **the losing control said nothing**.
It now reports:

> **2 link blocks are overriding this** (My Links, AFFILIATE LINKS) — a block's
> own shape always wins. **[ Use this shape everywhere ]**

The button writes `shape: ''` to each overriding block: it **removes what was
winning** rather than guessing a replacement, so the block goes back to
inheriting — which is what `''` means everywhere else in this system.

This is the inverse of LANDMINES §13. There a control existed and nothing
listened; here everything listens correctly and something nearer the element is
louder. Both feel identical to the person using it, which is why the fix has to
be feedback rather than a precedence change.

### 1c · Two things sharing one colour

`.lkb-cta` derived its fill from `--lkb-fg`, the block's **text** colour. So
changing your link text repainted the button, and dark-text-on-bright-button was
unexpressible. They are different surfaces.

Now `ctaBg` / `ctaFg` per block, plus `link_cta_color` / `featured_link_cta_*`
at page level — the same block → featured → page → derived cascade every other
link colour already uses. All default `''`, so nothing changes appearance until
touched.

Both levels exist because the per-block version alone meant setting the same
colour four times for four featured blocks, and the page-level panel is where
people look first.

### 1d · Two things sharing one glow

`glow_targets` had one `links` entry covering both regions. Profile links sit
*inside* the card; featured links sit on the raw background — so the glow that
flatters one blows out the other. They were already separate for colour, shape,
opacity and blur. Glow was the last shared control.

**The migration detail that matters:** a theme saved before the split lists
`'links'` but not `'featured'`. Read naively, every existing storefront silently
loses its featured glow — something the creator never switched off.

```js
if (id === 'featured') return t.includes('featured') || t.includes('links');
```

> **Transferable:** splitting one option into two is a data migration wearing a
> UI change's clothes. The old value has to keep meaning what it meant.

---

## 2 · Page order

Everything below the profile card is now reorderable: **Featured links ·
Videos · Products · Email signup**.

The profile card stays fixed — it carries the avatar, name, bio and profile
links, so it is the page's identity header rather than a section.

This also closes the email-capture complaint from explainer 05 §3 for free. The
subscribe box was hardcoded below the products where nobody scrolls; it can now
sit directly under the bio.

### The resolver is the whole feature

`resolveSectionOrder` never trusts the saved array:

| saved | result |
|---|---|
| `['email','products']` | missing ids **appended** |
| `['products','GONE','email']` | stale id **dropped** |
| `['email','email','videos']` | **deduped** |
| `'nope'` | default order |

Two silent failures that prevents. A section added to `PAGE_SECTIONS` *after*
someone saved their order would be absent from their array and would never
render for them. And a repeated id renders its section twice with clashing React
keys.

New sections append at the **bottom**: they appear rather than vanish, and they
do not displace what someone deliberately put on top.

**I found the dedupe case by testing the function, not reading it.** The editor
cannot produce a duplicate — but an imported theme can, and that function exists
precisely to make bad input safe.

### Moved, not rewritten

Each section entry is the same JSX that was previously inline, relocated into a
lookup keyed by section id. Nothing was retyped, so the sections cannot have
drifted from how they used to render.

`moveSection` writes the **full resolved order**, not a patch — so a theme
missing a section is repaired the first time anything moves.

**The bug this nearly shipped with:** the first pass left the old preview JSX in
place below the new map, so every section rendered twice. Caught by counting
occurrences per renderer rather than by looking at the screen.

---

## 3 · Embedded videos, capped at two

YouTube, Shorts, Vimeo, TikTok. `MAX_PROFILE_VIDEOS = 2`.

**TikTok was not supported.** `toEmbed` handled YouTube and Vimeo only, which is
notable given TikTok is the format most creators would paste.

Rewritten as `describeEmbed`, returning `{ src, kind, vertical }` rather than a
bare URL. **Orientation is the point:** a TikTok is 9:16 and a YouTube is 16:9,
and a caller that only gets a src has to guess — guessing wrong letterboxes a
vertical video into a wide black box, which is how most embedded TikToks end up
looking broken. YouTube **Shorts** are detected as vertical too, since that is
what people actually paste. `toEmbed` still exists unchanged for old callers.

### Three decisions worth keeping

**The cap is enforced twice** — the editor won't let you add a third, and the
renderer slices anyway. The editor is a courtesy; the renderer is the guarantee,
because a theme can arrive by import or template and never touch the editor.

**`allow-same-origin` is deliberately absent** from the iframe sandbox. These
are third-party frames and have no business reading anything of ours. Plus
`loading="lazy"` and a strict referrer policy.

**The preview shows a placeholder, not a live player.** Two third-party embeds
inside a 300px frame that re-renders on every slider drag would be slow, and
would start playing audio while someone is picking colours. The stand-in renders
the *shape*, which is what tells you how much of the page the video takes.

---

## 4 · Heading controls, and a default that is not empty

Block headings gained **style** (Panel / Plain), **alignment**, and **show/hide**.

The panel — a tinted, blurred background behind the heading — is what gives
featured links contrast over artwork. Built from the block's own text colour via
`color-mix`, so it inherits the existing cascade and needed no colour control of
its own.

**`titleStyle` defaults to `'bar'`, not `''`** — the opposite of what note 180
§2 established for `shape`. That is deliberate: `shape` must default empty
because there is a page-level value to inherit. There is no page-level *heading
style*, so a concrete default is correct. It does change existing blocks, which
is a visible change nobody made block-by-block.

**Hiding is not deleting.** The toggle flips a layout flag and never touches
`block.title`, so hide-then-show returns your words. And a hidden title never
renders its panel — an empty tinted bar is worse than no heading. The
collapsible toggle still renders, because hiding a title must not hide the
control that opens the block.

---

## 5 · Two spacing bugs

**Featured links had no side margin.** Profile blocks live inside `.sf-panel`
and inherit its padding; featured blocks render *outside* it and had only
`margin-top`. Two link columns of different widths on one page, with the
featured one flush to the edge.

Aligned to the card's **content** edge, not its outer edge, so a link button is
the same width wherever it appears.

That number is now `--sf-panel-pad`, read by four rules — two of them negative
margins that exist to cancel it. Note 186 flagged those as duplicated constants
and left them; they can no longer drift.

**Pill links had no room at the ends.** A 999px radius eats its own width: the
curve starts half the height in from each edge, so text padded for a square
button sits on the curve. Driven by `--lkb-xpad` rather than a selector, because
the shape itself is a variable — it can come from the block *or* the page, and a
selector could only see one.

---

## 6 · Mobile background video: a hardcoded rule became a setting

I had disabled background video on phones outright (note 189 §7). The reasons
were real — iOS Low Power Mode blocks autoplay with no API to detect it, and a
multi-megabyte file over cellular is expensive — but the call was not mine to
make. Plenty of phones play it fine, and turning it off for all of them meant
the feature did not exist for most visitors.

`bg_video_mobile`, **default on**. The split:

- **The creator's call** — whether phones get video at all
- **The visitor's call** — `prefers-reduced-motion`, Save-Data, 2G. Explicit
  settings someone chose on their own device. No creator preference overrides
  those, so they are checked unconditionally.

> **Transferable:** when you catch yourself protecting users from a feature
> their product owner chose, check whether you are encoding a *preference* as a
> *rule*. Preferences belong in settings. The only things that stay rules are
> the ones the end user themselves asked for.

---

## Files
`src/lib/storefront.js` — `section_order`, `PAGE_SECTIONS`,
`resolveSectionOrder`, `videos`, `MAX_PROFILE_VIDEOS`, `icon_size`,
`bg_video_mobile`, four CTA colour keys, glow target split
`src/lib/embed.js` — `describeEmbed` (TikTok, Shorts, orientation)
`src/lib/blocks.js` — `titleStyle`/`titleAlign`/`titleShow`, `ctaBg`/`ctaFg`
`src/app-pages/Storefront.jsx` — ordered sections, video embeds, panel-pad
variable, product text colour, pill padding, icon size
`src/components/LinkBlock.jsx` — heading panel, CTA colours, pill padding
`src/components/LinkBlockEditor.jsx` — heading controls, CTA colour rows
`src/app-pages/StorefrontEditor.jsx` — Page order panel, Videos panel, override
notice, CTA colours, icon size, preview parity throughout

## Still open
- Nothing migrates pre-180 blocks off their concrete `shape`. The button fixes
  it per-account on demand; a migration cannot tell "left over from an old
  default" from "deliberately chosen", which is why it is a button.
- `titleStyle: 'bar'` changes existing blocks on next load.

---

## Exercises

1. **Find the next 1a.** Grep for elements that set `color:` and also contain
   children that set `color:`. Which other theme colour controls are painting
   only a border?

2. **Break the glow migration.** Remove the `|| t.includes('links')` fallback,
   then load a theme saved before the split. What did the creator lose, and how
   would they have described it in a bug report?

3. **Test the resolver, do not read it.** Write five inputs to
   `resolveSectionOrder` that a human would never type but a file could contain.
   Which does it survive? Add the one it does not.

4. **Count the renders.** After moving a section into the order map, how would
   you confirm nothing renders twice *without* looking at the page? Write the
   check.

5. **Argue the default.** `titleStyle` defaults to `'bar'` and `shape` defaults
   to `''`. State the rule that makes both correct, then find a third key in
   `DEFAULT_BLOCK_LAYOUT` and decide which side it belongs on.

6. **Take a rule away.** Find another place in this codebase where a hardcoded
   decision is protecting users from something the creator chose. Decide whether
   it should become a setting, and what the visitor still gets to override.

---

# Appendix — the solutions, in code

Each fix below is the smallest change that made the behaviour correct, plus the
reasoning that chose it over the obvious alternative.

## A · Product text colour

**Symptom:** the picker wrote `item_text_color`, the wrap emitted
`--sf-item-fg`, the card consumed it, and the text stayed black.

**Found by** listing every element inside `.sf-card` and grepping each for
`color:`. The parent was innocent; two children were not.

```css
/* before — parent correct, children override it */
.sf-card       { color: var(--sf-item-fg, var(--text)); }
.sf-card-title { color: var(--text); }
.sf-price      { color: var(--text); }

/* after — the leaves read the same variable */
.sf-card-title { color: var(--sf-item-fg, var(--text)); }
.sf-price      { color: var(--sf-item-fg, var(--text)); }
```

**Rejected:** `!important` on `.sf-card`. It would have worked, and it would
have hidden the fact that two rules disagreed — making the next colour control
fail exactly the same way.

The preview had no `--lp-item-fg` at all, so it was added and consumed by
`.lp-card-title` / `.lp-price`. Otherwise the preview would have kept agreeing
with the bug.

## B · The shape override notice

**Found by** querying the data rather than reading CSS:

```
theme.link_shape:  "sharp"
block "My Links"         layout.shape: "rounded"   ← wins
block "AFFILIATE LINKS"  layout.shape: "square"    ← wins
```

```jsx
const shapeOverrides = (blocks || []).filter(bl => (bl.layout?.shape || '') !== '');

async function clearShapeOverrides() {
  for (const bl of shapeOverrides) await updateBlockLayout(bl.id, bl.layout, { shape: '' });
  setBlocks(await listBlocks(user.id));
}
```

Writing `''` rather than the page's current value is the whole point: `''` means
*inherit*, so the block keeps following the page control afterwards. Writing
`'sharp'` would have fixed today's symptom and re-created the bug the next time
the page shape changed.

**Rejected:** making page-level win over blocks. That is a precedence change to
fix a *communication* problem, and it would break every creator who set a
per-block shape deliberately.

## C · CTA colours, and where they sit in the cascade

```css
/* before — the button WAS the text colour */
background: color-mix(in srgb, var(--lkb-fg, …) 88%, black);
color: #fff;

/* after — four levels, each falling through to the next */
background: var(--lkb-cta-bg,          /* this block      */
            var(--sf-cta-bg,           /* page / featured */
            color-mix(in srgb, var(--lkb-fg, var(--sf-link-fg, var(--accent))) 88%, black)));
color:      var(--lkb-cta-fg, var(--sf-cta-fg, #fff));
```

The derived expression stays as the final fallback, so **a block that sets
nothing looks exactly as it did before**. That is what made this safe to ship
without touching anyone's existing page.

Featured overrides page by rebinding the same variable on the section wrapper:

```js
if (theme.featured_link_cta_color) v['--sf-cta-bg'] = theme.featured_link_cta_color;
```

`LinkBlock` needs no idea which region it renders in — the wrapper answers that
by shadowing the variable. Same trick as the link colours.

## D · Splitting one glow target into two

```js
const on = (id) => {
  if (!glowOn) return false;
  const t = theme.glow_targets;
  if (!Array.isArray(t)) return true;              // predates the key entirely
  if (id === 'featured') return t.includes('featured') || t.includes('links');
  return t.includes(id);
};
```

Three states, three different correct answers:

| saved value | meaning | answer |
|---|---|---|
| `undefined` | predates the whole feature | all targets on |
| `['links']` | predates the split | both link regions on |
| `['links','featured']` | saved since the split | exactly as listed |

Only the middle row needed thought, and getting it wrong turns a UI change into
silent data loss for every existing account.

## E · Section order

```js
export function resolveSectionOrder(theme) {
  const known = PAGE_SECTIONS.map(s => s.id);
  const saved = Array.isArray(theme?.section_order) ? theme.section_order : [];
  const kept  = [...new Set(saved.filter(id => known.includes(id)))];
  return [...kept, ...known.filter(id => !kept.includes(id))];
}
```

Four lines, four guarantees: non-array → default · unknown id → dropped ·
duplicate → collapsed · missing id → appended at the bottom.

Rendering became a lookup:

```jsx
{resolveSectionOrder(theme).map(id => {
  const section = { featured: …, videos: …, products: …, email: … }[id];
  return section || null;
})}
```

**The bug this nearly shipped with:** the first pass added the map but left the
original inline JSX below it, so every section rendered twice. Caught by counting
class occurrences per file, not by looking at the page:

```
featured  live=1  preview=1
videos    live=1  preview=1
products  live=1  preview=1
email     live=1  preview=1
```

A visual check would have shown *something* on screen and looked plausible.

## F · Orientation-aware embeds

```js
// YouTube Shorts are VERTICAL, and are what creators actually paste.
const shorts = u.pathname.match(/^\/shorts\/([\w-]+)/);
if (shorts) return { src: `…/embed/${shorts[1]}`, kind: 'youtube', vertical: true };

// TikTok — the numeric id is the last segment. The @handle in front of it is
// decorative and changes when someone renames, so it is never used.
if (host.endsWith('tiktok.com')) {
  const id = u.pathname.split('/').filter(Boolean).pop();
  if (/^\d{6,}$/.test(id || '')) {
    return { src: `https://www.tiktok.com/embed/v2/${id}`, kind: 'tiktok', vertical: true };
  }
}
```

Returning `{ src, kind, vertical }` instead of a bare string is what lets the CSS
apply `aspect-ratio: 9/16`. Without it every embed is 16:9 and a TikTok renders
as a thin strip inside a wide black box.

Verified against six URL shapes **before** any UI was wired:

```
tiktok 9:16    https://www.tiktok.com/embed/v2/7212345678901234567
youtube 9:16   https://www.youtube.com/embed/abc123XYZ      (Shorts)
youtube 16:9   https://www.youtube.com/embed/dQw4w9WgXcQ    (watch?v=)
youtube 16:9   https://www.youtube.com/embed/dQw4w9WgXcQ    (youtu.be)
vimeo 16:9     https://player.vimeo.com/video/76979871
null           —                                            (not a video)
```

## G · Pill padding as a variable

The shape can come from the block *or* the page, so a CSS selector can only ever
see one of them:

```jsx
...(shapeRadius === '999px' ? { '--lkb-xpad': '26px' } : null),
```
```css
.lkb-item              { padding-inline: var(--lkb-xpad, 15px); }
.sf-lnk-oval .lkb-item { --lkb-xpad: 26px; }   /* page level, non-overriding blocks */
```

The block sets its own padding at the same moment it sets its own radius — one
decision, one place. The page-level rule covers blocks that did not override.

## H · One number for the panel inset

`--sf-panel-pad` replaced a `26px` that appeared in four rules, two of them
negative margins whose only job is to cancel it:

```css
.sf-wrap { --sf-panel-pad: 26px; }
.sf-panel                { padding: 34px var(--sf-panel-pad) 30px; }
.sf-featured             { padding-inline: var(--sf-panel-pad); }
.sf-panelbanner          { margin: -34px calc(-1 * var(--sf-panel-pad)) 16px; }
.sf-lnk-full .sf-linkbtn { margin-inline: calc(-1 * var(--sf-panel-pad));
                           padding-inline: var(--sf-panel-pad); }
```

Note 186 identified these as duplicated constants and left them. Changing the
padding used to misalign the banner and the full-width links by a few pixels,
with no error anywhere.
