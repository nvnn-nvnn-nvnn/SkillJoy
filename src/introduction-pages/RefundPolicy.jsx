import { Link } from 'react-router-dom';

export default function RefundPolicyPage() {
    return (
        <div className="page" style={{ maxWidth: 760 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Refund Policy</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

            <Section title="Overview">
                SkillJoy uses an escrow payment system to protect both buyers and sellers. This policy explains when refunds are issued and how the process works.
            </Section>

            <Section title="Before Payment">
                If you have accepted a gig request but have not yet submitted payment, you can cancel the order at no charge from the My Orders page. No refund is needed as no money was collected.
            </Section>

            <Section title="After Payment (Escrowed)">
                Once payment is in escrow, refunds may be issued in the following cases:
                {'\n\n'}• The seller cancels the order before delivery.{'\n'}
                • A dispute is resolved in the buyer's favor.{'\n'}
                • The seller fails to deliver within the agreed timeframe.
            </Section>

            <Section title="After Delivery">
                Once a gig is marked as delivered, you have a review window to confirm completion or file a dispute. Releasing payment is final — refunds are not issued after funds have been released to the seller.
            </Section>

            <Section title="Auto-Release">
                If you do not take action within 3 days of delivery, payment is automatically released to the seller. Auto-released payments are not eligible for refund.
            </Section>

            <Section title="Disputes">
                If you believe a gig was not completed as described, file a dispute before releasing payment. Disputes are reviewed and resolved at SkillJoy's discretion. See our <Link to="/terms" style={{ color: 'var(--accent)' }}>Terms of Service</Link> for details.
            </Section>

            <Section title="Platform Fee">
                The $6 platform service fee is non-refundable in all cases, including cancelled and disputed orders.
            </Section>

            <Section title="Processing Time">
                Approved refunds are returned to your original payment method within 5–10 business days, depending on your bank or card issuer.
            </Section>

            <Section title="Contact">
                For refund-related questions, contact <a href="mailto:support@skilljoy.app" style={{ color: 'var(--accent)' }}>support@skilljoy.app</a>.
            </Section>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={{ background: '#f0ede8', padding: 24, borderRadius: 16, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{title}</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line' }}>{children}</p>
        </div>
    );
}
