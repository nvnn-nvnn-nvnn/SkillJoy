import { Link } from 'react-router-dom';

const steps = [
    {
        emoji: '🔗',
        title: 'Claim your storefront',
        desc: 'Sign up and grab your link — skilljoy.me/@you. It\'s the one link you\'ll share everywhere.',
    },
    {
        emoji: '🧩',
        title: 'Build a Skill',
        desc: 'Add what you sell — a digital download, course, coaching call, or membership — with content blocks and a price.',
    },
    {
        emoji: '🚀',
        title: 'Publish & share',
        desc: 'Publish your storefront and drop your link in your bio across Instagram, TikTok, YouTube, and X.',
    },
    {
        emoji: '💳',
        title: 'Get paid',
        desc: 'Buyers check out in one tap. Payments are processed securely by Stripe and paid out to your bank.',
    },
    {
        emoji: '📈',
        title: 'Grow',
        desc: 'Track sales and views, build your email list, offer discounts, and add more Skills as you grow.',
    },
];

export default function HowItWorksPage() {
    return (
        <div className="page" style={{ maxWidth: 800 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>How It Works</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 48, fontSize: 16 }}>
                SkillJoy is the creator storefront for selling what you know — courses, templates, prompts, and coaching, all from one link, with secure Stripe-powered checkout.
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
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Payments & payouts</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 0 }}>
                    Checkout is powered by Stripe, so card details never touch SkillJoy. After a sale, your earnings are
                    transferred to your connected Stripe account and paid out to your bank on Stripe's schedule. You keep
                    the bulk of every sale — SkillJoy only takes a small platform fee, shown transparently at checkout.
                </p>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
                <Link to="/login" className="btn btn-primary">Start your store</Link>
                <Link to="/about"
                className="btn btn-secondary"
                style={{
                    color: "#000",
                    backgroundColor: "#fff"
                }}
                >About SkillJoy</Link>
            </div>
        </div>
    );
}
