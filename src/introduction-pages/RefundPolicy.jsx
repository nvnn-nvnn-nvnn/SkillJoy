import { Link } from 'react-router-dom';
import LegalPage from './LegalPage';

// Content only — layout, theming and navigation live in LegalPage.
// The old version faked a bullet list with '\n\n• …' inside whiteSpace:pre-line;
// it's a real <ul> now, so it wraps properly and reads as a list to a screen
// reader instead of one run-on paragraph.
const SECTIONS = [
    {
        title: 'Overview',
        body: <p>SkillJoy uses an escrow payment system to protect both buyers and sellers. This policy explains when refunds are issued and how the process works.</p>,
    },
    {
        title: 'Before Payment',
        body: <p>If you have accepted a gig request but have not yet submitted payment, you can cancel the order at no charge from the <strong>My Orders</strong> page. No refund is needed, as no money was collected.</p>,
    },
    {
        title: 'After Payment (Escrowed)',
        body: (
            <>
                <p>Once payment is in escrow, refunds may be issued in the following cases:</p>
                <ul>
                    <li>The seller cancels the order before delivery</li>
                    <li>A dispute is resolved in the buyer&rsquo;s favor</li>
                    <li>The seller fails to deliver within the agreed timeframe</li>
                </ul>
            </>
        ),
    },
    {
        title: 'After Delivery',
        body: <p>Once a gig is marked as delivered, you have a review window to confirm completion or file a dispute. <strong>Releasing payment is final</strong> — refunds are not issued after funds have been released to the seller.</p>,
    },
    {
        title: 'Auto-Release',
        body: <p>If you do not take action within 3 days of delivery, payment is automatically released to the seller. Auto-released payments are not eligible for refund.</p>,
    },
    {
        title: 'Disputes',
        body: <p>If you believe a gig was not completed as described, file a dispute <strong>before</strong> releasing payment. Disputes are reviewed and resolved at SkillJoy&rsquo;s discretion. See our <Link to="/terms">Terms of Service</Link> for details.</p>,
    },
    {
        title: 'Platform Fee',
        body: <p>The $3.50 platform service fee is non-refundable in all cases, including cancelled and disputed orders.</p>,
    },
    {
        title: 'Processing Time',
        body: <p>Approved refunds are returned to your original payment method within 5–10 business days, depending on your bank or card issuer.</p>,
    },
    {
        title: 'Contact',
        body: <p>For refund-related questions, contact <a href="mailto:techkage@proton.me">techkage@proton.me</a>.</p>,
    },
];

export default function RefundPolicyPage() {
    return (
        <LegalPage
            title="Refund Policy"
            updated={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            intro="When refunds are issued, how escrow protects both sides, and what happens after payment is released."
            sections={SECTIONS}
        />
    );
}
