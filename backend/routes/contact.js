const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// POST /api/contact — fallback when Web3Forms is unavailable
router.post('/', async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ error: 'name, email, and message are required.' });
    }

    const { error } = await supabase.from('contact_submissions').insert({
        name,
        email,
        subject: subject || null,
        message,
    });

    if (error) {
        console.error('Contact fallback insert error:', error.message);
        return res.status(500).json({ error: 'Failed to save message. Please email us directly.' });
    }

    res.json({ success: true });
});

module.exports = router;
