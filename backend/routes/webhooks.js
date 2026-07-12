const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const supabase = require('../config/supabase');
const { sendEmail, getUserEmail, purchaseThankYou } = require('./../lib/email');
const { fireAutomation } = require('./../lib/webhookout');
const { fulfillGuestPurchase } = require('./../lib/guestFulfillment');

// ═══════════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK ENDPOINT
// ═══════════════════════════════════════════════════════════════════════════
router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log('\n📨 WEBHOOK RECEIVED:', new Date().toISOString());
    console.log('Headers:', req.headers['stripe-signature'] ? 'Has signature' : 'No signature');

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.log(`Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const paymentIntent = event.data.object;
            console.log(`\n✅ STRIPE WEBHOOK: PaymentIntent succeeded: ${paymentIntent.id}`);
            console.log(`💰 Amount: $${paymentIntent.amount / 100}`);

            // ── Guest purchase (no account at pay time — created at fulfilment) ──
            if (paymentIntent.metadata?.kind === 'skill_guest') {
                try { await fulfillGuestPurchase(paymentIntent); }
                catch (e) { console.error('❌ Guest fulfilment failed:', e.message); }
                break;
            }

            // ── v3 Skill purchase (instant digital goods, no escrow) ──
            if (paymentIntent.metadata?.kind === 'skill') {
                const { skill_id, buyer_id } = paymentIntent.metadata;
                console.log(`🧩 Skill purchase: skill ${skill_id} for buyer ${buyer_id}`);

                const { data: paid, error: skillErr } = await supabase
                    .from('purchases')
                    .update({ status: 'paid', stripe_payment_id: paymentIntent.id })
                    .eq('buyer_id', buyer_id).eq('skill_id', skill_id)
                    .neq('status', 'paid') // idempotency guard
                    .select('id');

                if (skillErr) {
                    console.error('❌ Failed to mark Skill purchase paid:', skillErr.message);
                } else if (!paid || paid.length === 0) {
                    console.warn(`⚠️ Skill purchase already paid or pending row missing (skill ${skill_id}, buyer ${buyer_id})`);
                } else {
                    const { data: skill } = await supabase
                        .from('skills').select('title, creator_id, confirmation_message').eq('id', skill_id).single();
                    // Notify the creator of the sale.
                    if (skill?.creator_id) {
                        await supabase.from('notifications').insert({
                            user_id: skill.creator_id,
                            type: 'skill_purchase',
                            title: 'New sale! 🎉',
                            message: `Someone just bought "${skill.title ?? 'your Skill'}".`,
                            related_id: skill_id, related_type: null,
                        });
                    }
                    // Count a promo-code redemption, if one was used.
                    const code = paymentIntent.metadata?.code;
                    if (code && skill?.creator_id) {
                        const { data: d } = await supabase.from('discounts')
                            .select('id, times_redeemed').eq('creator_id', skill.creator_id).ilike('code', code).maybeSingle();
                        if (d) await supabase.from('discounts').update({ times_redeemed: d.times_redeemed + 1 }).eq('id', d.id);
                    }
                    // Best-effort thank-you / receipt to the buyer.
                    try {
                        const email = await getUserEmail(buyer_id);
                        if (email) {
                            const { subject, html } = purchaseThankYou({
                                title: skill?.title ?? 'your purchase',
                                amountCents: paymentIntent.amount,
                                note: skill?.confirmation_message || '',
                                accessUrl: `${process.env.FRONTEND_URL}/locker/${skill_id}`,
                                accessLabel: 'Open in Locker',
                            });
                            await sendEmail({ to: email, subject, html });
                        }
                    } catch (e) { console.warn('receipt email failed:', e.message); }
                    // Outbound automation webhook (Zapier/Make/AutoDM).
                    if (skill?.creator_id) fireAutomation(skill.creator_id, 'sale', {
                        skill_id, title: skill.title, amount: paymentIntent.amount / 100, kind: 'onetime',
                    });
                    console.log(`✅ Skill purchase fulfilled (skill ${skill_id}, buyer ${buyer_id})`);
                }

                // ── Order bump: grant the add-on product that rode this payment ──
                const bumpSkillId = paymentIntent.metadata?.bump_skill_id;
                if (bumpSkillId) {
                    const { data: bumpPaid } = await supabase
                        .from('purchases')
                        .update({ status: 'paid', stripe_payment_id: paymentIntent.id })
                        .eq('buyer_id', buyer_id).eq('skill_id', bumpSkillId)
                        .neq('status', 'paid') // idempotency guard
                        .select('id');
                    if (bumpPaid?.length) {
                        const { data: bumpSkill } = await supabase
                            .from('skills').select('title, creator_id').eq('id', bumpSkillId).single();
                        if (bumpSkill?.creator_id) {
                            await supabase.from('notifications').insert({
                                user_id: bumpSkill.creator_id,
                                type: 'skill_purchase',
                                title: 'Order bump sold! 🎉',
                                message: `Your add-on "${bumpSkill.title ?? 'product'}" sold alongside another purchase.`,
                                related_id: bumpSkillId, related_type: null,
                            });
                        }
                        console.log(`✅ Order bump fulfilled (skill ${bumpSkillId}, buyer ${buyer_id})`);
                    }
                }
                break;
            }

            console.log(`📦 OrderId from metadata: ${paymentIntent.metadata?.orderId}`);

            if (!paymentIntent.metadata?.orderId) {
                console.log('⚠️ PaymentIntent missing orderId metadata');
                break;
            }

            const orderId = paymentIntent.metadata.orderId;
            console.log(`🔍 Updating order ${orderId} to escrowed...`);

            const { data: updated, error } = await supabase
                .from('gig_requests')
                .update({
                    payment_status: 'escrowed',
                    payment_amount: paymentIntent.amount / 100,
                    payment_intent_id: paymentIntent.id,
                    escrow_date: new Date().toISOString(),
                    status: 'accepted'
                })
                .eq('id', orderId)
                .neq('payment_status', 'escrowed') // idempotency guard
                .select('id');

            if (error) {
                console.error('❌ Failed to update order to escrowed:', error);
            } else if (!updated || updated.length === 0) {
                console.warn(`⚠️ RACE/MISSING: order ${orderId} not found or already escrowed — webhook may have arrived before order was created`);
            } else {
                console.log(`✅ Order ${orderId} escrowed. Amount: $${paymentIntent.amount / 100}`);
            }
            break;
        }

        case 'payment_intent.payment_failed':
        case 'payment_intent.canceled': {
            const failedIntent = event.data.object;
            const failedOrderId = failedIntent.metadata?.orderId;
            console.log(`⚠️ Payment ${event.type}: ${failedIntent.id}`);
            if (failedOrderId) {
                await supabase
                    .from('gig_requests')
                    .update({ payment_status: 'unpaid' })
                    .eq('id', failedOrderId)
                    .in('payment_status', ['unpaid', 'escrowed']); // only revert if not yet released/cleared
                console.log(`↩️ Order ${failedOrderId} reverted to unpaid`);
            }
            break;
        }


      case 'charge.dispute.created': {
        const dispute = event.data.object;
        console.log(`🚨 CHARGEBACK: dispute ${dispute.id} | pi: ${dispute.payment_intent} | $${dispute.amount / 100} | reason: ${dispute.reason}`);

        if (!dispute) {
            console.log('⚠️ Unable to fetch dispute information');
            break
        };



        const { data: order } = await supabase
            .from('gig_requests')
            .select('id, requester_id, provider_id')
            .eq('payment_intent_id', dispute.payment_intent)
            .single();

        if (order) {
            const { data: flagged } = await supabase
                .from('gig_requests')
                .update({ payment_status: 'chargebacked' })
                .eq('id', order.id)
                .neq('payment_status', 'chargebacked') // idempotency guard — Stripe may redeliver
                .select('id');

            if (!flagged || flagged.length === 0) {
                console.log(`⚠️ dispute ${dispute.id} already recorded for order ${order.id} — skipping duplicate notifications`);
                break;
            }

            const {data: adminProfile} = await supabase
                .from('profiles')
                .select('id')
                .eq('email', process.env.ADMIN_EMAIL)
                .single();

            if (!adminProfile) {
                console.error('⚠️ ADMIN_EMAIL not found in profiles — skipping admin notification');
            }

            const createdNotifications = [
                {
                    user_id: order.requester_id,
                    type: 'chargeback',
                    title: 'Chargeback opened',
                    message: `A chargeback was filed on order ${order.id}. Our team is reviewing it.`,
                    related_id: order.id,
                    related_type: 'gig',
                },
                {
                    user_id: order.provider_id,
                    type: 'chargeback',
                    title: 'Chargeback opened on your order',
                    message: `A chargeback was filed against order ${order.id}. Funds are frozen pending review.`,
                    related_id: order.id,
                    related_type: 'gig',
                },
            ];
            if (adminProfile) {
                createdNotifications.unshift({
                    user_id: adminProfile.id,
                    type: 'chargeback',
                    title: 'Chargeback received',
                    message: `Order ${order.id} has been chargebacked. Reason: ${dispute.reason}`,
                    related_id: order.id,
                    related_type: 'gig',
                });
            }
            await supabase.from('notifications').insert(createdNotifications);
        }

        // ── v3 skill purchase (storefront sale) — notify creator + admin ──
        // Additive only: no money moved, no purchase-status change (flipping
        // status would alter buyer access / RLS — out of scope). Idempotency:
        // no flag column on purchases, so we gate on an existing-notification
        // check keyed by the purchase id (Stripe may redeliver this event).
        if (!order) {
            const { data: purchase } = await supabase
                .from('purchases')
                .select('id, buyer_id, skill_id, skill:skills(title, creator_id)')
                .eq('stripe_payment_id', dispute.payment_intent)
                .maybeSingle();

            if (purchase?.skill?.creator_id) {
                const { data: already } = await supabase
                    .from('notifications')
                    .select('id')
                    .eq('type', 'chargeback')
                    .eq('related_id', purchase.id)
                    .eq('title', 'Chargeback opened on your sale')
                    .maybeSingle();
                if (already) {
                    console.log(`⚠️ dispute ${dispute.id} already notified for purchase ${purchase.id} — skipping`);
                    break;
                }

                const { data: adminProfile } = await supabase
                    .from('profiles').select('id').eq('email', process.env.ADMIN_EMAIL).single();

                const skillNotifications = [{
                    user_id: purchase.skill.creator_id,
                    type: 'chargeback',
                    title: 'Chargeback opened on your sale',
                    message: `A buyer filed a chargeback on "${purchase.skill.title ?? 'your product'}". Stripe will ask for evidence — check your email/dashboard. Reason: ${dispute.reason}.`,
                    related_id: purchase.id,
                    related_type: null,
                }];
                if (adminProfile) {
                    skillNotifications.push({
                        user_id: adminProfile.id,
                        type: 'chargeback',
                        title: 'Chargeback on a skill sale',
                        message: `Purchase ${purchase.id} ("${purchase.skill.title ?? '?'}") chargebacked. Reason: ${dispute.reason}.`,
                        related_id: purchase.id,
                        related_type: null,
                    });
                }
                await supabase.from('notifications').insert(skillNotifications);
                console.log(`🚨 skill-sale chargeback recorded for purchase ${purchase.id}`);
            }
        }

        break;
    }

        case 'charge.dispute.closed': {
            const dispute = event.data.object;
            console.log(`⚖️ DISPUTE CLOSED: ${dispute.id} | outcome: ${dispute.status} | pi: ${dispute.payment_intent}`);

            if (!dispute){
                console.log('⚠️ Unable to fetch dispute metadata');
                break;
            }

            const {data: order} = await supabase
                .from('gig_requests')
                .select('id, requester_id, provider_id')
                .eq('payment_intent_id', dispute.payment_intent)
                .single()

            if (!order) {
                // ── v3 skill purchase — tell the creator the outcome. Additive
                // only; idempotency via existing-notification check (title is
                // outcome-specific so won/lost each fire once).
                const { data: purchase } = await supabase
                    .from('purchases')
                    .select('id, skill:skills(title, creator_id)')
                    .eq('stripe_payment_id', dispute.payment_intent)
                    .maybeSingle();
                if (purchase?.skill?.creator_id && ['won', 'lost'].includes(dispute.status)) {
                    const won = dispute.status === 'won';
                    const title = won ? 'Chargeback resolved in your favor' : 'Chargeback lost';
                    const { data: already } = await supabase
                        .from('notifications')
                        .select('id')
                        .eq('type', 'chargeback')
                        .eq('related_id', purchase.id)
                        .eq('title', title)
                        .maybeSingle();
                    if (!already) {
                        await supabase.from('notifications').insert({
                            user_id: purchase.skill.creator_id,
                            type: 'chargeback',
                            title,
                            message: won
                                ? `The chargeback on "${purchase.skill.title ?? 'your product'}" was resolved in your favor.`
                                : `The chargeback on "${purchase.skill.title ?? 'your product'}" was lost — the buyer's bank reversed the payment.`,
                            related_id: purchase.id,
                            related_type: null,
                        });
                        console.log(`⚖️ skill-sale dispute ${dispute.id} closed (${dispute.status}) — creator notified`);
                    }
                } else {
                    console.log('⚠️ Unable to fetch order metadata');
                }
                break;
            }

            const { data: adminProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', process.env.ADMIN_EMAIL)
                .single();

            if (!adminProfile) {
                console.error('⚠️ ADMIN_EMAIL not found in profiles — skipping admin notification');
            }

            if (dispute.status === 'won') {
                const { data: settled } = await supabase
                    .from('gig_requests')
                    .update({ payment_status: 'chargeback_won' })
                    .eq('id', order.id)
                    .neq('payment_status', 'chargeback_won') // idempotency guard — Stripe may redeliver
                    .select('id');
                if (!settled || settled.length === 0) {
                    console.log(`⚠️ dispute ${dispute.id} (won) already recorded — skipping duplicate notifications`);
                    break;
                }

                const wonNotifications = [
                    {
                        user_id: order.requester_id,
                        type: 'chargeback',
                        title: 'Chargeback denied',
                        message: `Your chargeback on order ${order.id} was denied.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                    {
                        user_id: order.provider_id,
                        type: 'chargeback',
                        title: 'Chargeback resolved in your favor',
                        message: `The chargeback on order ${order.id} was resolved in your favor.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                ];
                if (adminProfile) wonNotifications.unshift({
                    user_id: adminProfile.id,
                    type: 'chargeback',
                    title: 'Dispute won',
                    message: `Dispute ${dispute.id} resolved in our favor. Order ${order.id}.`,
                    related_id: order.id,
                    related_type: 'gig',
                });
                await supabase.from('notifications').insert(wonNotifications);

            } else if (dispute.status === 'lost') {
                const { data: settled } = await supabase
                    .from('gig_requests')
                    .update({ payment_status: 'chargeback_lost' })
                    .eq('id', order.id)
                    .neq('payment_status', 'chargeback_lost') // idempotency guard — Stripe may redeliver
                    .select('id');
                if (!settled || settled.length === 0) {
                    console.log(`⚠️ dispute ${dispute.id} (lost) already recorded — skipping duplicate notifications`);
                    break;
                }

                const lostNotifications = [
                    {
                        user_id: order.requester_id,
                        type: 'chargeback',
                        title: 'Chargeback approved',
                        message: `Your chargeback on order ${order.id} was approved.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                    {
                        user_id: order.provider_id,
                        type: 'chargeback',
                        title: 'Chargeback lost',
                        message: `The chargeback on order ${order.id} was lost. Funds returned to buyer.`,
                        related_id: order.id,
                        related_type: 'gig',
                    },
                ];
                if (adminProfile) lostNotifications.unshift({
                    user_id: adminProfile.id,
                    type: 'chargeback',
                    title: 'Dispute lost',
                    message: `Dispute ${dispute.id} lost. Order ${order.id} refunded to buyer.`,
                    related_id: order.id,
                    related_type: 'gig',
                });
                await supabase.from('notifications').insert(lostNotifications);

            } else if (dispute.status === 'warning_closed') {
                console.log(`⚠️ Dispute ${dispute.id} warning_closed — no action needed`);
            }

            break;
            
            



        }

        

        // ── Subscription starts: platform paywall OR creator membership ──
        case 'checkout.session.completed': {
            const session = event.data.object;
            if (session.mode !== 'subscription') break;

            // ── PLATFORM SUB (creator → SkillJoy, no Connect) ──
            // Kept strictly apart from skill_sub below via the metadata kind.
            if (session.metadata?.kind === 'platform_sub') {
                const userId = session.metadata.user_id;
                if (!userId) { console.warn('platform_sub session missing user_id'); break; }
                console.log(`💳 Platform subscription started: user ${userId}, sub ${session.subscription}`);

                // Pull the authoritative status/trial dates from the subscription.
                let status = 'trialing', trialEndsAt = null, periodEnd = null;
                try {
                    const sub = await stripe.subscriptions.retrieve(session.subscription);
                    status = sub.status;
                    trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
                    periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
                } catch (e) { console.warn('platform_sub retrieve failed, defaulting to trialing:', e.message); }

                // Upsert = naturally idempotent on Stripe redelivery.
                const { error } = await supabase.from('platform_subscriptions').upsert({
                    user_id: userId,
                    stripe_customer_id: session.customer,
                    stripe_subscription_id: session.subscription,
                    status, trial_ends_at: trialEndsAt, current_period_end: periodEnd,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'user_id' });
                if (error) console.error('❌ platform_sub upsert failed:', error.message);
                else console.log(`✅ Platform sub recorded (user ${userId}, status ${status})`);
                break;
            }

            // ── v3 Membership (fan → creator via Connect) ──
            if (session.metadata?.kind !== 'skill_sub') break;
            const { skill_id, buyer_id } = session.metadata;
            console.log(`🔁 Membership started: skill ${skill_id}, buyer ${buyer_id}`);

            const { data: granted, error } = await supabase
                .from('purchases')
                .update({ status: 'paid', stripe_subscription_id: session.subscription })
                .eq('buyer_id', buyer_id).eq('skill_id', skill_id).neq('status', 'paid')
                .select('id');
            if (error) { console.error('❌ Membership grant failed:', error.message); break; }
            // Idempotency: only run side-effects on the first grant (Stripe may redeliver).
            if (!granted || granted.length === 0) { console.log('membership already granted — skipping side-effects'); break; }

            const { data: skill } = await supabase
                .from('skills').select('title, creator_id').eq('id', skill_id).single();
            if (skill?.creator_id) {
                await supabase.from('notifications').insert({
                    user_id: skill.creator_id,
                    type: 'skill_purchase',
                    title: 'New member! 🎉',
                    message: `Someone just subscribed to "${skill.title ?? 'your Skill'}".`,
                    related_id: skill_id, related_type: null,
                });
                fireAutomation(skill.creator_id, 'sale', { skill_id, title: skill.title, kind: 'membership' });

                // Patreon-style: fold the new member's (already-verified) account
                // email into the creator's subscriber list — same capture as the
                // lead-magnet flow. No opt-in email; the login email is trusted.
                try {
                    const memberEmail = session.customer_details?.email || await getUserEmail(buyer_id);
                    if (memberEmail) {
                        await supabase.from('subscribers').upsert(
                            { creator_id: skill.creator_id, email: memberEmail, source: 'membership' },
                            { onConflict: 'creator_id,email', ignoreDuplicates: true }
                        );
                    }
                } catch (e) { console.warn('membership subscribe failed:', e.message); }

                // Thank-you / confirmation email to the new member (was missing).
                try {
                    const memberEmail = session.customer_details?.email || session.customer_email || await getUserEmail(buyer_id);
                    if (memberEmail) {
                        const { subject, html } = purchaseThankYou({
                            title: skill.title ?? 'your membership',
                            amountCents: session.amount_total ?? null,
                            recurring: true,
                            accessUrl: `${process.env.FRONTEND_URL}/locker/${skill_id}`,
                            accessLabel: 'Open your membership',
                        });
                        await sendEmail({ to: memberEmail, subject, html });
                    }
                } catch (e) { console.warn('membership receipt failed:', e.message); }
            }
            break;
        }

        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const sub = event.data.object;

            // ── PLATFORM SUB lifecycle (creator → SkillJoy) ──
            if (sub.metadata?.kind === 'platform_sub') {
                const status = event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status;
                const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
                const trialEndsAt = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
                console.log(`💳 Platform sub ${sub.id} → ${status}`);
                // Same-value update = idempotent on redelivery. A lapse
                // (canceled/unpaid/past_due) darkens the storefront via the
                // skills RLS gate — no cron, no extra write needed.
                const { error } = await supabase
                    .from('platform_subscriptions')
                    .update({ status, current_period_end: periodEnd, trial_ends_at: trialEndsAt, updated_at: new Date().toISOString() })
                    .eq('stripe_subscription_id', sub.id);
                if (error) console.error('❌ platform_sub status update failed:', error.message);
                break;
            }

            // ── v3 Membership (fan → creator) ──
            if (sub.metadata?.kind !== 'skill_sub') break;
            // active/trialing → access on; anything else → access off.
            const active = ['active', 'trialing'].includes(sub.status);
            const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
            console.log(`🔁 Subscription ${sub.id} → ${sub.status} (access ${active ? 'on' : 'off'})`);
            await supabase
                .from('purchases')
                .update({ status: active ? 'paid' : 'expired', current_period_end: periodEnd })
                .eq('stripe_subscription_id', sub.id);
            break;
        }

        // ── PLATFORM SUB dunning: card failed on a SkillJoy invoice ──
        case 'invoice.payment_failed': {
            const invoice = event.data.object;
            const subId = invoice.subscription;
            if (!subId) break;

            // Discriminator: only platform subs have a row keyed by this sub id
            // (memberships store their sub id on `purchases`) — a skill_sub
            // invoice matches nothing and falls through untouched.
            const { data: rows } = await supabase
                .from('platform_subscriptions')
                .select('user_id, last_dunned_invoice_id')
                .eq('stripe_subscription_id', subId);
            if (!rows || rows.length === 0) break; // not a platform sub

            const userId = rows[0].user_id;
            // Idempotency is keyed on the INVOICE, not the status field: a
            // concurrent customer.subscription.updated may set past_due first,
            // so gating on status would swallow the dunning email. Set past_due
            // + claim this invoice unconditionally; only notify if we hadn't
            // already dunned THIS invoice (i.e. not a Stripe redelivery).
            const alreadyDunned = rows[0].last_dunned_invoice_id === invoice.id;
            await supabase
                .from('platform_subscriptions')
                .update({ status: 'past_due', last_dunned_invoice_id: invoice.id, updated_at: new Date().toISOString() })
                .eq('stripe_subscription_id', subId);
            if (alreadyDunned) break;

            console.log(`⚠️ Platform sub payment failed: user ${userId}, sub ${subId}, invoice ${invoice.id}`);

            await supabase.from('notifications').insert({
                user_id: userId, type: 'order_update',
                title: 'Payment failed — storefront paused',
                message: 'Your SkillJoy subscription payment didn’t go through. Update your card to bring your storefront back online.',
                related_type: null,
            });

            try {
                const email = await getUserEmail(userId);
                if (email) {
                    await sendEmail({
                        to: email,
                        subject: 'Action needed: your SkillJoy payment failed',
                        html: `
                            <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
                                <h2>Your storefront is paused</h2>
                                <p>We couldn’t charge your card for your SkillJoy subscription, so your
                                storefront is hidden from the public until it’s sorted. Your products,
                                customizations, and your buyers’ access are all safe.</p>
                                <p><a href="${process.env.FRONTEND_URL}/dashboard"
                                      style="display:inline-block;padding:12px 20px;background:#00CC99;color:#fff;border-radius:8px;text-decoration:none">
                                    Update payment method</a></p>
                                <p style="color:#888;font-size:13px">Stripe will retry automatically —
                                updating your card usually fixes it right away.</p>
                            </div>`,
                    });
                }
            } catch (e) { console.warn('dunning email failed:', e.message); }
            break;
        }

        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
});

// Simple GET test endpoint
router.get('/stripe', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/stripe/test', (req, res) => {
    console.log('\n✅ GET /webhooks/stripe/test HIT!');
    res.json({ status: 'webhook route working', timestamp: new Date().toISOString() });
});

module.exports = router;
