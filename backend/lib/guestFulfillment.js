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
    // `created` is a SECURITY signal, not a statistic — see signInTokenFor below.
    if (existing?.id) return { id: existing.id, created: false };

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

    // ignoreDuplicates above drops the name whenever a row already exists — and
    // a trigger creates one the instant the auth user is made, so that was every
    // new guest. Backfill it, but ONLY when empty: a returning buyer who has
    // since set their own name must not have it overwritten by a checkout form.
    if (name) {
        await supabase.from('profiles')
            .update({ full_name: name })
            .eq('id', userId)
            .or('full_name.is.null,full_name.eq.');
    }
    return { id: userId, created: true };
}

/**
 * A one-time token that signs the buyer straight in, or null.
 *
 * ── Why this is gated ──
 *
 * Handing back a session for whatever email was typed is an account-takeover
 * primitive: pay $1 with victim@example.com and you are signed in as them.
 * Payment proves someone paid. It does not prove they own the inbox.
 *
 * So a session is only ever issued when THIS transaction created the account.
 * A brand-new shadow account contains exactly one thing — the product just
 * bought — so there is nothing to steal. An account that already existed may
 * hold other purchases, a storefront, payout details; that buyer gets the
 * emailed link instead, which proves inbox ownership before granting anything.
 *
 * The token is a hashed OTP, single-use, and exchanged client-side via
 * verifyOtp. It is only returned alongside a Stripe PaymentIntent this server
 * has already confirmed as succeeded (or a verified-free product).
 */
async function signInTokenFor(email, created) {
    if (!created) return null;
    try {
        const { data } = await supabase.auth.admin.generateLink({
            type: 'magiclink', email: (email || '').trim().toLowerCase(),
        });
        return data?.properties?.hashed_token || null;
    } catch (e) {
        // Never fail a paid purchase over a convenience. They still own it, and
        // the receipt email still carries a working link.
        console.warn('sign-in token failed:', e.message);
        return null;
    }
}

// Fulfil a guest one-time purchase from a succeeded PaymentIntent.
async function fulfillGuestPurchase(pi) {
    const m = pi.metadata || {};
    if (m.kind !== 'skill_guest') return { signInToken: null };

    const skillId = m.skill_id;
    const email = m.guest_email;
    const name = m.guest_name || '';
    if (!skillId || !email) { console.warn('guest fulfil: missing skill_id/email'); return { signInToken: null }; }

    const { id: buyerId, created } = await findOrCreateBuyer(email, name);

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
            if (/duplicate|unique|23505/i.test(insErr.message)) {
                console.log(`guest fulfil: already fulfilled (${email})`);
                return { buyerId, signInToken: await signInTokenFor(email, created) };
            }
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

    return { buyerId, signInToken: await signInTokenFor(email, created) };
}

/**
 * Grant a FREE one-time product to an email, with no account and no payment.
 *
 * Deliberately mirrors fulfillGuestPurchase: same buyer resolution, same
 * purchases row, same magic-link email. The only differences are that there is
 * no PaymentIntent to verify and amount_cents is 0.
 *
 * The CALLER must have verified the product is actually free — this function
 * trusts its input, exactly as fulfillGuestPurchase trusts a succeeded Stripe
 * PaymentIntent. Keeping that check at the route boundary means there is one
 * place to audit rather than two.
 *
 * Idempotent. Someone who claims the same lead magnet twice — a second device,
 * a lost email, a double-tap — must get another copy of the link, not an error
 * and not a duplicate row.
 */
async function fulfillFreeClaim({ skill, email, name }) {
    const clean = (email || '').trim().toLowerCase();
    const { id: buyerId, created } = await findOrCreateBuyer(clean, name);

    const row = {
        buyer_id: buyerId, skill_id: skill.id,
        version_at_purchase: skill.version ?? 1,
        amount_cents: 0, status: 'paid',
    };

    // Same once-only dance as the paid path: flip a non-paid row if one exists,
    // else insert, and treat a duplicate as "someone else already granted it".
    const { data: flipped } = await supabase.from('purchases')
        .update({ status: 'paid', amount_cents: 0, version_at_purchase: row.version_at_purchase })
        .eq('buyer_id', buyerId).eq('skill_id', skill.id).neq('status', 'paid')
        .select('id');
    if (!flipped || flipped.length === 0) {
        const { error } = await supabase.from('purchases').insert(row);
        // A duplicate here means they already have it. Fall through to the email
        // anyway — a repeat claim is usually someone who lost the first link.
        if (error && !/duplicate|unique|23505/i.test(error.message)) throw error;
    }

    // Magic link straight to the product, so "no account" stays true on the way
    // back in as well as on the way through.
    let actionUrl = `${process.env.FRONTEND_URL}/locker/${skill.id}`;
    try {
        const { data: link } = await supabase.auth.admin.generateLink({
            type: 'magiclink', email: clean,
            options: { redirectTo: `${process.env.FRONTEND_URL}/locker/${skill.id}` },
        });
        if (link?.properties?.action_link) actionUrl = link.properties.action_link;
    } catch (e) {
        // A failed link generation must not lose the grant — they still own the
        // product, they just get the plain URL and a normal sign-in.
        console.warn('free claim: magic link failed, sending plain URL:', e.message);
    }

    try {
        const { subject, html } = purchaseThankYou({
            buyerName: name || '', skillTitle: skill.title,
            actionUrl, confirmationMessage: skill.confirmation_message || '',
        });
        await sendEmail({ to: clean, subject, html });
    } catch (e) {
        // Same reasoning: the grant is the product, the email is the delivery.
        // Losing delivery is bad; losing the grant would be worse.
        console.warn('free claim: email failed:', e.message);
    }

    return { buyerId, signInToken: await signInTokenFor(clean, created) };
}

module.exports = { fulfillGuestPurchase, fulfillFreeClaim, findOrCreateBuyer, signInTokenFor };
