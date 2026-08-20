# 01 — How SkillJoy works (full architecture)

_The one map. Read top-to-bottom once; after that, jump to the section you need.
Every section points at real files so you can go read the source, not vibes._

---

## 0. The 60-second mental model

SkillJoy is **Linktree + a store**: every creator gets one public page at
`skilljoy.me/@handle` where they sell things (courses, downloads, coaching,
memberships) and where the page's *entire look* is deeply customizable.

Three moving parts:

1. **A React single-page app (SPA)** — everything the browser runs. Built with
   Vite. This is 95% of the codebase.
2. **Supabase** — the database (Postgres), user auth, and row-level security.
   The SPA talks to it directly for most reads/writes.
3. **A small Express backend** (`backend/`) — exists for **one reason: money**.
   Anything touching Stripe (charging a card, payouts, webhooks) must run on a
   server with secret keys, never in the browser.

> One sentence to remember: **the browser talks to Supabase for data, and to the
> Express backend only for Stripe.**

---

## 1. The stack, and why each piece is here

| Piece | What | Why this choice |
|---|---|---|
| **React 19 + Vite** | The SPA | Fast dev, and the app is mostly authed/interactive screens — SPA territory. (See the Next.js discussion: SSR would only help the *public* pages.) |
| **react-router-dom** | Client-side routing | `main.jsx` maps URLs → page components. No server round-trip on navigation. |
| **Supabase** | Postgres + Auth + RLS | One service for DB, login, and per-row security. The client library (`src/lib/supabase.js`) is imported everywhere data is read. |
| **Express backend** (`backend/routes/*`) | Stripe only | Secret keys + webhooks can't live in a browser. |
| **Stripe (Connect)** | Payments + payouts | Buyers pay; money is destination-charged to the *creator's* connected account, minus a platform fee. |

Feature flag worth knowing: **`LEGACY_MODE`** (`src/lib/config.js`). SkillJoy v1
was a college skill-swap app (matches, swaps, gigs). That code isn't deleted —
it's wrapped behind `LEGACY_MODE`, default **off**. v3 (the storefront) is what
runs. That's why you'll see `stores.jsx` full of `SKILL_CATEGORIES`,
`overlapScore`, etc. — legacy helpers, dormant.

---

## 2. Directory map (where things live)

```
src/
  main.jsx                 ← app entry: providers + ALL routes
  lib/                     ← the "backend for the frontend": data + logic, no JSX
    supabase.js            ← the configured Supabase client (imported everywhere)
    stores.jsx             ← AuthProvider + useUser/useProfile/useAuth
    storefront.js          ← DEFAULT_THEME, resolveTheme, MODE_PALETTES, presets
    skills.js              ← products CRUD (a "skill" IS a product)
    profiles.js            ← public profile / theme lookups
    purchases.js, booking.js, subscribers.js, metrics.js, discounts.js …
    productTypes.js        ← the catalog of what you can sell (digital, course…)
    config.js              ← feature flags + fee constants
  app-pages/               ← authed / functional screens
    Storefront.jsx         ← the PUBLIC page at /@handle  (the product)
    StorefrontEditor.jsx   ← where a creator edits their page  (the studio)
    Checkout.jsx, Dashboard.jsx, Analytics.jsx, SkillBuilder.jsx …
    auth/Onboarding.jsx, auth/Login.jsx
  introduction-pages/      ← marketing (Home, HowItWorks, About, pricing…)
  components/              ← shared UI (Header, Footer, Seo, BookingWidget…)
backend/routes/            ← Express: checkout, guest, webhooks, billing,
                             stripe-connect, payments, locker, admin …
docs/v3-skill-platform/
  notes/                   ← dated change-logs (what changed, when)
  notes/explainers/        ← THIS folder (how systems work)
  migrations/              ← loose .sql files, applied manually (001 … 026)
```

---

## 3. Routing & the four kinds of page

All routes live in [`src/main.jsx`](../../../../src/main.jsx) inside `<Routes>`.
Mentally, there are four page *types*:

1. **Marketing** (`/`, `/how-it-works`, `/about`, `/terms`…) — public, static-ish.
2. **App** (`/build`, `/dashboard`, `/storefront/edit`, `/analytics`…) — authed,
   interactive. The creator's workspace.
