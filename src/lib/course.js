import { supabase } from './supabase';

// ── Course data layer (v3): Sections → Lessons + per-buyer progress ─────────
// Lessons are content_blocks with a section_id (see src/lib/skills.js for the
// block CRUD those reuse). RLS: creators manage their sections; buyers read
// sections of skills they've paid for and own their progress rows.

/** Ordered sections for a skill. */
export async function listSections(skillId) {
  const { data, error } = await supabase
    .from('course_sections')
    .select('id, skill_id, title, position')
    .eq('skill_id', skillId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createSection(skillId, position) {
  const { data, error } = await supabase
    .from('course_sections')
    .insert({ skill_id: skillId, title: '', position })
    .select('id, skill_id, title, position').single();
  if (error) throw error;
  return data;
}

export async function updateSection(id, patch) {
  const { error } = await supabase.from('course_sections').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteSection(id) {
  const { error } = await supabase.from('course_sections').delete().eq('id', id);
  if (error) throw error;
}

/** Persist a new section order. `orderedIds` = section ids in display order. */
export async function reorderSections(orderedIds) {
  const results = await Promise.all(
    orderedIds.map((id, position) => supabase.from('course_sections').update({ position }).eq('id', id))
  );
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}

// ── Progress ────────────────────────────────────────────────────────────────

/** Set of the current buyer's completed lesson (block) ids for a skill. */
export async function listMyProgress(skillId) {
  const { data, error } = await supabase
    .from('lesson_progress')
    .select('block_id')
    .eq('skill_id', skillId);
  if (error) throw error;
  return new Set((data ?? []).map(r => r.block_id));
}

export async function markLesson(userId, skillId, blockId) {
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({ user_id: userId, skill_id: skillId, block_id: blockId }, { onConflict: 'user_id,block_id' });
  if (error) throw error;
}

export async function unmarkLesson(userId, blockId) {
  const { error } = await supabase
    .from('lesson_progress')
    .delete().eq('user_id', userId).eq('block_id', blockId);
  if (error) throw error;
}
