const { Resend } = require('resend');
const supabase = require('../config/supabase');

// Only construct Resend if a key is set — a missing key must NOT crash the
// server at import. When absent, sendEmail() no-ops with a warning.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// Switch to 'SkillJoy <noreply@skilljoy.app>' once skilljoy.app is verified in Resend dashboard
// Set RESEND_FROM in Railway env vars once skilljoy.app is verified in Resend dashboard.
// Until then, leave it unset and it falls back to onboarding@resend.dev (Resend's shared domain).
const FROM = process.env.RESEND_FROM || 'SkillJoy <onboarding@resend.dev>';

// Fetch a user's email from Supabase auth
async function getUserEmail(userId) {
    try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        return user?.email ?? null;
    } catch {
        return null;
    }
}

// `attachments` is optional and passes straight through to Resend:
//   [{ filename, content }]  — content is a Buffer or a base64 string.
// Booking mail uses it to attach the .ics invite. Note the deliberate choice
// NOT to also set a text/calendar Content-Type part: Resend sends the file as a
// normal attachment, which every client can open, whereas a malformed inline
// calendar part can make Gmail swallow the message body entirely.
async function sendEmail({ to, subject, html, attachments }) {
    if (!resend) {
        console.warn('Email skipped — RESEND_API_KEY not set. Would have sent:', subject, '→', to);
        return null;
    }
    const payload = { from: FROM, to, subject, html };
    if (attachments?.length) payload.attachments = attachments;
    const { data, error } = await resend.emails.send(payload);
    if (error) {
        console.error('Resend error:', error);
        throw new Error(error.message || 'Failed to send email');
    }
    return data;
}

// Escape user-supplied text before dropping it into email HTML.
function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Templates ─────────────────────────────────────────────────────────────────

