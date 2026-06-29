const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { unsubToken } = require('../lib/unsub');

// ═══════════════════════════════════════════════════════════════════════════
// Public (no-auth) endpoints. Mounted WITHOUT authMiddleware.
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/public/unsubscribe { c: creatorId, e: email, t: token }
router.post('/unsubscribe', async (req, res) => {
    try {
        const { c: creatorId, e: email, t: token } = req.body;
        if (!creatorId || !email || !token) return res.status(400).json({ error: 'Invalid unsubscribe link.' });
        if (token !== unsubToken(creatorId, email)) return res.status(403).json({ error: 'Invalid or expired unsubscribe link.' });

        const { error } = await supabase
            .from('subscribers').delete().eq('creator_id', creatorId).ilike('email', email);
        if (error) return res.status(500).json({ error: error.message });

        res.json({ success: true });
    } catch (err) {
        console.error('Unsubscribe error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
