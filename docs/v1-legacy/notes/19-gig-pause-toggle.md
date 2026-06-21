# 19 — Gig Pause Toggle (offers_gigs off = hidden from marketplace)

## What changed

### `src/app-pages/Gigs.jsx`

**Added `offers_gigs` to the profile join select:**
```js
.select('*, profile:profiles!user_id(id, full_name, bio, service_type, availability, offers_gigs)')
```

**Filter out paused sellers before processing:**
```js
const activeGigs = data.filter(gig => gig.profile?.offers_gigs !== false);
const gigsWithRatings = await Promise.all(activeGigs.map(async (gig) => {
```

### `src/app-pages/Settings.jsx`

**Added notification when seller turns off gig services:**
```js
async function saveGigSettings() {
    const turningOff = profile?.offers_gigs === true && offersGigs === false;
    // ... save to DB ...
    if (turningOff) {
        await supabase.from('notifications').insert({
            user_id: user.id,
            type: 'order_update',
            title: 'Gig services are now paused',
            message: 'Your gigs are no longer visible to buyers. No new requests will come in until you re-enable gig services in Settings. Your gig listings and payout info are safe.',
        });
    }
}
```

## Why

Users going on a break from gig work could still receive requests from buyers because the `offers_gigs` flag was never checked at the query level — gigs were fetched regardless of the seller's status. This caused sellers to get unwanted requests they couldn't fulfil.

The notification was added so the seller gets clear, immediate confirmation that their gigs are hidden — reduces confusion about why no requests are coming in.

## How

- `offers_gigs` already existed on the `profiles` table as a boolean — no DB migration needed.
- The filter uses `!== false` (not `=== true`) so gigs where `offers_gigs` is `null` or `undefined` still appear. Only explicitly paused sellers (`offers_gigs = false`) are excluded.
- The notification is only inserted on a true → false transition, checked by comparing `profile.offers_gigs` (current DB value) against the new toggle state before saving. Turning gig services back on sends no notification.
- Stripe info (`stripe_account_id`, `stripe_onboarded`) and all gig listings are never touched — `saveGigSettings()` only writes `offers_gigs` to profiles.