// Branded purchase confirmation / thank-you email. One template for every v3
// purchase path — one-time, guest, and membership (recurring=true tweaks copy).
// `note` is the creator's custom confirmation message; `footerNote` is extra
// fine print (e.g. the guest "no password needed" line).
function purchaseThankYou({ title, amountCents = null, recurring = false, note = '', accessUrl, accessLabel = 'Access your purchase', footerNote = '' }) {
    const price = amountCents != null
        ? `$${(amountCents / 100).toFixed(2)}${recurring ? ' / month' : ''}`
        : '';
    const noteHtml = note
        ? `<p style="background:#f4f1ea;border-radius:8px;padding:12px 14px;white-space:pre-wrap;margin:16px 0;">${esc(note)}</p>`
        : '';
    return {
        subject: recurring ? `You’re in — ${title}` : `Thanks for your purchase — ${title}`,
        html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5;">
            <h1 style="font-size:22px;margin:0 0 10px;">Thank you! 🎉</h1>
            <p style="margin:0;">Your ${recurring ? 'membership to' : 'purchase of'} <strong>${esc(title)}</strong>${price ? ` — <strong>${price}</strong>` : ''} is confirmed.</p>
            ${noteHtml}
            <p style="margin:18px 0 10px;">${recurring ? 'Access your member content anytime:' : 'Access it anytime:'}</p>
            <a href="${accessUrl}" style="display:inline-block;padding:12px 22px;background:#D4522A;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">${accessLabel}</a>
            ${recurring ? '<p style="color:#6b7280;font-size:13px;margin-top:18px;">You can manage or cancel your membership anytime from your Locker.</p>' : ''}
            ${footerNote ? `<p style="color:#6b7280;font-size:13px;margin-top:18px;">${esc(footerNote)}</p>` : ''}
            <p style="color:#9ca3af;font-size:12px;margin-top:24px;">SkillJoy</p>
        </div>`,
    };
}


function orderRequestedSeller({ sellerName, buyerName, gigTitle, amount, orderId }) {
    return {
        subject: `New order request — ${gigTitle}`,
        html: `
            <p>Hi ${sellerName},</p>
            <p><strong>${buyerName}</strong> has requested your gig <strong>"${gigTitle}"</strong> for <strong>$${amount}</strong>.</p>
            <p>Log in to accept or decline the request.</p>
            <a href="${process.env.FRONTEND_URL}/orders" style="display:inline-block;padding:10px 20px;background:#ec9146;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Order</a>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">SkillJoy — the student skill marketplace</p>
        `,
    };
}

function orderAcceptedBuyer({ buyerName, sellerName, gigTitle, orderId }) {
    return {
        subject: `Your order was accepted — ${gigTitle}`,
        html: `
            <p>Hi ${buyerName},</p>
            <p><strong>${sellerName}</strong> accepted your order for <strong>"${gigTitle}"</strong>.</p>
            <p>Complete your payment to get the work started.</p>
            <a href="${process.env.FRONTEND_URL}/orders" style="display:inline-block;padding:10px 20px;background:#ec9146;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Pay Now</a>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">SkillJoy — the student skill marketplace</p>
        `,
    };
}

function paymentEscrowedSeller({ sellerName, buyerName, gigTitle, amount }) {
    return {
        subject: `Payment secured — ${gigTitle}`,
        html: `
            <p>Hi ${sellerName},</p>
            <p><strong>${buyerName}</strong> has paid <strong>$${amount}</strong> for <strong>"${gigTitle}"</strong>. Funds are held in escrow.</p>
            <p>Deliver the work and mark it as delivered when complete.</p>
            <a href="${process.env.FRONTEND_URL}/orders" style="display:inline-block;padding:10px 20px;background:#ec9146;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">View Order</a>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">SkillJoy — the student skill marketplace</p>
        `,
    };
}

function workDeliveredBuyer({ buyerName, sellerName, gigTitle, orderId }) {
    return {
        subject: `Work delivered — review and release payment`,
        html: `
            <p>Hi ${buyerName},</p>
            <p><strong>${sellerName}</strong> has marked <strong>"${gigTitle}"</strong> as delivered.</p>
            <p>Review the work and release payment, or file a dispute if there's an issue. You have <strong>3 days</strong> before payment is auto-released.</p>
            <a href="${process.env.FRONTEND_URL}/orders" style="display:inline-block;padding:10px 20px;background:#ec9146;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Review & Release</a>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">SkillJoy — the student skill marketplace</p>
        `,
    };
}

function fundsReleasedSeller({ sellerName, gigTitle, amount }) {
    return {
        subject: `Payment released — ${gigTitle}`,
        html: `
            <p>Hi ${sellerName},</p>
            <p>Payment of <strong>$${amount}</strong> for <strong>"${gigTitle}"</strong> has been released. Funds will clear to your Stripe account in 14 days.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">SkillJoy — the student skill marketplace</p>
        `,
    };
}

function fundsCleared({ sellerName, gigTitle, amount }) {
    return {
        subject: `Funds cleared — ${gigTitle}`,
        html: `
            <p>Hi ${sellerName},</p>
            <p>Your earnings of <strong>$${amount}</strong> for <strong>"${gigTitle}"</strong> have cleared and are on their way to your Stripe account.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">SkillJoy — the student skill marketplace</p>
        `,
    };
}

function disputeFiled({ recipientName, gigTitle, role }) {
    return {
        subject: `Dispute opened — ${gigTitle}`,
        html: `
            <p>Hi ${recipientName},</p>
            <p>A dispute has been filed for <strong>"${gigTitle}"</strong>. Our team will review and reach out within 1–2 business days.</p>
            <p style="color:#6b7280;font-size:13px;margin-top:24px;">SkillJoy — the student skill marketplace</p>
        `,
    };
}

// ── Booking emails (v3 native scheduling) ────────────────────────────────────
//
// One shared shell for all four states so a session email always looks the same
// and only the words change. The reason these matter more than in-app
// notifications: a booking is a promise about a moment in the future, and the
// place people check before a call is their inbox and their calendar — not a
// bell icon in an app they may not open again before the session.
//
// `when` is pre-formatted by the caller, which owns the timezone decision:
// each recipient gets the time rendered in THEIR OWN zone. Formatting here
// would mean picking one zone and being wrong for one of the two parties.
function bookingShell({ heading, intro, when, timezoneNote, title, meetingUrl, ctaUrl, ctaLabel, footer, tone = 'normal' }) {
    const accent = tone === 'danger' ? '#CE4A3E' : '#D4522A';
    const struck = tone === 'danger' ? 'text-decoration:line-through;opacity:.7;' : '';
    return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;line-height:1.5;">
        <h1 style="font-size:22px;margin:0 0 10px;">${esc(heading)}</h1>
        <p style="margin:0 0 16px;">${intro}</p>
        <div style="background:#f4f1ea;border-radius:8px;padding:14px 16px;margin:0 0 16px;">
            <p style="margin:0;font-weight:700;font-size:16px;${struck}">${esc(when)}</p>
            ${timezoneNote ? `<p style="margin:4px 0 0;color:#6b7280;font-size:12px;">${esc(timezoneNote)}</p>` : ''}
            <p style="margin:10px 0 0;color:#4b5563;font-size:14px;">${esc(title)}</p>
        </div>
        ${meetingUrl ? `<p style="margin:0 0 16px;font-size:14px;">Join the call: <a href="${esc(meetingUrl)}" style="color:${accent};font-weight:600;">${esc(meetingUrl)}</a></p>` : ''}
        ${ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;padding:12px 22px;background:${accent};color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">${esc(ctaLabel)}</a>` : ''}
        ${footer ? `<p style="color:#6b7280;font-size:13px;margin-top:18px;">${footer}</p>` : ''}
        <p style="color:#9ca3af;font-size:12px;margin-top:24px;">SkillJoy</p>
    </div>`;
}

function bookingConfirmed({ recipientName, otherPartyName, isCreator, title, when, timezoneNote, meetingUrl, manageUrl }) {
    return {
        subject: `Confirmed: ${title} — ${when}`,
        html: bookingShell({
            heading: isCreator ? 'New booking 📅' : 'You’re booked in ✅',
            intro: isCreator
                ? `<strong>${esc(otherPartyName)}</strong> booked a session with you.`
                : `Your session with <strong>${esc(otherPartyName)}</strong> is confirmed.`,
            when, timezoneNote, title, meetingUrl,
            ctaUrl: manageUrl, ctaLabel: 'View booking',
            footer: 'The attached invite adds this to your calendar. Need a different time? Reschedule from your booking rather than cancelling.',
        }),
    };
}

function bookingRescheduled({ recipientName, otherPartyName, isCreator, title, when, previousWhen, timezoneNote, meetingUrl, manageUrl }) {
    return {
        subject: `Moved: ${title} — now ${when}`,
        html: bookingShell({
            heading: 'Session moved 🔁',
            intro: isCreator
                ? `<strong>${esc(otherPartyName)}</strong> moved your session${previousWhen ? ` from <span style="text-decoration:line-through;">${esc(previousWhen)}</span>` : ''}.`
                : `Your session with <strong>${esc(otherPartyName)}</strong> has moved${previousWhen ? ` from <span style="text-decoration:line-through;">${esc(previousWhen)}</span>` : ''}.`,
            when, timezoneNote, title, meetingUrl,
            ctaUrl: manageUrl, ctaLabel: 'View booking',
            footer: 'The attached invite updates the event already on your calendar — you should not end up with two.',
        }),
    };
}

function bookingCancelled({ recipientName, otherPartyName, isCreator, title, when, timezoneNote, rebookUrl }) {
    return {
        subject: `Cancelled: ${title} — ${when}`,
        html: bookingShell({
            heading: 'Session cancelled',
            intro: isCreator
                ? `<strong>${esc(otherPartyName)}</strong> cancelled this session.`
                : `Your session with <strong>${esc(otherPartyName)}</strong> was cancelled.`,
            when, timezoneNote, title,
            ctaUrl: rebookUrl, ctaLabel: isCreator ? 'View bookings' : 'Book another time',
            tone: 'danger',
            footer: 'The attached update removes it from your calendar. You still have access to everything you bought.',
        }),
    };
}

function bookingReminder({ recipientName, otherPartyName, isCreator, title, when, timezoneNote, meetingUrl, manageUrl }) {
    return {
        subject: `Tomorrow: ${title} — ${when}`,
        html: bookingShell({
            heading: 'Coming up ⏰',
            intro: isCreator
                ? `Reminder — you have a session with <strong>${esc(otherPartyName)}</strong>.`
                : `Reminder — your session with <strong>${esc(otherPartyName)}</strong> is coming up.`,
            when, timezoneNote, title, meetingUrl,
            ctaUrl: manageUrl, ctaLabel: 'View booking',
            footer: 'Can’t make it? Reschedule or cancel as early as you can so the slot can be reused.',
        }),
    };
}

module.exports = {
    sendEmail,
    getUserEmail,
    purchaseThankYou,
    templates: {
        orderRequestedSeller,
        orderAcceptedBuyer,
        paymentEscrowedSeller,
        workDeliveredBuyer,
        fundsReleasedSeller,
        fundsCleared,
        disputeFiled,
        bookingConfirmed,
        bookingRescheduled,
        bookingCancelled,
        bookingReminder,
    },
};
