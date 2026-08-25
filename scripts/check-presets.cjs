// Validate the theme presets in src/lib/presets.js.
//
//   npm run check:presets        (also runs on every build)
//
// .cjs, not .js: package.json sets "type": "module", so a .js here would be
// parsed as ESM and require() would not exist. Same reason as
// check-style-backticks.cjs.
//
// This loads the REAL objects via dynamic import rather than regexing the
// source — which is exactly why presets.js has no imports of its own. A regex
// validator would have to re-implement JS parsing to know whether `...BASE`
// was actually spread, and it would be wrong about it eventually.
//
// ── What it catches, and why each one has bitten ──
//
//  · MISSING BASE       a preset that doesn't reset effects leaves the previous
//                       preset's snow falling over your new minimal theme.
//                       Presets get tried in sequence, so this always shows up
//                       as "the SECOND preset is broken".
//  · LITERAL TEXT COLOR text_color/title_color override the light/dark palette
//                       permanently — a dark preset leaves pale text behind
//                       when the user later picks a light one.
//  · LOW CONTRAST       an accent that fails against its own background makes
//                       arrows, borders and glow unreadable on a look the user
//                       cannot tell is at fault.
//  · UNKNOWN KEY        sanitizeThemeImport drops keys not in DEFAULT_THEME, so
//                       a typo'd key is silently ignored forever.
//  · BAD ENUM / ID      dead category ids hide a preset from the picker
//                       entirely; duplicate ids make one unreachable.

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const fs = require('node:fs');

const PRESETS = path.join(__dirname, '..', 'src', 'lib', 'presets.js');
const STOREFRONT = path.join(__dirname, '..', 'src', 'lib', 'storefront.js');

// WCAG relative luminance + contrast ratio. Duplicated from lib/blocks.js on
// purpose: importing it would drag in the supabase client, which needs env
// vars this script must run without.
const srgb = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
}
function contrast(a, b) {
  const A = luminance(a), B = luminance(b);
  if (A == null || B == null) return null;
  return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
}

// Enum-valued theme keys. Anything not listed is free-form (colours, numbers).
const ENUMS = {
  mode: ['light', 'dark'],
  bg: ['canvas', 'solid', 'gradient', 'image', 'video', 'animated'],
  bg_motion: ['aurora', 'drift', 'pulse', 'nebula', 'sweep'],
  button_style: ['rounded', 'pill', 'sharp'],
  link_shape: ['rounded', 'oval', 'sharp', 'full'],
  featured_link_shape: ['', 'rounded', 'oval', 'sharp', 'full'],
  avatar_shape: ['circle', 'rounded', 'square'],
  name_fx: ['none', 'gradient', 'rainbow', 'shimmer', 'glitch'],
  overlay: ['none', 'rain', 'snow', 'vhs', 'stars', 'particles', 'matrix'],
  product_glow: ['none', 'soft', 'strong'],
  profile_fx: ['none', 'glow', 'float'],
  cursor_fx: ['none', 'trail', 'sparkle'],
  banner_style: ['panel', 'cover'],
  layout: ['list', 'grid'],
};

// Effects that must be explicitly reset, i.e. what BASE exists to cover. If a
// preset carries none of these it almost certainly forgot to spread BASE.
const RESET_KEYS = [
  'overlay', 'name_fx', 'profile_fx', 'cursor_fx',
  'animated_name', 'tilt_enabled', 'mono_icons', 'glow_intensity', 'product_glow',
];

// The accent renders as arrows, border tints and glow marks — decorative, so
// the bar is the WCAG non-text/large-text threshold rather than the 4.5:1 that
// applies to body copy. Below this it stops being legible at all.
// Presets may only reference assets shipped with the app, from this directory.
const TEMPLATE_ASSET_DIR = '/templates/';
// Every visitor downloads a background video before the page settles, on
// whatever connection they have. This is a hard ceiling, not a suggestion.
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;
// Music autoplays behind a page, so it is downloaded on arrival like everything
// else. A 4-minute 128kbps MP3 is ~3.5MB; this forces a trimmed loop instead.
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

const MIN_CONTRAST = 3.0;
const GOOD_CONTRAST = 4.5;

function defaultThemeKeys() {
  // DEFAULT_THEME lives in storefront.js, which DOES import supabase — so read
  // the keys out of the source rather than importing it.
  const src = fs.readFileSync(STOREFRONT, 'utf8');
  const start = src.indexOf('export const DEFAULT_THEME = {');
  if (start < 0) throw new Error('DEFAULT_THEME not found in storefront.js');
  const end = src.indexOf('\n};', start);
  const body = src.slice(start, end);
  return new Set([...body.matchAll(/^\s{2}([a-z_0-9]+):/gm)].map(m => m[1]));
}

