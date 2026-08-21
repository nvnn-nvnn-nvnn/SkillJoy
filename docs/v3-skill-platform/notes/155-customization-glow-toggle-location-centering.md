# 155 — Customization page: glow toggle, location, type scale, and two centering bugs

Date: 2026-08-20

Five asks in one pass: a master glow toggle, a location field, a more digestible
customization page, a centered loading state, and a centered click-to-enter splash. Three of
them turned out to be sitting on real bugs.

---

## 1. Glow toggle (`glow_enabled`)

New `DEFAULT_THEME.glow_enabled: true`. One switch in **General** that kills the accent halo on
the display name and the social icons.

**Read it as `glow_enabled !== false`, never as truthy.** Every store saved before this key
existed has it `undefined`; a truthy check would silently un-glow every existing storefront on
deploy. Same trap as `show_avatar` elsewhere in this file.

**Off collapses, it does not clear.** `--sf-glow`, `--sf-glow-strong` and `--sf-icon-glow` go to
`0px` while `glow_intensity` / `icon_glow` keep their stored values, so flipping the toggle back
restores the creator's exact look instead of resetting them to zero. Wiping the values would
have been the destructive shortcut.

### The one glow that did NOT follow
`animated_name` renders through `.sf-anim-name`, whose keyframes animate a **hardcoded
`text-shadow:0 0 18px`** — it never reads `--sf-glow`. So collapsing the vars left the name still
pulsing. It is now gated on `glowOn` at the class level in both `Storefront.jsx` and
`LivePreview`, and its toggle moved *inside* the glow subgroup — outside it, you could flip
"Pulse the name" with glow off and nothing would happen, which reads as broken.

**Transferable:** a "master switch" built on CSS variables only reaches effects that actually
read those variables. Grep for hardcoded values of the thing you are gating before assuming the
switch is complete.

`LivePreview` mirrors all of this. If it hadn't, the toggle would have looked inert until you
opened the live page.

---

## 2. Location

`profiles.location TEXT` — a real column, not a theme key, because it is profile *content* like
`bio`, not styling. Rendered under the handle with a `MapPin`, muted rather than accent (the
handle directly above already owns the accent; two accent lines fight the display name).

It sits in the storefront editor, not Settings, because it is **public page content** — the rule
is that *private* details (phone, email, address) live in Settings; a city shown on your public
page is the same class of thing as your bio.

**The trap:** `updateStorefront()` is an explicit destructuring whitelist —
`{ bio, storefront_theme, tracking_pixels, … }`. A new field added to the editor's `patch`
object is **silently dropped on save** with no error anywhere. Had to add `location` in three
places: the editor state, `updateStorefront`'s signature + patch, and the `select()` in
`getProfileByUsername` (which is also an explicit column list, so an unlisted column comes back
`undefined` and the page just never renders it).

---

## 3. Type scale + spacing

The page was dense and small. Bumped across the board — panel padding 20→26, field spacing
16→22, panel titles 16→18, field labels 11→12.5, notes 12→13 with a line-height, toggle labels
14→15, hints 12→13, seg buttons 13→14 with roomier padding, sub-nav items 14→15, and the toggle
switch itself 42×24→46×26 so it doesn't look undersized next to the larger text.

New `.std-subgroup`: an indented block with an accent left-rule, used for settings that only
exist while their parent toggle is on. Without it the glow sliders would float at the same visual
level as the switch controlling them, which is what made the panel hard to scan in the first
place.

---

## 4. & 5. The two centering bugs — same root cause

`Header.jsx` sets `showSidebar` for **every** route a logged-in user visits except `/login` and
`/onboarding` — *including a public storefront at `/@username`*. That puts `padding-left:248px`
on `.app-shell`.

`position:fixed` elements do not see that padding. So `.sf-splash { inset:0 }` covered the whole
viewport and centered its text on the **screen**, while the storefront content centered in the
**248px-offset area** — the click-to-enter text landed ~124px left of where the page visually
centers. The rail also paints at `z-index:200` vs the splash's `100`, so it drew over the gate.

> ⚠️ **Partly superseded — see [note 160](160-splash-centering-the-other-axis.md).**
> The fix below is HORIZONTAL only. On mobile `--shell-offset` is `0px`, so the
> splash stayed ~30px off-centre vertically under the 60px top bar. Note 160
> adds `top: var(--app-header-h)` to both layers.

**Fix:** a new `--shell-offset` on `body` (`248px` under `.has-sidebar`, `0px` on mobile where the
drawer overlays instead of pushing). Fixed overlays use
`top:0; right:0; bottom:0; left:var(--shell-offset, 0px)` instead of `inset:0`.

The loading state was worse and separately broken: it was
`<div className="sf-wrap"><p>Loading…</p></div>` — left-aligned at the top of the page, **and it
never rendered `<StoreStyles />`**, so none of the storefront CSS it referenced was even loaded.
The `notfound` branch right below it always had. Now a proper centered column with an accent
spinner, a `role="status"` live region, a reduced-motion fallback, and its styles.

**Transferable:** `position:fixed` is viewport-relative and cannot see an ancestor's padding.
Any app shell that offsets content for a fixed rail needs to publish that offset as a variable,
or every fixed overlay in the app is quietly off-center for logged-in users.

---

## Migration
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;
```
In `supabase/schema.sql`. **Must be applied before deploy** or saving a storefront errors on the
unknown column.

## Files
- `src/lib/storefront.js` (glow_enabled, updateStorefront whitelist) · `src/lib/profiles.js`
  (select) · `src/app-pages/Storefront.jsx` · `src/app-pages/StorefrontEditor.jsx` ·
  `src/App.css` (`--shell-offset`) · `supabase/schema.sql`
