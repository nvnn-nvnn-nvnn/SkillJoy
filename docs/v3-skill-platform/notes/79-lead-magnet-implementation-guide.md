# 79 — Lead magnet: a build-it-yourself guide (ELI20)

_Session 2026-07-05. This is a **teaching guide**, not a changelog — a roadmap so
you can implement the `lead` product type yourself. I'll explain the why, point
at the exact files/functions, and give hints + signatures rather than
copy-paste. Written to be re-readable._

---

## 0. What a lead magnet actually is (the concept)

A lead magnet is a **free product you trade for an email address.** "Download my
free Notion template" → you get the template, the creator gets you on their list.
The *product* is almost beside the point; the **email capture is the feature.**

So the mental model is different from every other type: for digital/course/
coaching the money is the goal. For a lead magnet, **the subscriber is the
goal**, and "free delivery" is just the bait.

## 1. The big realization: you've already built ~90% of it

Don't build a new system. A lead magnet is literally:

> **a free digital product** + **"on claim, add the buyer's email to the
> creator's list."**

Both halves exist already:

- **Free delivery** — `backend/routes/checkout.js`, the `if (!skill.price_cents)`
  branch (~line 52): it upserts a `paid` purchase for $0 and returns
  `{ free: true }`. No Stripe. The buyer then lands in their Locker and downloads
  exactly like a digital product (`file_key` or `external_url`).
- **The list** — `src/lib/subscribers.js` → `subscribe(creatorId, email, name,
  source)`, backed by a `subscribers` table with an `onConflict: 'creator_id,
  email'` upsert (so it's **idempotent** — claiming twice can't create dupes).
  The whole audience UI (`AudiencePanel`) + broadcast (`sendBroadcast`) already
  read from that table.

**The only genuinely new behavior is one line of intent: "when a `lead` product
is claimed, insert the buyer's email into `subscribers`."** Everything else is
framing.

## 2. Where the new behavior belongs (and why)

You could subscribe them from the frontend after claiming. **Don't.** Put it
**server-side, in the same place the grant happens** — the free branch of
`checkout.js`. Three reasons, and they're worth internalizing:

1. **Single source of truth.** The grant already happens there. Do the side
   effect (subscribe) right next to the thing that triggers it, so they can never
   drift apart.
2. **Can't be bypassed.** A frontend subscribe can be skipped by a script hitting
   the API directly. A backend one is guaranteed for every claim.
3. **It already has what you need.** In that handler you have `req.user` (the
   buyer — `.id` and `.email`) and the `skill` row (`.creator_id`). That's
   literally the whole `subscribe(creatorId, email)` call.

Note the backend uses the **service-key** Supabase client (`backend/config/
supabase.js`), which bypasses RLS — so it can insert a subscriber row for *any*
creator. That's correct here: the server is trusted; the buyer isn't writing the
row, the server is, on their behalf.

## 3. The build, step by step (hints, not answers)

### Step 1 — turn the type on
`src/lib/productTypes.js`: flip `lead` from `built: false` → `built: true`. That's
the switch that makes it appear as a real, pickable type on `/build/new` instead
of a "Soon" card. (Do this LAST if you want to test the flow before exposing it.)

### Step 2 — frame it in the builder (`SkillBuilder.jsx`)
A lead magnet is **free by definition and delivers a download.** So:

- **Middle-step label + hint:** add `lead` to `MIDDLE_LABEL` (e.g. `'Freebie'`).
  `KIND_HINTS.lead` already exists — tweak the copy if you like.
- **Delivery = same as digital.** A lead magnet needs a File block (upload or
  link). You *already* have `hasDelivery(blocks)`. Reuse it: the publish gate for
  `lead` should require delivery, exactly like `digital`. (Look at how the
  `k === 'digital'` guard works in `togglePublish` and the Publish checklist —
  you're adding `lead` to that same condition.)
- **Force it free.** This is the one real decision. A lead magnet with a price
  isn't a lead magnet. Options, easiest → strictest:
  - (a) Default `price_cents` to 0 on create and just… trust it.
  - (b) In the Pricing step, when `kind === 'lead'`, hide the price input and show
    "Lead magnets are free." — set `price_cents: 0` and don't let them change it.
  - I'd do (b): make the UI enforce the invariant so bad data can't happen.
  Hint: the Pricing panel already branches on state; add a `kind === 'lead'`
  case that renders a locked "Free" instead of the `$` input.

### Step 3 — the actual feature: subscribe on claim
`backend/routes/checkout.js`, the `/:skillId/intent` handler:

1. The skill `select(...)` at the top **doesn't fetch `kind` yet** (line ~37).
   Add `kind` to that column list — you can't branch on what you didn't select.
2. In the free branch (`if (!skill.price_cents)`), after the `purchases` upsert
   and before `return res.json({ free: true })`, add:
   > if `skill.kind === 'lead'`, upsert a row into `subscribers` with
   > `creator_id: skill.creator_id`, `email: req.user.email` (lowercased/trimmed),
   > `source: 'lead_magnet'`. Wrap it in try/catch and **don't fail the claim if
   > the subscribe errors** — the buyer still gets their freebie; the email is a
   > best-effort side effect. (Same "fail-open on the side effect" pattern as the
   > receipt email a few lines down.)

   You're mirroring what `subscribe()` does in `subscribers.js`, but with the
   backend's service-key client and its `.upsert(..., { onConflict:
   'creator_id,email', ignoreDuplicates: true })`. Copy that upsert shape.

That's the whole feature. ~5 lines.

### Step 4 — polish the buyer-facing copy (optional)
On the sales page (`SkillPublic.jsx`) the free CTA already says "Get it free."
For a lead magnet you might want "Get free access" or "Download free." Minor;
skip if you don't care.

## 4. The one design fork worth understanding

Your claim flow **requires login** — so the email you capture is the buyer's
*account* email, grabbed automatically. That's the simple, correct v1.

The "purist" lead magnet captures emails from **logged-out strangers** via a form
on the sales page (no account needed). That's the **guest-checkout** problem we
talked about earlier — it needs a real identity/delivery rework (magic links,
etc.). **Don't do it now.** Ship the login-gated version; note guest capture as a
future upgrade. 90% of the value (turning buyers/claimers into list members) is
in the simple version.

## 5. How to test it

1. As creator: New product → Lead magnet → add a File (or link) → confirm the
   Pricing step is locked to Free → Publish.
2. As a *second* account: open the sales page → "Get it free" → land in Locker,
   download works.
3. Back as the creator: Dashboard → Audience → **the second account's email is
   now a subscriber** with source `lead_magnet`.
4. Claim again with the same account → still exactly one subscriber row (the
   `onConflict` upsert did its job).

## 6. Stretch goals (later, if you want)

- **Tag which magnet** brought them in (store `skill_id` on the subscriber row or
  in `source`) — useful analytics.
- **Guest capture** (the fork above) once you tackle guest checkout.
- **Double opt-in / welcome email** on subscribe (you already have Resend +
  `templates` in the backend).

---

**TL;DR:** lead magnet = free digital product + one server-side `subscribe()` in
the checkout free branch. Reuse `hasDelivery`, reuse the free-grant path, reuse
the subscribers table. The only new code is "add `kind` to a select, and if it's
a lead, upsert a subscriber." Flip `built: true` when you're happy.
