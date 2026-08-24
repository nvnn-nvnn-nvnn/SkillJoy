import { supabase } from './supabase';

// ── Storefront customization data layer (v3, Phase 7) ───────────────────────
// Theme lives in profiles.storefront_theme; link buttons in store_links.

// Site music plays at 85%, never full blast — a page the visitor didn't ask to
// make noise shouldn't arrive at 100%. This trims the page, not the creator:
// their file's own mastering still sets the perceived loudness.
//
// MUST be assigned to the DOM `volume` property, never passed as JSX. `volume`
// is not an HTML attribute, so `<audio volume={0.85}>` is dropped silently and
// the element stays at 1. The property survives `src` changes, so setting it
// once on mount also covers every later track in a playlist.
//
// Shared with the editor's track-preview player so a creator auditions their
// music at exactly the level visitors will hear.
export const SITE_AUDIO_VOLUME = 0.85;

// Playlist cap. Four is a deliberate product decision, not a technical one:
// site music is ambience, and every track is a file YOU store and serve on every
// storefront visit. A 20-track playlist is a hosting bill and a slower page, not
// a better page. Enforced in the editor (StorefrontEditor) — the theme is a JSON
// blob the client writes, so this is a guardrail on the creator's own page
// rather than a security boundary.
export const MAX_AUDIO_TRACKS = 4;

export const DEFAULT_THEME = {
  accent: '#F5634A',
  layout: 'list',           // 'list' | 'grid'
  banner_url: '',
  // 'panel' — the original: a 150px strip inside the card, clipped to it.
  // 'cover' — full-bleed across the top of the PAGE, fading out at its bottom
  //           edge so it melts into the background instead of ending on a line.
  banner_style: 'panel',    // 'panel' | 'cover'
  // Display-name colour. '' = inherit the theme's normal text colour, which is
  // the safe default: it follows light/dark automatically. A set value is an
  // explicit override and does NOT adapt, so the editor warns on low contrast
  // rather than silently letting someone make their own name unreadable.
  name_color: '',
  // Profile-card fill. '' = follow the mode palette's --surface (the old
  // behaviour). A set value is mixed with card_opacity exactly the same way, so
  // colour and transparency stay independent controls rather than one field
  // that has to encode both.
  card_color: '',
  // Link buttons and product cards are SEPARATE block types (see the
  // link-in-bio spec), so each gets its own fill AND its own text colour.
  // '' = follow the theme. Sharing any of these would collapse a distinction
  // the page design depends on.
  link_color: '',
  link_text_color: '',
  // Opacity and blur are per-category too. They read product_opacity /
  // card_blur before, so a glassy product grid forced glassy link buttons.
  // null = "follow the product value", which keeps every existing storefront
  // pixel-identical until someone moves the slider.
  link_opacity: null,
  link_blur: null,
  // 'rounded' | 'oval' | 'sharp' | 'full'. Separate from button_style, which is
  // the PRODUCT card shape — they were one key and that's exactly the conflation
  // being undone here. 'full' also drops the side margins.
  link_shape: 'oval',
  item_color: '',
  item_text_color: '',
  show_avatar: true,        // false → hide the profile picture on the storefront
  socials: [],
  // ── Deeper theming (guns.lol-style) ──
  mode: 'light',            // 'light' | 'dark' — drives surface/text palette
  bg: 'canvas',             // 'canvas' | 'solid' | 'gradient' | 'image' | 'video'
  bg_color: '#FBF8F2',      // solid fill / gradient start
  bg_color2: '#FDEBE6',     // gradient end
  bg_image: '',             // full-page background image url
  bg_video: '',             // full-page background video url (bg === 'video')
  button_style: 'rounded',  // 'rounded' | 'pill' | 'sharp'
  // ── Studio: glass + effects ──
  text_color: '',           // '' = palette default; else overrides body text
  title_color: '',          // '' = follows text; else colors the display name
  card_opacity: 100,        // 60–100 — card fill opacity (glassmorphism)
  card_blur: 0,             // 0–24 px — backdrop blur behind cards
  cursor_url: '',           // custom cursor image url
  mono_icons: false,        // grayscale the social icons
  animated_name: false,     // subtle animated glow on the display name
  product_glow: 'soft',     // 'none' | 'soft' | 'strong' — accent glow on product cards
  product_opacity: 100,     // 40–100 — product/link fill opacity (glass)
  product_blur: 0,          // 0–24 px — backdrop blur behind products/links (glass)
  avatar_size: 96,          // px — profile picture diameter on the public page
  avatar_shape: 'circle',   // 'circle' | 'rounded' | 'square' — profile picture shape
  bio_size: 15,             // px — bio font size
  bio_weight: 400,          // 300–800 — bio font weight
  bio_glow: 0,              // 0–20 px — accent drop-shadow glow on the bio
  // ── Phase 2: guns.lol effects ──
  // Master ON/OFF for the accent halo on the display name + social icons. The
  // two sliders below keep their values when it is off, so flipping it back
  // restores the creator's exact settings instead of resetting them to zero.
  // Always read as `glow_enabled !== false` — stores saved before this key
  // existed have it undefined and must keep glowing.
  glow_enabled: true,
  glow_intensity: 0,        // 0–80 px — master accent glow across name/avatar/panel/links
  icon_glow: 10,            // 0–60 px — social-icon glow halo (10 ≈ the old fixed look)
  name_fx: 'none',          // 'none'|'gradient'|'rainbow'|'shimmer'|'glitch' — display-name text effect
  overlay: 'none',          // 'none'|'rain'|'snow'|'vhs'|'stars'|'particles'|'matrix' — full-page overlay
  audio_url: '',            // DEPRECATED single site-audio url — kept in sync w/ audio_tracks[0] for back-compat
  audio_tracks: [],         // [{ url, name }] — site music playlist; play/mute pill plays through it
  cursor_fx: 'none',        // 'none' | 'trail' | 'sparkle' — pointer particle effect
  cursor_fx_color: '',      // '' = follow accent; else a hex for the particles
  profile_fx: 'none',       // 'none' | 'glow' | 'float' — profile panel animation
  // ── Phase 3: entry & depth ──
  show_group_headers: true, // group/section headers above product groups
  show_type_badges: true,   // product-type chips (Course · Download · …) on cards
  splash_enabled: false,    // show a "click to enter" splash before revealing the page
  splash_text: 'click to enter',
  tilt_enabled: false,      // 3D tilt/parallax on the profile card as the pointer moves
  tilt_max: 10,             // 0–20 — max tilt in degrees
};

