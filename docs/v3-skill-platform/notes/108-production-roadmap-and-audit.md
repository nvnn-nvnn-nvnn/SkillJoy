# 108 — Production roadmap + audit (Stan Store competitor)

_2026-07-09. Prioritized, phased checklist. Audit findings up top._

---

## Audit findings (verified in code)

1. **Platform paywall does NOT exist yet.** All "subscription" code (`backend/routes/checkout.js`,
   `webhooks.js`) is *creator membership products* — a fan subscribing to a creator, destination-
   charged to the creator's Connect account. The **app/platform subscription** (creator pays
   SkillJoy) is greenfield. ⇒ Guests literally cannot hit the platform sub — different Stripe
   object, different account. The fear is prevented by construction; we just must NOT wire the
   platform sub into the guest/product path.
2. **Onboarding is already the new link-in-bio flow.** Vestiges to remove are narrow: the
   **Availability step** (morning/midday/evening), `LEGACY_MODE ? '/matches'` routing, and the
   `ProfileView` swap card — not the whole file.
3. **Migrations are loose .sql files (001–020) in `docs/`**, not a Supabase-managed dir. "Applied
   to prod" is manual + unverifiable. Treat as risk. No 021+ yet.
4. Guest flow (`guest.js`) is already separate from `checkout.js`. Good separation to preserve.

---

## Phase 0 — Critical fixes (do FIRST, before new features)

- [ ] **RLS audit** — every table, confirm a creator can't read/write another's rows; run
      `/security-review` on the branch. (Outstanding from Apr-13 audit.)
- [ ] **CSRF** — confirm state-changing endpoints are protected. (Outstanding from Apr-13.)
- [ ] **Verify migrations 001–020 are actually applied** in prod Supabase (diff against
      `supabase/schema.sql`). Adopt a real migration tool (Supabase CLI) so this stops being manual.
- [ ] **Webhook idempotency** — replaying the same Stripe event must not double-fulfil / double-email
      (Stripe *will* retry). Verify the once-only guard in `guestFulfillment.js` + `webhooks.js`.
- [ ] **Strip legacy onboarding vestiges** — remove Availability step, `LEGACY_MODE` routing to
      `/matches`, `ProfileView`; drop dead gig/swap routes from `main.jsx`.
- [ ] **Error boundary + real 404** so a bad route / thrown error doesn't blank the SPA.

## ⭐ PRICING DECISION (locked 2026-07-09)

**Subscription + transaction fee, gated at publish/sell — NOT at signup.**
- Signup + build + customize is **free** (protect top-of-funnel).
- Card captured + 14-day trial starts at the **publish/first-sell** moment (the point of value).
- **Plus** a per-sale transaction fee (`application_fee`, ~3–5%) — take both: sub = predictable MRR,
  fee = upside that scales with creator success. Fee can shrink on higher tiers as upgrade incentive.
- Price the sub so a creator who's made even ONE sale finds it obviously worth it (churn guard).
- Retention > paywall: MRR is only real if creators actually sell, so creator GMV stays a priority.

## Phase 1 — Monetization (HIGHEST) 💰

- [ ] **Platform subscription / paywall** — new Stripe *platform* Product+Price (SkillJoy's own
      account, NOT Connect). Creator subscribes with card; `trial_period_days: 14`, card captured
      up front, first charge on day 14. New table `platform_subscriptions` (user_id, stripe_customer_id,
      stripe_subscription_id, status, trial_ends_at, current_period_end). New backend route
      `/api/billing/*` (create-subscription, portal, webhook handling for
      `customer.subscription.*` + `invoice.payment_failed`).
- [ ] **Publish gate (gate here, NOT at signup)** — signup/build/customize is free; a storefront
      can only go LIVE when: (a) profile info complete (name, handle, phone), AND (b) platform sub is
      `trialing` or `active`. The publish action is where the card capture + trial kicks off. Enforce
      server-side (never trust client).
- [ ] **Guest-vs-platform isolation guard** — explicit assertion that `/api/guest/*` and product
      checkout can never create a platform subscription; add a regression test.
- [ ] **Fix subscriber row** (members not showing) — investigate the actual query/RLS; likely the
      members-feed select or a missing RLS SELECT policy on the memberships table. **(needs repro)**
