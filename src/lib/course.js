import { supabase } from './supabase';

// ── Course data layer (v3): Modules → Lessons → content + progress ──────────
// A MODULE is a course_sections row (table name kept; UI calls it "Module").
// A LESSON is a course_lessons row (title + description) inside a module; it
// CONTAINS content_blocks (via content_blocks.lesson_id). Progress is per-lesson.
// RLS: creators manage their own; buyers read what they've paid for; buyers own
// their progress rows.

// ── Modules (course_sections) ───────────────────────────────────────────────
export async function listModules(skillId) {
  const { data, error } = await supabase
    .from('course_sections')
    .select('id, skill_id, title, position')
    .eq('skill_id', skillId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createModule(skillId, position) {
  const { data, error } = await supabase
    .from('course_sections')
    .insert({ skill_id: skillId, title: '', position })
    .select('id, skill_id, title, position').single();
  if (error) throw error;
  return data;
}

export async function updateModule(id, patch) {
  const { error } = await supabase.from('course_sections').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteModule(id) {
  const { error } = await supabase.from('course_sections').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderModules(orderedIds) {
  const results = await Promise.all(
    orderedIds.map((id, position) => supabase.from('course_sections').update({ position }).eq('id', id))
  );
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}

// ── Lessons (course_lessons) ────────────────────────────────────────────────
/** All lessons for a skill (both builder + player group these by section_id). */
export async function listLessons(skillId) {
  const { data, error } = await supabase
    .from('course_lessons')
    .select('id, skill_id, section_id, title, description, position')
    .eq('skill_id', skillId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getLesson(lessonId) {
  const { data, error } = await supabase
    .from('course_lessons')
    .select('id, skill_id, section_id, title, description, position')
    .eq('id', lessonId).single();
  if (error) throw error;
  return data;
}

export async function createLesson(skillId, sectionId, position) {
  const { data, error } = await supabase
    .from('course_lessons')
    .insert({ skill_id: skillId, section_id: sectionId, title: '', position })
    .select('id, skill_id, section_id, title, description, position').single();
  if (error) throw error;
  return data;
}

export async function updateLesson(id, patch) {
  const { error } = await supabase.from('course_lessons').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteLesson(id) {
  const { error } = await supabase.from('course_lessons').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderLessons(orderedIds) {
  const results = await Promise.all(
    orderedIds.map((id, position) => supabase.from('course_lessons').update({ position }).eq('id', id))
  );
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}

/** How many content blocks each lesson of a skill holds → Map<lessonId, count>.
 *  One query for the whole course (not one per lesson), so the builder can flag
 *  empty lessons without an N+1. Lessons with no blocks are simply absent. */
export async function countLessonBlocks(skillId) {
  const { data, error } = await supabase
    .from('content_blocks')
    .select('lesson_id')
    .eq('skill_id', skillId)
    .not('lesson_id', 'is', null);
  if (error) throw error;
  const counts = new Map();
  for (const r of data ?? []) counts.set(r.lesson_id, (counts.get(r.lesson_id) ?? 0) + 1);
  return counts;
}

// ── Progress (per lesson) ───────────────────────────────────────────────────
/** Set of the current buyer's completed lesson ids for a skill.
 *  `userId` is filtered explicitly rather than leaning on RLS alone: if the
 *  lesson_progress policy is ever loosened, an unscoped query would silently
 *  count OTHER buyers' rows and show a wrong "8/10 · 80%". Defence in depth —
 *  RLS stays the security boundary, this keeps the number correct regardless. */
export async function listMyProgress(skillId, userId) {
  let q = supabase.from('lesson_progress').select('lesson_id').eq('skill_id', skillId);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q;
  if (error) throw error;
  return new Set((data ?? []).map(r => r.lesson_id));
}

export async function markLesson(userId, skillId, lessonId) {
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({ user_id: userId, skill_id: skillId, lesson_id: lessonId }, { onConflict: 'user_id,lesson_id' });
  if (error) throw error;
}

export async function unmarkLesson(userId, lessonId) {
  const { error } = await supabase
    .from('lesson_progress')
    .delete().eq('user_id', userId).eq('lesson_id', lessonId);
  if (error) throw error;
}
