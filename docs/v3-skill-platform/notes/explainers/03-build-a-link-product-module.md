# 03 — Learning module: build the "link product"

_A build-it-yourself guide. **No finished code in here on purpose** — it gives you
the decisions, the traps, and a build order. You write it._

**Goal:** an affiliate link that lives *down with the products*, rendered as a card
with a title, a description and its own call-to-action button — while the profile
link area up top goes back to being socials and community links.

---

## 1. First, name the actual problem

The current model has exactly two things that can appear on a storefront:

| | Profile links (`store_links`) | Products (`skills`) |
|---|---|---|
| Shape | label + url | title, description, cover, price, type badge |
| Where | pill buttons *inside* the profile panel | card grid *below*, in labelled groups |
| Grouping | none | `group_label` |
| Ordering | `position` | `sort_order` |
| Click goes to | an external site | `/@handle/:skillId` sales page |

You want a third thing: **product-shaped, but it leaves the site.**

Notice what that sentence contains. "Product-shaped" is about *presentation*
— cover, title, description, grouping, ordering. "Leaves the site" is about
*behaviour* — no checkout, no purchase row, no locker access.

> **The core insight of this whole module:** presentation and behaviour are two
> different axes, and the existing schema has them welded together. `skills` owns
> the card look *and* the purchase machinery. `store_links` owns leaving the site
> *and* the pill look. You need one corner of each, which is why neither table
> fits as-is.

Write that down before you touch a keyboard. Every decision below flows from it.

---

## 2. Three ways to build it — pick one, deliberately

### Option A — a new `kind` on `skills` (`kind = 'link'`)

Add `'link'` to the `kind` CHECK constraint in `skills`, treat it as a product
with a URL.

**You get for free:** grouping, `sort_order`, cover image, the card render, the
editor list, section assignment, the type badge — all of it, immediately.

**What fights you:** everything about `skills` assumes a *purchase*.
- The card links to `/@handle/:skillId`. Yours must go to an external URL.
- Publishing runs the **paywall gate** (`publishSkill` → `SUBSCRIPTION_REQUIRED`).
  Should adding an affiliate link require a paid plan? Probably not — but you
  would have to carve an exception into a money path, which is the riskiest code
  in the app to special-case.
- `price_cents`, `version`, `content_blocks`, `purchases` all become meaningless
  columns you must keep coherent anyway.

> **Heuristic:** inheriting a table means inheriting its *invariants*. Count how
> many you'd have to break before choosing this.

### Option B — extend `store_links` ⭐ recommended

Give links the fields they lack, plus a **placement** switch.

**Why this is the better fit:** the thing you're building genuinely *is* a link.
It has no price, no content, no buyer, no version. The only thing it's missing is
presentation. Adding presentation to a link is a much smaller lie than removing
commerce from a product.

It also solves your second request in the same stroke. You said the regular link
format is sometimes better suited to the products area — so make **placement a
property of every link**, not a new type. One field, both features.

**What fights you:** the products area currently renders one list. You'll have to
merge two differently-shaped lists into one ordered stream. That's §4, and it's
the real work of this project.

### Option C — a general `store_tiles` table

Anything can be a tile; products and links are both tile *sources*.

The "right" long-term architecture, and far too much for this feature. Note it as
where you'd go if a third and fourth tile type ever appear.

---

**Recommendation: Option B.** Smallest lie, no money-path changes, and it makes
placement general instead of bolting on a special case.

Now go argue with that yourself before you accept it. If you pick A or C, write
down why — a decision you can defend is worth more than the "right" one.

---

## 3. Design the data (before any UI)

Sketch the columns `store_links` needs. Current shape:
`id, creator_id, label, url, position, is_affiliate`.

Think through each addition and what it's for:

- **placement** — where it renders. Two values today. What should *existing rows*
  default to, so nobody's live page changes the moment you migrate?
- **description** — the sub-line on the card. Should the profile-area pill show
  it too, or ignore it?
- **cover_url** — reuse the `skill-covers` bucket and `uploadBanner`. Which
  entry in `LIMITS` (`src/lib/uploadLimits.js`, note 159) applies? Do you need a
  new one?
- **cta_label** — your "specialized button." What renders when it's blank?
- **group_label** — so a link can sit inside "My favorites" alongside products.
  Match the `skills` column *exactly* — same name, same type, same
  empty-string-means-ungrouped convention. Diverging here will cost you in §4.
- **sort_order** — note `store_links` already has `position`. Do you add a second
  ordering column, or reuse the one that exists? (Think about what `position`
  means once a link can live in two different places.)

> **Trap — the default value decides your blast radius.** Every existing link row
> gets whatever default you choose. Pick the one where live storefronts render
> **exactly as they do today** after the migration. New behaviour should be opt-in.

Write the migration as `028_link_placement.sql`. Copy the house style from
`026_product_groups.sql`: `ADD COLUMN IF NOT EXISTS`, idempotent, a comment
saying *why*.

Then — the step that is easy to forget — find every `.select()` that reads links
and add your columns. Grep `from('store_links')`. **A column you don't select is
a column that silently arrives as `undefined`**, and your UI will just never show
it, with no error to explain why. (Exactly the trap the `location` field hit in
note 155.)

---

## 4. The hard part: merging two ordered lists

