# Onboarding Text Color Fix — `src/app-pages/auth/Onboarding.jsx`

## Why
Gray muted text (`var(--text-muted)`, `var(--text-secondary)`) was hard to read on the onboarding background.

## What Changed
- `.step-indicator` and `.onboard-sub` CSS classes: color → `#fff`
- "(optional)" span on bio label: color → `#fff`
- Service type option description text: color → `#fff`
- Unselected service type radio option background: `transparent` → `#fff`
