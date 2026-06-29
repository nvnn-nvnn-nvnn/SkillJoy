import { supabase } from './supabase';

// ── Storefront customization data layer (v3, Phase 7) ───────────────────────
// Theme lives in profiles.storefront_theme; link buttons in store_links.

export const DEFAULT_THEME = { accent: '#D4522A', layout: 'list', banner_url: '', socials: [] };

export const SOCIAL_TYPES = [
  { type: 'instagram', label: 'Instagram', icon: '📸' },
  { type: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { type: 'youtube',   label: 'YouTube',   icon: '▶️' },
  { type: 'x',         label: 'X',         icon: '𝕏' },
  { type: 'website',   label: 'Website',   icon: '🌐' },
];

/** Merge a stored theme over defaults so missing keys are safe. */
export function resolveTheme(theme) {
  return { ...DEFAULT_THEME, ...(theme || {}) };
}

/** Save bio + theme (+ optional integrations) on the creator's profile. */
export async function updateStorefront(userId, { bio, storefront_theme, tracking_pixels, automation_webhook_url }) {
  const patch = {};
  if (bio !== undefined) patch.bio = bio;
  if (storefront_theme !== undefined) patch.storefront_theme = storefront_theme;
  if (tracking_pixels !== undefined) patch.tracking_pixels = tracking_pixels;
  if (automation_webhook_url !== undefined) patch.automation_webhook_url = automation_webhook_url;
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
