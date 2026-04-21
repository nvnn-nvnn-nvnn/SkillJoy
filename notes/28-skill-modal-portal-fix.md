# 28 — Skill Browse Modal Portal Fix

## What changed

### `src/components/Skillededitor.jsx`

**Wrapped the Browse modal in `createPortal`** so it renders on `document.body` instead of inside the component tree.

```diff
+ import { createPortal } from 'react-dom';

- {showModal && (
-     <div style={{ position: 'fixed', inset: 0, ... }}>
+ {showModal && createPortal(
+     <div style={{ position: 'fixed', inset: 0, ... }}>
          ...
-     </div>
- )}
+     </div>,
+     document.body
+ )}
```

## Why

The modal used `position: fixed` with `inset: 0` which normally covers the full viewport. But when any ancestor element has a CSS `transform`, `filter`, or `will-change` property (e.g. the `.fade-up` animation on the onboarding card), it creates a new containing block — `position: fixed` then resolves relative to that ancestor instead of the viewport. This trapped the modal inside the card/page container.

## How

`createPortal(jsx, document.body)` mounts the modal's DOM directly on `<body>`, completely outside the component tree. This means no ancestor CSS can affect its positioning. The modal still has access to React state/props normally — portals only change where the DOM node lives, not the React component hierarchy.
