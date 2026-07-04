import { supabase } from './supabase';

// ── Customer reviews (v3, post-purchase Options) ────────────────────────────
// Reads are public (RLS: select true). Writes require a paid purchase and
// buyer_id = auth.uid() (see migration 012). One review per buyer per skill.

/** Public list of a skill's reviews, newest first, with author name. */
export async function listReviews(skillId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, body, created_at, buyer_id, buyer:profiles!reviews_buyer_id_fkey(full_name)')
    .eq('skill_id', skillId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** {count, average} for a skill — averages the ratings client-side. */
export function summarize(reviews) {
  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  return { count, average };
}

/** The current buyer's own review for a skill (or null). */
export async function getMyReview(skillId, buyerId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, body')
    .eq('skill_id', skillId).eq('buyer_id', buyerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Create or update the buyer's review (unique on skill_id+buyer_id). */
export async function upsertReview(skillId, buyerId, { rating, body }) {
  const { data, error } = await supabase
    .from('reviews')
    .upsert({ skill_id: skillId, buyer_id: buyerId, rating, body: body || null }, { onConflict: 'skill_id,buyer_id' })
    .select('id, rating, body')
    .single();
  if (error) throw error;
  return data;
}

/** Remove the buyer's own review. */
export async function deleteReview(id) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}
