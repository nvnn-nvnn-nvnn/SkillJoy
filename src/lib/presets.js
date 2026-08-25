// ═══════════════════════════════════════════════════════════════════════════
// THEME PRESETS — the one-tap looks in Customize -> Templates and in onboarding.
//
// ── HOW TO ADD YOUR OWN ────────────────────────────────────────────────────
//
//   1. Copy an existing entry below. Give it a new unique `id`.
//   2. Keep `...BASE` FIRST in the theme object. Always. See rule 1.
//   3. Set only the keys your look actually needs.
//   4. Run:  npm run check:presets
//      It validates ids, categories, contrast, and the two rules below —
//      and it runs on every build, so a bad preset cannot ship.
//
// Every valid theme key is listed in DEFAULT_THEME (storefront.js). A key that
// is not in there is silently dropped on import, so the validator flags typos.
//
// This file deliberately has NO IMPORTS. That is what lets the validator load
// the real objects rather than regexing source, and it keeps presets editable
// without understanding the rest of the theme system.
// ═══════════════════════════════════════════════════════════════════════════

// ── One-tap theme templates ──────────────────────────────────────────────────
// Each preset is a PARTIAL theme: applying it merges over the current theme, so
// a creator's name/bio/avatar/socials/links/products are never touched.
//
// ── Two rules every preset here follows ──
//
// 1. RESET WHAT YOU DON'T SET. A preset that omits `overlay` leaves the
//    previous preset's snow falling over your new minimal theme. Presets get
//    tried in sequence — someone clicks four in ten seconds — so each one must
//    fully describe the look, including the effects it turns OFF. That is what
//    BASE below is for: spread it first and every effect starts from neutral.
//
// 2. NEVER SET text_color / title_color TO A LITERAL. Those override the
//    light/dark palette permanently, so a dark preset would leave pale text
//    behind when someone later picks a light one. '' means "follow the mode",
//    which is what a template should almost always do.
//
// `category` groups them in the picker; `blurb` is the one-line "what is this
// for" a creator reads before committing to a look.
export const PRESET_CATEGORIES = [
  { id: 'clean',  label: 'Clean & minimal', blurb: 'Content first. Nothing competing with your links.' },
  { id: 'bold',   label: 'Bold & bright',   blurb: 'High contrast, saturated colour, hard to scroll past.' },
  { id: 'dark',   label: 'Dark & moody',    blurb: 'Deep backgrounds with glow. Reads well at night.' },
  { id: 'nature', label: 'Soft & natural',  blurb: 'Muted, warm palettes that feel calm rather than loud.' },
  { id: 'retro',  label: 'Retro & playful', blurb: 'Effects on purpose — VHS, neon, glitch.' },
  { id: 'scenic', label: 'Scenic backgrounds', blurb: 'Artwork behind your page, with glassy cards so text stays readable.' },
  { id: 'showcase', label: 'Motion', blurb: 'Backgrounds that move. No video file — CSS only, so they cost nothing to load.' },
];

// Shared neutral baseline. Spreading this first makes rule 1 structural rather
// than something to remember: a preset states what it cares about, and
// everything else lands on a known-off value instead of whatever was there.
const BASE = {
  overlay: 'none', name_fx: 'none', profile_fx: 'none', cursor_fx: 'none',
  animated_name: false, tilt_enabled: false, mono_icons: false,
  glow_enabled: true, glow_intensity: 0, icon_glow: 10, bio_glow: 0,
  card_opacity: 100, card_blur: 0, product_opacity: 100, product_blur: 0,
  link_opacity: null, link_blur: null,
  product_glow: 'none', splash_enabled: false,
  // Palette-following, never literal — see rule 2.
  text_color: '', title_color: '', name_color: '', card_color: '',
  link_color: '', link_text_color: '', item_color: '', item_text_color: '',
  featured_link_color: '', featured_link_text_color: '',
  bg_image: '', bg_video: '',
  glow_targets: ['name', 'avatar', 'card', 'links', 'icons'],
};