- [ ] **Themed checkout** — Checkout.jsx reads the creator's `storefront_theme` (accent, mode,
      bg) so the pay page matches their storefront. Big trust/conversion win.
- [ ] **Trial UX** — banner showing days left; dunning emails on `payment_failed`; graceful
      downgrade (unpublish storefront) when sub lapses.
- [ ] **Stripe Tax** consideration + receipts.

## Phase 2 — Content & customization ✨

- [ ] **Background video** — `bg: 'video'` theme option; `<video autoplay muted loop playsinline>`
      layer in `.sf-bg`; upload to object storage (see Phase 3). Poster fallback for mobile.
- [ ] **Overlay effects** (rain / snow / VHS) — `theme.overlay` enum; a fixed overlay layer
      (CSS animation or lightweight canvas). VHS = scanline + noise via CSS. Keep it a single
      pointer-events:none layer over `.sf-bg`.
- [ ] **Site music/audio** — `theme.audio_url`; small play/mute pill (autoplay is blocked by
      browsers → require a tap). Persist muted-state.
- [ ] **Cursor effects** — beyond the current static cursor image: trail / sparkle. JS particle
      layer, gated behind a theme toggle (perf: rAF, cap particles).
- [ ] **Profile effects** — glow/animation presets for the profile panel.
- [ ] **Product thumbnails** — image per product; already have cover in builder? verify + surface
      in dashboard cards.
- [ ] **Rich product description editor** — replace the plain `<textarea>` with a lightweight rich
      editor (bold, bullets, headings). Store as sanitized HTML or markdown; render safely on the
      storefront/product page. Bigger editing surface. (Tiptap or a minimal markdown editor.)
- [ ] **UI section templates** — presets for the storefront *layout* (current default + 1–2 better).
- [ ] **Full site templates** — bundled theme presets (bg + accent + effects + layout) a creator
      picks in one click. Store as named theme JSON.

## Phase 3 — Infra & delivery 🏗️

- [ ] **DON'T rip out Supabase.** A full backend migration = rewriting auth + RLS + every query for
      no clear payoff, months of risk. Supabase (Postgres + auth + RLS + realtime) is production-grade.
- [ ] **The real gap is digital-product *delivery*, not the DB.** Add dedicated object storage for
      large files + secure delivery: **Cloudflare R2** (zero egress fees) or **Bunny.net** (great for
      video/large media, cheap CDN) with **signed, expiring download URLs**. Keep metadata/entitlements
      in Supabase; store the *file* in R2/Bunny. This is a targeted addition, not a migration.
- [ ] **Secure delivery flow** — buyer's download link is short-lived + tied to a fulfilled purchase
      row (no hotlinking, no sharing a permanent URL).
- [ ] **Background/video/audio assets** → same object storage, served via CDN (Supabase egress will
      get expensive for media otherwise).

## Phase 4 — Landing pages & polish

- [ ] **Marketing landing pages** — hero, features, pricing (show the 14-day trial), social proof,
      FAQ, CTA. This is the top of the funnel; conversion-critical.
- [ ] **Storefront OG/meta tags** — per-creator title/description/image so shared links preview well
      (Stan does this; it drives clicks).
- [ ] **Creator analytics** — views, clicks, conversion, revenue per product (extend existing metrics).
- [ ] **Legal** — Terms, Privacy, Refund pages exist as reserved routes; confirm real content + a
      terms-acceptance checkbox at signup. ✅ TOS checkbox now enforced in onboarding (note 115) —
      still need to (a) persist the acceptance (timestamp + version) not just gate on it, and (b)
      confirm the legal page bodies are real.
