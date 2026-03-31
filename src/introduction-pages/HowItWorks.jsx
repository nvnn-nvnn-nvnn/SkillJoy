import { Link } from 'react-router-dom';

const steps = [
    {
        emoji: '📝',
        title: 'Create your profile',
        desc: 'Sign up and set your skills, availability, and whether you want to swap, offer gigs, or both.',
    },
    {
        emoji: '🔍',
        title: 'Browse or list',
        desc: 'Search for gigs from other students, or list your own services for others to hire you.',
    },
    {
        emoji: '💬',
        title: 'Chat & agree',
        desc: 'Message the other person, clarify expectations, and accept the request when you\'re ready.',
    },
    {
        emoji: '💳',
        title: 'Secure payment',
        desc: 'Buyers pay upfront — funds are held in escrow by Stripe until the work is delivered.',
    },
    {
        emoji: '✅',
        title: 'Deliver & release',
        desc: 'The seller marks the work as done. The buyer reviews and releases payment. Both parties can rate each other.',
    },
];

export default function HowItWorksPage() {
    return (
        <div className="page" style={{ maxWidth: 800 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>How It Works</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 48, fontSize: 16 }}>
                SkillJoy is a campus marketplace where students can exchange skills for free or hire each other for paid gigs — all with secure Stripe-powered escrow.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 48 }}>
                {steps.map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', background: '#fff', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px' }}>
                        <div style={{ fontSize: 32, flexShrink: 0, lineHeight: 1 }}>{step.emoji}</div>
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Step {i + 1}</div>
                            <h3 style={{ fontWeight: 600, margin: '0 0 6px' }}>{step.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px', marginBottom: 40 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Skill Swaps</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 0 }}>
                    Swaps work a little differently — no money changes hands. You and another user agree to teach each other a skill.
                    When you've both completed the exchange and marked it done, you each earn points and can rate each other.
                </p>
            </div>

            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '24px 28px', marginBottom: 40 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#92400e' }}>🕐 14-Day Clearance Period</h2>
                <p style={{ color: '#78350f', lineHeight: 1.7, marginBottom: 0 }}>
                    Once payment is released by the buyer, your earnings enter a <strong>14-day safety clearance</strong> before
                    being transferred to your Stripe account. This protects sellers from chargebacks — if a buyer disputes
                    a charge with their bank after completion, SkillJoy has a window to manage it before funds are sent.
                    After 14 days with no issues, your money is automatically paid out. You can track the countdown in the chat.
                </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
                <Link to="/gigs" className="btn btn-primary">Browse Gigs</Link>
                <Link to="/swaps" className="btn btn-secondary">Explore Swaps</Link>
            </div>
        </div>
    );
}
