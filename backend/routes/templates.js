const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
if (!ADMIN_EMAIL) throw new Error('ADMIN_EMAIL env var is not set');

const BUCKET = 'skill-covers';           // public bucket, same one covers use
const PREFIX = '_templates';             // platform-owned area inside it

// Theme keys that hold an uploaded asset. These are the only keys copied, and
// the only keys rewritten — everything else in the theme is plain styling.
const ASSET_KEYS = ['bg_image', 'bg_video'];

// Budgets. A template's assets download on every page view of every storefront
// using it, so these are ceilings, not suggestions. Matches the numbers
// scripts/check-presets.cjs enforces for hand-authored presets.
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;

function isAdmin(req) {
    return req.user?.email === ADMIN_EMAIL;
}

// A stored asset URL looks like:
//   https://<proj>.supabase.co/storage/v1/object/public/skill-covers/<path>
// We need <path> to copy it. Returns null for anything that isn't in our
// bucket — an external URL, or a path already inside _templates/.
function storagePathFromUrl(url) {
    if (typeof url !== 'string' || !url) return null;
    const marker = `/object/public/${BUCKET}/`;
    const i = url.indexOf(marker);
    if (i < 0) return null;
    const path = decodeURIComponent(url.slice(i + marker.length).split('?')[0]);
    // Refuse traversal and refuse re-copying something already platform-owned.
    if (path.includes('..') || path.startsWith(`${PREFIX}/`)) return null;
    return path;
}

function publicUrl(path) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function limitFor(mime) {
    if (mime?.startsWith('video/')) return MAX_VIDEO_BYTES;
    if (mime?.startsWith('audio/')) return MAX_AUDIO_BYTES;
    return MAX_IMAGE_BYTES;
}

/**
 * Read an asset and report its size WITHOUT writing anything.
 *
 * Split from the write on purpose. Validating while copying means the first
 * oversized file aborts the request after earlier files are already in storage
 * — and the old catch never removed them, so every failed save leaked orphans.
 */
async function measureAsset(srcPath) {
    const { data: blob, error } = await supabase.storage.from(BUCKET).download(srcPath);
    if (error) throw new Error(`could not read ${srcPath}: ${error.message}`);
    return { blob, bytes: blob.size, mime: blob.type || 'application/octet-stream' };
}

/**
 * Write one already-measured asset into the platform-owned prefix.
 *
 * Re-uploads rather than storage.copy(): copy() hands back no size, and the
 * size is the whole point — it decides what every visitor downloads on every
 * page view of every storefront using this template.
 */
async function writeAsset({ blob, bytes, mime }, srcPath, templateId) {
    const name = srcPath.split('/').pop();
    const destPath = `${PREFIX}/${templateId}/${name}`;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error } = await supabase.storage.from(BUCKET)
        .upload(destPath, buffer, { contentType: mime, cacheControl: '31536000', upsert: true });
    if (error) throw new Error(`could not write ${destPath}: ${error.message}`);
    return { path: destPath, url: publicUrl(destPath), bytes, mime };
}

const mb = (b) => (b / 1048576).toFixed(1);

/**
 * Which assets does this theme actually render, and where do they live?
 *
 * Shared by the save route and the preflight route so the size readout in the
 * editor is produced by the same logic that decides whether a save succeeds.
 */
function collectCandidates(theme, includeAudio) {
    const wanted = [];
    if (theme.bg === 'image' || theme.bg === 'video') wanted.push('bg_image'); // background, or the video's poster
    if (theme.bg === 'video') wanted.push('bg_video');
    if (theme.banner_url) wanted.push('banner_url');
    if (theme.cursor_url) wanted.push('cursor_url');

    const out = [];
    for (const key of wanted) {
        const path = storagePathFromUrl(theme[key]);
        if (path) out.push({ key, path, name: key.replace(/_/g, ' ') });
    }
    if (includeAudio && Array.isArray(theme.audio_tracks)) {
        for (const track of theme.audio_tracks) {
            const path = storagePathFromUrl(track?.url);
            if (path) out.push({ key: 'audio_tracks', path, name: track.name || 'Track' });
        }
    }
    return { wanted, candidates: out };
}