// ── One-tap theme templates ──────────────────────────────────────────────────
// Each preset is a PARTIAL theme: applying it merges over the current theme, so
// a creator's name/bio/avatar/socials/links/products are never touched.
export const THEME_PRESETS = [
  { id: 'midnight', name: 'Midnight Glow', emoji: '🌌', theme: {
    mode: 'dark', bg: 'gradient', bg_color: '#0B0B14', bg_color2: '#1B1636', accent: '#7A5CFF',
    glow_intensity: 34, name_fx: 'shimmer', product_glow: 'strong', overlay: 'stars',
    card_opacity: 70, card_blur: 14, product_opacity: 70, product_blur: 10,
    profile_fx: 'glow', button_style: 'pill', tilt_enabled: true, text_color: '', title_color: '' } },
  { id: 'clean', name: 'Clean Light', emoji: '🤍', theme: {
    mode: 'light', bg: 'canvas', accent: '#F5634A', glow_intensity: 0, name_fx: 'none',
    product_glow: 'none', overlay: 'none', card_opacity: 100, card_blur: 0,
    product_opacity: 100, product_blur: 0, profile_fx: 'none', button_style: 'rounded',
    tilt_enabled: false, text_color: '', title_color: '' } },
  { id: 'vapor', name: 'Vaporwave', emoji: '🌴', theme: {
    mode: 'dark', bg: 'gradient', bg_color: '#2B1055', bg_color2: '#7597DE', accent: '#FF2D75',
    glow_intensity: 28, name_fx: 'rainbow', overlay: 'vhs', product_glow: 'strong',
    card_opacity: 65, card_blur: 12, product_opacity: 68, product_blur: 8,
    button_style: 'sharp', tilt_enabled: true, text_color: '', title_color: '' } },
  { id: 'frost', name: 'Frosted', emoji: '❄️', theme: {
    mode: 'light', bg: 'gradient', bg_color: '#E8F4FF', bg_color2: '#F7FBFF', accent: '#2563EB',
    glow_intensity: 10, name_fx: 'none', overlay: 'snow', product_glow: 'soft',
    card_opacity: 55, card_blur: 20, product_opacity: 60, product_blur: 14,
    button_style: 'pill', tilt_enabled: false, text_color: '', title_color: '' } },
  { id: 'terminal', name: 'Terminal', emoji: '🟩', theme: {
    mode: 'dark', bg: 'solid', bg_color: '#05080A', accent: '#00FF88', glow_intensity: 24,
    name_fx: 'glitch', overlay: 'matrix', product_glow: 'soft', mono_icons: true,
    card_opacity: 75, card_blur: 6, product_opacity: 75, product_blur: 4,
    button_style: 'sharp', tilt_enabled: false, text_color: '', title_color: '' } },
  { id: 'sunset', name: 'Sunset', emoji: '🌅', theme: {
    mode: 'dark', bg: 'gradient', bg_color: '#2A1020', bg_color2: '#6B2D3C', accent: '#FF8C00',
    glow_intensity: 22, name_fx: 'gradient', overlay: 'particles', product_glow: 'soft',
    card_opacity: 72, card_blur: 10, product_opacity: 72, product_blur: 8,
    profile_fx: 'float', button_style: 'rounded', tilt_enabled: true, text_color: '', title_color: '' } },
];

