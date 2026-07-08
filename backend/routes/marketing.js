const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const supabase = require('../config/supabase');
const { sendEmail } = require('../lib/email');
const { unsubToken } = require('../lib/unsub');

// ═══════════════════════════════════════════════════════════════════════════
// v3 EMAIL MARKETING — send a broadcast to the creator's subscribers via Resend.
// Auth middleware runs upstream → req.user is the creator.
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/marketing/broadcast  { subject, body }
router.post('/broadcast', async (req, res) => {
    try {
        const creatorId = req.user.id;
        const subject = (req.body.subject || '').trim();
        const body = (req.body.body || '').trim();
        if (!subject || !body) return res.status(400).json({ error: 'Subject and body are required.' });

        const { data: subs, error } = await supabase
            .from('subscribers').select('email').eq('creator_id', creatorId);
        if (error) return serverError(res, error);
        if (!subs?.length) return res.status(400).json({ error: 'You have no subscribers yet.' });

        // Creator display name for the footer.
        const { data: profile } = await supabase
            .from('profiles').select('full_name, username').eq('id', creatorId).single();
        const fromName = profile?.full_name || (profile?.username ? `@${profile.username}` : 'A SkillJoy creator');

        const baseUrl = process.env.FRONTEND_URL || '';
        const buildHtml = (email) => {
            const t = unsubToken(creatorId, email);
            const unsubUrl = `${baseUrl}/unsubscribe?c=${creatorId}&e=${encodeURIComponent(email)}&t=${t}`;
            return `
            <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
              <div style="white-space:pre-wrap;line-height:1.6;color:#1a1a1a;">${escapeHtml(body)}</div>
              <p style="color:#9ca3af;font-size:12px;margin-top:28px;">Sent by ${escapeHtml(fromName)} via SkillJoy.
                &nbsp;·&nbsp; <a href="${unsubUrl}" style="color:#9ca3af;">Unsubscribe</a></p>
            </div>`;
        };

        // Send individually (one recipient per email; avoids leaking the list).
        const results = await Promise.allSettled(
            subs.map(s => sendEmail({ to: s.email, subject, html: buildHtml(s.email) }))
        );
        const sent = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - sent;

        // If every send failed, surface it (likely RESEND_API_KEY not configured).
        if (sent === 0) {
            const reason = results[0]?.reason?.message || 'Email provider not configured.';
            return res.status(502).json({ error: `Could not send: ${reason}` });
        }

        await supabase.from('broadcasts').insert({
            creator_id: creatorId, subject, body, recipient_count: sent,
        });

        res.json({ sent, failed });
    } catch (err) {
        console.error('Broadcast error:', err);
        serverError(res, err);
    }
});

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = router;
