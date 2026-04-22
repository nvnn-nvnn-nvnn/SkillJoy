# 32 — Gig Modal: Missing Description Fix + Direct Page Link

## What changed

### Fix: Gig description not showing in modal

**`src/app-pages/MyListings.jsx` — `loadData()` queries**

The three Supabase queries for incoming, sent, and completed requests were joining gigs with only `(id, title, price, category)`. The modal tried to render `description`, `commitments`, `requirements`, and `images` but those fields were never fetched — they were always `undefined`.

Added the missing fields to all three queries:

```diff
- gig:gigs!gig_id(id, title, price, category)
+ gig:gigs!gig_id(id, title, price, category, description, commitments, requirements, images)
```

### Feature: Direct link to gig page from modal

Added a "View full gig page" link at the bottom of the gig detail modal. Clicking it navigates to `/gigs/:gigId` (the full GigDetails page) and closes the modal.

Styled as a warm button-link with `var(--accent)` text on `var(--surface-alt)` background, hovering to `var(--accent-light)`.

## Why

**Description fix** — The modal was silently failing. It rendered "No description provided" even for gigs that had descriptions, because the data was never requested from Supabase. Same issue for commitments, requirements, and portfolio images.

**Direct link** — Users could only preview gig info in a summary modal. There was no way to jump to the full gig page (which has reviews, hire button, provider card, FAQs) from My Listings. The link gives quick access without leaving the modal-first workflow.

## How

- The select fields are a comma-separated string inside the Supabase `.select()` join — just added the four missing column names
- The link uses React Router's `<Link>` component (already imported) with `onClick` closing the modal before navigation
- `.ml-modal-link` class handles styling, placed at the bottom of the modal after all content sections
