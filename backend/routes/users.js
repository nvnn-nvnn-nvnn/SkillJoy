const express = require('express');
const router = express.Router();
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
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
