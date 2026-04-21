# 27 — Railway Build Fix

## What changed

### `railway.json`

Removed the `cd backend &&` prefix from both `buildCommand` and `startCommand`:

```diff
- "buildCommand": "cd backend && npm install"
+ "buildCommand": "npm install"

- "startCommand": "cd backend && node index.js"
+ "startCommand": "node index.js"
```

## Why

Railway's service root directory is already set to `/backend` in the dashboard. The old commands were trying to `cd backend` from within `/backend`, resulting in `/backend/backend/` which doesn't exist — causing a build failure.

## How

Since Railway resolves the root directory before running any commands, the build and start commands just need to run directly without navigating into a subdirectory.
