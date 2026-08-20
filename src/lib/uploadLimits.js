// ── Upload limits — ONE source of truth ──────────────────────────────────────
// Storage is a real cost and an unbounded upload is an unbounded bill, so every
// file the app accepts is checked against this table before it leaves the
// browser. Previously only ONE call site (BlockEditor) had a limit, as a local
// magic number; covers, banners, background video, audio and cursors had none.
//
// ⚠️ THIS FILE IS THE UX LAYER, NOT THE SECURITY LAYER.
// It runs in the browser, so a determined user can bypass it by calling the
// Supabase storage API directly with their own anon key. The *authoritative*
// limit is `file_size_limit` on the bucket itself — see
// `docs/v3-skill-platform/migrations/027_upload_limits.sql`. Both must exist:
//   · bucket limit  → cannot be bypassed, but gives a generic opaque error
//   · this file     → instant, specific, human feedback before any bytes upload
// If you change a number here, change it there too, or they drift.

export const MB = 1024 * 1024;

// Large digital products MUST be a single archive. Reasons, in order:
//   1. Cost/sprawl — a "product" that is 40 loose files is 40 storage objects
//      to track, sign and clean up; an archive is one.
//   2. Buyer experience — one download beats hunting through N links.
//   3. Integrity — folder structure and filenames survive the round trip.
// Below the threshold a single loose PDF is friendlier than forcing a zip, so
// the rule only kicks in once the upload is big enough to be worth packaging.
export const ZIP_REQUIRED_ABOVE = 25 * MB;

// Extension check, not MIME. Browsers report archives inconsistently —
// application/zip, application/x-zip-compressed, or a bare
// application/octet-stream depending on OS and how the file was made — so the
// extension is the reliable signal here.
const ARCHIVE_EXTS = ['.zip'];

export const LIMITS = {
  //  kind      max size        what it is                      accept hint
  digital: { max: 200 * MB, label: 'Product file',      accept: undefined },
  cover:   { max: 5   * MB, label: 'Cover image',       accept: 'image/' },
  banner:  { max: 8   * MB, label: 'Banner image',      accept: 'image/' },
  bgImage: { max: 8   * MB, label: 'Background image',  accept: 'image/' },
  avatar:  { max: 5   * MB, label: 'Profile picture',   accept: 'image/' },
  cursor:  { max: 1   * MB, label: 'Custom cursor',     accept: 'image/' },
  audio:   { max: 15  * MB, label: 'Audio track',       accept: 'audio/' },
  bgVideo: { max: 50  * MB, label: 'Background video',  accept: 'video/' },
};

/** Human file size: 900 KB, 4.2 MB, 200 MB. */
export function formatBytes(bytes) {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / MB;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export const isArchive = (name) =>
  ARCHIVE_EXTS.some(ext => (name || '').toLowerCase().endsWith(ext));

/**
 * Validate one file against a kind in LIMITS.
 * Returns { ok: true } or { ok: false, error } — an error STRING, not a throw,
 * because every caller wants to render it, not catch it.
 */
export function validateUpload(kind, file) {
  const rule = LIMITS[kind];
  if (!rule) return { ok: false, error: `Unknown upload kind "${kind}".` };
  if (!file) return { ok: false, error: 'No file selected.' };

  // Type first: "that's not an image" is more useful than "that's too big"
  // when someone picks the wrong file entirely.
  if (rule.accept && !(file.type || '').startsWith(rule.accept)) {
    return { ok: false, error: `${rule.label} must be a ${rule.accept.replace('/', '')} file.` };
  }

  if (file.size > rule.max) {
    return {
      ok: false,
      error: `${rule.label} is ${formatBytes(file.size)} — the limit is ${formatBytes(rule.max)}.`
        + (kind === 'digital' ? ' Compress it, or split it across multiple products.' : ''),
    };
  }

  // The archive rule — digital products only. Everything else is a single
  // asset by definition and would be nonsense to zip.
  if (kind === 'digital' && file.size > ZIP_REQUIRED_ABOVE && !isArchive(file.name)) {
    return {
      ok: false,
      error: `Files over ${formatBytes(ZIP_REQUIRED_ABOVE)} must be uploaded as a .zip. `
        + `Yours is ${formatBytes(file.size)} — put it in a zip and upload that.`,
    };
  }

  return { ok: true };
}
