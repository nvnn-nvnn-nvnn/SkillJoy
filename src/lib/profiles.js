import { supabase } from './supabase';

// ── Public profile lookups (v3) ─────────────────────────────────────────────

/** Resolve a storefront @handle to its public profile. Null if not found. */
export async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, location, storefront_theme, tracking_pixels')
    .ilike('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Creator's storefront theme by id — for the themed checkout. Best-effort:
 * returns null on ANY failure so the caller falls back to the app-default
 * look; returns {} when the creator simply hasn't themed yet (their store
 * renders defaults, so checkout pinning defaults still matches it).
 */
export async function getProfileTheme(creatorId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('storefront_theme')
      .eq('id', creatorId)
      .maybeSingle();
    if (error || !data) return null;
    return data.storefront_theme || {};
  } catch { return null; }
}

/**
 * All public storefronts for the Discover page: creators with ≥1 published
 * skill, each with a product count + a sample cover. Two queries (skills then
 * profiles) to avoid depending on FK-hint names. Sorted by product count.
 */
export async function listStorefronts() {
  const { data: skills, error } = await supabase
    .from('skills')
    .select('creator_id, cover_url')
    .eq('status', 'published');
  if (error) throw error;

  const agg = new Map(); // creator_id → { count, cover }
  for (const s of skills) {
    if (!agg.has(s.creator_id)) agg.set(s.creator_id, { count: 0, cover: null });
    const e = agg.get(s.creator_id);
    e.count++;
    if (!e.cover && s.cover_url) e.cover = s.cover_url;
  }

  const ids = [...agg.keys()];
  if (!ids.length) return [];

  const { data: profs, error: pe } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio')
    .in('id', ids)
    .not('username', 'is', null);
  if (pe) throw pe;

  return profs
    .map(p => ({ ...p, productCount: agg.get(p.id).count, cover: agg.get(p.id).cover }))
    .sort((a, b) => b.productCount - a.productCount);
}