// A theme file carries LOOK, never content or assets:
//  - socials/audio_tracks are someone's own links & music, not styling.
//  - asset URLs would hotlink the exporter's storage (breaks + leaks on their bill).
// Excluded from both export and import.
const THEME_PORTABLE_EXCLUDE = new Set([
  'socials', 'audio_tracks', 'audio_url',
  'banner_url', 'bg_image', 'bg_video', 'cursor_url',
]);

/** Strip a theme down to the shareable/stylistic keys (for export). */
export function portableTheme(theme) {
  const out = {};
  for (const [k, v] of Object.entries(theme || {})) {
    if (!THEME_PORTABLE_EXCLUDE.has(k)) out[k] = v;
  }
  return out;
}

/**
 * Whitelist an imported theme file down to keys we actually know about, so a
 * hand-edited/hostile JSON can't inject arbitrary fields into the profile row.
 * Unknown keys, type mismatches, and content/asset keys are dropped silently.
 * Returns {} if nothing recognizable.
 */
export function sanitizeThemeImport(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const key of Object.keys(DEFAULT_THEME)) {
    if (THEME_PORTABLE_EXCLUDE.has(key)) continue;              // never import content/assets
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const val = raw[key];
    const def = DEFAULT_THEME[key];
    // Type must match the default's shape, else skip it.
    if (Array.isArray(def)) { if (Array.isArray(val)) out[key] = val; continue; }
    // A null default means "unset, but holds a number when set" (link_opacity,
    // link_blur). typeof null === 'object', so the plain type check below would
    // silently DROP a perfectly valid imported number — the exact failure mode
    // this whitelist exists to avoid for hostile input, applied to good input.
    if (def === null) { if (val === null || typeof val === 'number') out[key] = val; continue; }
    if (typeof def === typeof val) out[key] = val;
  }
  // The importer has no bg_image/bg_video (we never carry them), so an
  // image/video background would render blank — fall back to the plain canvas.
  if (out.bg === 'image' || out.bg === 'video') out.bg = 'canvas';
  return out;
}

// ── Mode palettes — SINGLE source of truth ───────────────────────────────────
// The public storefront pins these via .sf-mode-light/.sf-mode-dark, and the
// themed checkout pins the same values inline. Both consume THIS constant so
// the two surfaces can never drift apart.
export const MODE_PALETTES = {
  light: {
    bg: '#FBF8F2', surface: '#ffffff', surfaceAlt: '#F4F1EA',
    text: '#1A1916', textSecondary: '#5B574E', textMuted: '#97917F',
    border: '#ECE6DB', borderStrong: '#DCD4C6',
  },
  dark: {
    bg: '#121316', surface: '#1b1c20', surfaceAlt: '#24262b',
    text: '#f2f0ea', textSecondary: '#b6b3ab', textMuted: '#85817a',
    border: '#2c2e34', borderStrong: '#3a3d45',
  },
};

