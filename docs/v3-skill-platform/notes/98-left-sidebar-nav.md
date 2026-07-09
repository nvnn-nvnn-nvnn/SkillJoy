# 98 — Left vertical sidebar (app shell) + nav separation

_2026-07-08. Replaced the top horizontal nav with a left vertical sidebar, and
reorganized the nav so products / storefront-editing / services are distinct._

---

## Layout change

- **[Header.jsx](../../../src/components/Header.jsx)** rewritten: a fixed left rail
  (248px) on desktop; a sticky top bar + slide-in drawer on mobile (`max-width:900px`).
  Icon + label rows (lucide), grouped with section labels, active-state highlight.
- **Shell offset:** Header toggles a `body.has-sidebar` class; `.app-shell` (added to
  the shell wrapper in [main.jsx](../../../src/main.jsx)) gets `padding-left:248px`
  when present (0 on mobile). Because the rail is `position:fixed`, this is the only
  reflow needed, and it self-clears on pages where the sidebar hides (login,
  logged-out) — the class only applies while `showSidebar` is true.
- **CSS** in [App.css](../../../src/App.css): new `.sidebar` / `.sb-*` block. The old
  `.nav*` rules are now dead (no longer rendered) but left in place (harmless).

## Nav separation (the IA ask)

Grouped the sidebar so the three concepts are distinct destinations:
- **Create:** Products (`/build`) · Storefront (`/storefront/edit` — the *editor*,
  now separated from viewing) · Services (`/services`)
- **Grow:** Dashboard · Discover · Locker
- **Campus** (only if `LEGACY_MODE`): Matches/Swaps/Gigs/Orders/Disputes/Chat
- **Footer:** View my page (`/@handle` — the public storefront) · Profile · Notifications

Key split: "Storefront" now points at the **editor** (`/storefront/edit`), while the
public page moved to a distinct "View my page" link. Products and Services are their
own items.

## To check / possible follow-ups
- **Landing page** (`/`) when *logged in* gets the left offset (fine, but marketing
  pages are edge cases — logged-out visitors see it full-bleed as before).
- Pages that assumed a top nav bar now start at the very top on desktop — the page
  wrappers carry their own padding, so it should read fine; eyeball the busier ones
  (Dashboard, Services).
- **Open IA question:** is `/services` (ServicesDashboard) actually distinct from
  `/build` (product list), or redundant? The nav now separates them; the underlying
  pages may want reconciling later.

## Status
Build passes. Next: storefront editor.
