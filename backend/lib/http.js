// Generic 500 responder: logs the real error server-side, but never leaks the
// internal message (DB/Stripe/stack details) to the client. Intentional 4xx
// responses keep their own friendly messages — only unexpected 500s use this.
function serverError(res, err) {
    console.error('[500]:', err?.message || err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

module.exports = { serverError };
