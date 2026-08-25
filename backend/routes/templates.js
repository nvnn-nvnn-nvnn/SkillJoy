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
 * Copy one asset from the author's folder into the platform-owned prefix.
 *
 * Downloads and re-uploads rather than using storage.copy(): copy() keeps the
 * source's metadata and, more importantly, gives us no size to enforce a budget
 * against. Reading the blob is the only way to know what we are about to make
 * everyone download.
 */
async function copyAsset(srcPath, templateId) {
    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(srcPath);
    if (dlErr) throw new Error(`could not read ${srcPath}: ${dlErr.message}`);

    const bytes = blob.size;
    const mime = blob.type || 'application/octet-stream';
    const cap = limitFor(mime);
    if (bytes > cap) {
        throw new Error(
            `${srcPath.split('/').pop()} is ${(bytes / 1048576).toFixed(1)}MB, over the `
            + `${(cap / 1048576).toFixed(0)}MB limit for ${mime.split('/')[0]} — every visitor downloads this.`
        );
    }

    const name = srcPath.split('/').pop();
    const destPath = `${PREFIX}/${templateId}/${name}`;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(destPath, buffer, { contentType: mime, cacheControl: '31536000', upsert: true });
    if (upErr) throw new Error(`could not write ${destPath}: ${upErr.message}`);

    return { path: destPath, url: publicUrl(destPath), bytes, mime };
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
        const assets = [];
        let total = 0;

        // Background image / video.
        for (const key of ASSET_KEYS) {
            const path = storagePathFromUrl(theme[key]);
            if (!path) continue;
            const copied = await copyAsset(path, id);
            theme[key] = copied.url;
            assets.push({ key, ...copied });
            total += copied.bytes;
        }

        // Music. Every track copied, or the array is dropped entirely — a
        // partially-copied playlist would half-point at the author's storage.
        if (includeAudio && Array.isArray(src.audio_tracks) && src.audio_tracks.length) {
            const tracks = [];
            for (const track of src.audio_tracks) {
                const path = storagePathFromUrl(track?.url);
                if (!path) continue;
                const copied = await copyAsset(path, id);
                tracks.push({ url: copied.url, name: track.name || 'Track' });
                assets.push({ key: 'audio_tracks', ...copied });
                total += copied.bytes;
            }
            theme.audio_tracks = tracks;
            // audio_url is the deprecated single-track field, still read by some
            // surfaces. Out of sync means the music silently disappears there.
            theme.audio_url = tracks[0]?.url || '';
        } else {
            theme.audio_tracks = [];
            theme.audio_url = '';
        }

        if (total > MAX_TOTAL_BYTES) {
            // Clean up before refusing — a rejected save must not leave files behind.
            await supabase.storage.from(BUCKET).remove(assets.map(a => a.path));
            return res.status(400).json({
                error: `Assets total ${(total / 1048576).toFixed(1)}MB, over the `
                    + `${MAX_TOTAL_BYTES / 1048576}MB budget for one template.`,
            });
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