3. **Public storefront** (`/:handle`, `/:handle/:skillId`) — the shareable product
   page. **Declared LAST** before the `*` catch-all, so real routes like `/about`
   win and only leftover `/@nova`-style paths fall through to `<Storefront>`.
4. **Checkout** (`/checkout/:skillId`) — the pay flow.

The provider stack (also in `main.jsx`) wraps everything:

```
<ErrorBoundary>          ← catches thrown render errors, shows a fallback
  <AuthProvider>         ← who is logged in (section 4)
    <DialogProvider>     ← app-wide confirm()/alert() modals
      <BrowserRouter> → <AppRoutes/>
```

---

## 4. Auth & the profile (who you are)

Everything hangs off two objects: **`user`** (the Supabase auth identity) and
**`profile`** (the `profiles` table row — username, name, bio, avatar, and the
all-important `storefront_theme`).

[`src/lib/stores.jsx`](../../../../src/lib/stores.jsx) → `AuthProvider`:

- On mount it calls `supabase.auth.getSession()`, then subscribes to
  `onAuthStateChange`. When a session appears, it `loadProfile(user.id)` (a
  Supabase select on `profiles`).
- It exposes hooks used across the app:
  - `useUser()` → the auth user (or `null`)
  - `useProfile()` → the profiles row (or `null`)
  - `useAuth()` → `{ session, loading, setProfile }` (setProfile lets a screen
    update the cached profile after a save — e.g. the editor after "Save")

**OnboardingGate** (`main.jsx`): a tiny component that, on the protected app
surfaces, redirects a logged-in user with **no `username`** to `/onboarding`.
That's how a brand-new account is forced to pick a handle before it can use the
app. After onboarding saves, we `setProfile(updated)` and send them to
`/storefront/edit` (see note 141) — build your page first.

There's a small shared helper here too, `initials(name)` — used for avatar
fallbacks. (It once crashed on double-spaced names; see note where we hardened it.)

---

## 5. The data model (the tables that matter)

Supabase Postgres. Migrations are **loose `.sql` files** in
`docs/v3-skill-platform/migrations/` (001…026), applied **by hand** in the
Supabase dashboard — there's no automatic migration runner, so "is prod caught
up?" is a real question to check.

The tables you'll actually touch:

| Table | Is | Key columns |
|---|---|---|
| **profiles** | A creator/user | `username`, `full_name`, `avatar_url`, `bio`, `phone`, **`storefront_theme` (jsonb)**, `tracking_pixels`, `tos_version` |
| **skills** | A **product** (legacy name!) | `creator_id`, `title`, `outcome`, `price_cents`, `pricing_type` (`onetime`/`membership`), **`kind`** (digital/course/coaching…), `status`, **`sort_order`**, **`group_label`** (its section), `order_bump_*` |
| **store_links** | Link-in-bio buttons | `creator_id`, `label`, `url`, `position`, `is_affiliate` |
| **purchases** | A completed sale | buyer, skill, `amount_cents`, `created_at` |
| **bookings** | A coaching slot | `skill`, `buyer`, `start_time` |
| **subscribers** | Email-capture list | `creator_id`, `email`, `source` |
| **platform_subscriptions** | The creator's SkillJoy plan (paywall) | migrations 021–023 |

> Gotcha to internalize: **a "skill" is a product.** The name is a fossil from v1.
> `src/lib/skills.js` is your products CRUD.

---

## 6. ⭐ The theme / live-preview engine (what you asked to understand)

This is the crown jewel and the thing that makes SkillJoy *SkillJoy*. The whole
"edit your page and everything updates in real time" experience is **one idea**:

> A page's entire look is **one JSON object**, resolved into **CSS custom
> properties**, consumed **identically** by a live preview and the real page.

### 6.1 Storage — one blob, not 40 columns

A creator's whole look lives in **`profiles.storefront_theme`**, a single JSONB
column. Accent, mode, background, glow, effects, avatar shape, music playlist,
splash text — all keys in one object. This is *why* customization moved so fast:
**adding a feature = adding a key**, never a migration.

The shape + defaults are `DEFAULT_THEME` in
[`src/lib/storefront.js`](../../../../src/lib/storefront.js).

### 6.2 `resolveTheme` — the safety net

