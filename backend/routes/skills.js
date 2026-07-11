const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const supabase = require('../config/supabase');
const { isPlatformLive, paywallEnabled } = require('../lib/platformSub');

// ═══════════════════════════════════════════════════════════════════════════
// v3 SKILLS — server-only actions. Skill/block CRUD is client-side via Supabase
// + RLS; this route is only for things needing the service role, like fanning
// out version-update notifications to OTHER users (buyers). Auth runs upstream.
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/skills/:skillId/publish — the PAYWALL GATE. Publishing is
// server-only (a DB trigger blocks the client from flipping status itself —
// see migrations/021). Going live requires: (a) you own the skill, (b) your
// profile is complete (name, handle, phone), (c) a live platform subscription
// (trialing|active). A 402 SUBSCRIPTION_REQUIRED tells the frontend to launch
// the /api/billing/subscribe flow; publish is retried after the trial starts.
router.post('/:skillId/publish', async (req, res) => {
    try {
        const { skillId } = req.params;
        const userId = req.user.id;

        const { data: skill, error: skillErr } = await supabase
            .from('skills')
            .select('id, title, status, creator_id')
            .eq('id', skillId)
            .single();
        if (skillErr || !skill) return res.status(404).json({ error: 'Skill not found' });
        if (skill.creator_id !== userId) return res.status(403).json({ error: 'Not your Skill.' });
        if (skill.status === 'published') return res.json({ status: 'published', already: true });

        // The gate — only enforced while the paywall is live (Stripe configured).
        // Dormant → publishing just needs ownership, exactly like pre-paywall.
        if (paywallEnabled()) {
            // (b) profile complete — name, handle, phone.
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, username, phone')
                .eq('id', userId)
                .single();
            const missing = ['full_name', 'username', 'phone'].filter(f => !profile?.[f]?.trim?.());
            if (missing.length) {
                return res.status(400).json({
                    error: 'Finish your profile before publishing — we need your name, handle, and phone number.',
                    code: 'PROFILE_INCOMPLETE',
                    missing,
                });
            }

            // (c) live platform subscription. This is THE gate — signup/build/
            // customize are free; the card + 14-day trial start here.
            if (!(await isPlatformLive(userId))) {
                return res.status(402).json({
                    error: 'Start your free 14-day trial to publish your storefront.',
                    code: 'SUBSCRIPTION_REQUIRED',
                });
            }
        }

        const { data: updated, error: upErr } = await supabase
            .from('skills')
            .update({ status: 'published', updated_at: new Date().toISOString() })
            .eq('id', skillId)
            .select('id, status')
            .single();
        if (upErr) return serverError(res, upErr);

        res.json({ status: updated.status });
    } catch (err) {
        console.error('Skill publish error:', err);
        serverError(res, err);
    }
});

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
        if (upErr) return serverError(res, upErr);

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
        serverError(res, err);
    }
});

module.exports = router;
