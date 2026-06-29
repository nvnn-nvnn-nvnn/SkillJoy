const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ═══════════════════════════════════════════════════════════════════════════
// v3 SKILLS — server-only actions. Skill/block CRUD is client-side via Supabase
// + RLS; this route is only for things needing the service role, like fanning
// out version-update notifications to OTHER users (buyers). Auth runs upstream.
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/skills/:skillId/version — bump version + notify existing buyers.
router.post('/:skillId/version', async (req, res) => {
    try {
        const { skillId } = req.params;
        const userId = req.user.id;

        const { data: skill, error: skillErr } = await supabase
            .from('skills')
            .select('id, title, version, status, creator_id')
            .eq('id', skillId)
            .single();
        if (skillErr || !skill) return res.status(404).json({ error: 'Skill not found' });
        if (skill.creator_id !== userId) return res.status(403).json({ error: 'Not your Skill.' });
        if (skill.status !== 'published') {
            return res.status(400).json({ error: 'Publish the Skill before pushing an update.' });
        }

        const newVersion = skill.version + 1;
        const { error: upErr } = await supabase
            .from('skills')
            .update({ version: newVersion, updated_at: new Date().toISOString() })
            .eq('id', skillId);
        if (upErr) return res.status(500).json({ error: upErr.message });

        // Notify everyone who already bought it.
        const { data: buyers } = await supabase
            .from('purchases')
            .select('buyer_id')
            .eq('skill_id', skillId).eq('status', 'paid');

        if (buyers?.length) {
            const notifs = buyers.map(b => ({
                user_id: b.buyer_id,
                type: 'skill_update',
                title: `Updated to v${newVersion}`,
                message: `"${skill.title ?? 'A Skill you own'}" just got an update. Open it to see what's new.`,
                related_id: skillId,
                related_type: null,
            }));
            await supabase.from('notifications').insert(notifs);
        }

        res.json({ version: newVersion, notified: buyers?.length ?? 0 });
    } catch (err) {
        console.error('Skill version bump error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