```js
resolveTheme(profile.storefront_theme)   // → { ...DEFAULT_THEME, ...stored }
```

It merges the stored blob over defaults, so **missing keys are always safe** (an
old row saved before a feature existed just gets that feature's default). It also
does small **migrations-on-read** — e.g. an old single `audio_url` becomes a
one-item `audio_tracks` playlist. Nothing is rewritten in the DB; it's normalized
every time it loads. Both the editor and the public page call this, so they can
never interpret a theme differently.

### 6.3 The editor — state in, no network

[`src/app-pages/StorefrontEditor.jsx`](../../../../src/app-pages/StorefrontEditor.jsx):

1. On load: `setTheme(resolveTheme(profile.storefront_theme))` — the blob becomes
   local React state called `theme`.
2. Every control calls a tiny setter, e.g. `set({ accent: '#7A5CFF' })`, which
   does `setTheme(t => ({ ...t, accent: '#7A5CFF' }))`. **That's it — it mutates
   state. Nothing saves. Nothing hits the server.**

### 6.4 Real-time = state → inline CSS variables

Here's the actual "how does it update instantly" answer. Two components read
`theme` and map it onto **CSS custom properties** via an inline `style` object:

- **`<LivePreview>`** (inside the editor) sets `--accent`, `--lp-glow`,
  `--lp-card-bg`, mode via a `.lp-mode-dark` class, etc.
- The **public `<Storefront>`** sets the *same* concepts as `--sf-glow`,
  `--sf-panel-bg`, `--accent`, `.sf-mode-dark`…

All the CSS in both places is written against those variables
(`box-shadow: 0 0 var(--sf-glow) …`). So when a slider calls `set(...)`:

```
slider → set({glow_intensity: 60}) → React re-renders
       → inline style recomputes --sf-glow: "60px"
       → every rule using var(--sf-glow) repaints  → INSTANT, no round-trip
```

There is no "live update system." It's just **React state driving inline CSS
variables**, and CSS repainting when a variable changes. The preview and the real
page match because they share one resolve-and-pin path (and share
`MODE_PALETTES`, the single source of truth for the light/dark colors, so they
literally can't drift).

### 6.5 Save — one write

"Save changes" → `updateStorefront(userId, { storefront_theme: theme, … })`
(`src/lib/storefront.js`) → a **single Supabase update** to the JSONB column →
then `setProfile({...profile, ...patch})` so the cached profile matches.

### 6.6 Public render — same path, different consumer

A visitor hits `/@handle` → `<Storefront>` loads the profile, runs the **same
`resolveTheme`**, pins the **same CSS variables** → the page looks exactly like
the creator's preview. The loop closes.

### 6.7 The pattern in one diagram

```
                 profiles.storefront_theme (JSONB)
                          │  resolveTheme()
              ┌───────────┴────────────┐
   EDITOR state (draft)          PUBLIC page load
        │                              │
   set({...})  ── live ──►  map theme → CSS custom properties  ◄── same map
        │                              │
   <LivePreview> repaints        <Storefront> paints
        │
   Save → updateStorefront() → back to the JSONB blob
```

---

## 7. Products, sections & the storefront render

- A creator's products are `skills` rows (`src/lib/skills.js`).
- **Sections** are not a table — a "section" is just a distinct **`group_label`**
  across a creator's products. The storefront buckets products by first-seen
  label (in `sort_order`), so the visual sections *are* the labels. The editor's
  "Sections & product order" panel edits those labels/order directly (note 150).
- Each card shows a **type badge** derived from `skills.kind` via
  `PRODUCT_TYPES` in `src/lib/productTypes.js` (Course, Digital product, …).

---

## 8. Checkout & money

The one place the Express backend earns its keep.

Flow in [`src/app-pages/Checkout.jsx`](../../../../src/app-pages/Checkout.jsx):

1. Load the product (`getPublicSkill`). Decide the path:
   - **Free** → grant instantly, go to `/locker`.
   - **Membership** → hosted Stripe subscription page (redirect).
   - **One-time paid** → embedded Stripe **PaymentElement** (the card form).
2. **Guests can buy one-time products without an account** — a separate,
   deliberately isolated path (`startGuestCheckout` → `backend/routes/guest.js`).
   Logged-in users use `startCheckout` → `backend/routes/checkout.js`.
3. Optional **promo code** and **order bump** (a one-click add-on) adjust the total.
4. The browser calls the backend to create a Stripe **PaymentIntent** and gets a
   `clientSecret`; Stripe's PaymentElement collects the card; on success a
   **webhook** (`backend/routes/webhooks.js`) is the source of truth that
   fulfils the purchase (grants access, emails the buyer). The client also
   confirms optimistically, but the webhook is authoritative — that's why a
   flaky network can't lose a paid order.

**Money split:** Stripe **Connect** — the charge is destination-charged to the
*creator's* connected account, and SkillJoy keeps a platform fee (~5%,
`SKILL_PLATFORM_FEE_BPS` in `config.js`, authoritative value server-side in
`backend/config/fees.js`). Two *different* Stripe concepts to never conflate:
- **Product sales** → money to the creator (Connect, guest-payable).
- **Platform subscription** (the creator paying SkillJoy $19/mo) → money to
  SkillJoy's own account (`backend/routes/billing.js`, `platform_subscriptions`).
  Guests can *physically never* hit this — different Stripe object, different
  account. Keep it that way.

The checkout page is **themed** to the creator's accent + light/dark (note 146),
but deliberately drops all the loud effects — a pay page must feel calm and
trustworthy.

---

## 9. Metrics

`recordEvent(name, payload)` in `src/lib/metrics.js` logs events
(`storefront_view`, `checkout_start`, `purchase`, …). The Dashboard/Analytics
pages read these back for the creator's funnel. Cheap, append-only.

---

## 10. ♻️ The repeatable recipe — adding a customization feature

This is the pattern we've used for glow, tilt, splash, overlays, icon glow,
cursor color, avatar shape… Learn it once and you can add the next one solo:

1. **Add a key** to `DEFAULT_THEME` in `src/lib/storefront.js` (pick a safe
   default that reproduces *today's* look, so existing pages don't change).
2. **Consume it on the public page** — in `Storefront.jsx`, map the key to a CSS
   custom property in the wrap `style`, and write the CSS against that variable.
   Prefer `calc(var(--x) * k)` + `color-mix(… var(--accent) …)` so one number
   drives layered, accent-aware effects (see note 147, icon glow).
3. **Add an editor control** in `StorefrontEditor.jsx` (a `<Slider>`, `<Seg>`,
   `<Toggle>` or color row) that calls `set({ your_key: v })`.
4. **Mirror it in `<LivePreview>`** (the `--lp-*` variables) so the preview shows
   it — or intentionally leave it control-only (like splash/tilt) and note that.
5. **Save just works** — it's already in the `theme` blob, so `updateStorefront`
   persists it with everything else. No new column, no new query.
6. **Write a note** in `../` (dated change-log) and, if it's a *concept* worth
   teaching, an explainer here.

Landmines to respect while doing the above:
- **Button reset:** `App.css` styles bare `<button>`s as nowrap pills — custom
  buttons must set their own width/padding/radius or text clips.
- **Portalled layers escape your CSS vars:** anything appended to `<body>`
  (cursor-FX layer, modals) is *outside* the themed wrapper, so `var(--accent)`
  won't reach it — pin the value on the element itself (note 148).
- **Two effects, one CSS property:** if two features both want `transform` (tilt
  + float), give each its own wrapper element; one rule can't own a property twice.

---

## 11. Where to look first, by task

| I want to… | Start in |
|---|---|
| Change how the public page looks | `app-pages/Storefront.jsx` (`StoreStyles`) |
| Add/adjust an editor control | `app-pages/StorefrontEditor.jsx` |
| Add a theme option | `lib/storefront.js` (`DEFAULT_THEME`) then the two above |
| Touch products/sections | `lib/skills.js` + `productTypes.js` |
| Change checkout / payments | `app-pages/Checkout.jsx` + `backend/routes/checkout.js|guest.js|webhooks.js` |
| Change who-can-see-what | Supabase **RLS policies** (per table) + the migration that defines them |
| Add a route/page | `main.jsx` |

---

_This doc describes the app as of 2026-07-18. If you change an architectural
thing (not just a feature), update the relevant section here — this is the map
people trust._