/** Measure a candidate set and report every problem, not just the first. */
async function measureAll(candidates) {
    const problems = [];
    let total = 0;
    for (const c of candidates) {
        c.measured = await measureAsset(c.path);
        total += c.measured.bytes;
        const cap = limitFor(c.measured.mime);
        c.over = c.measured.bytes > cap;
        c.cap = cap;
        if (c.over) problems.push(`${c.name} is ${mb(c.measured.bytes)}MB (max ${mb(cap)}MB)`);
    }
    if (total > MAX_TOTAL_BYTES) {
        problems.push(`everything together is ${mb(total)}MB (max ${mb(MAX_TOTAL_BYTES)}MB)`);
    }
    return { problems, total };
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST — public. Anonymous too: the onboarding picker runs pre-session.
// ═══════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('store_templates')
            .select('id, name, blurb, category, emoji, theme, install_count, created_at')
            .in('status', ['public', 'unlisted'])
            .order('category', { ascending: true })
            .order('position', { ascending: true })
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ templates: data ?? [] });
    } catch (e) {
        return serverError(res, e, 'Could not load templates');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// PREFLIGHT — admin only. "Would this save, and what does it weigh?"
//
// Exists because the budget was invisible until you pressed save and read an
// error. Runs the identical measurement the save runs, so the readout in the
// editor cannot promise something the save then refuses.
// ═══════════════════════════════════════════════════════════════════════════
router.get('/preflight', authMiddleware, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
        const includeAudio = req.query.includeAudio !== 'false';

        const { data: profile, error } = await supabase
            .from('profiles').select('storefront_theme').eq('id', req.user.id).single();
        if (error) throw error;
        const theme = profile?.storefront_theme;
        if (!theme || typeof theme !== 'object') return res.json({ assets: [], total: 0, problems: [] });

        const { candidates } = collectCandidates(theme, includeAudio);
        const { problems, total } = await measureAll(candidates);

        res.json({
            assets: candidates.map(c => ({
                key: c.key, name: c.name, bytes: c.measured.bytes,
                mime: c.measured.mime, cap: c.cap, over: !!c.over,
            })),
            total, maxTotal: MAX_TOTAL_BYTES, problems,
        });
    } catch (e) {
        return serverError(res, e, 'Could not check template size');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// SAVE — admin only. Snapshots the caller's CURRENT page look as a template.
//
// The client sends metadata only. The theme is read server-side from the
// caller's own profile row, so a request cannot inject a theme that was never
// on a real page — and cannot name an asset path the caller doesn't own.
// ═══════════════════════════════════════════════════════════════════════════
router.post('/', authMiddleware, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

        const name = String(req.body?.name || '').trim().slice(0, 60);
        const blurb = String(req.body?.blurb || '').trim().slice(0, 160);
        const category = String(req.body?.category || 'showcase').trim().slice(0, 32);
        const emoji = String(req.body?.emoji || '🎨').trim().slice(0, 8);
        const includeAudio = req.body?.includeAudio !== false;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const { data: profile, error: pErr } = await supabase
            .from('profiles').select('storefront_theme').eq('id', req.user.id).single();
        if (pErr) throw pErr;

        const src = profile?.storefront_theme;
        if (!src || typeof src !== 'object') {
            return res.status(400).json({ error: 'Your page has no saved theme yet — customize it first.' });
        }

        // Strip content. A template is a LOOK: never the author's name, bio,
        // links, products or socials. Same split portableTheme enforces.
        const theme = { ...src };
        delete theme.socials;

        const id = crypto.randomUUID();

        // ── Which assets does this theme actually RENDER? ──
        // bg_video is only painted when bg === 'video'. Copying it regardless
        // meant a page set to 'image' still dragged its unused video into the
        // template — spending the budget on bytes nobody would ever see.
        const { wanted, candidates } = collectCandidates({ ...theme, audio_tracks: src.audio_tracks }, includeAudio);
        // Anything the theme does not render must not survive into the template
        // still pointing at the author's storage.
        for (const key of ASSET_KEYS) if (!wanted.includes(key)) theme[key] = '';

        // ── Measure everything BEFORE writing anything ──
        // Report every problem at once. Failing on the first oversized file
        // tells you about one of four, and you fix them one round trip at a time.
        const { problems, total } = await measureAll(candidates);
        if (problems.length) {
            return res.status(400).json({
                error: `Too heavy to share — ${problems.join('; ')}. `
                    + 'Every visitor downloads these on every page view. Trim the files, '
                    + 'or turn off "Include my music" and save again.',
            });
        }

        // ── Past this point nothing can fail on size, so writing is safe ──
        const assets = [];
        try {
            const tracks = [];
            for (const c of candidates) {
                const written = await writeAsset(c.measured, c.path, id);
                assets.push({ key: c.key, ...written });
                if (c.key === 'audio_tracks') tracks.push({ url: written.url, name: c.name });
                else theme[c.key] = written.url;
            }
            theme.audio_tracks = tracks;
            // audio_url is the deprecated single-track field, still read by some
            // surfaces. Out of sync means the music silently disappears there.
            theme.audio_url = tracks[0]?.url || '';
        } catch (copyErr) {
            // A half-written template must not leave files behind.
            if (assets.length) await supabase.storage.from(BUCKET).remove(assets.map(a => a.path));
            throw copyErr;
        }

        const { data: row, error: insErr } = await supabase
            .from('store_templates')
            .insert({ id, author_id: req.user.id, name, blurb, category, emoji, theme, assets })
            .select('id, name, blurb, category, emoji, theme, created_at').single();
        if (insErr) {
            await supabase.storage.from(BUCKET).remove(assets.map(a => a.path));
            throw insErr;
        }

        res.json({ template: row, assetCount: assets.length, bytes: total });
    } catch (e) {
        return serverError(res, e, e.message || 'Could not save template');
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// DELETE — admin only. Removes the storage copies too, via the manifest.
// ═══════════════════════════════════════════════════════════════════════════
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

        const { data: row, error } = await supabase
            .from('store_templates').select('id, assets').eq('id', req.params.id).single();
        if (error) throw error;

        const paths = (row.assets || []).map(a => a.path).filter(Boolean);
        if (paths.length) await supabase.storage.from(BUCKET).remove(paths);

        const { error: delErr } = await supabase
            .from('store_templates').delete().eq('id', req.params.id);
        if (delErr) throw delErr;

        res.json({ ok: true, removedAssets: paths.length });
    } catch (e) {
        return serverError(res, e, 'Could not delete template');
    }
});

module.exports = router;
