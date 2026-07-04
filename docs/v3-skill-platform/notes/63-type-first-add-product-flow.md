# 63 — Type-first "Add product" flow (expert guide)

_Session 2026-07-02. Goal: make creating a product feel like Stan Store — a
dedicated, type-first, guided flow — instead of dumping every product into one
generic editor. This note is written as a **concept guide** so future-you can
re-derive the design, not just the diff._

---

## 1. The problem we're solving

Before this change there were two truths in tension:

- We already had the **vocabulary** of a Stan-like store: a `skills.kind` enum
  (`digital / course / coaching / membership / webinar / lead / bundle`), a
  block system (video / file / prompt / workflow / guide / coaching), and a
  `/services` dashboard with a product-type catalog.
- But the **creation flow ignored all of it.** Clicking "New" anywhere ran
  `createSkill({ title: 'Untitled Skill' })` and dropped you into ONE long
  generic scroll (`/build/:id`). `kind` was a trailing `<select>` afterthought.

So the app *could* describe seven product types but *treated them all
identically at the moment of creation.* That's the "vibe-coded" feel: no
sense that the tool understands what you're making.

## 2. What Stan actually does (the pattern we're copying)

Researched from Stan's own help docs (article 14 "Sell a Digital Download",
article 422 "Launch your first product"). Two ideas matter:

1. **Type-first.** "Add Product" opens a **picker of product types** first. You
   commit to *what* you're building before you see a single form field. This is
   a deliberate funnel: the choice narrows everything downstream.
2. **Guided, tailored editor.** After picking, you get a **tabbed** editor whose
   tabs/fields are specific to that type. For a digital download:
   - **Thumbnail** — how it looks in the store (style, 400×400 image, title,
     subtitle, button text)
   - **Checkout page** — the sales page (1920×1080 banner, description + body,
     CTA text, price + discount codes + quantity limit, custom buyer fields)
   - **Delivery** — upload a file **or** redirect to a URL
   - **Options** — reviews, email flows, order bumps, confirmation email
   - then **Publish / Save as draft**

**Key mental model — three orthogonal axes.** Keep these separate in your head;
conflating them is what makes product builders rot:

| Axis           | Column / concept        | Question it answers      |
|----------------|-------------------------|--------------------------|
| **Kind**       | `skills.kind`           | *What is this?* (digital, course…) |
| **Pricing**    | `skills.pricing_type`   | *How does it bill?* (onetime, membership) |
| **Content**    | `blocks` (block types)  | *What does the buyer get?* |

A coaching call can be one-time; a membership-kind is usually (not always)
`pricing_type='membership'`. Kind drives the *builder shape*; pricing drives
*checkout*; blocks are the *payload*.

## 3. What we built this pass (Phase A, chunk 1)

Only the **type-first entry point** — the dedicated picker page. The tailored
tabbed editor is the next chunk (see §5).

- **`src/lib/productTypes.js`** — NEW. The single source of truth for the type
  catalog (`PRODUCT_TYPES` + `TYPE_BY_ID`). `id` matches the `skills.kind` enum.
  `built: true` means it has a real builder + checkout path today
  (only `digital` + `coaching`); the rest render as "Soon" and can't be created
  yet. **Why extract it:** the catalog was previously duplicated inside
  `ServicesDashboard.jsx`. One list, imported everywhere, so adding a type or
  flipping `built` happens in exactly one place.

- **`src/app-pages/AddProduct.jsx`** — NEW page at **`/build/new`**. The sleek
  "What do you want to sell?" gallery. Picking a *built* type calls
  `createSkill(userId, { kind, title: '' })` and routes to `/build/:id`; unbuilt
  types are disabled with a "Soon" chip. This is the dedicated page Stan uses
  (we intentionally replaced the old modal — a full page has room to breathe and
  is linkable/bookmarkable).

- **Rewired every "New" entry point** to `/build/new`:
  - `ServicesDashboard.jsx` — both "New product" buttons now `navigate('/build/new')`;
    the in-page product-type **modal was deleted**, along with its now-dead
    `showNew` state and `createOfKind`. Refactored it to import the catalog from
    `productTypes.js`.
  - `Dashboard.jsx` — header "+ New product" → `/build/new`.
  - `SkillBuilder.jsx` — the list header button and empty-state CTA are now
    `<Link to="/build/new">`; removed the old direct-create `newSkill()` path so
    there's exactly ONE way to create a product (type-first). Everything is
    consistent now.

- **Routing:** `main.jsx` adds `/build/new` **before** `/build/:skillId`. React
  Router v6 ranks static segments above dynamic ones, so `new` wins over
  `:skillId` regardless of order — but we list it first for human clarity.

### Naming note
UI copy shifted "Skill/Service" → **"product"** on the create path
("New product"), matching the creator's mental model and Stan's language. The
data model is unchanged — it's still `skills` rows under the hood.

## 4. Why this is the right seam

The picker owns exactly one decision (**which `kind`**) and then hands off. That
keeps the builder free to become type-aware *without* the picker needing to know
anything about how each type is edited. When we build the course editor later,
the picker doesn't change — only the builder branches on `kind`.

## 5. What's next (not done yet)

- **Phase A chunk 2 — tabbed, type-aware builder.** Turn the single-scroll
  `/build/:id` into tabs (Details / Content / Checkout / Publish) and branch the
  fields on `skill.kind`. Add the sales-page fields Stan has and we lack:
  subtitle, CTA button text, discount-code toggle, quantity limit. For
  `digital`, foreground "upload your file OR redirect URL" as a first-class step
  rather than a generic 'file' block.
- **Phase B — declutter the dashboards.** Fold `/dashboard`'s ~7 stacked panels
  into tabbed sections (Overview / Sales / Audience / Settings) and unify its
  visual language with `/services`.
- **Unbuilt kinds.** Each of course / membership / webinar / lead / bundle needs
  a real builder + checkout before flipping `built: true` in `productTypes.js`.

## 6. If something breaks

- "New" buttons 404 → confirm the `/build/new` route sits before
  `/build/:skillId` in `main.jsx` and `AddProduct` is imported.
- Missing icon crash in `/services` → the product-type lucide icons now live in
  `productTypes.js`; only icons used *directly* in `ServicesDashboard` (Repeat,
  Boxes, etc.) remain in its own lucide import.
