const { Resend } = require('resend');
const supabase = require('../config/supabase');

const resend = new Resend(process.env.RESEND_API_KEY);
// Switch to 'SkillJoy <noreply@skilljoy.app>' once skilljoy.app is verified in Resend dashboard
const FROM = process.env.NODE_ENV === 'production'
    ? 'SkillJoy <noreply@skilljoy.app>'
    : 'SkillJoy <onboarding@resend.dev>';

// Fetch a user's email from Supabase auth
async function getUserEmail(userId) {
    try {
        const { data: { user } } = await supabase.auth.admin.getUserById(userId);
        return user?.email ?? null;
    } catch {
        return null;
    }
}

async function sendEmail({ to, subject, html }) {
    try {
        await resend.emails.send({ from: FROM, to, subject, html });
    } catch (err) {
        console.error('Resend error:', err.message);
    }
}

// ── Templates ─────────────────────────────────────────────────────────────────

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

module.exports = {
    sendEmail,
    getUserEmail,
    templates: {
        orderRequestedSeller,
        orderAcceptedBuyer,
        paymentEscrowedSeller,
        workDeliveredBuyer,
        fundsReleasedSeller,
        fundsCleared,
        disputeFiled,
    },
};
