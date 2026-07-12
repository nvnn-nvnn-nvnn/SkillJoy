const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const supabase = require('../config/supabase');

const GIG_REASONS     = ['Spam or misleading', 'Inappropriate content', 'Scam or fraud', 'Copyright violation', 'Other'];
const USER_REASONS    = ['Harassment', 'Spam or misleading', 'Fake profile', 'Scam or fraud', 'Inappropriate behavior', 'Other'];
const COMMENT_REASONS = ['Spam or misleading', 'Harassment', 'Hate speech', 'Inappropriate content', 'Illegal activity', 'Other'];
// v3 products ("skills") — the storefront moderation surface.
const SKILL_REASONS   = ['Scam or fraud', 'Stolen or pirated content', 'Sexual or explicit content', 'Illegal activity', 'Spam or misleading', 'Other'];

const REASONS_BY_TYPE = { gig: GIG_REASONS, user: USER_REASONS, comment: COMMENT_REASONS, skill: SKILL_REASONS };

// POST /api/reports
router.post('/', async (req, res) => {
    try {
        const { reportedType, reportedId, reason, description } = req.body;
        const reporterId = req.user.id;

        if (!reportedType || !reportedId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!['gig', 'user', 'comment', 'skill'].includes(reportedType)) {
            return res.status(400).json({ error: 'Invalid report type' });
        }

        const validReasons = REASONS_BY_TYPE[reportedType];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ error: 'Invalid reason' });
        }

        if (description && description.length > 1000) {
            return res.status(400).json({ error: 'Description too long (max 1000 chars)' });
        }

        if (reportedType === 'user' && reportedId === reporterId) {
            return res.status(400).json({ error: 'Cannot report yourself' });
        }

        if (reportedType === 'gig') {
            const { data: gig } = await supabase.from('gigs').select('user_id').eq('id', reportedId).single();
            if (!gig) return res.status(404).json({ error: 'Gig not found' });
            if (gig.user_id === reporterId) return res.status(400).json({ error: 'Cannot report your own gig' });
        }

        if (reportedType === 'skill') {
            const { data: skill } = await supabase.from('skills').select('creator_id').eq('id', reportedId).single();
            if (!skill) return res.status(404).json({ error: 'Product not found' });
            if (skill.creator_id === reporterId) return res.status(400).json({ error: 'Cannot report your own product' });
        }

        if (reportedType === 'comment') {
            const { data: comment } = await supabase.from('comments').select('author_id').eq('id', reportedId).single();
            if (!comment) return res.status(404).json({ error: 'Comment not found' });
            if (comment.author_id === reporterId) return res.status(400).json({ error: 'Cannot report your own comment' });
        }

        // Prevent duplicate reports within 24 hours
        const { data: existing } = await supabase
            .from('reports')
            .select('id')
            .eq('reporter_id', reporterId)
            .eq('reported_type', reportedType)
            .eq('reported_id', reportedId)
            .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: 'You already reported this recently' });
        }

        const { error } = await supabase.from('reports').insert({
            reporter_id: reporterId,
            reported_type: reportedType,
            reported_id: reportedId,
            reason,
            description: description?.trim() || null,
        });

        if (error) return serverError(res, error);

        res.json({ success: true });
    } catch (err) {
        console.error('Report submit error:', err);
        serverError(res, err);
    }
});

module.exports = router;
