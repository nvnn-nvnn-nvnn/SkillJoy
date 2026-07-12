const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
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
        if (error) return serverError(res, error);

        res.json({ success: true });
    } catch (err) {
        console.error('Unsubscribe error:', err);
        serverError(res, err);
    }
});

// POST /api/public/subscribe { creatorId, email, name?, source? }
// Storefront email capture. Runs on the SERVICE ROLE (not the visitor's anon
// key) so it can't be broken by RLS drift, and the email is validated +
// rate-limited (strictLimiter upstream) server-side. Idempotent per
// (creator, email) — a duplicate subscribe returns ok, not an error.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
router.post('/subscribe', async (req, res) => {
    try {
        const { creatorId, email, name, source } = req.body || {};
        const clean = (email || '').trim().toLowerCase();
        if (!creatorId) return res.status(400).json({ error: 'Missing creator.' });
        if (!EMAIL_RE.test(clean)) return res.status(400).json({ error: 'Enter a valid email.' });

        // Confirm the creator exists (avoids orphan rows / FK error noise).
        const { data: creator } = await supabase
            .from('profiles').select('id').eq('id', creatorId).maybeSingle();
        if (!creator) return res.status(404).json({ error: 'Creator not found.' });

        const { error } = await supabase
            .from('subscribers')
            .upsert(
                { creator_id: creatorId, email: clean, name: (name || '').trim() || null, source: source || 'storefront' },
                { onConflict: 'creator_id,email', ignoreDuplicates: true },
            );
        if (error) return serverError(res, error);

        res.json({ ok: true });
    } catch (err) {
        console.error('Public subscribe error:', err);
        serverError(res, err);
    }
});

module.exports = router;
