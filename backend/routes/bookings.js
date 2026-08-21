const express = require('express');
const router = express.Router();
const { serverError } = require('../lib/http');
const supabase = require('../config/supabase');
const { sendEmail, getUserEmail, templates } = require('../lib/email');
const { buildBookingIcs, bookingUid } = require('../lib/ics');

// ═══════════════════════════════════════════════════════════════════════════
// v3 NATIVE BOOKINGS — book / reschedule / cancel, with calendar invites.
//
// WHY THIS MOVED SERVER-SIDE
// Booking rows used to be inserted straight from the browser with supabase-js,
// leaning on RLS for safety. RLS is genuinely good here (it proves the caller
// paid), but it can only answer "may this row exist?" — it can't answer the
// two questions that actually matter for scheduling:
//
//   1. Is this slot one the host actually offers?  RLS sees a timestamp, not a
//      weekly availability rule. A crafted insert could book 3am Sunday.
//   2. Who tells the other party?  Emails need the Resend key, which must never
//      reach the browser, and the .ics invite has to be built somewhere trusted.
//
// So the route is the writer, and it runs on the service-role client — meaning
// RLS is BYPASSED here and every check below is load-bearing, not decorative.
// The RLS policies stay in place for the read path the UI still uses directly.
// ═══════════════════════════════════════════════════════════════════════════

const { slotProblem } = require('../lib/slots');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:5173';

// Everything the notification + email + invite layer needs, in one read.
async function loadContext(bookingId) {
    const { data: booking, error } = await supabase
        .from('bookings')
        .select(`id, skill_id, block_id, creator_id, buyer_id, start_time, end_time, status,
                 meeting_url, buyer_timezone, reschedule_count,
                 skill:skills(title),
                 creator:profiles!bookings_creator_id_fkey(full_name, booking_timezone),
                 buyer:profiles!bookings_buyer_id_fkey(full_name)`)
        .eq('id', bookingId)
        .single();
    if (error || !booking) return null;

    const [creatorEmail, buyerEmail] = await Promise.all([
        getUserEmail(booking.creator_id),
        getUserEmail(booking.buyer_id),
    ]);
    return { booking, creatorEmail, buyerEmail };
}

const fmtWhen = (iso, tz) => new Date(iso).toLocaleString('en-US', {
    timeZone: tz || 'UTC', weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});

/**
 * Tell both parties, in-app and by email, with a calendar invite attached.
 *
 * Deliberately best-effort: a booking that succeeded must never be reported as
 * failed because Resend was down. The row is already committed by the time this
 * runs, so every failure here is logged and swallowed.
 */
async function notifyBoth(kind, ctx, { previousStart = null } = {}) {
    const { booking, creatorEmail, buyerEmail } = ctx;
    const title = booking.skill?.title || 'Coaching session';
    const creatorName = booking.creator?.full_name || 'Your host';
    const buyerName = booking.buyer?.full_name || 'Someone';
    const creatorTz = booking.creator?.booking_timezone || 'UTC';
    const buyerTz = booking.buyer_timezone || creatorTz;
    const cancelled = kind === 'cancelled';

    // ── In-app ──
    const copy = {
        confirmed: ['booking_confirmed', 'New booking 📅', 'Booking confirmed 📅'],
        rescheduled: ['booking_rescheduled', 'Session moved 🔁', 'Session moved 🔁'],
        cancelled: ['booking_cancelled', 'Session cancelled', 'Session cancelled'],
    }[kind];
    if (copy) {
        const [type, creatorTitle, buyerTitle] = copy;
        await supabase.from('notifications').insert([
            {
                user_id: booking.creator_id, type, title: creatorTitle,
                message: `${buyerName} · "${title}" · ${fmtWhen(booking.start_time, creatorTz)}`,
                related_id: booking.skill_id, related_type: null,
            },
            {
                user_id: booking.buyer_id, type, title: buyerTitle,
                message: `"${title}" with ${creatorName} · ${fmtWhen(booking.start_time, buyerTz)}`,
                related_id: booking.skill_id, related_type: null,
            },
        ]).then(({ error }) => { if (error) console.error('Booking notification error:', error.message); });
    }

    // ── Calendar invite ──
    // CANCEL removes the event; REQUEST creates or updates it. Both reuse the
    // same UID, and SEQUENCE rises with reschedule_count — that pairing is what
    // makes a moved session replace the old one rather than duplicate it.
    const method = cancelled ? 'CANCEL' : 'REQUEST';
    const buildIcs = (organizer, attendee) => buildBookingIcs({
        uid: bookingUid(booking.id),
        sequence: booking.reschedule_count || 0,
        method,
        title: `${title} — with ${creatorName}`,
        description: booking.meeting_url
            ? `Your SkillJoy session.\n\nJoin: ${booking.meeting_url}`
            : 'Your SkillJoy session.',
        start: booking.start_time,
        end: booking.end_time,
        meetingUrl: booking.meeting_url || '',
        organizer, attendee,
    });

    const manageUrl = `${FRONTEND}/locker`;
    const templateFor = { confirmed: 'bookingConfirmed', rescheduled: 'bookingRescheduled', cancelled: 'bookingCancelled' }[kind];
    if (!templateFor) return;

    const recipients = [
        {
            email: creatorEmail, isCreator: true, tz: creatorTz,
            recipientName: creatorName, otherPartyName: buyerName,
            ics: buildIcs({ name: creatorName, email: creatorEmail }, { name: buyerName, email: buyerEmail }),
            ctaUrl: `${FRONTEND}/dashboard`,
        },
        {
            email: buyerEmail, isCreator: false, tz: buyerTz,
            recipientName: buyerName, otherPartyName: creatorName,
            ics: buildIcs({ name: creatorName, email: creatorEmail }, { name: buyerName, email: buyerEmail }),
            ctaUrl: manageUrl,
        },
    ];

    for (const r of recipients) {
        if (!r.email) continue;
        try {
            const mail = templates[templateFor]({
                recipientName: r.recipientName,
                otherPartyName: r.otherPartyName,
                isCreator: r.isCreator,
                title,
                when: fmtWhen(booking.start_time, r.tz),
                previousWhen: previousStart ? fmtWhen(previousStart, r.tz) : null,
                timezoneNote: `Shown in ${r.tz}`,
                meetingUrl: cancelled ? '' : (booking.meeting_url || ''),
                manageUrl: r.ctaUrl,
                rebookUrl: r.ctaUrl,
            });
            await sendEmail({
                to: r.email,
                subject: mail.subject,
                html: mail.html,
                attachments: [{ filename: 'session.ics', content: Buffer.from(r.ics, 'utf8') }],
            });
        } catch (e) {
            console.error(`Booking ${kind} email failed for ${r.email}:`, e.message);
        }
    }
}

