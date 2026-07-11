# 114 — Locked onboarding + v1 ProfileView removal + phone in onboarding

_2026-07-11._

## What & why

Three tightly-related fixes:

1. **Onboarding is now a locked, chrome-free flow.** A user reported leaving via the
   still-visible header mid-onboarding and corrupting the setup.
2. **Removed the SkillJoy v1 ProfileView** that showed after onboarding (leftover from the
   original gig/swap iteration).
3. **Onboarding now collects + saves phone.** It had phone *state* but **no input** — phone
   was only inherited from signup metadata, so Google/OAuth users saved `null`.

## Changes

- **`components/Header.jsx`** — `showSidebar` now also false on `/onboarding` (was already
  hiding on `/login`). No sidebar/nav during onboarding.
- **`components/Footer.jsx`** — returns null on `/onboarding` (like `/chat`).
- **`app-pages/auth/Onboarding.jsx`:**
  - Removed `ProfileView` import + the `viewMode` state + the whole view-mode branch. The page
    always renders the setup form now.
  - Removed the **Exit / Cancel** button (the escape hatch).
  - Added a **required Phone** input (type=tel, prefilled from metadata if present) with a
    "Private — verification, never shown" note; `save()` now validates phone is non-empty.
  - Effect redirects an already-onboarded user (has `username`) straight to `/build` — so a
    completed user never lands back on the form.
- **`main.jsx`** — new `<OnboardingGate />` (rendered in `AppRoutes`). If a logged-in user has
  no `username` and is on a protected app route (`/build /dashboard /storefront /locker
  /discover /settings`), it redirects to `/onboarding`. This is the robustness layer: even if
  they use browser-back or a manual URL, they can't slip into the app mid-onboarding. Public /
  marketing / storefront pages are intentionally NOT gated (avoids trapping guest buyers /
  logged-out browsing).

## Audit: is there a duplicate onboarding page? (No.)

Checked — there is **exactly one** onboarding page: `/onboarding` → `Onboarding.jsx`. The
"two onboardings" impression comes from **two surfaces both collecting phone + name**:
1. **Login signup form** (`Login.jsx`, `mode==='signup'`) — Full name + phone + email + password
   → stored in `user_metadata`.
2. **Onboarding** — name (only if not already captured) + phone + handle + bio.

The *"only phone"* variant someone saw = Onboarding with the name field auto-hidden
(`showNameField` false when the name arrived via signup/Google metadata) → it shows phone +
handle + bio, name hidden. Same page, conditional field. `Profile.jsx` (`/profile`) is a
separate legacy account page (avatar/ratings/Stripe-onboard/"Set up storefront" link), NOT
onboarding.

**Intended design (confirmed):** signup CAPTURES phone → onboarding PRE-FILLS + user CONFIRMS
(not re-enter). Implemented:
- Onboarding phone field is prefilled from `user.user_metadata.phone` (new-user branch) or
  `profile.phone`; label changed to **"Confirm your phone number"** + hint "Pulled from
  sign-up — double-check it's correct."
- **SkillJoy green logo** (`assets/skilljoy-green.svg`) added top-left of the onboarding brand
  panel (replaces the old text "SkillJoy"), since the header/logo is hidden during onboarding.

## Bug: "Please enter your name" with no name field (FIXED)

**Symptom:** onboarding rejected save with "Please enter your name." but showed no name input.

**Root cause — a hidden-but-empty field.** Two pieces disagreed:
- The render hid the name field via `showNameField = !!profile?.full_name || !nameFromAccount`,
  where `nameFromAccount` = "metadata has a name." So if signup/Google metadata had a name, the
  field was hidden (assumption: "we already have it, skip straight to the handle").
- But the prefill effect only read the name **from metadata when there was NO profile row**
  (`else` branch). When a profile row already existed with `full_name = null` — exactly what a
  **Google signup** produces (a row is created, name column null) — the `if (profile)` branch set
  `fullName = profile.full_name ?? ''` = **empty**, and never fell back to metadata.

Net: metadata had a name → field hidden; profile row existed with null name → value empty → the
required-name validation failed with no field to fix it. Dead-end, Google-signup-specific.

**Fix (two parts):**
1. **Prefill always falls back to metadata**, even when a profile row exists but its fields are
   null: `setFullName(profile?.full_name || meta.full_name || meta.name || '')` (same for phone:
   `profile?.phone || meta.phone || ''`). One unified prefill path, no `if (profile)` vs `else`
   split. So the name/phone actually populate for Google rows.
2. **The name field always renders now** (prefilled + editable) — removed `showNameField` /
   `nameFromAccount` entirely. Same "prefill + confirm" model as the phone field. A required field
   can never be hidden again.

**Lesson (the reusable one):** never gate the *visibility* of a required field on a different
signal than the one that *populates* its value. If validation requires X, either always show X's
input or guarantee X is non-empty when hidden — deriving "hide it" and "fill it" from different
conditions is how you get an unfixable form.

Onboarding field order now: **Your name** (prefill) → **Confirm your phone number** (prefill) →
**Your page link** (handle) → **Bio** (optional). No hidden required fields.

## Notes
- "Incomplete" = no `username` (the core identity field). Existing users who have a username but
  no phone are NOT force-redirected (they'd hit the publish gate → Settings instead, per
  note 113). New users must fill phone in onboarding.
- Phone lives in BOTH onboarding (initial capture) and Settings (later edit) — both legitimate.
  The storefront editor still has none (personal-info separation rule, note 113 / memory).
- Dead CSS `.onb-shell-solo` left in place (harmless; was the viewMode single-column variant).
- `ProfileView`/`Profileview.jsx` is now unreferenced by onboarding; still on disk (may be used
  by other legacy pages). Not deleted.
- `vite build` ✅.
