import { supabase } from './supabase';

// ── Link-in-Bio blocks (plan 04, migration 032) ─────────────────────────────
// A block owns a set of links AND how that set is laid out. Everything the
// editor's Layout and Settings tabs control lives here.

const BLOCK_COLS_LEGACY =
  'id, creator_id, kind, title, subtitle, visible, collapsible, default_collapsed, ' +
  'collapsed_thumb_url, position, layout, created_at';
// 033 added placement. Selected separately so a creator who hasn't run the
// migration falls back instead of losing every block — PostgREST rejects the
// WHOLE query on one unknown column, and the caller swallows it as "no blocks".
// Same trap listLinks hit in note 180.
const BLOCK_COLS = `${BLOCK_COLS_LEGACY}, placement`;

export const PLACEMENTS = [
  { id: 'profile',  label: 'Profile links',
    blurb: 'Inside your profile card, under your bio. The default home for links.' },
  { id: 'featured', label: 'Featured links',
    blurb: 'Its own section above your products. For the one or two things you want clicked.' },
];

// ── Layout ──────────────────────────────────────────────────────────────────
// The four styles. `blurb` is shown under each option in the editor — the ask
// was "little blurbs that tell users the difference", and a style picker where
// you have to click all four to find out what they do is a bad picker.
// Four styles, matching the reference UI's naming. The editor renders each as a
// visual TILE (a small diagram of the shape), not a text pill — a layout picker
// is a question about shape, and a shape is faster to recognise than to read.
// The blurb still carries the tradeoff for anyone who wants it.
export const LINK_STYLES = [
  { id: 'classic',  label: 'Classic',    blurb: 'Full-width buttons, stacked. The familiar link-in-bio look — safest for lots of links.' },
  { id: 'carousel', label: 'Carousel',   blurb: 'A row that swipes sideways. Keeps a long list short, but people miss what’s off-screen.' },
  { id: 'grid',     label: 'Image grid', blurb: 'Thumbnails in a grid. Best when your links have images worth showing.' },
  { id: 'cards',    label: 'Card',       blurb: 'Thumbnail, title and description together. The most detail per link, so use it for a few.' },
];

// Two sizes, not three. A middle option in a set of three is the one nobody can
// describe — S and L are a real choice, "medium" is just the default wearing a
// label. `medium` is still accepted on read for blocks saved before this.
export const LINK_SHAPES = [
  { id: 'pill',    label: 'Pill',    radius: '999px', blurb: 'Fully rounded ends. The classic link-in-bio button.' },
  { id: 'rounded', label: 'Rounded', radius: '14px',  blurb: 'Soft corners. Reads as a card more than a button.' },
  { id: 'square',  label: 'Square',  radius: '4px',   blurb: 'Hard corners. Editorial and graphic.' },
];

export const LINK_SIZES = [
  { id: 'small', label: 'S', blurb: 'Compact rows — fits more above the fold.' },
  { id: 'large', label: 'L', blurb: 'Bold and roomy. Good for a few key links.' },
];

export const DEFAULT_BLOCK_LAYOUT = {
  style: 'classic',
  size: 'large',
  align: 'left',     // 'left' | 'center' | 'right'
  // Booleans, not enums: the reference exposes these as on/off switches, and
  // "subtle vs bold" is a distinction nobody can predict from the words.
  outline: false,
  shadow: false,
  columns: 2,        // grid only
  // Per-block colour. '' = inherit the page theme, which is what every existing
  // block does, so adding these changes nothing until someone picks one.
  //
  // These live in `layout` (JSONB) rather than as columns precisely so a new
  // knob costs no migration — the reason the shape was JSONB in migration 032.
  bg: '',            // link background
  fg: '',            // link text
  headingColor: '',  // block title + subtitle
  // '' = inherit the page-level link_shape. A concrete default here would make
  // every block silently override the page setting.
  shape: '',         // '' | 'pill' | 'rounded' | 'square'
};

// ── Contrast ────────────────────────────────────────────────────────────────
// Duplicated deliberately from storefront.js rather than imported: that module
// pulls in the whole theme/preset system, and this needs six lines of maths.
const srgb = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };

/** Relative luminance of a #rrggbb string, or null if it isn't one. */
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
}

/**
 * WCAG contrast ratio between two hex colours, or null when either is unset
 * (i.e. inheriting the theme — we can't know the resolved value from here, and
 * guessing would produce a confidently wrong warning).
 */
