const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// Placeholder user routes - add as needed

const PUBLIC_FIELDS = 'id, full_name, bio, avatar_url, service_type, availability, college, college_verified';

router.get('/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const isOwnProfile = req.user.id === userId;

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

module.exports = router;
