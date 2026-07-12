# 116 — Project status + operating checklist (v1 SHIPPED)

_Refreshed 2026-07-11. SkillJoy is live, monetized, moderated. The build phase is essentially
over; what remains is operating + growth, not features. Points at detailed notes, doesn't repeat._

## Where it stands — phase status

| Phase | Status |
|---|---|
| 0 — Security + legacy cleanup | ✅ Done (notes 109/110) |
| 1 — Monetization (paywall) | ✅ Done + **armed & verified on live** (111/112/023) |
| 2 — Content & customization | ✅ Done — bg video, overlays, audio, cursor/profile FX (117), markdown descriptions + course polish (118) |
| Trust & safety | ✅ Done — product reports + admin takedown, skill dispute notifications, cancel-sub UI (119) |
| 3 — Media infra (R2/Bunny) | ⏸ Deferred on purpose (delivery works on Supabase; premature until volume) |
| 4 — Landing / polish | 🟡 In progress — dark mode + social-glow done this session; growth levers remain |

## Shipped, by note
106 bio effects · 107 glassmorphism + remove buttons · 108 roadmap/audit (pricing locked:
sub + fee, gate at publish) · 109 legacy cleanup · 110 security pass · 111/112 paywall (112 =
READ-FIRST handoff) · 113 phone→Settings · 114 locked onboarding + v1 profile removed · 115 TOS
gate + "My Page" pivot · 117 Phase-2 effects · 118 markdown + course + audio-autoplay + audio-bug
fix · 119 trust & safety · **this session:** site dark mode + stronger social-icon glow.

## Operating checklist (what's actually left)

### Do before promoting hard
- [ ] **Legal content** — real Terms/Privacy/Refund text (Termly/iubenda/lawyer), pasted into the
      existing pages. **Owner deferring for now** (accepted risk while soft). We force TOS agreement,
      so this is the real exposure.
- [x] **Stripe Radar** — already ON (owner confirmed). Good.
- [x] **Supabase bucket config** — done (video/audio MIME + size). Phase 2 uploads work.
- [x] **Paywall verified on live** — done (owner tested; Stripe Checkout opens with card form).
- [ ] **Email-verification gate** — see the how-to below. Being worked on.

### Housekeeping
- [ ] **Persist TOS acceptance** — currently only gated on the checkbox; store timestamp + version
      on the profile (note 115).
- [ ] **Repo privacy** — public repo, owner's real name in old commit history (note 112). Decide
      before promoting.
- [ ] **Supabase CLI migrations** — stop applying loose `.sql` by hand.

### Growth levers (AGREED NEXT — post-launch, high ROI)
- [ ] **Apple Pay / Google Pay** in checkout — biggest mobile-conversion lever, near-free w/ Stripe.
- [ ] **Lead magnets (free products) + email capture** — Stan's core growth loop.
- [ ] **"You made a sale 💰" notifications** — cheap, high retention ROI.

### UI / polish (in progress this session)
- [x] Site-wide **dark mode** (toggle in Settings → Appearance; persisted; storefront decoupled).
- [x] Stronger **social-icon glow** (layered drop-shadow bloom).
- [ ] **Dark-mode cleanup** — foundation flips the CSS-var system, but components with HARD-CODED
      colors (many inline styles in Settings/Admin, Footer's dark bar, some `#fff`/`#1a1a1a`) won't
      fully theme. Sweep hardcoded colors → vars for full coverage. (Follow-up.)
- [ ] **"Fix the UI"** — owner flagged; needs specifics (which screens/what's off).

## Email-verification gate — how to turn it on
Two layers:
1. **Supabase (the real switch):** Authentication → Providers → Email → enable **"Confirm email."**
   With it on, an email/password user CAN'T sign in until they click the confirmation link — so the
   gate is largely implicit. (Magic-link + Google users are confirmed by construction.)
2. **App-side belt-and-suspenders (optional, small):** in the publish endpoint
   (`backend/routes/skills.js`), block publish when `req.user.email_confirmed_at` is null →
   402/403 with a "verify your email" code the frontend surfaces as a banner + resend button.
   Only needed if you want to hard-gate beyond Supabase's sign-in confirmation.
