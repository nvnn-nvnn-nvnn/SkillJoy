# 20 — Gig Listing Prerequisites (Stripe + Gig Services Required)

## What changed

### `src/app-pages/MyListings.jsx`

**Replaced the Stripe-only warning banner with a combined prerequisites banner** that shows when either `stripe_onboarded` or `offers_gigs` is missing:

```jsx
{(!profile?.stripe_onboarded || !profile?.offers_gigs) && (
    <div style={{ /* yellow warning box */ }}>
        <p>⚠️ Before you can list a gig, you need to:</p>
        <ul>
            {!profile?.stripe_onboarded && (
                <li>Connect Stripe to receive payments — <Link to="/profile">Set up payouts</Link></li>
            )}
            {!profile?.offers_gigs && (
                <li>Enable gig services in your settings — <Link to="/settings">Go to Settings</Link></li>
            )}
        </ul>
        <p>Your gig won't be submitted until both are complete.</p>
    </div>
)}
```

Only the relevant items render — if only one is missing, only one bullet shows.

**Blocked `handleCreateGig` at the handler level:**
```js
if (!profile?.stripe_onboarded || !profile?.offers_gigs) {
    showToast('Set up Stripe payouts and enable gig services before listing.', 'error');
    return;
}
```

**Disabled the submit button when prerequisites are unmet:**
```jsx
disabled={submitting || !title.trim() || !price || !profile?.stripe_onboarded || !profile?.offers_gigs}
```

## Why

Users could list gigs without Stripe connected or gig services enabled. This meant:
- Buyers could pay for a gig whose seller couldn't receive the payout
- Gigs could appear in the marketplace from sellers who had paused their services

The guard is applied in three places (banner, handler, button) so it's impossible to bypass — the button is visually disabled, the handler rejects it as a fallback, and the banner tells the user exactly what to fix with direct links.

## How

- `profile` comes from `useProfile()` which is synced to the Supabase `profiles` table via the auth store — no extra fetch needed.
- The banner conditionally renders each bullet independently so the user only sees what's actually missing, not a generic "do both" message when only one thing is wrong.
- Both links point directly to the page where the fix lives: `/profile` for Stripe setup, `/settings` for the gig toggle.
- Existing gigs can still be edited regardless of these conditions — the check only applies to the `handleCreateGig` path, not `handleEditGig`.
