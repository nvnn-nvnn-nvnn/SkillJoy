const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/blocks — list of user IDs blocked by the current user
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('blocked_users')
            .select('blocked_id, blocked:profiles!blocked_id(id, full_name, avatar_url), created_at')
            .eq('blocker_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        res.json(data ?? []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/blocks/block
router.post('/block', async (req, res) => {
    try {
        const { blockedId } = req.body;
        if (!blockedId) return res.status(400).json({ error: 'Missing blockedId' });
        if (blockedId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });

        // Verify user exists
        const { data: profile } = await supabase.from('profiles').select('id').eq('id', blockedId).single();
        if (!profile) return res.status(404).json({ error: 'User not found' });

        const { error } = await supabase.from('blocked_users').upsert(
            { blocker_id: req.user.id, blocked_id: blockedId },
            { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
        );

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/blocks/unblock
router.post('/unblock', async (req, res) => {
    try {
        const { blockedId } = req.body;
        if (!blockedId) return res.status(400).json({ error: 'Missing blockedId' });

        const { error } = await supabase
            .from('blocked_users')
            .delete()
            .eq('blocker_id', req.user.id)
            .eq('blocked_id', blockedId);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
