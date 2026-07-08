const supabase = require('../config/supabase');
const { sendEmail, purchaseThankYou } = require('./email');

// ═══════════════════════════════════════════════════════════════════════════
// GUEST FULFILMENT — turn a succeeded guest PaymentIntent into a real purchase.
//
// Guests check out with just name + email + card. On the FIRST successful
// payment we create-or-find a passwordless Supabase account for that email, then
// the purchase flows through the normal buyer_id system (Locker, order bumps,
// receipts — all reused). We email them a magic link so they can access it
// on-site without ever setting a password. Idempotent: safe to run from both the
// webhook and the /confirm fallback (they race).
// ═══════════════════════════════════════════════════════════════════════════

// Find an existing buyer by email, else create a passwordless auth user + a
// profile row (the FK target for purchases.buyer_id).
async function findOrCreateBuyer(email, name) {
    const clean = (email || '').trim().toLowerCase();

    // Fast path: a profile already carries this email.
    const { data: existing } = await supabase
        .from('profiles').select('id').eq('email', clean).maybeSingle();
    if (existing?.id) return existing.id;

    // Create the auth user (email pre-confirmed so the magic link works).
    const { data: created, error } = await supabase.auth.admin.createUser({
        email: clean, email_confirm: true, user_metadata: { full_name: name || '' },
    });
    let userId = created?.user?.id;
    if (!userId) {
        // Already in auth but without a profile row — recover the id via a link gen.
        const { data: link } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: clean });
        userId = link?.user?.id;
        if (!userId) throw (error || new Error('Could not resolve a buyer account.'));
    }

    // Ensure a profile row exists (won't clobber an existing one).
    await supabase.from('profiles').upsert(
        { id: userId, email: clean, full_name: name || '' },
        { onConflict: 'id', ignoreDuplicates: true },
    );
    return userId;
}

// Fulfil a guest one-time purchase from a succeeded PaymentIntent.
async function fulfillGuestPurchase(pi) {
    const m = pi.metadata || {};
    if (m.kind !== 'skill_guest') return;

    const skillId = m.skill_id;
    const email = m.guest_email;
    const name = m.guest_name || '';
    if (!skillId || !email) { console.warn('guest fulfil: missing skill_id/email'); return; }

    const buyerId = await findOrCreateBuyer(email, name);

    const { data: skill } = await supabase.from('skills')
        .select('title, creator_id, version, confirmation_message').eq('id', skillId).single();

    const bumpAmount = parseInt(m.bump_amount || '0', 10) || 0;
    const mainAmount = Math.max(0, pi.amount - bumpAmount);

    // Grant the main product — atomic once-only so side-effects (receipt,
    // notifications, redemption) fire exactly once even when the webhook and
    // /confirm race, or Stripe redelivers. First flip any non-paid row to paid;
    // if none, insert. A duplicate insert means another call won → skip.
    const paidRow = {
        buyer_id: buyerId, skill_id: skillId, version_at_purchase: skill?.version ?? 1,
        amount_cents: mainAmount, stripe_payment_id: pi.id, status: 'paid',
    };
    const { data: flipped } = await supabase.from('purchases')
        .update({ status: 'paid', stripe_payment_id: pi.id, amount_cents: mainAmount, version_at_purchase: paidRow.version_at_purchase })
        .eq('buyer_id', buyerId).eq('skill_id', skillId).neq('status', 'paid')
        .select('id');
    if (!flipped || flipped.length === 0) {
        const { error: insErr } = await supabase.from('purchases').insert(paidRow);
        if (insErr) {
            if (/duplicate|unique|23505/i.test(insErr.message)) { console.log(`guest fulfil: already fulfilled (${email})`); return; }
            throw insErr;
        }
    }

    // Grant the order bump, if one rode this payment.
    if (m.bump_skill_id) {
        const { data: bumpSkill } = await supabase.from('skills')
            .select('title, creator_id, version').eq('id', m.bump_skill_id).single();
        await supabase.from('purchases').upsert({
            buyer_id: buyerId, skill_id: m.bump_skill_id, version_at_purchase: bumpSkill?.version ?? 1,
            amount_cents: bumpAmount, stripe_payment_id: pi.id, status: 'paid',
        }, { onConflict: 'buyer_id,skill_id' });
        if (bumpSkill?.creator_id) {
            await supabase.from('notifications').insert({
                user_id: bumpSkill.creator_id, type: 'skill_purchase',
                title: 'Order bump sold! 🎉',
                message: `Your add-on "${bumpSkill.title ?? 'product'}" sold alongside another purchase.`,
                related_id: m.bump_skill_id, related_type: null,
            });
        }
    }

    // Count a promo-code redemption, if one was used.
    if (m.code && skill?.creator_id) {
        const { data: d } = await supabase.from('discounts')
            .select('id, times_redeemed').eq('creator_id', skill.creator_id).ilike('code', m.code).maybeSingle();
        if (d) await supabase.from('discounts').update({ times_redeemed: d.times_redeemed + 1 }).eq('id', d.id);
    }

    // Notify the creator of the sale.
    if (skill?.creator_id) {
        await supabase.from('notifications').insert({
            user_id: skill.creator_id, type: 'skill_purchase',
            title: 'New sale! 🎉',
            message: `Someone just bought "${skill.title ?? 'your Skill'}".`,
            related_id: skillId, related_type: null,
        });
    }

    // Email the guest their receipt + a magic link (passwordless access to the Locker).
    try {
        const { data: link } = await supabase.auth.admin.generateLink({
            type: 'magiclink', email,
            options: { redirectTo: `${process.env.FRONTEND_URL}/locker/${skillId}` },
        });
        const accessUrl = link?.properties?.action_link || `${process.env.FRONTEND_URL}/login`;
        const { subject, html } = purchaseThankYou({
            title: skill?.title ?? 'your purchase',
            amountCents: pi.amount,
            note: skill?.confirmation_message || '',
            accessUrl, // magic link — signs the guest in, no password
            accessLabel: 'Access your purchase',
            footerNote: 'This link signs you in — no password needed. You can add a password or sign in with Google any time using this email.',
        });
        await sendEmail({ to: email, subject, html });
    } catch (e) { console.warn('guest receipt/magic-link failed:', e.message); }

    console.log(`✅ Guest purchase fulfilled (skill ${skillId}, ${email})`);
}

module.exports = { fulfillGuestPurchase, findOrCreateBuyer };
