import { apiFetch } from './api';

// ── Saved templates (migration 034) ─────────────────────────────────────────
//
// The 38 presets in presets.js are authored by hand in code. These are saved
// from a REAL page: an admin customizes their storefront in the normal editor —
// background video, music, effects — and saves that look.
//
// Why both exist: a preset with a video cannot be hand-written, because the
// asset has to be uploaded first. Anything involving an upload has to be
// created by a running system, not by typing an object literal.
//
// Reads go through the backend rather than browser→Supabase because the same
// endpoint serves anonymous onboarding, and keeping one code path means the
// shape can't drift between the two callers.

/** Every published template, already shaped like a THEME_PRESETS entry. */
export async function listTemplates() {
  try {
    const res = await apiFetch('/api/templates');
    if (!res.ok) return [];
    const { templates } = await res.json();
    return (templates ?? []).map(t => ({
      id: `db:${t.id}`,        // namespaced so a DB id can never collide with a
      dbId: t.id,              // built-in preset id in the same picker
      name: t.name,
      emoji: t.emoji || '🎨',
      category: t.category || 'showcase',
      blurb: t.blurb || '',
      theme: t.theme || {},
      saved: true,             // lets the UI mark these as deletable
    }));
  } catch {
    // A template list that fails to load must never break the editor — the
    // built-in presets still render. Same reasoning as listBlocks not throwing.
    return [];
  }
}

/** Save the caller's CURRENT storefront look as a template. Admin only.
 *  The theme is read server-side from the caller's profile, so this sends
 *  metadata only — there is no way to submit a look that wasn't on a real page. */
export async function saveTemplate({ name, blurb, category, emoji, includeAudio = true }) {
  const res = await apiFetch('/api/templates', {
    method: 'POST',
    body: JSON.stringify({ name, blurb, category, emoji, includeAudio }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not save template');
  return body;
}

/** Delete a saved template and its copied assets. Admin only. */
export async function deleteTemplate(dbId) {
  const res = await apiFetch(`/api/templates/${dbId}`, { method: 'DELETE' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Could not delete template');
  return body;
}