The storefront builds `skillGroups` by bucketing skills on `group_label`
(`Storefront.jsx`, just after `glowOn`). You now need link-cards inside those
same groups.

Sit with this before coding. The questions, in order:

1. **What is the unit being sorted?** Right now it's a skill. It needs to become
   something that could be either. What's the minimum shape both can wear —
   `{ id, sortKey, render }`? Something richer?
2. **How do the two orderings interleave?** Skills have `sort_order`, links have
   their own. Two independent sequences both starting at 0. If a skill and a
   link both say `sort_order: 2`, who wins — and is that *stable* across
   reloads? (An unstable sort here means the page visibly reshuffles between
   visits. Ask what the tiebreaker is.)
3. **What creates a group?** Today a group exists because a skill has that
   label. Should a group with *only* links appear? What about a link whose label
   matches no existing group — new section, or dropped?
4. **Does the group count include links?** `.sf-groupcount` currently counts
   items in the group. If it counts only products, it's lying.

> **This is the part to design on paper.** Every one of those four is a decision
> a reader of your page will notice if you get it wrong, and none of them is
> forced by the code.

**A hint on shape, not a solution:** normalise both sources into one array of
plain objects *before* grouping, with a `type` field marking which it came from.
Group that array. Then the renderer switches on `type` at the leaf. The grouping
logic then never learns there are two tables — which is the whole point.

---

## 5. The render

Study `.sf-card` in `Storefront.jsx` — cover, body, title, outcome, foot with
price + `TypeTag`. Your link card is the same skeleton with three differences:

- `<a href>` with `target="_blank"`, not react-router `<Link>`. It leaves the site.
- `rel` must carry `sponsored` when `is_affiliate` — **and** the visible
  `.sf-afftag` from note 158. The rule from that note applies here too: an
  attribute only crawlers read is not a disclosure.
- The foot has a CTA button where the price is.

> **Reuse the class names.** If your link card invents `.sf-linkcard` with its own
> padding and radius, it will drift from `.sf-card` the first time someone
> restyles products, and the grid will look broken. Share the skeleton, add a
> modifier class for what differs.

And don't forget the profile area: it must now render only `placement='profile'`
links, or your links appear **twice**.

---

## 6. The editor

The "Link buttons" panel in `StorefrontEditor.jsx` grows a placement control and
the new fields.

- Which fields should be **hidden** when placement is `profile`? A cover image and
  description do nothing on a pill button — showing them promises something that
  won't happen. (`.std-subgroup` from note 155 exists for exactly this
  conditional-settings pattern.)
- The **live preview** must honour placement too, or the control looks broken
  until you open the real page. This is the same lesson as `glow_enabled` in note
  155 — a preview that ignores a setting is worse than no preview.
- Section assignment: where do you set a link's `group_label`? The **Sections**
  panel already manages groups for products. Extending it is more work but one
  concept for the creator; a separate control is easier but now they manage
  sections in two places. Your call — decide which confuses less.

---

## 7. Build order (each step ships something you can see)

Do them in this order. Each one is verifiable on its own, so a mistake is
localised instead of hiding inside four other changes.

1. **Migration + selects.** No UI. Verify in the Supabase table editor that a new
   column exists and that your storefront is **completely unchanged**. If
   anything moved, your default was wrong — fix it now, before UI hides it.
2. **Editor writes the fields.** No render changes. Set a link's placement to
   `products`, save, reload the editor, confirm it persisted. It should still not
   appear in the products area.
3. **Profile area filters by placement.** Now a `products` link *disappears* from
   the top. It is nowhere. That's correct and expected at this step.
4. **Products area renders it**, ungrouped, at the end. It reappears below.
5. **Grouping + ordering** (§4). The real work, and now it's the only thing that
   can be broken.
6. **Polish:** cover, CTA label, affiliate tag, empty states.

> Notice the shape: the risky step is fifth, by which point everything under it is
> proven. Sequencing work so the uncertain part lands last — on a foundation you
> already trust — is most of what "planning an implementation" means.

---

## 8. Traps, collected

- **Default values** decide whether existing storefronts change. (§3)
- **A column not in `.select()`** arrives `undefined`, silently. (§3, note 155)
- **Rendering in both places** if you filter one area and forget the other. (§5)
- **Unstable sort** across two sequences makes the page reshuffle. (§4)
- **The preview ignoring the new field** makes a working feature look broken. (§6)
- **`rel="sponsored"` is not a disclosure** — needs the visible tag. (note 158)
- **The global button reset in `App.css`** styles every bare `<button>` with
  `white-space: nowrap` and pill radius. Your CTA needs an explicit override or
  the label will clip. (This one has bitten this codebase before.)

---

## 9. Check yourself

You've finished when you can answer these without opening the code:

1. Where does a link with `placement='products'` and no `group_label` render, and
   why there rather than anywhere else?
2. A creator sets `sort_order: 2` on both a product and a link in the same group.
   What order do they render in, and will it be the same on the next page load?
3. Which of your changes would break if someone ran the migration but deployed
   the *old* frontend? What about new frontend, migration not yet run?
4. You add a third placement later ("footer"). How many files must change? If the
   answer is more than three, your placement handling is too scattered — where
   would you centralise it?

Question 3 is the one people skip. **Migrations and deploys are never
simultaneous**, so every schema change has a window where one side is ahead.
Knowing which direction is safe is what lets you ship without a maintenance
window.