- [ ] **Email verification (PLACEHOLDER — make real eventually).** Current state: Supabase sends a
      confirmation email at email/password signup ("confirm your account, then sign in"), so email
      IS loosely verified for that path — BUT **Google-OAuth users are auto-verified by Google** and
      never prove control of the address in our flow, and we never *gate* anything on verified
      status. "Real" version: (a) block publish / payouts until `email_confirmed_at` is set, (b) a
      resend-verification UI + a "verify your email" banner, (c) re-verify on email change (already
      partially handled by Supabase's confirm-change flow in Settings). Placeholder only for now.
- [ ] **Email deliverability** — domain verified in Resend (done for skilljoy.me); add abandoned-cart
      / receipt / trial-reminder templates.
- [ ] **Observability** — error monitoring (Sentry), uptime ping, rate-limiting on
      guest/checkout/billing endpoints.

## Phase 5 — Future (postponed)

- [ ] Direct messaging / creator↔buyer comms.
- [ ] Affiliate / referral program.
- [ ] Coupons/discount UX polish (backend `priceWithDiscount` already exists).

---

## How Stan Store works (to match/exceed)

- **Model:** one link-in-bio storefront; "everything is a product" (digital download, course,
  membership, booking, lead magnet, webinar). No marketplace — creators bring their own traffic.
- **Payments:** Stripe; fast, mobile-first, single-page checkout; instant digital delivery on pay.
- **Built-in:** email capture + email marketing, basic analytics, order bumps, discount codes.
- **Their strength:** ruthless simplicity + mobile checkout conversion.
- **Our edge (do NOT lose it):** deep guns.lol-style customization (bg video, effects, glass,
  themes) that Stan can't touch. Match their checkout simplicity + delivery reliability, win on
  customization + price.
- **To match them:** themed mobile checkout, instant + secure delivery, email automations, per-
  product analytics, rich product pages.

---

## Addendum — what else to add (things not in the original ask)

### Existential (a payments platform dies without these) ⚠️
- [ ] **Content moderation + fraud defense.** You're liable for what's sold on you. One scammer
      selling garbage / a stolen-card farm → **Stripe terminates your platform account** and every
      creator goes down. Need: report-a-product flow, admin takedown, Stripe **Radar** on, and a
      manual review queue for first-time payouts.
- [ ] **KYC / creator identity.** Stripe Connect Express handles most, but confirm onboarding
      *requires* it before payouts, and you're not paying out to unverified accounts.
- [ ] **Chargeback / dispute handling.** You *will* get them. Need a flow: Stripe dispute webhook →
      notify creator → evidence submission → clawback logic on the fulfilled purchase row. Without
      it, disputes silently tank your account health.
- [ ] **Tax — Stripe Tax + 1099-K.** US creators over threshold need 1099-K (Stripe Connect can
      issue). Sales tax/VAT on digital goods via Stripe Tax. Not optional at volume.
- [ ] **GDPR — account deletion + data export.** Legal once you have EU users. Self-serve "delete
      my account / download my data."

### High-leverage growth (this is how Stan actually wins) 📈
- [ ] **Wallet payments — Apple Pay / Google Pay** in checkout. Single biggest **mobile conversion**
      lever; nearly free with Stripe Payment Element. Most-underrated item on this whole list.
- [ ] **Lead magnets (free products) + email capture.** Stan's core growth loop: give a freebie for
      an email, then market to the list. You have partial email capture — make "free" a first-class
      price type.
- [ ] **Creator sale notifications** (email + in-app "💰 you made a sale"). Retention/dopamine; also
      a trust signal. Cheap, high emotional ROI.
- [ ] **Abandoned-checkout recovery** — email a buyer who started but didn't finish. Direct revenue.
- [ ] **Linktree / Stan import** — one-click import of links to lower switching cost. Acquisition wedge.
- [ ] **Onboarding activation checklist** — "connect Stripe → add first product → publish." Drives
      the activation metric that actually predicts retention.
- [ ] **Reviews / testimonials on product pages** — social proof lifts conversion; Stan has it.

### Buyer experience
- [ ] **Guest purchase re-access** — since you allow guest checkout, a buyer needs a magic-link to
      re-download later without an account (ties to the passwordless-account approach).
- [ ] **Multi-currency** for international creators/buyers.
- [ ] **Bundles / upsells** (bundle was deferred — it's a real revenue multiplier; revisit).

### Ops / hygiene (boring, bites later)
- [ ] **Bot protection on signup** (Cloudflare Turnstile). Free trials + open signup = card-testing
      and abuse magnet.
- [ ] **Staging environment + CI** so you stop testing config in prod (you felt this pain at launch).
- [ ] **Automated DB backups + a tested restore.** Supabase has backups — confirm tier + that you've
      actually restored once.
- [ ] **Performance:** DB indexes on hot query paths (storefront load, purchases), image optimization,
      serve media via CDN.
- [ ] **Accessibility pass** — keyboard nav, contrast, alt text. Also helps SEO + legal.

### Product/pricing strategy (decide, don't drift)
- [ ] **Platform pricing tiers** — one flat paywall, or free-tier + Pro? Free-tier-with-fee lowers the
      signup barrier vs a hard paywall; model the funnel before you commit to "card required to publish."
- [ ] **Take rate** — what % / flat fee does SkillJoy keep per sale (`application_fee`)? Decide and
      make it configurable.

## Recommended order of attack

1. Phase 0 (security + legacy cleanup) — non-negotiable, protects everything else.
2. Phase 1 (paywall + publish gate) — this is the business model; nothing monetizes without it.
3. Phase 3 delivery bit (R2/Bunny) — before pushing digital-product volume.
4. Phase 2 customization — your differentiator, but after money + delivery are solid.
5. Phase 4 landing/polish — in parallel once Phase 1 works.

---

## Phase 6 — Competitor parity gaps (Stan / Beacons / Sellfy)

_Added 2026-07-13. Gap analysis vs the three main competitors. First, what we ALREADY
match so we don't re-build it: link-in-bio + all product types (download/course/booking/
membership/links), Stripe `PaymentElement` (Apple/Google Pay wallets already work) + guest
checkout, **order bumps**, discount codes, reviews, tracking pixels, embeds, analytics,
Connect payouts, email capture + subscriber list + one-shot **broadcast** email, and the deep
customization edge (bg video, overlays, audio, cursor/name FX) none of them have._

### High-leverage — close first
- [ ] **Automated email** — sequences/flows (welcome, drip, nurture) + **abandoned-checkout
      recovery**. We only have one-shot `sendBroadcast`. Subscriber table + Resend already exist,
      so this is mostly automation logic. (Stan.) Direct revenue.
- [ ] **Custom domain** — `yourbrand.com` instead of `skilljoy.me/@you`. All three offer it;
      single most-requested "pro" feature + churn guard.
- [ ] **Bundles + post-purchase upsells** — bundle was deferred; we have pre-purchase order bumps
      but no one-click post-pay upsell. Pure revenue multiplier on existing traffic. (Stan/Sellfy.)

### Worth doing
- [ ] **Affiliate / referral program** for creators (was Phase 5). (Stan/Beacons.)
- [ ] **AI assist** — generate product copy / store setup. (Stan AI, Beacons AI.)
- [ ] **SMS marketing** + a proper audience CRM/contacts view. (Beacons.)
- [ ] **Tip jar / donations** product type. (Stan/Beacons.)
- [ ] **Mobile creator app** + "💰 you made a sale" push (in-app notif already noted in addendum).
- [ ] **Migration/import** tool from Linktree/Stan/other (switching wedge). (Sellfy.)
- [ ] **Instagram auto-DM / comment-to-DM** automation. (Beacons.)
- [ ] **Webinar / live-launch** product type + **drip-scheduled** course lessons. (Stan.)

### Deliberate NON-goals (unless we change what SkillJoy is)
- [ ] ~~Print-on-demand / physical products / shipping / inventory~~ — Sellfy's headline, but a
      different business (fulfillment, logistics). Skip unless pivoting.
- [ ] ~~Media Kit generator + brand-deals marketplace / sponsorship invoicing~~ — Beacons' angle;
      creator-monetization-via-sponsorship, not storefront sales. Out of scope for now.

> Caveat: competitor feature sets shift fast; knowledge current to early 2026. Spot-check each
> competitor's live pricing page before committing priority.

### Tactical follow-ups (from 2026-07-13 build session) — Devv to program

- [ ] **Theme preset picker** — one-tap named looks (bg + accent + effects + glow bundle). Full
      write-up in note 137. Highest-leverage next customization move.
- [ ] **Demo `SubscribeForm` no-op** — on demo storefronts the subscribe form posts to Supabase with
      a fake creator id → silent error. No-op it when the store is a demo (`getDemoStore`).
- [ ] **Site-music: track drag-reorder + per-creator cap** — upload order = play order today; no cap
      on number/size of tracks (note 139).
- [ ] **Change social-type without remove/re-add** — the icon picker only adds; editing a row's
      platform means remove + re-add (note 138).
- [ ] **Polish the Link buttons section** like the social icon picker (note 138).
