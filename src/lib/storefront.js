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
export const MAX_PROFILE_VIDEOS = 2;

// The movable sections, in their default order.
export const PAGE_SECTIONS = [
  { id: 'featured', label: 'Featured links', blurb: 'The links you promoted out of your profile card.' },
  { id: 'videos',   label: 'Videos',         blurb: 'Your embedded YouTube, Shorts, Vimeo or TikTok.' },
  { id: 'products', label: 'Products',       blurb: 'Everything you sell, in its groups.' },
  { id: 'email',    label: 'Email signup',   blurb: 'The subscribe box. Higher up converts better.' },
];

/**
 * The saved order, repaired.
 *
 * Two failure modes this exists to prevent, both silent:
 *
 *   · a section added to PAGE_SECTIONS after someone saved their order would be
 *     missing from their array and would simply never render for them
 *   · a stale id left in a saved array (a section we removed) would be rendered
 *     as nothing, or crash a lookup
 *
 * So: keep the saved ids that still exist, then append anything new. New
 * sections land at the bottom, which is the safe default — they appear rather
 * than vanish, and they do not displace what someone deliberately put on top.
 */
export function resolveSectionOrder(theme) {
  const known = PAGE_SECTIONS.map(s => s.id);
  const saved = Array.isArray(theme?.section_order) ? theme.section_order : [];
  const kept = [...new Set(saved.filter(id => known.includes(id)))];
  return [...kept, ...known.filter(id => !kept.includes(id))];
}

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
  // The CTA button is its own surface. '' derives it from the link text colour,
  // which is the behaviour every existing page already has.
  link_cta_color: '',
  link_cta_text_color: '',
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
  // ── Featured links are a THIRD category ──
  // Profile links sit in the card; featured links get their own section above
  // the products. They are the same kind of object with a different job, so
  // they need their own styling — but every key here defaults to empty/null,
  // meaning "inherit the profile-link value". That is what makes this a fourth
  // cascade level rather than a fork: block -> featured -> page -> theme.
  featured_link_color: '',
  featured_link_text_color: '',
  featured_link_cta_color: '',
  featured_link_cta_text_color: '',
  featured_link_opacity: null,
  featured_link_blur: null,
  featured_link_shape: '',   // '' = follow link_shape

  // ── Which surfaces the glow slider reaches ──
  // One slider used to light the name, avatar, card, links and icons at once,
  // so tuning it for one wrecked the others — "the effects just mixing up".
  // Default is every target, so existing pages are unchanged; unchecking one
  // collapses only that surface's glow variable to 0.
  glow_targets: ['name', 'avatar', 'card', 'links', 'icons'],
  item_color: '',
  item_text_color: '',
  show_avatar: true,        // false → hide the profile picture on the storefront
  socials: [],
  // ── Deeper theming (guns.lol-style) ──
  mode: 'light',            // 'light' | 'dark' — drives surface/text palette
  // 'animated' is a MOVING background with no asset at all — CSS gradient
  // layers on a slow loop. It exists because "video background" is usually a
  // request for MOTION, not for footage: this delivers the motion at zero
  // bytes, no decode cost, and no bandwidth per visitor. Real video is still
  // there for when the footage itself is the point.
  bg: 'canvas',             // 'canvas' | 'solid' | 'gradient' | 'image' | 'video' | 'animated'
  // Which motion, when bg === 'animated'. Two colours drive every one of them,
  // so a creator picks a palette and a movement rather than 20 fixed looks.
  bg_motion: 'aurora',      // 'aurora' | 'drift' | 'pulse' | 'nebula' | 'sweep'
  bg_speed: 100,            // 40-200 % — scales every motion's duration
  bg_color: '#FBF8F2',      // solid fill / gradient start
  bg_color2: '#FDEBE6',     // gradient end
  bg_image: '',             // full-page background image url
  bg_video: '',             // full-page background video url (bg === 'video')
  // Play the background video on phones too.
  //
  // This was hardcoded OFF, which was the wrong call to make on a creator's
  // behalf: plenty of phones play it fine, and turning it off for all of them
  // meant the feature simply did not exist for most visitors. The reasons for
  // caution are real — iOS Low Power Mode blocks autoplay outright, and a
  // multi-megabyte file over cellular is expensive — but they are a tradeoff
  // the person who owns the page should be making, not a rule.
  //
  // What is NOT a setting: prefers-reduced-motion and Save-Data. Those are the
  // VISITOR's own explicit choices about their own device, and a creator does
  // not get to override them.
  bg_video_mobile: true,
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
  // Social icon diameter. Sized with the avatar rather than fixed: the two sit
  // together and read as one unit, so a large avatar over 23px icons looks off.
  icon_size: 23,            // 14-44 px
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
  // Embedded videos on the profile — YouTube, Shorts, Vimeo, TikTok.
  // [{ url }], capped at MAX_PROFILE_VIDEOS. The cap is a product decision, not
  // a technical one: each embed is a third-party iframe that loads its own
  // scripts, and a page of them stops being a link-in-bio and starts being a
  // feed nobody scrolls to the bottom of.
  videos: [],
  // Order of the movable page sections, top to bottom. The profile card is not
  // in this list on purpose: it carries the avatar, name, bio and profile
  // links, so it is the page's identity header rather than a section, and a
  // page whose header is not first is a different product.
  //
  // Read through resolveSectionOrder, never directly — a saved array from
  // before a new section existed must not make that section disappear.
  section_order: ['featured', 'videos', 'products', 'email'],
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

