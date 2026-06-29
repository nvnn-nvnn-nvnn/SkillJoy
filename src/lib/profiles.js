import { supabase } from './supabase';

// ── Public profile lookups (v3) ─────────────────────────────────────────────

/** Resolve a storefront @handle to its public profile. Null if not found. */
export async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, storefront_theme, tracking_pixels')
    .ilike('username', username)
    .maybeSingle();
  if (error) throw error;
  return data;
}
