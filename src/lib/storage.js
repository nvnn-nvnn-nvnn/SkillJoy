import { supabase } from './supabase';

// ── Storage helpers (v3) ────────────────────────────────────────────────────
// Paths are `{creatorId}/{skillId}/{uuid}-{safeName}` so the folder-owner RLS
// policies in migrations/002_storage_buckets.sql scope writes to the creator.

const COVERS = 'skill-covers'; // public
const FILES = 'skill-files';   // private — served later via signed URLs

function safePath(creatorId, skillId, fileName) {
  const uuid = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const safe = (fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
  return `${creatorId}/${skillId}/${uuid}-${safe}`;
}

/** Upload a cover image to the public bucket. Returns its public URL. */
export async function uploadCover(creatorId, skillId, file) {
  const path = safePath(creatorId, skillId, file.name);
  const { error } = await supabase.storage.from(COVERS)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(COVERS).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload a storefront banner to the public covers bucket. Returns public URL. */
export async function uploadBanner(creatorId, file) {
  const path = safePath(creatorId, 'banner', file.name);
  const { error } = await supabase.storage.from(COVERS)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(COVERS).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload a link-block thumbnail to the public covers bucket. Returns public URL.
 *  Same bucket as covers — RLS scopes writes by the {creatorId}/ prefix, so the
 *  second path segment is just a folder for humans reading the bucket. */
export async function uploadLinkThumb(creatorId, file) {
  const path = safePath(creatorId, 'link-thumbs', file.name);
  const { error } = await supabase.storage.from(COVERS)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(COVERS).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload a storefront background video to the public bucket. Returns public URL.
 *  NOTE: the skill-covers bucket must allow video/* MIME types + a large-enough
 *  file size limit (Supabase dashboard config). */
export async function uploadBgVideo(creatorId, file) {
  const path = safePath(creatorId, 'bgvideo', file.name);
  const { error } = await supabase.storage.from(COVERS)
    .upload(path, file, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(COVERS).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload storefront audio to the public bucket. Returns public URL.
 *  NOTE: bucket must allow audio/* MIME types (Supabase dashboard config). */
export async function uploadAudio(creatorId, file) {
  const path = safePath(creatorId, 'audio', file.name);
  const { error } = await supabase.storage.from(COVERS)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(COVERS).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload a gated asset to the PRIVATE bucket. Returns the storage KEY (path) —
 * store it in content_blocks.file_key, NOT a URL. The buyer's download link is
 * minted on demand in Phase 3.
 */
export async function uploadBlockFile(creatorId, skillId, file) {
  const path = safePath(creatorId, skillId, file.name);
  const { error } = await supabase.storage.from(FILES)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  return { key: path, name: file.name, size: file.size };
}

/** Creator-side preview URL for a private file they own (short-lived). */
export async function getOwnerFilePreviewUrl(fileKey, expiresIn = 120) {
  const { data, error } = await supabase.storage.from(FILES).createSignedUrl(fileKey, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
