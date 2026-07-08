# 82 — Membership: pricing lock, member feed, member-email capture

_Session 2026-07-06 (cont. from note 81). Three changes: hard-lock the pricing
ternary so only membership kinds bill recurring, make membership Patreon-esque
with a creator "member updates" feed, and auto-capture member emails to the
creator's subscriber list._

---

## 1. Pricing ternary — membership billing is now exclusive to membership kind

[src/app-pages/SkillBuilder.jsx](../../../src/app-pages/SkillBuilder.jsx) Pricing
step. Before, the default (non-lead, non-membership) branch offered a One-time /
**Membership** segmented toggle — meaning a digital/course/webinar product could
be toggled into a subscription. That's the bad state.

- **Membership branch:** removed the pointless single-option toggle; shows a
  static `/ month` label. `pricing_type` is already forced to `'membership'` at
  creation (`createSkill`), so there's nothing to choose.
- **Non-membership branch:** removed the "Membership" button entirely; shows a
  static `one-time` label. A one-time product can no longer become recurring.
- New `.sb-permonth` style for both labels.

Net: `pricing_type: 'membership'` is only reachable for `kind === 'membership'`,
enforced at creation (data) **and** in the builder UI (no toggle to get wrong).

## 2. Member post feed — Patreon-style, via CommunityThread `feed` mode

Rather than a new table, extended the existing
[CommunityThread](../../../src/components/CommunityThread.jsx) (already rendered
for every skill in the Locker consume view, backed by `community_posts`, realtime,
RLS-gated to buyers+creator).

New `feed` prop (default false):
- **Symmetric (default, non-membership):** anyone posts top-level + replies — unchanged.
- **`feed` mode (membership):** asymmetric. Only the **creator** sees the top-level
  composer (`canCompose = !feed || isCreator`); members read the creator's updates
  and can **reply** (the comment loop). Header becomes "📣 Member updates", copy +
  empty states change to match.

Wired in [Locker.jsx](../../../src/app-pages/Locker.jsx):
`<CommunityThread ... feed={skill.kind === 'membership'} />`.

No schema/RLS change — members hold a `paid` purchase so existing
`community_posts` RLS already lets them read + reply; the creator posts top-level.

**Known gap (deferred):** when the creator posts a top-level update, members are
NOT notified — `notify()` fans out to a single recipient and returns early for the
creator's own space. True "new update" fan-out to all members needs a members
query; left for later. Replies still notify the parent author (creator gets pinged
when a member comments).

## 3. Member-email capture — auto-add to subscriber list (no opt-in email)

Decision: **auto-add, no verification email.** The member's account email is
already verified at signup, so we trust it (unlike storefront lead capture which is
a raw email).

[backend/routes/webhooks.js](../../../backend/routes/webhooks.js), in the
`checkout.session.completed` (skill_sub) grant handler: after the notification +
automation, upsert the member's email into `subscribers`:

```js
const memberEmail = session.customer_details?.email || await getUserEmail(buyer_id);
await supabase.from('subscribers').upsert(
  { creator_id: skill.creator_id, email: memberEmail, source: 'membership' },
  { onConflict: 'creator_id,email', ignoreDuplicates: true }
);
```

Same shape as the lead-magnet capture (checkout.js), new `source: 'membership'`.
`subscribers` (migration 008) has no `verified` column, so nothing else needed.
Wrapped in try/catch — a subscribe failure must never break the grant.

## 4. Not done / next
- **Membership tiers** — explicitly deferred (multiple levels at different prices).
  Will need a tiers table, per-tier Stripe prices, builder UI, tier-gated content.
- **New-update notifications** to members (the fan-out gap above).
- **Bundle** — still `built: false` (note 81).

## 5. How to test
- **Pricing lock:** builder → digital/course/webinar → Pricing shows only a price
  field + `one-time`, no Membership option. Membership kind shows price + `/ month`.
- **Member feed:** subscribe to a membership from a 2nd account → open it in the
  Locker → members see "📣 Member updates" with no composer, can reply. Creator
  (preview or own) sees the composer and can post updates.
- **Email capture:** after a membership checkout completes (webhooks running),
  check the creator's `subscribers` for the member's email with `source='membership'`.
