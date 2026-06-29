import { supabase } from './supabase';

// ── Per-Skill community data layer (v3) ─────────────────────────────────────
// One lightweight thread per skill: posts + one level of replies. Access is
// RLS-gated to buyers + the creator. NOT a forum — keep it simple.

/** All posts + replies for a skill, oldest first. Caller groups replies by parent. */
export async function listPosts(skillId) {
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, skill_id, author_id, body, parent_post_id, created_at, author:profiles!community_posts_author_id_fkey(id, full_name, avatar_url)')
    .eq('skill_id', skillId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/** Create a top-level post (parentId null) or a reply. */
export async function createPost(skillId, authorId, body, parentId = null) {
  const { data, error } = await supabase
    .from('community_posts')
    .insert({ skill_id: skillId, author_id: authorId, body, parent_post_id: parentId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePost(postId) {
  const { error } = await supabase.from('community_posts').delete().eq('id', postId);
  if (error) throw error;
}
