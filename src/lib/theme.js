// ── Site-wide light/dark theme (app chrome only; the public storefront themes
// itself per-creator). Applied via data-theme="dark" on <html>; persisted in
// localStorage. See the dark var block in src/index.css.

const KEY = 'sj-theme';

/**
 * 'light' | 'dark' — an explicit saved choice always wins; otherwise DARK.
 *
 * Dark is the product default rather than the OS preference. Following the OS
 * is the usual advice, but it means the brand's first impression is decided by
 * a setting we don't control, and half of new visitors would see a look that
 * was never art-directed. A saved preference still overrides this, so anyone
 * who wants light gets light and keeps it.
 *
 * `localStorage` can throw outright (Safari private mode, blocked site data),
 * so the read is guarded — an exception here would take down first paint,
 * since applyTheme() runs before render in main.jsx.
 */
export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* storage unavailable — fall through to the default */ }
  return 'dark';
}

/** Reflect a theme onto the document (no persistence). */
export function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

/** Persist + apply. The write is guarded for the same reason as the read —
 *  a blocked localStorage must not stop the theme from actually changing. */
export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* not persisted this session */ }
  applyTheme(theme);
}