async function main() {
  const mod = await import(pathToFileURL(PRESETS).href);
  const { THEME_PRESETS, PRESET_CATEGORIES } = mod;

  if (!Array.isArray(THEME_PRESETS) || !THEME_PRESETS.length) {
    console.error('check-presets: THEME_PRESETS is empty or not an array.');
    process.exit(1);
  }

  const known = defaultThemeKeys();
  const catIds = new Set(PRESET_CATEGORIES.map(c => c.id));
  const seen = new Map();
  const errors = [];
  const warnings = [];

  for (const p of THEME_PRESETS) {
    const at = `preset "${p.id || '(no id)'}"`;
    const t = p.theme || {};

    if (!p.id) errors.push(`${at}: missing id`);
    else if (seen.has(p.id)) errors.push(`${at}: duplicate id (also at index ${seen.get(p.id)})`);
    else seen.set(p.id, THEME_PRESETS.indexOf(p));

    if (!p.name) errors.push(`${at}: missing name`);
    if (!p.blurb) warnings.push(`${at}: no blurb — the picker will show an empty line`);
    if (!p.category) errors.push(`${at}: missing category`);
    else if (!catIds.has(p.category)) {
      errors.push(`${at}: category "${p.category}" is not in PRESET_CATEGORIES — the preset will never render`);
    }

    // Rule 1 — did it spread BASE?
    const missingResets = RESET_KEYS.filter(k => !(k in t));
    if (missingResets.length > 3) {
      errors.push(`${at}: looks like it is missing "...BASE" — no value for ${missingResets.slice(0, 4).join(', ')}. `
        + 'Effects from a previously applied preset will leak into this one.');
    }

    // Rule 2 — palette-following text colours.
    for (const k of ['text_color', 'title_color']) {
      if (t[k]) errors.push(`${at}: ${k} is set to "${t[k]}". Use '' so it follows light/dark mode.`);
    }

    // Typo'd keys are dropped silently by sanitizeThemeImport, so catch them here.
    for (const k of Object.keys(t)) {
      if (!known.has(k)) errors.push(`${at}: unknown theme key "${k}" — not in DEFAULT_THEME (typo?)`);
    }

    for (const [k, allowed] of Object.entries(ENUMS)) {
      if (k in t && !allowed.includes(t[k])) {
        errors.push(`${at}: ${k} = "${t[k]}" is not one of ${allowed.join(' | ')}`);
      }
    }

    // Accent against the background this preset actually paints.
    const bg = (t.bg === 'gradient' || t.bg === 'solid' || t.bg === 'animated') && t.bg_color
      ? t.bg_color
      : (t.mode === 'dark' ? '#121316' : '#FBF8F2');
    const ratio = contrast(t.accent, bg);
    if (ratio == null) {
      if (t.accent) errors.push(`${at}: accent "${t.accent}" is not a #rrggbb colour`);
    } else if (ratio < MIN_CONTRAST && !p.contrastNote) {
      errors.push(`${at}: accent ${t.accent} on ${bg} is ${ratio.toFixed(2)}:1 — below ${MIN_CONTRAST}:1. `
        + 'Darken or lighten it, or set contrastNote: "<why this is acceptable>" to accept it deliberately.');
    } else if (ratio < MIN_CONTRAST) {
      warnings.push(`${at}: accent ${t.accent} on ${bg} is ${ratio.toFixed(2)}:1, accepted — ${p.contrastNote}`);
    } else if (ratio < GOOD_CONTRAST) {
      warnings.push(`${at}: accent ${t.accent} on ${bg} is ${ratio.toFixed(2)}:1 (under ${GOOD_CONTRAST}:1 — fine for icons, weak for text)`);
    }

    if (t.bg === 'gradient' && !t.bg_color2) {
      errors.push(`${at}: bg is "gradient" but bg_color2 is unset — it will render as a flat colour`);
    }
    // Background assets: app-shipped only.
    //
    // The rule is not "no images" — it is "no asset that belongs to somebody".
    // An uploaded background lives in one creator's storage, so a preset
    // pointing at it would hotlink their file and bill their bandwidth for
    // everyone else's page (the same reasoning as THEME_PORTABLE_EXCLUDE).
    // Files under public/templates/ are shipped with the app: no owner, no
    // bill, and they survive a theme export.
    for (const [key, kind] of [['bg_image', 'image'], ['bg_video', 'video']]) {
      const val = t[key];
      if (!val) continue;
      if (!val.startsWith(TEMPLATE_ASSET_DIR)) {
        errors.push(`${at}: ${key} "${val}" must be an app-shipped asset under ${TEMPLATE_ASSET_DIR} — `
          + 'a preset cannot reference an uploaded or external file.');
        continue;
      }
      const onDisk = path.join(__dirname, '..', 'public', val.replace(/^\//, ''));
      if (!fs.existsSync(onDisk)) {
        errors.push(`${at}: ${key} points at ${val}, which does not exist. `
          + 'Run: node scripts/gen-backgrounds.cjs (or add the file).');
      }
      if (kind === 'video') {
        const bytes = fs.existsSync(onDisk) ? fs.statSync(onDisk).size : 0;
        if (bytes > MAX_VIDEO_BYTES) {
          errors.push(`${at}: ${key} is ${(bytes / 1048576).toFixed(1)}MB — over the `
            + `${MAX_VIDEO_BYTES / 1048576}MB budget. Every visitor downloads this before the page settles.`);
        }
      }
    }
    // Music, same ownership rule as images: shipped only, never an upload.
    if (t.audio_tracks?.length) {
      for (const track of t.audio_tracks) {
        if (typeof track?.url !== 'string' || !track.url.startsWith(TEMPLATE_ASSET_DIR)) {
          errors.push(`${at}: audio track "${track?.url}" must be an app-shipped asset under ${TEMPLATE_ASSET_DIR}`);
          continue;
        }
        if (!track.name) warnings.push(`${at}: audio track ${track.url} has no name — the player shows a blank label`);
        const onDisk = path.join(__dirname, '..', 'public', track.url.replace(/^\//, ''));
        if (!fs.existsSync(onDisk)) {
          errors.push(`${at}: audio track ${track.url} does not exist on disk`);
        } else if (fs.statSync(onDisk).size > MAX_AUDIO_BYTES) {
          errors.push(`${at}: audio track ${track.url} is ${(fs.statSync(onDisk).size / 1048576).toFixed(1)}MB — `
            + `over the ${MAX_AUDIO_BYTES / 1048576}MB budget.`);
        }
      }
      // audio_url is the deprecated single-track field, kept in sync for
      // back-compat. A preset that sets tracks but not audio_url silently loses
      // its music on any surface still reading the old key.
      if (!t.audio_url) {
        warnings.push(`${at}: sets audio_tracks but not audio_url — set it to the first track for back-compat`);
      }
    }
    if (t.bg === 'animated') {
      // The moving fields are semi-transparent, so without a base colour they
      // composite over the palette default and the whole look changes with mode.
      if (!t.bg_color) errors.push(`${at}: bg is "animated" but bg_color is unset — it is the ground the motion sits on`);
      // bg_color2 is one of the two moving colours; missing it means both blobs
      // are the accent and the motion reads as one shape, not a field.
      if (!t.bg_color2) errors.push(`${at}: bg is "animated" but bg_color2 is unset — both moving fields would be the accent`);
      const spd = t.bg_speed;
      if (spd != null && (typeof spd !== 'number' || spd < 40 || spd > 200)) {
        errors.push(`${at}: bg_speed ${spd} is outside 40-200 — the renderer clamps it, so the value is a lie`);
      }
      // Contrast is measured against bg_color above; the moving fields sit on
      // top at 38-55% opacity, so a light motion colour on a dark ground can
      // still wash out text even when the ground passes.
      if ((t.card_opacity ?? 100) > 88) {
        warnings.push(`${at}: card_opacity ${t.card_opacity ?? 100} over a moving background — `
          + 'consider 58-75 with card_blur so the motion stays behind the text.');
      }
    }
    if (t.bg === 'image' && !t.bg_image) {
      errors.push(`${at}: bg is "image" but bg_image is unset — it will render as a flat colour`);
    }
    if (t.bg === 'video') {
      if (!t.bg_video) errors.push(`${at}: bg is "video" but bg_video is unset`);
      // A video shows nothing before it loads, on a slow connection, and under
      // prefers-reduced-motion. The still is what the page falls back to in all
      // three, so it is required rather than nice to have.
      if (!t.bg_image) {
        errors.push(`${at}: a video background needs bg_image as its poster — `
          + 'it is what shows during load and under prefers-reduced-motion.');
      }
    }
    // Text over artwork is the fastest way to make a page unreadable. Glassy
    // cards are what keep the background decorative.
    if ((t.bg === 'image' || t.bg === 'video') && (t.card_opacity ?? 100) > 88) {
      warnings.push(`${at}: card_opacity ${t.card_opacity ?? 100} over a background image — `
        + 'consider 60-80 with card_blur so text stays readable.');
    }
  }

  for (const w of warnings) console.warn(`  warn  ${w}`);

  if (errors.length) {
    console.error(`\ncheck-presets: ${errors.length} problem${errors.length === 1 ? '' : 's'}\n`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error('');
    process.exit(1);
  }

  console.log(`OK — ${THEME_PRESETS.length} presets across ${PRESET_CATEGORIES.length} categories`
    + `${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}.`);
}

main().catch(err => {
  console.error('check-presets: failed to load presets —', err.message);
  process.exit(1);
});