// One-tap theme templates live in their own module (presets.js) because it has
// NO imports — that is what lets scripts/check-presets.cjs load and validate the
// real objects instead of regexing the source. Re-exported here so every
// existing `from '@/lib/storefront'` import keeps working.
export { THEME_PRESETS, PRESET_CATEGORIES, presetsByCategory } from './presets';

// A theme file carries LOOK, never content or assets:
//  - socials/audio_tracks are someone's own links & music, not styling.
//  - asset URLs would hotlink the exporter's storage (breaks + leaks on their bill).
// Excluded from both export and import.
const THEME_PORTABLE_EXCLUDE = new Set([
  'socials', 'audio_tracks', 'audio_url',
  'banner_url', 'bg_image', 'bg_video', 'cursor_url',
]);

// …except when the asset is one WE ship. The exclusion exists because an
// uploaded URL points at the exporter's storage — importing it would hotlink
// their file and bill their bandwidth. A path under /templates/ is served by
// this app, has no owner, and is the whole point of a scenic template: strip it
// and an exported Aurora theme arrives with a blank background.
export const TEMPLATE_ASSET_PREFIX = '/templates/';
const isShippedAsset = (v) => {
  if (typeof v === 'string') return v.startsWith(TEMPLATE_ASSET_PREFIX);
  // audio_tracks is [{ url, name }]. Every track must be shipped — one uploaded
  // URL in the array would smuggle the whole playlist past the check.
  if (Array.isArray(v)) {
    return v.length > 0 && v.every(t => typeof t?.url === 'string' && t.url.startsWith(TEMPLATE_ASSET_PREFIX));
  }
  return false;
};

/** Strip a theme down to the shareable/stylistic keys (for export). */
export function portableTheme(theme) {
  const out = {};
  for (const [k, v] of Object.entries(theme || {})) {
    if (!THEME_PORTABLE_EXCLUDE.has(k) || isShippedAsset(v)) out[k] = v;
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
    // Shipped assets are the one safe exception — see isShippedAsset. The
    // prefix check is also the security boundary: it is a same-origin path, so
    // a hand-edited file cannot smuggle in an external URL here.
    if (THEME_PORTABLE_EXCLUDE.has(key) && !isShippedAsset(raw[key])) continue;
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

// Surfaces the glow slider can reach. Absent from theme.glow_targets = that
// surface's variable collapses to 0px while the others keep the slider value.
export const GLOW_TARGETS = [
  { id: 'name',   label: 'Name' },
  { id: 'avatar', label: 'Profile picture' },
  { id: 'card',   label: 'Profile card' },
  // Split from one "Link buttons" target: profile links sit inside the card and
  // featured links sit on the raw background, so the glow that flatters one
  // routinely blows out the other. They are already separate everywhere else
  // (colour, shape, opacity, blur) — glow was the last shared control.
  { id: 'links',    label: 'Profile links' },
  { id: 'featured', label: 'Featured links' },
  { id: 'icons',  label: 'Icons' },
];

export function glowVars(theme, glowOn) {
  // undefined (saved before this key existed) must mean "all on", not "none" —
  // otherwise every existing storefront loses its glow on next load.
  const on = (id) => {
    if (!glowOn) return false;
    const t = theme.glow_targets;
    if (!Array.isArray(t)) return true;   // saved before this key existed → all on
    // 'featured' was split out of 'links'. A theme saved before the split lists
    // only 'links', and must keep glowing in both regions — otherwise the split
    // silently turns something off that the creator never switched off.
    if (id === 'featured') return t.includes('featured') || t.includes('links');
    return t.includes(id);
  };
  const base = theme.glow_intensity ?? 0;
  const px = (yes, mult = 1) => (yes ? `${base * mult}px` : '0px');
  return {
    '--sf-glow-name':        px(on('name')),
    '--sf-glow-name-strong': px(on('name'), 2.4),
    '--sf-glow-avatar':      px(on('avatar'), 2.4),
    '--sf-glow-card':        px(on('card'), 2.4),
    '--sf-glow-links':          px(on('links')),
    '--sf-glow-links-strong':   px(on('links'), 2.4),
    '--sf-glow-featured':        px(on('featured')),
    '--sf-glow-featured-strong': px(on('featured'), 2.4),
    '--sf-icon-glow':        on('icons') ? `${theme.icon_glow ?? 10}px` : '0px',
  };
}
