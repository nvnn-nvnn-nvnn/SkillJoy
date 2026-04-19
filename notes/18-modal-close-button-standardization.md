# 18 — Modal Close Button Standardization

## What changed

Moved all modal close buttons to top-right with a consistent, professional style across the entire app.

### App.css — single authoritative `.modal-close` rule

Added/updated:
```css
.modal { position: relative; ... }

.modal-close {
    position: absolute;
    top: 14px; right: 14px;
    width: 32px; height: 32px;
    display: flex; align-items: center; justify-content: center;
    background: var(--surface-alt);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 15px;
    line-height: 1;
    color: var(--text-secondary);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    flex-shrink: 0;
}
.modal-close:hover {
    background: var(--border);
    color: var(--text);
    border-color: var(--border-strong);
}
```

### Removed local `.modal-close` overrides from:
- `src/components/Usermodal.jsx`
- `src/app-pages/Chat.jsx`
- `src/app-pages/MyListings.jsx`
- `src/app-pages/MySwaps.jsx`

### Skillededitor.jsx — Browse modal

Added `position: relative` to the modal container div so `position: absolute` on `.modal-close` works correctly inside it. Replaced the old close button with `<button className="modal-close">✕</button>`.

## Why

Several modals had their close buttons inline or in inconsistent positions. Some had wrong `border-radius`. Centralizing in App.css ensures one change affects all modals consistently.