// Only the two parties may touch a booking.
const isParty = (booking, userId) => booking.creator_id === userId || booking.buyer_id === userId;

// ── POST /api/bookings — book a slot ────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { skillId, blockId, start, end, timezone } = req.body || {};
        if (!skillId || !start || !end) return res.status(400).json({ error: 'Missing booking details.' });

        const { data: skill } = await supabase
            .from('skills').select('id, creator_id, title').eq('id', skillId).single();
        if (!skill) return res.status(404).json({ error: 'Product not found.' });
        if (skill.creator_id === userId) return res.status(400).json({ error: 'You can’t book your own session.' });

        // Paid access — the same rule the RLS policy enforced, restated because
        // the service-role client is not subject to it.
        const { data: purchase } = await supabase
            .from('purchases').select('id')
            .eq('buyer_id', userId).eq('skill_id', skillId).eq('status', 'paid')
            .maybeSingle();
        if (!purchase) return res.status(403).json({ error: 'You need to buy this before booking a time.' });

        const { data: block } = blockId
            ? await supabase.from('content_blocks')
                .select('id, booking_minutes, min_notice_minutes, meeting_url').eq('id', blockId).single()
            : { data: null };

        const { data: creator } = await supabase
            .from('profiles').select('booking_availability, booking_timezone').eq('id', skill.creator_id).single();

        const problem = slotProblem({
            availability: creator?.booking_availability,
            tz: creator?.booking_timezone || 'UTC',
            start, end,
            minNoticeMinutes: block?.min_notice_minutes || 0,
        });
        if (problem) return res.status(400).json({ error: problem });

        const { data: booking, error } = await supabase
            .from('bookings')
            .insert({
                skill_id: skillId,
                block_id: blockId || null,
                creator_id: skill.creator_id,
                buyer_id: userId,
                start_time: new Date(start).toISOString(),
                end_time: new Date(end).toISOString(),
                // Snapshot, not a join — see migration 028 for why.
                meeting_url: block?.meeting_url || null,
                buyer_timezone: timezone || null,
            })
            .select('id').single();

        if (error) {
            // The gist exclusion constraint from migration 016 is the real
            // arbiter of double-booking: two people hitting the same slot at
            // once both pass the checks above, and exactly one insert survives.
            if (/duplicate|unique|exclu|overlap|conflict/i.test(error.message)) {
                return res.status(409).json({ error: 'That slot was just taken — pick another.' });
            }
            return serverError(res, error);
        }

        const ctx = await loadContext(booking.id);
        if (ctx) await notifyBoth('confirmed', ctx);
        res.json({ id: booking.id });
    } catch (err) {
        serverError(res, err);
    }
});

