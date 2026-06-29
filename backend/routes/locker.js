const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ═══════════════════════════════════════════════════════════════════════════
// v3 LOCKER — gated file delivery. Mints a short-lived signed URL for a private
// content-block file, only after verifying the caller paid for the Skill (or is
// its creator). Auth middleware runs upstream → req.user is set.
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/locker/block/:blockId/download
router.get('/block/:blockId/download', async (req, res) => {
    try {
        const { blockId } = req.params;
        const userId = req.user.id;

        const { data: block, error: blockErr } = await supabase
            .from('content_blocks')
            .select('id, skill_id, file_key, skill:skills(creator_id)')
            .eq('id', blockId)
            .single();
        if (blockErr || !block) return res.status(404).json({ error: 'Block not found' });
        if (!block.file_key) return res.status(400).json({ error: 'This block has no downloadable file.' });

        const isCreator = block.skill?.creator_id === userId;
        if (!isCreator) {
            const { data: purchase } = await supabase
                .from('purchases')
                .select('id')
                .eq('buyer_id', userId).eq('skill_id', block.skill_id).eq('status', 'paid')
                .maybeSingle();
            if (!purchase) return res.status(403).json({ error: 'You don’t have access to this file.' });
        }

        const { data, error } = await supabase.storage
            .from('skill-files')
            .createSignedUrl(block.file_key, 60); // 60s, minted fresh per request
        if (error) return res.status(500).json({ error: error.message });

        res.json({ url: data.signedUrl });
    } catch (err) {
        console.error('Locker download error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
