# 30 — My Listings Page Redesign

## What changed

### `src/app-pages/MyListings.jsx`

**Full UI rewrite** — all business logic, handlers, and data fetching are unchanged. Only the presentation layer was overhauled.

**Hero section** — Replaced flat `#f0ede8` background with a card-based hero (`var(--surface)` + border + rounded corners). Added a stats row showing Listed / Pending / Completed counts separated by vertical dividers.

**Tab navigation** — Replaced plain `.tabs` with a segmented control style: rounded container with `var(--surface-alt)` background, active tab gets white fill + subtle shadow. "New Gig" moved from a tab to a proper button in the hero actions.

**Gig cards** — Now show image thumbnail (first portfolio image) with hover zoom, category badge + price on the same row, 2-line clamped description, and tags preview (shows first 3 + "+N" overflow). Edit/Remove buttons sit in a footer row separated by a border.

**Request cards** — Horizontal layout: avatar + info on the left, price + payment badge + action buttons on the right. Stacks vertically on mobile.

**Payment badges** — Extracted into a `PayBadge` component with color-coded styles per status: escrowed (blue), held (amber), paid (green), released (indigo), refunded (purple), cleared (dark green).

**Form** — Grouped into labeled sections (Basic Info, Details, Media, FAQs, Tags) with uppercase headers and section dividers. Title + Price fields sit side-by-side on desktop. Everything stacks on mobile.

**Fixed invisible/wrong text colors:**
- FAQ helper text had `color: '#fff'` — removed entirely
- Optional labels had `color: '#000'` — now use `var(--text-muted)` via `.ml-optional` class
- All hardcoded `#fff` and `#000` inline styles replaced with CSS variables

**Removed unused imports:** `FAQSection`, `ChevronDown`, `ChevronUp`, `useMemo`.

**Added responsive breakpoint** — Hero actions, gig grid, request cards, form rows, and URL inputs all stack on screens under 768px.

## Why

The previous page was functional but visually flat — no cards, no visual hierarchy between sections, inline styles with hardcoded colors (some invisible), and a tab bar that mixed navigation with actions ("+ New Gig" was a tab). The form was a single unsectioned column. Request cards stacked everything vertically which wasted space on desktop.

## How

- All class names prefixed with `ml-` to avoid collisions with global styles
- Used existing CSS variables (`--surface`, `--border`, `--text-secondary`, `--accent`, etc.) throughout so the page matches the rest of the app
- No new dependencies — `Plus` and `Trash2` from lucide-react were already imported
- `PayBadge` component is defined locally in the same file since it's only used here
- Mobile layout handled with a single `@media (max-width: 768px)` block at the bottom
