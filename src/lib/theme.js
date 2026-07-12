// ── Site-wide light/dark theme (app chrome only; the public storefront themes
// itself per-creator). Applied via data-theme="dark" on <html>; persisted in
// localStorage. See the dark var block in src/index.css.

const KEY = 'sj-theme';

/** 'light' | 'dark' — defaults to the OS preference, then falls back to light. */
export function getTheme() {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Reflect a theme onto the document (no persistence). */
export function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}

/** Persist + apply. */
export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  applyTheme(theme);
}
