const crypto = require('crypto');

// Signed unsubscribe token so links can't be forged/enumerated.
const SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_KEY || 'dev-secret';

function unsubToken(creatorId, email) {
    return crypto.createHmac('sha256', SECRET)
        .update(`${creatorId}:${(email || '').toLowerCase()}`)
        .digest('hex').slice(0, 32);
}

module.exports = { unsubToken };
