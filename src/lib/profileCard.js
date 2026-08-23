// ── Profile hero card colours ───────────────────────────────────────────────
//
// Presets, not free hex. Each entry carries a light AND dark pair, because the
// card sits on a themed page: one hex that reads well on white is usually
// invisible or glaring on the dark surface. Storing a key and resolving it in
// CSS keeps that decision in one place (see migration 030 for the reasoning).
//
// `tint`   card background
// `edge`   border — always a step darker/lighter than the tint so the card keeps
//          a visible boundary rather than bleeding into the page
// `accent` used for the small identity details (verified pill, handle)
//
// Text colour is deliberately NOT part of a preset: every tint here is light
// enough (or, in dark mode, dark enough) that the normal --text token clears
// 4.5:1 on it. That's the constraint each pair was chosen against, and it's why
// the palette is fixed rather than user-supplied.
export const PROFILE_CARD_COLORS = [
  { key: 'default', label: 'Default', light: { tint: 'var(--surface)',  edge: 'var(--border)',  accent: 'var(--accent)'  },
                                       dark:  { tint: 'var(--surface)',  edge: 'var(--border)',  accent: 'var(--accent)'  } },
  { key: 'coral',   label: 'Coral',   light: { tint: '#FDEDE8', edge: '#F6C9BC', accent: '#C24A2E' },
                                       dark:  { tint: '#3A211A', edge: '#5E362A', accent: '#F09A7E' } },
  { key: 'sand',    label: 'Sand',    light: { tint: '#F8F1E2', edge: '#E6D6B8', accent: '#8A6A23' },
                                       dark:  { tint: '#332C1E', edge: '#4E4430', accent: '#D9BC77' } },
  { key: 'sage',    label: 'Sage',    light: { tint: '#E9F2EA', edge: '#C2D9C6', accent: '#2F6B45' },
                                       dark:  { tint: '#1E2E24', edge: '#33493A', accent: '#8CC8A3' } },
  { key: 'ocean',   label: 'Ocean',   light: { tint: '#E7F0F7', edge: '#BFD6E8', accent: '#1F5A87' },
                                       dark:  { tint: '#1B2833', edge: '#2E4356', accent: '#8ABEE4' } },
  { key: 'lilac',   label: 'Lilac',   light: { tint: '#F0EBF7', edge: '#D3C6E6', accent: '#5B3E8F' },
                                       dark:  { tint: '#272033', edge: '#3E3352', accent: '#B79BE0' } },
  { key: 'slate',   label: 'Slate',   light: { tint: '#EEF0F2', edge: '#CFD5DA', accent: '#3F4B55' },
                                       dark:  { tint: '#23282D', edge: '#3A4249', accent: '#A9B6C0' } },
];

export const CARD_COLOR_BY_KEY = Object.fromEntries(PROFILE_CARD_COLORS.map(c => [c.key, c]));

/** Preset for a stored key. Unknown/NULL keys fall back to default, so adding
 *  or removing a preset can never leave a profile unrenderable. */
export function resolveCardColor(key) {
  return CARD_COLOR_BY_KEY[key] || CARD_COLOR_BY_KEY.default;
}

/** Inline CSS custom properties for a card. Both modes are emitted as separate
 *  variables and picked between in CSS via a media query — a style attribute
 *  can't contain a media query, so the choice has to happen in the stylesheet. */
export function cardColorVars(key) {
  const c = resolveCardColor(key);
  return {
    '--pfc-tint': c.light.tint,
    '--pfc-edge': c.light.edge,
    '--pfc-accent': c.light.accent,
    '--pfc-tint-dark': c.dark.tint,
    '--pfc-edge-dark': c.dark.edge,
    '--pfc-accent-dark': c.dark.accent,
  };
}