export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Plain-language verdict for a ratio. 4.5 is AA for normal text. */
export function contrastVerdict(ratio) {
  if (ratio === null) return null;
  if (ratio >= 7) return { level: 'great', label: 'Excellent contrast' };
  if (ratio >= 4.5) return { level: 'ok', label: 'Good contrast' };
  if (ratio >= 3) return { level: 'warn', label: 'Low — hard to read at small sizes' };
  return { level: 'bad', label: 'Too low — most people can’t read this' };
}

/** Merge a stored layout over the defaults. Unknown keys are kept (forward
 *  compatible); missing ones fall back. Same contract as resolveTheme(). */
export function resolveBlockLayout(layout) {
  const out = { ...DEFAULT_BLOCK_LAYOUT, ...(layout || {}) };
  // 'medium' was offered before the picker dropped to two sizes. It still
  // exists in saved blocks, and no stylesheet has ever had a rule for it — so
  // those blocks were rendering with NO size applied at all. Coerce here, at
  // the one boundary every renderer goes through, rather than adding dead CSS
  // to each of them.
  if (!LINK_SIZES.some(s => s.id === out.size)) out.size = 'large';
  return out;
}

// ── Blocks ──────────────────────────────────────────────────────────────────
/** Distinguishes "the blocks feature isn't installed" from "something broke".
 *  Returned rather than thrown so the public storefront can degrade quietly
 *  while the EDITOR can say exactly what's wrong. Swallowing both cases the
 *  same way is what made a half-applied migration indistinguishable from an
 *  empty account. */
export async function listBlocksResult(creatorId) {
  const query = (cols) => supabase
    .from('store_blocks')
    .select(cols)
    .eq('creator_id', creatorId)
    .order('position', { ascending: true });

  let { data, error } = await query(BLOCK_COLS);
  if (!error) return { blocks: data ?? [], status: 'ok' };

  // Pre-033: the placement column doesn't exist yet. Retry without it and treat
  // everything as a profile block, which is what it was before 033 anyway.
  if (error.code === '42703' || /column .* does not exist/i.test(error.message || '')) {
    const legacy = await query(BLOCK_COLS_LEGACY);
    if (!legacy.error) {
      return { blocks: (legacy.data ?? []).map(b => ({ ...b, placement: 'profile' })), status: 'ok' };
    }
    error = legacy.error;
  }

  // 42P01 undefined_table · PGRST205 PostgREST schema-cache miss (the table
  // exists in SQL but the API layer hasn't reloaded — needs
  // `notify pgrst, 'reload schema';`)
  const notInstalled =
    error.code === '42P01' || error.code === 'PGRST205' ||
    /does not exist|schema cache/i.test(error.message || '');

  return {
    blocks: [],
    status: notInstalled ? 'not-installed' : 'error',
    error: {
      code: error.code || '(no code)',
      message: error.message || String(error),
      hint: error.hint || error.details || null,
    },
  };
}

/** Blocks only, never throws. For read-only surfaces that just render what's
 *  there (the public storefront). */
export async function listBlocks(creatorId) {
  const { blocks } = await listBlocksResult(creatorId);
  return blocks;
}

export async function createBlock(creatorId, position, placement = 'profile', kind = 'links') {
  const row = { creator_id: creatorId, kind, position, layout: DEFAULT_BLOCK_LAYOUT, placement };
  const { data, error } = await supabase
    .from('store_blocks').insert(row).select(BLOCK_COLS).single();
  if (!error) return data;

  // Pre-033 fallback, same reasoning as the read path.
  if (error.code === '42703' || /column .* does not exist/i.test(error.message || '')) {
    const { placement: _drop, ...legacyRow } = row;
    const retry = await supabase
      .from('store_blocks').insert(legacyRow).select(BLOCK_COLS_LEGACY).single();
    if (retry.error) throw retry.error;
    return { ...retry.data, placement: 'profile' };
  }
  throw error;
}

export async function updateBlock(id, patch) {
  const { error } = await supabase.from('store_blocks').update(patch).eq('id', id);
  if (error) throw error;
}

/** Patch just the layout JSON, merging rather than replacing — callers set one
 *  key at a time and must not clobber the rest. */
export async function updateBlockLayout(id, current, patch) {
  const next = { ...resolveBlockLayout(current), ...patch };
  const { error } = await supabase.from('store_blocks').update({ layout: next }).eq('id', id);
  if (error) throw error;
  return next;
}

export async function deleteBlock(id) {
  const { error } = await supabase.from('store_blocks').delete().eq('id', id);
  if (error) throw error;
}

export async function reorderBlocks(orderedIds) {
  const results = await Promise.all(
    orderedIds.map((id, position) =>
      supabase.from('store_blocks').update({ position }).eq('id', id))
  );
  const failed = results.find(r => r.error);
  if (failed) throw failed.error;
}
