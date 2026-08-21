import { supabase } from './supabase';
import { apiFetch } from './api';

// ── Skills data layer (v3) ──────────────────────────────────────────────────
// Reads + creator CRUD go straight through Supabase (guarded by RLS — see
// docs/v3-skill-platform/migrations/001_skill_platform.sql). Anything that must
// be brokered server-side (publish-side effects, version bump + buyer notify)
// calls the backend, which lands in Phase 2/3.

const SKILL_COLS = 'id, creator_id, title, outcome, description, cover_url, price_cents, pricing_type, kind, version, status, sort_order, group_label, promo_video_url, confirmation_message, reviews_enabled, order_bump_skill_id, order_bump_price_cents, order_bump_blurb, created_at, updated_at';

/** All skills owned by the current creator (any status). */
export async function listMySkills(creatorId) {
  const { data, error } = await supabase
    .from('skills')
    .select(SKILL_COLS)
    .eq('creator_id', creatorId)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Published skills for a public storefront, by creator id (creator-ordered). */
export async function listPublishedSkills(creatorId) {
  const { data, error } = await supabase
    .from('skills')
    .select(SKILL_COLS)
    .eq('creator_id', creatorId)
    .eq('status', 'published')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Persist a new Skill display order. `ordered` = array of skill ids. */
export async function reorderSkills(ordered) {
  const results = await Promise.all(
    ordered.map((id, sort_order) => supabase.from('skills').update({ sort_order }).eq('id', id))
  );
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}

/** Public sales-page data: skill meta (RLS: published only) + a safe block
 *  outline (type/title/position via the skill_block_outline view). No gated
 *  content. Returns null if the skill isn't found/published. */
export async function getPublicSkill(skillId) {
  const { data: skill, error } = await supabase
    .from('skills').select(SKILL_COLS).eq('id', skillId).eq('status', 'published').maybeSingle();
  if (error) throw error;
  if (!skill) return null;
  const { data: outline, error: oe } = await supabase
    .from('skill_block_outline')
    .select('id, type, title, position')
    .eq('skill_id', skillId)
    .order('position', { ascending: true });
  if (oe) throw oe;
  return { ...skill, outline: outline ?? [] };
}

/** One skill + its ordered content blocks. */
export async function getSkillWithBlocks(skillId) {
  const { data: skill, error } = await supabase
    .from('skills').select(SKILL_COLS).eq('id', skillId).single();
  if (error) throw error;
  const { data: blocks, error: be } = await supabase
    .from('content_blocks')
    .select('id, skill_id, section_id, lesson_id, type, position, title, body_text, file_key, external_url, booking_minutes, buffer_minutes, min_notice_minutes, meeting_url, created_at')
    .eq('skill_id', skillId)
    .order('position', { ascending: true });
  if (be) throw be;
  return { ...skill, blocks };
}

/** Create a draft skill, returns the new row. `kind` defaults to 'digital'
 *  (DB also defaults it) — pass fields.kind to create a course/coaching/etc. */
export async function createSkill(creatorId, fields = {}) {
  const kind = fields.kind ?? 'digital';
  const { data, error } = await supabase
    .from('skills')
    // a membership kind is born with pricing_type locked to 'membership' so the
    // bad state (membership kind billed one-time) is never representable.
    .insert({
      creator_id: creatorId,
      status: 'draft',
      kind,
      ...(kind === 'membership' && { pricing_type: 'membership' }),
      ...fields,
    })
    .select(SKILL_COLS).single();
  if (error) throw error;
  return data;
}

/** Patch a skill's metadata (title/outcome/cover/price/pricing_type/status). */
export async function updateSkill(skillId, patch) {
  const { data, error } = await supabase
    .from('skills')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', skillId)
    .select(SKILL_COLS).single();
  if (error) throw error;
  return data;
}

export async function deleteSkill(skillId) {
  const { error } = await supabase.from('skills').delete().eq('id', skillId);
  if (error) throw error;
}

// ── Content blocks ──────────────────────────────────────────────────────────

/** Content blocks belonging to one course lesson, ordered. */
export async function listLessonBlocks(lessonId) {
  const { data, error } = await supabase
    .from('content_blocks')
    .select('id, skill_id, section_id, lesson_id, type, position, title, body_text, file_key, external_url, booking_minutes, buffer_minutes, min_notice_minutes, meeting_url')
    .eq('lesson_id', lessonId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addBlock(skillId, block) {
  const { data, error } = await supabase
    .from('content_blocks').insert({ skill_id: skillId, ...block }).select().single();
  if (error) throw error;
  return data;
}

export async function updateBlock(blockId, patch) {
  const { data, error } = await supabase
    .from('content_blocks').update(patch).eq('id', blockId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBlock(blockId) {
  const { error } = await supabase.from('content_blocks').delete().eq('id', blockId);
  if (error) throw error;
}

/** Persist a new ordering. `ordered` is an array of block ids in display order. */
export async function reorderBlocks(ordered) {
  const updates = ordered.map((id, position) =>
    supabase.from('content_blocks').update({ position }).eq('id', id));
  const results = await Promise.all(updates);
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}

// ── Backend-brokered (Phase 2/3 — endpoints not built yet) ──────────────────

/** Publish a skill — server-brokered (the paywall gate). The backend requires
 *  a complete profile + a live platform subscription; a DB trigger blocks the
 *  old direct status flip. On failure the thrown Error carries `.code`
 *  ('SUBSCRIPTION_REQUIRED' | 'PROFILE_INCOMPLETE') so the UI can react. */
export async function publishSkill(skillId) {
  const res = await apiFetch(`/api/skills/${skillId}/publish`, { method: 'POST' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || 'Couldn’t publish.');
    err.code = body.code;
    err.missing = body.missing;
    throw err;
  }
  return { status: body.status };
}

/** Bump version + notify existing buyers. */
export async function publishUpdate(skillId) {
  // TODO(Phase 4): POST /api/skills/:id/version — server bumps version and
  // fans out `skill_update` notifications to buyers.
  const res = await apiFetch(`/api/skills/${skillId}/version`, { method: 'POST' });
  if (!res.ok) throw new Error('Version bump endpoint not available yet (Phase 4).');
  return res.json();
}
