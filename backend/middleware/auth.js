const supabase = require('../config/supabase');

module.exports = async function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        console.error('Auth error:', error?.message, '| SUPABASE_URL set:', !!process.env.SUPABASE_URL, '| SERVICE_KEY set:', !!process.env.SUPABASE_SERVICE_KEY);
        return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    next();
};
