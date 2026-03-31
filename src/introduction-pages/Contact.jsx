import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function ContactPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sent, setSent] = useState(false);

    function handleSubmit(e) {
        e.preventDefault();
        // Placeholder — wire to email service (Resend) later
        setSent(true);
    }

    return (
        <div className="page" style={{ maxWidth: 680 }}>
            <Link to="/" style={{ fontSize: 14, color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-block', marginBottom: 24 }}>← Back to Home</Link>

            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 6 }}>Contact Us</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>
                Questions, feedback, or issues? We'd love to hear from you.
            </p>

            {sent ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 16, padding: '32px 28px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
                    <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Message sent!</h2>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>We'll get back to you within 1–2 business days.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="field" style={{ margin: 0 }}>
                            <label>Name</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
                        </div>
                        <div className="field" style={{ margin: 0 }}>
                            <label>Email</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                        </div>
                    </div>

                    <div className="field" style={{ margin: 0 }}>
                        <label>Subject</label>
                        <select value={subject} onChange={e => setSubject(e.target.value)} required>
                            <option value="">Select a topic…</option>
                            <option value="general">General question</option>
                            <option value="payment">Payment or escrow issue</option>
                            <option value="dispute">Dispute help</option>
                            <option value="account">Account issue</option>
                            <option value="bug">Bug report</option>
                            <option value="other">Other</option>
                        </select>
                    </div>

                    <div className="field" style={{ margin: 0 }}>
                        <label>Message</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Describe your question or issue…"
                            rows={5}
                            style={{ resize: 'vertical' }}
                            required
                        />
                    </div>

                    <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start', padding: '10px 28px' }}>
                        Send Message
                    </button>
                </form>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 40 }}>
                {[
                    { icon: '📧', label: 'Email', value: 'support@skilljoy.app' },
                    { icon: '⚖️', label: 'Legal', value: 'legal@skilljoy.app' },
                    { icon: '🔒', label: 'Privacy', value: 'privacy@skilljoy.app' },
                ].map(c => (
                    <div key={c.label} style={{ background: '#f0ede8', borderRadius: 14, padding: '18px 20px' }}>
                        <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{c.label}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{c.value}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
