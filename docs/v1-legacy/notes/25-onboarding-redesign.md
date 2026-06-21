# 25 — Onboarding Page Redesign

## What changed

### `src/app-pages/auth/Onboarding.jsx`

**White card layout** — The form now sits inside a white card (`var(--surface)`) with rounded corners and a subtle box-shadow, over the orange `var(--bg)` background. Previously everything rendered directly on the orange with no visual container.

**Fixed invisible text** — Multiple elements had `color: #fff` which was invisible on the orange/white backgrounds:
- `.step-indicator` → replaced with numbered step dots using `--text-muted` / `--accent`
- `.onboard-sub` → `var(--text-secondary)`
- Service type descriptions → `var(--text-muted)` via `.service-desc` class
- Bio "(optional)" label → `var(--text-muted)` via `.label-optional` class

**Step dots** — Replaced plain "Step X of Y" text with numbered circles + labels (About You, Teach, Learn, Availability). Completed steps show a checkmark, current step is highlighted with accent color.

**Added missing `.avail-chip.active` CSS** — Availability chips had no selected state styling. Now shows accent background/border when active.

**Removed redundant navigation** — "← Back to Profile View" and "Exit" buttons merged into one context-aware button: shows "Cancel" (returns to profile view) if the user already has a profile, or "Exit" (navigates home) if they don't.

**Commented out duplicate add-skill input (Step 2)** — The `SkillEditor` component already provides a text input, "Add" button, and a "Browse" modal with all skill categories. The inline `.custom-input` was a second way to do the same thing. Commented out to keep the more polished `SkillEditor`.

**Added responsive breakpoint** — Card padding, title size, and step dots scale down on screens under 600px.

## Why

- White text on orange/white was unreadable — users couldn't see step numbers, subtitles, or service descriptions
- Two separate "add skill" inputs in Step 2 was confusing
- No visual card container made the form feel flat and unfinished
- Availability chips had no selected feedback so users couldn't tell what they'd picked

## How

- Card uses existing design tokens (`--surface`, `--border`, `--r`) so it matches the rest of the app
- Step dots are pure CSS, no extra dependencies
- `SkillChipGrid` component extracted to share chip-rendering logic between Step 2 and Step 3
- Service type radio options moved from inline styles to CSS classes (`.service-option`, `.service-label`, `.service-desc`)