export const THEME_PRESETS = [
  // ── Clean & minimal ──────────────────────────────────────────────────────
  { id: 'clean', name: 'Clean Light', emoji: '🤍', category: 'clean',
    blurb: 'The safe default. Warm off-white, one accent, zero effects.',
    // 2.93:1 — below the bar, accepted knowingly. #F5634A is the app's brand
    // colour and the default every storefront already has; changing it here
    // would restyle every page that never picked a template. The accent only
    // paints arrows, border tints and glow on this preset — the CTA is white
    // on a darkened mix, which passes on its own. Revisit if the brand colour
    // ever moves.
    contrastNote: 'brand default accent; decorative use only on this preset',
    theme: { ...BASE, mode: 'light', bg: 'canvas', accent: '#F5634A',
      button_style: 'rounded', link_shape: 'oval', avatar_shape: 'circle' } },

  { id: 'paper', name: 'Paper', emoji: '📄', category: 'clean',
    blurb: 'Editorial. Square corners, ink-black accent, lots of air.',
    theme: { ...BASE, mode: 'light', bg: 'solid', bg_color: '#FAF9F6', accent: '#1A1916',
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'square',
      bio_size: 16, bio_weight: 400, show_type_badges: false } },

  { id: 'frost', name: 'Frosted', emoji: '❄️', category: 'clean',
    blurb: 'Glassy cards over a pale blue wash. Soft without being fussy.',
    theme: { ...BASE, mode: 'light', bg: 'gradient', bg_color: '#E8F4FF', bg_color2: '#F7FBFF',
      accent: '#2563EB', glow_intensity: 10, overlay: 'snow', product_glow: 'soft',
      card_opacity: 55, card_blur: 20, product_opacity: 60, product_blur: 14,
      button_style: 'pill', link_shape: 'oval' } },

  { id: 'mono', name: 'Monochrome', emoji: '⬛', category: 'clean',
    blurb: 'Greyscale everything. Your images become the only colour.',
    theme: { ...BASE, mode: 'light', bg: 'solid', bg_color: '#F2F2F0', accent: '#3A3A38',
      mono_icons: true, button_style: 'sharp', link_shape: 'sharp',
      avatar_shape: 'rounded', icon_glow: 0 } },

  // ── Bold & bright ────────────────────────────────────────────────────────
  { id: 'citrus', name: 'Citrus', emoji: '🍊', category: 'bold',
    blurb: 'Orange on cream. Cheerful, high energy, still readable.',
    theme: { ...BASE, mode: 'light', bg: 'gradient', bg_color: '#FFF4E0', bg_color2: '#FFD9A8',
      accent: '#B54708', product_glow: 'soft', button_style: 'pill', link_shape: 'oval',
      avatar_shape: 'circle', bio_weight: 500 } },

  { id: 'bubblegum', name: 'Bubblegum', emoji: '🩷', category: 'bold',
    blurb: 'Pink gradient, rounded everything. Reads young and friendly.',
    theme: { ...BASE, mode: 'light', bg: 'gradient', bg_color: '#FFE4F1', bg_color2: '#FFC2DE',
      accent: '#C2185B', product_glow: 'soft', glow_intensity: 12,
      button_style: 'pill', link_shape: 'oval', avatar_shape: 'circle',
      profile_fx: 'float' } },

  { id: 'electric', name: 'Electric', emoji: '⚡', category: 'bold',
    blurb: 'Cobalt and white with a hard edge. Built to convert.',
    theme: { ...BASE, mode: 'light', bg: 'solid', bg_color: '#F4F7FF', accent: '#1D4ED8',
      product_glow: 'soft', button_style: 'sharp', link_shape: 'sharp',
      avatar_shape: 'rounded', bio_weight: 600 } },

  // ── Dark & moody ─────────────────────────────────────────────────────────
  { id: 'midnight', name: 'Midnight Glow', emoji: '🌌', category: 'dark',
    blurb: 'Deep violet with a shimmer on your name. The classic night look.',
    theme: { ...BASE, mode: 'dark', bg: 'gradient', bg_color: '#0B0B14', bg_color2: '#1B1636',
      accent: '#7A5CFF', glow_intensity: 34, name_fx: 'shimmer', product_glow: 'strong',
      overlay: 'stars', card_opacity: 70, card_blur: 14, product_opacity: 70, product_blur: 10,
      profile_fx: 'glow', button_style: 'pill', link_shape: 'oval', tilt_enabled: true } },

  { id: 'obsidian', name: 'Obsidian', emoji: '🖤', category: 'dark',
    blurb: 'Near-black, no effects. Lets bright product images carry the page.',
    theme: { ...BASE, mode: 'dark', bg: 'solid', bg_color: '#0A0A0C', accent: '#E5E5E5',
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'square',
      icon_glow: 0, card_opacity: 92 } },

  { id: 'ember', name: 'Ember', emoji: '🔥', category: 'dark',
    blurb: 'Charcoal with a burning orange accent. Warm, not cold.',
    theme: { ...BASE, mode: 'dark', bg: 'gradient', bg_color: '#141110', bg_color2: '#33201A',
      accent: '#FB7A3C', glow_intensity: 26, product_glow: 'soft', overlay: 'particles',
      card_opacity: 78, card_blur: 8, product_opacity: 78, product_blur: 6,
      button_style: 'rounded', link_shape: 'rounded' } },

  { id: 'deepsea', name: 'Deep Sea', emoji: '🌊', category: 'dark',
    blurb: 'Teal on navy with a slow drift. Calm but still dark.',
    theme: { ...BASE, mode: 'dark', bg: 'gradient', bg_color: '#06131C', bg_color2: '#0D3B4A',
      accent: '#2DD4BF', glow_intensity: 20, product_glow: 'soft', overlay: 'rain',
      card_opacity: 74, card_blur: 12, product_opacity: 74, product_blur: 8,
      profile_fx: 'float', button_style: 'pill', link_shape: 'oval' } },

  { id: 'sunset', name: 'Sunset', emoji: '🌅', category: 'dark',
    blurb: 'Plum to rose with a gradient name. Flatters photography.',
    theme: { ...BASE, mode: 'dark', bg: 'gradient', bg_color: '#2A1020', bg_color2: '#6B2D3C',
      accent: '#FF8C00', glow_intensity: 22, name_fx: 'gradient', overlay: 'particles',
      product_glow: 'soft', card_opacity: 72, card_blur: 10, product_opacity: 72, product_blur: 8,
      profile_fx: 'float', button_style: 'rounded', link_shape: 'rounded', tilt_enabled: true } },

  // ── Soft & natural ───────────────────────────────────────────────────────
  { id: 'sage', name: 'Sage', emoji: '🌿', category: 'nature',
    blurb: 'Muted green on bone. Wellness, coaching, anything unhurried.',
    theme: { ...BASE, mode: 'light', bg: 'gradient', bg_color: '#F2F4EE', bg_color2: '#DFE7D8',
      accent: '#4F7042', button_style: 'rounded', link_shape: 'rounded',
      avatar_shape: 'circle', bio_size: 16 } },

  { id: 'clay', name: 'Clay', emoji: '🏺', category: 'nature',
    blurb: 'Terracotta and sand. Warm, handmade, a little earthy.',
    theme: { ...BASE, mode: 'light', bg: 'gradient', bg_color: '#FBF1E7', bg_color2: '#EFD9C4',
      accent: '#A34E30', button_style: 'rounded', link_shape: 'rounded',
      avatar_shape: 'rounded', bio_weight: 450 } },

  { id: 'linen', name: 'Linen', emoji: '🌾', category: 'nature',
    blurb: 'Barely-there beige with soft glass. Quiet and expensive-looking.',
    theme: { ...BASE, mode: 'light', bg: 'gradient', bg_color: '#FAF6F0', bg_color2: '#F0E7DA',
      accent: '#75603F', card_opacity: 68, card_blur: 16, product_opacity: 72, product_blur: 10,
      button_style: 'pill', link_shape: 'oval', avatar_shape: 'circle' } },

  { id: 'forest', name: 'Forest', emoji: '🌲', category: 'nature',
    blurb: 'Dark green with rain. Natural without going pastel.',
    theme: { ...BASE, mode: 'dark', bg: 'gradient', bg_color: '#0C1710', bg_color2: '#1D3524',
      accent: '#5CC98B', glow_intensity: 14, overlay: 'rain', product_glow: 'soft',
      card_opacity: 76, card_blur: 10, product_opacity: 76, product_blur: 6,
      button_style: 'rounded', link_shape: 'rounded' } },

  // ── Retro & playful ──────────────────────────────────────────────────────
  { id: 'vapor', name: 'Vaporwave', emoji: '🌴', category: 'retro',
    blurb: 'Purple-to-blue with VHS grain and a rainbow name. Maximal.',
    theme: { ...BASE, mode: 'dark', bg: 'gradient', bg_color: '#2B1055', bg_color2: '#7597DE',
      accent: '#FF2D75', glow_intensity: 28, name_fx: 'rainbow', overlay: 'vhs',
      product_glow: 'strong', card_opacity: 65, card_blur: 12, product_opacity: 68, product_blur: 8,
      button_style: 'sharp', link_shape: 'sharp', tilt_enabled: true } },

  { id: 'terminal', name: 'Terminal', emoji: '🟩', category: 'retro',
    blurb: 'Green-on-black with matrix rain and a glitching name.',
    theme: { ...BASE, mode: 'dark', bg: 'solid', bg_color: '#05080A', accent: '#00FF88',
      glow_intensity: 24, name_fx: 'glitch', overlay: 'matrix', product_glow: 'soft',
      mono_icons: true, card_opacity: 75, card_blur: 6, product_opacity: 75, product_blur: 4,
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'square' } },

  { id: 'arcade', name: 'Arcade', emoji: '👾', category: 'retro',
    blurb: 'Hot magenta on deep blue, square everything, cursor sparkles.',
    theme: { ...BASE, mode: 'dark', bg: 'gradient', bg_color: '#0B0F2B', bg_color2: '#241A5C',
      accent: '#FF3CAC', glow_intensity: 32, product_glow: 'strong', overlay: 'stars',
      cursor_fx: 'sparkle', card_opacity: 72, card_blur: 8, product_opacity: 72, product_blur: 6,
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'square', animated_name: true } },

  { id: 'candyshop', name: 'Candy Shop', emoji: '🍬', category: 'retro',
    blurb: 'Mint and lilac with a floating card. Sweet, deliberately.',
    theme: { ...BASE, mode: 'light', bg: 'gradient', bg_color: '#E6FBF4', bg_color2: '#EDE4FF',
      accent: '#7C3AED', glow_intensity: 14, product_glow: 'soft', cursor_fx: 'trail',
      card_opacity: 78, card_blur: 12, product_opacity: 80, product_blur: 8,
      profile_fx: 'float', button_style: 'pill', link_shape: 'oval', tilt_enabled: true } },

  // ── Scenic (shipped background art) ──────────────────────────────────────
  // These reference files in public/templates/, served from this app's own
  // domain. That is what makes them shareable: an uploaded background belongs
  // to one creator's storage, so a preset can never point at one (see
  // THEME_PORTABLE_EXCLUDE). App-shipped assets have no owner and no bill.
  //
  // Cards go glassy here on purpose — text sitting directly on artwork is the
  // single fastest way to make a page unreadable. The blur is what keeps the
  // background decorative instead of competing.
  { id: 'aurora', name: 'Aurora', emoji: '🌠', category: 'scenic',
    blurb: 'Deep blue and violet light. The safest of the image backgrounds.',
    theme: { ...BASE, mode: 'dark', bg: 'image', bg_image: '/templates/aurora.svg',
      accent: '#7DD3FC', glow_intensity: 22, product_glow: 'soft',
      card_opacity: 62, card_blur: 18, product_opacity: 66, product_blur: 12,
      link_opacity: 70, link_blur: 12,
      button_style: 'pill', link_shape: 'oval' } },

  { id: 'dusk', name: 'Dusk', emoji: '🌇', category: 'scenic',
    blurb: 'Magenta-to-amber haze. Warm, cinematic, good behind photography.',
    theme: { ...BASE, mode: 'dark', bg: 'image', bg_image: '/templates/dusk.svg',
      accent: '#FFB37B', glow_intensity: 20, name_fx: 'gradient', product_glow: 'soft',
      card_opacity: 60, card_blur: 20, product_opacity: 64, product_blur: 14,
      link_opacity: 68, link_blur: 14,
      button_style: 'rounded', link_shape: 'rounded' } },

  { id: 'starfield', name: 'Starfield', emoji: '✨', category: 'scenic',
    blurb: 'Real stars in the image, not an overlay — so it never animates.',
    theme: { ...BASE, mode: 'dark', bg: 'image', bg_image: '/templates/stars.svg',
      accent: '#C4B5FD', glow_intensity: 26, name_fx: 'shimmer', product_glow: 'strong',
      card_opacity: 58, card_blur: 18, product_opacity: 62, product_blur: 12,
      link_opacity: 66, link_blur: 12,
      button_style: 'pill', link_shape: 'oval' } },

  { id: 'blueprint', name: 'Blueprint', emoji: '📐', category: 'scenic',
    blurb: 'Technical grid fading into cyan. Reads engineered, not decorative.',
    theme: { ...BASE, mode: 'dark', bg: 'image', bg_image: '/templates/grid.svg',
      accent: '#38BDF8', glow_intensity: 16, product_glow: 'soft', mono_icons: true,
      card_opacity: 70, card_blur: 10, product_opacity: 72, product_blur: 8,
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'square' } },

  { id: 'tide', name: 'Tide', emoji: '🌊', category: 'scenic',
    blurb: 'Layered waves along the bottom. Leaves the top clear for your face.',
    theme: { ...BASE, mode: 'dark', bg: 'image', bg_image: '/templates/waves.svg',
      accent: '#5EEAD4', glow_intensity: 18, product_glow: 'soft',
      card_opacity: 66, card_blur: 14, product_opacity: 70, product_blur: 10,
      button_style: 'pill', link_shape: 'oval' } },

  { id: 'contour', name: 'Contour', emoji: '🗺️', category: 'scenic',
    blurb: 'Topographic lines on warm charcoal. Outdoors without being literal.',
    theme: { ...BASE, mode: 'dark', bg: 'image', bg_image: '/templates/topo.svg',
      accent: '#E9A163', glow_intensity: 12, product_glow: 'none',
      card_opacity: 74, card_blur: 10, product_opacity: 76, product_blur: 6,
      button_style: 'rounded', link_shape: 'rounded' } },

  { id: 'seafoam', name: 'Seafoam', emoji: '🫧', category: 'scenic',
    blurb: 'Pale mint and lilac wash. A light image background that stays readable.',
    theme: { ...BASE, mode: 'light', bg: 'image', bg_image: '/templates/mint.svg',
      accent: '#0F766E', product_glow: 'none',
      card_opacity: 72, card_blur: 16, product_opacity: 76, product_blur: 10,
      button_style: 'pill', link_shape: 'oval' } },

  { id: 'apricot', name: 'Apricot', emoji: '🍑', category: 'scenic',
    blurb: 'Soft peach and butter tones. Warm, light, and gentle on text.',
    theme: { ...BASE, mode: 'light', bg: 'image', bg_image: '/templates/peach.svg',
      accent: '#B03A5B', product_glow: 'none',
      card_opacity: 74, card_blur: 14, product_opacity: 78, product_blur: 10,
      button_style: 'rounded', link_shape: 'rounded' } },

  { id: 'graphite', name: 'Graphite', emoji: '⬛', category: 'scenic',
    blurb: 'Near-black with a subtle depth wash. Your images supply the colour.',
    theme: { ...BASE, mode: 'dark', bg: 'image', bg_image: '/templates/ink.svg',
      accent: '#D4D4D8', product_glow: 'none', icon_glow: 0,
      card_opacity: 80, card_blur: 8, product_opacity: 82, product_blur: 6,
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'rounded' } },

  { id: 'halftone', name: 'Halftone', emoji: '⚪', category: 'scenic',
    blurb: 'Printed-dot texture on warm paper. Editorial with a bit of grain.',
    theme: { ...BASE, mode: 'light', bg: 'image', bg_image: '/templates/dots.svg',
      accent: '#1A1916', product_glow: 'none',
      card_opacity: 82, card_blur: 6, product_opacity: 84, product_blur: 4,
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'square' } },

  // ── Showcase (motion) ────────────────────────────────────────────────────
  // Animated backgrounds: CSS gradient fields on long offset loops. No asset,
  // no bandwidth, no decode — the motion that "video background" usually means,
  // without the 3MB. Real video presets slot in beside these when there is
  // footage worth shipping (see public/templates/README.md).
  //
  // bg_color is the ground the motion composites over; bg_color2 and accent are
  // the two moving colours. So every one of these is a palette plus a movement.
  { id: 'nightdrive', name: 'Night Drive', emoji: '🌃', category: 'showcase',
    blurb: 'Violet and cyan sweeping across black. The most cinematic look here.',
    theme: { ...BASE, mode: 'dark', bg: 'animated', bg_motion: 'sweep', bg_speed: 90,
      bg_color: '#05060D', bg_color2: '#5B21B6', accent: '#22D3EE',
      glow_intensity: 30, name_fx: 'shimmer', product_glow: 'strong',
      card_opacity: 58, card_blur: 20, product_opacity: 62, product_blur: 14,
      link_opacity: 66, link_blur: 14,
      button_style: 'pill', link_shape: 'oval', tilt_enabled: true } },

  { id: 'lavalamp', name: 'Lava Lamp', emoji: '🫠', category: 'showcase',
    blurb: 'Warm blobs rotating slowly. Hypnotic without being distracting.',
    theme: { ...BASE, mode: 'dark', bg: 'animated', bg_motion: 'nebula', bg_speed: 70,
      bg_color: '#14060A', bg_color2: '#BE185D', accent: '#FB923C',
      glow_intensity: 24, product_glow: 'soft',
      card_opacity: 62, card_blur: 18, product_opacity: 66, product_blur: 12,
      link_opacity: 70, link_blur: 12,
      button_style: 'rounded', link_shape: 'rounded' } },

  { id: 'northern', name: 'Northern Lights', emoji: '🌌', category: 'showcase',
    blurb: 'Green and blue drifting overhead. Calm, slow, genuinely pretty.',
    theme: { ...BASE, mode: 'dark', bg: 'animated', bg_motion: 'aurora', bg_speed: 65,
      bg_color: '#040A0F', bg_color2: '#059669', accent: '#38BDF8',
      glow_intensity: 26, product_glow: 'soft', overlay: 'stars',
      card_opacity: 60, card_blur: 20, product_opacity: 64, product_blur: 14,
      link_opacity: 68, link_blur: 14,
      button_style: 'pill', link_shape: 'oval', profile_fx: 'float' } },

  { id: 'softfocus', name: 'Soft Focus', emoji: '🌤️', category: 'showcase',
    blurb: 'Pale peach and blue breathing gently. Motion you notice only if you look.',
    theme: { ...BASE, mode: 'light', bg: 'animated', bg_motion: 'pulse', bg_speed: 55,
      bg_color: '#FDFBF7', bg_color2: '#FFD9C0', accent: '#0F766E',
      card_opacity: 72, card_blur: 16, product_opacity: 76, product_blur: 10,
      link_opacity: 80, link_blur: 10,
      button_style: 'pill', link_shape: 'oval' } },

  { id: 'tidepool', name: 'Tide Pool', emoji: '🐚', category: 'showcase',
    blurb: 'Teal and sand sliding sideways. Light, airy, easy to read on.',
    theme: { ...BASE, mode: 'light', bg: 'animated', bg_motion: 'drift', bg_speed: 60,
      bg_color: '#F4FBFA', bg_color2: '#99E2D0', accent: '#0E7490',
      card_opacity: 74, card_blur: 14, product_opacity: 78, product_blur: 10,
      button_style: 'rounded', link_shape: 'rounded' } },

  { id: 'inferno', name: 'Inferno', emoji: '🔥', category: 'showcase',
    blurb: 'Red and amber churning. Loud on purpose — for launches and drops.',
    theme: { ...BASE, mode: 'dark', bg: 'animated', bg_motion: 'nebula', bg_speed: 130,
      bg_color: '#0B0403', bg_color2: '#B91C1C', accent: '#FBBF24',
      glow_intensity: 34, name_fx: 'gradient', product_glow: 'strong',
      card_opacity: 58, card_blur: 16, product_opacity: 62, product_blur: 12,
      link_opacity: 66, link_blur: 12,
      button_style: 'sharp', link_shape: 'sharp', animated_name: true, tilt_enabled: true } },

  { id: 'synthwave', name: 'Synthwave', emoji: '🕹️', category: 'showcase',
    blurb: 'Magenta and cyan sweeping over grain. Retro-futurist, full send.',
    theme: { ...BASE, mode: 'dark', bg: 'animated', bg_motion: 'sweep', bg_speed: 115,
      bg_color: '#0A0518', bg_color2: '#7C3AED', accent: '#F0ABFC',
      glow_intensity: 36, name_fx: 'rainbow', overlay: 'vhs', product_glow: 'strong',
      cursor_fx: 'sparkle',
      card_opacity: 60, card_blur: 14, product_opacity: 64, product_blur: 10,
      link_opacity: 68, link_blur: 10,
      button_style: 'sharp', link_shape: 'sharp', avatar_shape: 'square', tilt_enabled: true } },

  { id: 'moss', name: 'Moss', emoji: '🍃', category: 'showcase',
    blurb: 'Deep greens drifting under rain. Quiet motion, dark but not harsh.',
    theme: { ...BASE, mode: 'dark', bg: 'animated', bg_motion: 'drift', bg_speed: 50,
      bg_color: '#060D09', bg_color2: '#166534', accent: '#86EFAC',
      glow_intensity: 16, overlay: 'rain', product_glow: 'soft',
      card_opacity: 68, card_blur: 14, product_opacity: 72, product_blur: 10,
      button_style: 'rounded', link_shape: 'rounded' } },
];

/** Presets belonging to one category id, in declaration order. */
export function presetsByCategory(id) {
  return THEME_PRESETS.filter(p => p.category === id);
}
