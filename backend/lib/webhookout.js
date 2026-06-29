const supabase = require('../config/supabase');

// ── Outbound automation webhook (v3, Phase 11) ──────────────────────────────
// Fire-and-forget POST to the creator's configured automation_webhook_url so
// they can wire Zapier / Make / AutoDM tools to events (e.g. new sale).
async function fireAutomation(creatorId, event, data) {
    try {
        const { data: p } = await supabase
            .from('profiles').select('automation_webhook_url').eq('id', creatorId).single();
        const url = p?.automation_webhook_url;
        if (!url) return;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, data, sent_at: new Date().toISOString() }),
        });
        console.log(`🔗 Automation webhook fired (${event}) for creator ${creatorId}`);
    } catch (e) {
        console.warn('Automation webhook failed:', e.message);
    }
}

module.exports = { fireAutomation };
