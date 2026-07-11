# 115 — TOS agreement in onboarding + "My Page" nav pivot

_2026-07-11._

## 1. Terms of Service checkbox (forced) — onboarding

**Why:** legal/consent — a creator must agree to ToS before they get an account/storefront.

- **`Onboarding.jsx`:** new `agreedTos` state; a `.onb-tos` checkbox at the bottom of the form —
  "I agree to the Terms of Service and Privacy Policy" with links to `/terms` and `/privacy`
  (open in a new tab). **Double-enforced:** `save()` blocks with an error if unchecked, AND the
  primary button is `disabled={busy || !agreedTos}`. Styled to match (accent checkbox, accent
  links).
- **Follow-up (in note 108 Legal item):** we currently only *gate* on the checkbox — we don't
  *persist* the acceptance. Real version should store a timestamp + ToS version on the profile
  (proof of consent). Deferred.

## 2. "My Page" pivot (link-in-bio positioning)

**Why (owner):** the product's hook is the customizable link-in-bio *page*, not the product
catalog. Lead with the page to pull more users in; products live *on* the page. Rename +
reorder the nav to reflect that.

- **`components/Header.jsx`** — the "Create" group reordered so the page comes FIRST, and
  "Storefront" renamed to **"My Page"**:
  - `My Page` (Store icon → `/storefront/edit`) — now first.
  - `Products` (Package icon → `/build`) — now second.
- **`app-pages/StorefrontEditor.jsx`** — the editor's own top dropdown trigger renamed
  `Storefront ▾` → **`My Page ▾`** for consistency.
- Footer already said "View my page" — consistent, untouched.
- Note: the *route* is still `/storefront/edit` and the component is still `StorefrontEditor`
  (internal names unchanged — only user-facing labels moved to "My Page"). Fine; renaming the
  route/files is churn with no user benefit.

## 3. Email verification — added to roadmap (placeholder)

Added to note 108 Phase 4 as an explicit checklist item. **Not built.** Current reality:
Supabase confirms email at password signup, but Google-OAuth users are auto-verified externally
and nothing is *gated* on verified status. Real version later: gate publish/payouts on
`email_confirmed_at`, resend-verification UI + banner, re-verify on change.

`vite build` ✅.
