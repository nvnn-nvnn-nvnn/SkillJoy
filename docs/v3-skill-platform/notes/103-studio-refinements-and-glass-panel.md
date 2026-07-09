# 103 — Studio refinements: header dropdown, profile box, glass info panel

_2026-07-08. Follow-up fixes on the customization studio (note 102) + a structural
storefront change: the profile info now lives in one frosted glass panel._

---

## Layout correction
The sub-items (Site Customization / Links / Templates) moved **into the main header as
a dropdown under the "Storefront" tab** (not a left sidebar). Clicking Storefront ▾
opens a glass dropdown; the body is now controls + live preview (two columns).

## Storefront: single glass info panel (the "no bleed" fix)
Previously the name/bio sat directly on the background → text bled into busy images.
Now the header + products + links are wrapped in **`.sf-panel`** — a frosted glass
container (`background: color-mix(--surface, transparent)` + `backdrop-filter: blur`),
so text always sits on a readable surface. The **Profile opacity + blur sliders drive
this panel** (`--sf-panel-bg` / `--sf-panel-blur`): opacity 100/blur 0 = solid card;
lower opacity + blur = frosted glass showing the background through it. Product cards
inside revert to solid fills so they read as items within the panel. Mirrored in the
live preview (`.lp-inner` is the panel).

## Bug fixes from user testing
- **Banner "curling"** — removed the rounded bottom corners; flat edge-to-edge banner
  with a softer scrim.
- **Text color** — now applies to all body text (name/bio/muted), derived via
  `color-mix` from the chosen color, not just the name.
- **Profile info box** — the rewrite had dropped the bio editor; added a **Profile**
  panel (profile picture upload + display name + bio) at the top of Site Customization.
  `updateStorefront` extended to persist `full_name` + `avatar_url`; live preview uses
  the draft values.
- **Dark mode background** — explicit `.sf-mode-dark .sf-bg { background:#121316 }` so
  the canvas can't fall back to the app's light bg.
- **Dropdown z-index** raised so it can't hide behind panels.

## Reminder
skilljoy.me is the **Vercel** build — these are local until redeployed. Test on
localhost for instant HMR.

## Status
Build passes. Open items toward the full vision: drag-and-drop, real-frame preview,
fonts, video/audio background, particle field (all scaffolded "Soon").
