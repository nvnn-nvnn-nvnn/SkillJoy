# 92 — Onboarding redesign + link-in-bio positioning + availability grid

_2026-07-08. First surface of the "elevate the default UI" initiative. Chosen
direction: **premium light** (keep the warm identity, raise polish/hierarchy/depth)
— not the dark guns.lol look, which is reserved for the future customizable profile
pages. Onboarding is the proof-of-direction slice; this visual language rolls out to
the rest next._

---

## 1. Onboarding redesign (`src/app-pages/auth/Onboarding.jsx`)

All logic preserved verbatim (debounced username check, Google-name prefill, save,
`viewMode`/ProfileView). Only render + styles changed.

- **Split-panel shell** — one rounded, softly-shadowed container split into a warm
  branded value panel (logo, headline, benefit checklist, live link preview) + the
  form card. Reads as "designed," not templated. Collapses to single column on mobile;
  in `viewMode` (existing profile) the brand panel is dropped and the card goes solo.
- **Live link preview** — the brand panel shows `skilljoy.me/@<handle>` filling in as
  the user types.
- **"Claim your handle" input** — inline live state (mini-spinner → ✓/✕), colored
  border, "@handle is yours ✨" confirmation.
- **Segmented progress** ("Step 1 of 2 · About you") replaced the busy step-dots;
  smooth per-step fade/slide transition.
- Restrained ambient warmth (soft radial tints, no hard glows), stronger type scale.

## 2. Link-in-bio positioning (copy)

Reframed the messaging so SkillJoy reads as a **customizable link-in-bio / linktree
that also sells** (the guns.lol-adjacent identity), not merely a "storefront":
- Headline "Your link in bio, built to sell."; sub about a customizable page for all
  links/socials + selling.
- Benefits: customizable link-in-bio page · all links & socials in one place · sell
  products/courses/memberships.
- Step 1 wording: "set up your **page**" / "your **page** link".

This seeds the mental model for the upcoming **customizable profile page** feature
(guns.lol-style layouts) — that's a separate, larger build; this is just positioning.

## 3. Availability → day × time-of-day grid

The old step 2 was a flat chip list off `AVAILABILITY_OPTIONS`. Now it's a proper
**7 days (Mon–Sun) × 3 time-of-day (Morning / Midday / Evening)** toggle grid
(header row + a row per day, tappable cells).

**Data model (important):** `profiles.availability` stays a **flat string array** —
selections are stored as `"<Day> <Time>"` combos (e.g. `"Monday Morning"`). Chosen
because:
- The column type is unchanged (no migration).
- The **legacy** Gigs/GigDetails filters match availability by *substring* on day name
  and time-of-day word — `"Monday Morning"` still satisfies `slot.includes("Monday")`
  and `slot.includes("Morning")`, so legacy filtering keeps working.
- The UI derives selection state directly: `availability.includes(\`${day} ${time}\`)`
  — no parse/serialize step.

Note: the v3 coaching booking system uses a **separate** `profiles.booking_availability`
(weekly hours + timezone, via `AvailabilityEditor`/`booking.js`) — untouched. The
onboarding `availability` field is the lighter legacy one. (Open question for later:
whether onboarding availability should feed `booking_availability` instead — deferred.)

## Status
Build passes. Direction confirmed by user ("good good"). **Next:** propagate the
premium-light language to the dashboard, storefront, builder, and locker; then the
big one — the **customizable guns.lol-style profile page** (its own initiative).
