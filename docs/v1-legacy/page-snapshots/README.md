# v1 Page Snapshots

A frozen copy of every SkillJoy v1 page, taken **before** the v2 creator-platform
rebrand began. This is a rollback safety net — if v2 needs to be reverted, these
are the original page files exactly as they were.

- `app-pages/` — 20 files (incl. `auth/Login.jsx`, `auth/Onboarding.jsx`)
- `introduction-pages/` — 7 files

## Important

- These are **reference copies only**. They are not imported, built, or linted
  (`docs/v1-legacy` is in `eslint.config.js` ignores; Vite only bundles files
  imported from `src/`).
- The **live** pages still live in `src/app-pages/` and `src/introduction-pages/`
  and are what actually run. The rebrand edits those, not these.
- Snapshot does **not** include `src/components/`, `src/lib/`, routing
  (`main.jsx`), or styles. For a complete point-in-time restore, use git
  (a tag/branch at this commit captures the entire repo).

## To restore a single page

Copy the file back over its live counterpart, e.g.:

```sh
cp docs/v1-legacy/page-snapshots/app-pages/Gigs.jsx src/app-pages/Gigs.jsx
```

## To restore everything

```sh
cp -r docs/v1-legacy/page-snapshots/app-pages/.        src/app-pages/
cp -r docs/v1-legacy/page-snapshots/introduction-pages/. src/introduction-pages/
```

Then check imports still resolve (components/lib may have changed since the
snapshot) and re-run the app.
