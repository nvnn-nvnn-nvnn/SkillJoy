import { supabase } from './supabase';

// ── Storefront customization data layer (v3, Phase 7) ───────────────────────
// Theme lives in profiles.storefront_theme; link buttons in store_links.

export const DEFAULT_THEME = {
  accent: '#00CC99',
  layout: 'list',           // 'list' | 'grid'
  banner_url: '',
  show_avatar: true,        // false → hide the profile picture on the storefront
  socials: [],
  // ── Deeper theming (guns.lol-style) ──
  mode: 'light',            // 'light' | 'dark' — drives surface/text palette
  bg: 'canvas',             // 'canvas' | 'solid' | 'gradient' | 'image' | 'video'
  bg_color: '#FBF8F2',      // solid fill / gradient start
  bg_color2: '#E0F8F1',     // gradient end
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
  bio_size: 15,             // px — bio font size
  bio_weight: 400,          // 300–800 — bio font weight
  bio_glow: 0,              // 0–20 px — accent drop-shadow glow on the bio
  // ── Phase 2: guns.lol effects ──
  glow_intensity: 0,        // 0–40 px — master accent glow across name/avatar/panel/links
  name_fx: 'none',          // 'none'|'gradient'|'rainbow'|'shimmer'|'glitch' — display-name text effect
  overlay: 'none',          // 'none' | 'rain' | 'snow' | 'vhs' — full-page overlay effect
  audio_url: '',            // site audio url — play/mute pill on the storefront
  cursor_fx: 'none',        // 'none' | 'trail' | 'sparkle' — pointer particle effect
  profile_fx: 'none',       // 'none' | 'glow' | 'float' — profile panel animation
};

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

/** Merge a stored theme over defaults so missing keys are safe. */
export function resolveTheme(theme) {
  return { ...DEFAULT_THEME, ...(theme || {}) };
}

/** Save bio + theme (+ optional integrations) on the creator's profile. */
export async function updateStorefront(userId, { bio, storefront_theme, tracking_pixels, automation_webhook_url, full_name, avatar_url }) {
  const patch = {};
  if (bio !== undefined) patch.bio = bio;
  if (storefront_theme !== undefined) patch.storefront_theme = storefront_theme;
  if (tracking_pixels !== undefined) patch.tracking_pixels = tracking_pixels;
  if (automation_webhook_url !== undefined) patch.automation_webhook_url = automation_webhook_url;
  if (full_name !== undefined) patch.full_name = full_name;
  if (avatar_url !== undefined) patch.avatar_url = avatar_url;
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// ── Link buttons ─────────────────────────────────────────────────────────────
export async function listLinks(creatorId) {
  const { data, error } = await supabase
    .from('store_links')
    .select('id, label, url, position, is_affiliate')
    .eq('creator_id', creatorId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
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
