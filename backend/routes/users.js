const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const supabase = require('../config/supabase');

// Placeholder user routes - add as needed

const PUBLIC_FIELDS = 'id, full_name, bio, avatar_url, service_type, availability, college_verified, skills_teach, skills_learn, offers_gigs, points';

router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const isOwnProfile = req.user.id === userId;

        // If viewing someone else's profile, check if they have blocked the requester
        if (!isOwnProfile) {
            const { data: block } = await supabase
                .from('blocked_users')
                .select('id')
                .eq('blocker_id', userId)
                .eq('blocked_id', req.user.id)
                .maybeSingle();

            if (block) {
                return res.status(403).json({ error: 'This profile is not available.' });
            }
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select(isOwnProfile ? '*' : PUBLIC_FIELDS)
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(profile);
    } catch (err) {
        console.error('Get profile error:', err);
        serverError(res, err);
    }
});

// ── Delete account ───────────────────────────────────────────────────────────
// Permanently deletes the user's profile row and their Supabase auth account.
router.delete('/account', async (req, res) => {
    try {
        const userId = req.user.id;

        // Delete profile (cascades to related rows if FK constraints are set up)
        const { error: profileErr } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileErr) {
            console.error('Delete profile error:', profileErr.message);
            return res.status(500).json({ error: 'Failed to delete profile.' });
        }

        // Delete the auth user (requires service-role key, which the backend client has)
        const { error: authErr } = await supabase.auth.admin.deleteUser(userId);

        if (authErr) {
            console.error('Delete auth user error:', authErr.message);
            return res.status(500).json({ error: 'Profile deleted but failed to remove auth account. Contact support.' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Delete account error:', err);
        serverError(res, err);
    }
});

// ── Username change (15-day cooldown) ───────────────────────────────────────
// POST /api/users/username { username }
// Server-authoritative: normalization, reserved names, case-insensitive
// uniqueness, and the cooldown are ALL enforced here (never trust the client).
// Mirrors Onboarding.jsx's RESERVED_USERNAMES — keep the two lists in sync.
const RESERVED_USERNAMES = new Set([
    'build', 'locker', 'dashboard', 'login', 'onboarding', 'about', 'contact',
    'profile', 'settings', 'admin', 'terms', 'privacy', 'how-it-works',
    'refund-policy', 'gigs', 'swaps', 'matches', 'chat', 'disputes', 'my-orders',
    'my-listings', 'my-swaps', 'verify-college', 'main-search', 'api', 'health',
]);
const USERNAME_COOLDOWN_DAYS = 15;

router.post('/username', async (req, res) => {
    try {
        const userId = req.user.id;
        const normalized = (req.body?.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);

        if (normalized.length < 3) return res.status(400).json({ error: 'Usernames need at least 3 characters (a–z, 0–9, _).' });
        if (RESERVED_USERNAMES.has(normalized)) return res.status(400).json({ error: 'That handle is reserved — try another.' });

        const { data: me, error: meErr } = await supabase
            .from('profiles')
            .select('id, username, username_changed_at')
            .eq('id', userId)
            .single();
        if (meErr || !me) return res.status(404).json({ error: 'Profile not found.' });

        // Same handle → no-op; don't burn the cooldown.
        if ((me.username || '').toLowerCase() === normalized) {
            return res.json({ username: me.username, nextChangeAt: null, unchanged: true });
        }

        // Cooldown: only when a previous change is on record (null = never changed).
        if (me.username_changed_at) {
            const nextAllowed = new Date(new Date(me.username_changed_at).getTime() + USERNAME_COOLDOWN_DAYS * 86400000);
            if (Date.now() < nextAllowed.getTime()) {
                return res.status(429).json({
                    error: `You can change your username again on ${nextAllowed.toLocaleDateString()}.`,
                    nextChangeAt: nextAllowed.toISOString(),
                });
            }
        }

        // Case-insensitive uniqueness against everyone else.
        const { data: taken } = await supabase
            .from('profiles').select('id').ilike('username', normalized).neq('id', userId).maybeSingle();
        if (taken) return res.status(409).json({ error: 'That handle is taken — try another.' });

        const changedAt = new Date().toISOString();
        const { error: upErr } = await supabase
            .from('profiles')
            .update({ username: normalized, username_changed_at: changedAt })
            .eq('id', userId);
        if (upErr) {
            // Unique-index race past the live check.
            if (/duplicate|unique|23505/i.test(upErr.message)) {
                return res.status(409).json({ error: 'That handle was just taken — try another.' });
            }
            return serverError(res, upErr);
        }

        const nextChangeAt = new Date(Date.now() + USERNAME_COOLDOWN_DAYS * 86400000).toISOString();
        res.json({ username: normalized, nextChangeAt });
    } catch (err) {
        console.error('Username change error:', err);
        serverError(res, err);
    }
});

module.exports = router;
