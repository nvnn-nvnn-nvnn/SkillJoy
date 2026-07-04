# 70 — Post-purchase "Options" tab: promo video, confirmation msg, reviews

_Session 2026-07-03. New builder **Options** tab for post-purchase / marketing.
Built the 3 self-contained features for real; stubbed the 3 heavy ones as
"Soon". Expert guide._

---

## The scoping call (why only 3)
The user asked for six: order bump, affiliate share, promo video, customer
reviews, confirmation email, email integration. They split by risk:
- 🟢 **Self-contained** (built now): promo video, confirmation-email message,
  customer reviews.
- 🟠 **Real money/payout logic** (stubbed): order bump, affiliate — these touch
  Stripe PaymentIntents / commission splits and deserve dedicated passes.
- 🔴 **External API** (stubbed): email-integration (ESP OAuth per provider). Note
  a *native* audience/broadcast already exists (`AudiencePanel`).

User picked "safe 3 now, stub the rest." The stubs are "Soon" cards in the
Options tab (same pattern as unbuilt kinds on `/build/new`).

## Migration (RUN THIS)
`docs/v3-skill-platform/migrations/012_options_and_reviews.sql` — run once in the
Supabase SQL editor (idempotent). Adds to `skills`: `promo_video_url`,
`confirmation_message`, `reviews_enabled` (default true). Adds a **`reviews`**
table (one per buyer per skill) with RLS: **public read**; insert/update/delete
only by the buyer (`buyer_id = auth.uid()`) **and only if they have a paid
purchase**. Mirrored into `supabase/schema.sql`.

## The three features, end to end

### Promo video
- Builder Options tab: a `promo_video_url` input.
- `SkillPublic`: renders an embedded player at the top of the sales page.
- Embed logic extracted to **`src/lib/embed.js`** (`toEmbed`) so the sales page
  and `BlockRenderer` can share it (BlockRenderer still has its own copy for now
  — fine to dedupe later).

### Confirmation email message
- The purchase webhook **already sent a receipt** — this just injects the
  creator's optional `confirmation_message` into it.
- Builder: a textarea. Backend `webhooks.js`: selects `confirmation_message`,
  inserts it into the receipt HTML **escaped** (`<`/`>`), styled as a note.
- Local-dev caveat: no webhook = no receipt email locally (see note 62). The
  `/confirm` fast-path doesn't email; the webhook is the source of truth.

### Customer reviews
- Data layer **`src/lib/reviews.js`**: `listReviews`, `summarize` (count+avg),
  `getMyReview`, `upsertReview` (upsert on `skill_id,buyer_id`), `deleteReview`.
- Builder Options tab: a `reviews_enabled` **toggle** (custom switch — bare
  `<button>`, so it overrides the global button reset, per [[global-button-reset-landmine]]).
- `Locker` (`ReviewBox`): buyers who own the product get a star picker +
  optional text; create/update/delete their own review. Gated by `purchase` +
  `reviews_enabled`.
- `SkillPublic`: shows the average (stars + count) under the title and a list of
  up to 6 reviews above the buy bar. Only loads when `reviews_enabled`.

## Data plumbing
`SKILL_COLS` in `src/lib/skills.js` gained the 3 new columns, so they load via
`getSkillWithBlocks` and save via the builder's existing debounced `patchSkill`
(no new save code — same pattern as `kind`).

## Files
New: `migrations/012_…sql`, `src/lib/reviews.js`, `src/lib/embed.js`.
Edited: `SkillBuilder` (Options tab + styles), `SkillPublic` (promo + reviews),
`Locker` (`ReviewBox`), `skills.js` (cols), `backend/routes/webhooks.js`
(confirmation message), `supabase/schema.sql` (mirror).

## Verify
`eslint` clean; `node -c webhooks.js` OK; `npm run build` OK. **Manual test
needs the migration run first**, then: publish a product → buy from a 2nd
account → in the Locker leave a star review → confirm it shows on the public
page; set a promo video URL + confirmation message and confirm both appear.

## Next
Order bump + affiliate are the real revenue features and each needs a Stripe +
schema pass. Email integration is per-provider. All three are the "Soon" cards.