// ── POST /api/bookings/:id/reschedule ───────────────────────────────────────
// Moves an existing booking rather than cancel-and-rebook. Keeping the same row
// is what lets the calendar invite keep its UID and update in place — a cancel
// plus a new booking would leave a hole in the attendee's calendar and a second
// event beside it.
router.post('/:id/reschedule', async (req, res) => {
    try {
        const userId = req.user.id;
        const { start, end } = req.body || {};
        if (!start || !end) return res.status(400).json({ error: 'Pick a new time.' });

        const { data: existing } = await supabase
            .from('bookings')
            .select('id, skill_id, block_id, creator_id, buyer_id, start_time, status, reschedule_count')
            .eq('id', req.params.id).single();
        if (!existing) return res.status(404).json({ error: 'Booking not found.' });
        if (!isParty(existing, userId)) return res.status(403).json({ error: 'Not your booking.' });
        if (existing.status !== 'booked') return res.status(400).json({ error: 'This booking isn’t active.' });

        const { data: block } = existing.block_id
            ? await supabase.from('content_blocks')
                .select('min_notice_minutes, meeting_url').eq('id', existing.block_id).single()
            : { data: null };
        const { data: creator } = await supabase
            .from('profiles').select('booking_availability, booking_timezone').eq('id', existing.creator_id).single();

        // The host moving their own session is exempt from their own minimum
        // notice — that rule exists to protect them from buyers, not from
        // themselves, and a host fixing a clash an hour out is the normal case.
        const isCreator = existing.creator_id === userId;
        const problem = slotProblem({
            availability: creator?.booking_availability,
            tz: creator?.booking_timezone || 'UTC',
            start, end,
            minNoticeMinutes: isCreator ? 0 : (block?.min_notice_minutes || 0),
        });
        if (problem) return res.status(400).json({ error: problem });

        const previousStart = existing.start_time;
        const { error } = await supabase
            .from('bookings')
            .update({
                start_time: new Date(start).toISOString(),
                end_time: new Date(end).toISOString(),
                rescheduled_at: new Date().toISOString(),
                reschedule_count: (existing.reschedule_count || 0) + 1,
                // Re-copy the host's current link at this explicit moment.
                meeting_url: block?.meeting_url || null,
                // Critical: without this, a session whose 24h reminder already
                // fired would move to a new time and never remind again.
                reminder_sent: false,
            })
            .eq('id', existing.id);

        if (error) {
            if (/duplicate|unique|exclu|overlap|conflict/i.test(error.message)) {
                return res.status(409).json({ error: 'That slot was just taken — pick another.' });
            }
            return serverError(res, error);
        }

        const ctx = await loadContext(existing.id);
        if (ctx) await notifyBoth('rescheduled', ctx, { previousStart });
        res.json({ ok: true });
    } catch (err) {
        serverError(res, err);
    }
});

// ── POST /api/bookings/:id/cancel ───────────────────────────────────────────
router.post('/:id/cancel', async (req, res) => {
    try {
        const userId = req.user.id;
        const { data: existing } = await supabase
            .from('bookings').select('id, creator_id, buyer_id, status').eq('id', req.params.id).single();
        if (!existing) return res.status(404).json({ error: 'Booking not found.' });
        if (!isParty(existing, userId)) return res.status(403).json({ error: 'Not your booking.' });
        if (existing.status !== 'booked') return res.json({ ok: true }); // already gone — idempotent

        // Context is loaded BEFORE the status flips: the cancellation email
        // still has to state the time the session *was* at.
        const ctx = await loadContext(existing.id);

        const { error } = await supabase
            .from('bookings').update({ status: 'cancelled' }).eq('id', existing.id);
        if (error) return serverError(res, error);

        if (ctx) await notifyBoth('cancelled', ctx);
        res.json({ ok: true });
    } catch (err) {
        serverError(res, err);
    }
});

// ── GET /api/bookings/:id/calendar.ics ──────────────────────────────────────
// "Add to calendar" for someone who deleted the email or booked on a device
// that isn't where their calendar lives.
router.get('/:id/calendar.ics', async (req, res) => {
    try {
        const ctx = await loadContext(req.params.id);
        if (!ctx) return res.status(404).json({ error: 'Booking not found.' });
        if (!isParty(ctx.booking, req.user.id)) return res.status(403).json({ error: 'Not your booking.' });

        const { booking } = ctx;
        const title = booking.skill?.title || 'Coaching session';
        const creatorName = booking.creator?.full_name || 'Your host';
        const ics = buildBookingIcs({
            uid: bookingUid(booking.id),
            sequence: booking.reschedule_count || 0,
            method: booking.status === 'cancelled' ? 'CANCEL' : 'REQUEST',
            title: `${title} — with ${creatorName}`,
            description: booking.meeting_url
                ? `Your SkillJoy session.\n\nJoin: ${booking.meeting_url}`
                : 'Your SkillJoy session.',
            start: booking.start_time,
            end: booking.end_time,
            meetingUrl: booking.meeting_url || '',
            organizer: { name: creatorName, email: ctx.creatorEmail },
            attendee: { name: booking.buyer?.full_name || 'Attendee', email: ctx.buyerEmail },
        });

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="session.ics"');
        res.send(ics);
    } catch (err) {
        serverError(res, err);
    }
});

module.exports = router;
