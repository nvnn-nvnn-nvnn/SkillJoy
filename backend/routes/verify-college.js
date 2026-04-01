const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const supabase = require('../config/supabase');
const { sendEmail } = require('../lib/email');

// POST /api/verify-college/send
// Sends a verification email to the provided .edu address
router.post('/send', async (req, res) => {
    const { collegeEmail } = req.body;

    if (!collegeEmail) return res.status(400).json({ error: 'College email is required.' });
    if (!collegeEmail.toLowerCase().endsWith('.edu')) {
        return res.status(400).json({ error: 'Must be a valid .edu email address.' });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    const { error } = await supabase.from('profiles').update({
        college_email: collegeEmail.toLowerCase(),
        college_verify_token: token,
        college_verify_expires_at: expiresAt,
        college_verified: false,
    }).eq('id', req.user.id);

    if (error) return res.status(500).json({ error: error.message });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-college?token=${token}`;

    await sendEmail({
        to: collegeEmail,
        subject: 'Verify your college email — SkillJoy',
        html: `
            <p>Hi there,</p>
            <p>Click the button below to verify your university email and connect with students at your school.</p>
            <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#ec9146;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
                Verify College Email
            </a>
            <p style="color:#6b7280;font-size:13px;">This link expires in 24 hours. If you didn't request this, ignore this email.</p>
            <p style="color:#6b7280;font-size:13px;">SkillJoy — the student skill marketplace</p>
        `,
    });

    res.json({ success: true });
});

// POST /api/verify-college/confirm
// Confirms the token, marks college as verified
router.post('/confirm', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required.' });

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, college_email, college_verify_token, college_verify_expires_at, college_verified')
        .eq('college_verify_token', token)
        .single();

    if (error || !profile) return res.status(404).json({ error: 'Invalid or expired verification link.' });
    if (profile.college_verified) return res.json({ success: true, alreadyVerified: true });
    if (new Date(profile.college_verify_expires_at) < new Date()) {
        return res.status(410).json({ error: 'Verification link has expired. Please request a new one.' });
    }

    const universityDomain = profile.college_email.split('@')[1].toLowerCase();

    const { error: updateError } = await supabase.from('profiles').update({
        college_verified: true,
        university_domain: universityDomain,
        college_verify_token: null,
        college_verify_expires_at: null,
    }).eq('id', profile.id);

    if (updateError) return res.status(500).json({ error: updateError.message });

    res.json({ success: true, universityDomain });
});

module.exports = router;