// ── Contrast helpers (WCAG relative luminance) ───────────────────────────────
// Creators pick ANY accent — near-white (#F8FAFC) or near-black included. Text
// sitting on or colored by that accent must stay legible, so these decide.
function relLuminance(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return 0;
  const chan = (i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(0) + 0.7152 * chan(2) + 0.0722 * chan(4);
}

/** WCAG contrast ratio between two hex colors (1–21). */
export function contrastRatio(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** '#fff' or '#111' — whichever is more readable ON the given color. */
export function readableOn(hex) {
  const l = relLuminance(hex);
  const white = 1.05 / (l + 0.05);
  const black = (l + 0.05) / 0.05;
  return white >= black ? '#ffffff' : '#111111';
}

export const SOCIAL_TYPES = [
  { type: 'instagram', label: 'Instagram', icon: '📸' },
  { type: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { type: 'youtube',   label: 'YouTube',   icon: '▶️' },
  { type: 'x',         label: 'X',         icon: '𝕏' },
  { type: 'bluesky',   label: 'Bluesky',   icon: '🦋' },
  { type: 'snapchat',  label: 'Snapchat',  icon: '👻' },
  { type: 'onlyfans',  label: 'OnlyFans',  icon: '🔵' },
  { type: 'roblox',    label: 'Roblox',    icon: '🎮' },
  { type: 'bitcoin',   label: 'Bitcoin',   icon: '₿' },
  { type: 'ethereum',  label: 'Ethereum',  icon: 'Ξ' },
  { type: 'website',   label: 'Website',   icon: '🌐' },
];

/** Derive a friendly track name from a file URL (last path segment, no extension). */
function trackNameFromUrl(url) {
  try {
    const seg = decodeURIComponent(String(url).split('?')[0].split('/').pop() || '');
    return seg.replace(/\.[^.]+$/, '') || 'Track';
  } catch { return 'Track'; }
}

/** Merge a stored theme over defaults so missing keys are safe. */
export function resolveTheme(theme) {
  const merged = { ...DEFAULT_THEME, ...(theme || {}) };
  if (!Array.isArray(merged.audio_tracks)) merged.audio_tracks = [];
  // Back-compat: a legacy single audio_url becomes a one-item playlist.
  if (merged.audio_tracks.length === 0 && merged.audio_url) {
    merged.audio_tracks = [{ url: merged.audio_url, name: trackNameFromUrl(merged.audio_url) }];
  }
  return merged;
}

/** Save bio + theme (+ optional integrations) on the creator's profile. */
export async function updateStorefront(userId, { bio, location, storefront_theme, tracking_pixels, automation_webhook_url, full_name, avatar_url }) {
  const patch = {};
  if (bio !== undefined) patch.bio = bio;
  if (location !== undefined) patch.location = location;
  if (storefront_theme !== undefined) patch.storefront_theme = storefront_theme;
  if (tracking_pixels !== undefined) patch.tracking_pixels = tracking_pixels;
  if (automation_webhook_url !== undefined) patch.automation_webhook_url = automation_webhook_url;
  if (full_name !== undefined) patch.full_name = full_name;
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// ── Link buttons ─────────────────────────────────────────────────────────────
// Columns that only exist once migration 032 has run.
const LINK_COLS_LEGACY = 'id, label, url, position, is_affiliate, placement, description, cover_url, cta_label, group_label';
const LINK_COLS_BLOCKS = `${LINK_COLS_LEGACY}, block_id, featured, visible`;

export async function listLinks(creatorId) {
  // Explicit column list — anything missing here arrives `undefined` in the UI
  // with no error anywhere, so new columns must be added in BOTH places
  // (the migration + here). addLink's bare .select() picks up new ones on its own.
  //
  // TWO-STEP, and this is load-bearing. Naming a column PostgREST doesn't have
  // fails the ENTIRE query, and every caller wraps this in .catch(() => []).
  // So a select that runs ahead of its migration doesn't error visibly — it
  // silently empties the link list on the public storefront. That is exactly
  // what shipping the 032 columns here before 032 had run did.
  //
  // Trying the block columns first and falling back means the frontend is safe
  // to deploy in either order, and self-heals the moment the migration lands.
  const query = (cols) => supabase
    .from('store_links')
    .select(cols)
    .eq('creator_id', creatorId)
    // position, then created_at as a tiebreaker. createLink sets
    // `position: links.length`, so a delete-then-add can produce duplicate
    // positions — and equal sort keys let Postgres return rows in any order,
    // which shows up as the list visibly reshuffling between page loads.
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });

  const { data, error } = await query(LINK_COLS_BLOCKS);
  // `?? []` — a null here becomes links.filter(...) on null in every caller,
  // which is a hard crash rather than an empty list.
  if (!error) return data ?? [];

  // 42703 = undefined_column. Anything else is a real failure worth surfacing.
  const missingColumn = error.code === '42703' || /column .* does not exist/i.test(error.message || '');
  if (!missingColumn) throw error;

  const legacy = await query(LINK_COLS_LEGACY);
  if (legacy.error) throw legacy.error;
  // Defaults match the migration's, so callers can read these unconditionally.
  return (legacy.data ?? []).map(l => ({ ...l, block_id: null, featured: l.placement === 'products', visible: true }));
}

export async function addLink(creatorId, link) {
  const { data, error } = await supabase
    .from('store_links').insert({ creator_id: creatorId, ...link }).select().single();
  if (error) throw error;
  return data;
}

export async function updateLink(linkId, patch) {
  const { error } = await supabase.from('store_links').update(patch).eq('id', linkId);
  if (error) throw error;
}

export async function deleteLink(linkId) {
  const { error } = await supabase.from('store_links').delete().eq('id', linkId);
  if (error) throw error;
}

export async function reorderLinks(ordered) {
  const results = await Promise.all(
    ordered.map((id, position) => supabase.from('store_links').update({ position }).eq('id', id))
  );
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}
