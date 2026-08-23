import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MessageSquare, Clock, LifeBuoy, Check, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

// Contact — rewritten 2026-08-21.
//
// Three things were wrong, beyond the layout being plain:
//  1. Hardcoded colours again (note 169): the back link was #000 on #fff and
//     the success panel was #f0fdf4 / #86efac. All invisible-or-glaring in dark
//     mode. Tokens now.
//  2. The subject list was from the gig-marketplace era — "Payment or escrow
//     issue", "Dispute help" — which routes v3 creators to the wrong topics and
//     signals a product that no longer exists.
//  3. No sense of what happens next. A contact form with no stated response
//     time is a form people don't trust they've been heard by.

const SUBJECTS = [
    { value: 'general', label: 'General question' },
    { value: 'billing', label: 'Billing & subscription' },
    { value: 'payouts', label: 'Payouts & Stripe' },
    { value: 'product', label: 'Products & storefront help' },
    { value: 'account', label: 'Account & login' },
    { value: 'bug', label: 'Report a bug' },
    { value: 'other', label: 'Something else' },
];

export default function ContactPage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        setError('');

        let success = false;

        // Primary: Web3Forms.
        try {
            const res = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    access_key: import.meta.env.VITE_WEB3_PUBLIC_KEY,
                    name, email,
                    subject: subject ? `${subject} | SkillJoy` : 'SkillJoy',
                    message,
                }),
            });
            const data = await res.json();
            if (data.success) success = true;
        } catch { /* fall through to our own backend */ }

        // Fallback: our backend persists to Supabase, so a Web3Forms outage
        // still doesn't lose the message.
        if (!success) {
            try {
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, subject, message }),
                });
                const data = await res.json();
                if (res.ok && data.success) success = true;
            } catch { /* both failed */ }
        }

        if (success) setSent(true);
        else setError('That didn’t send. Try again, or email techkage@proton.me directly — we read that inbox.');
        setSubmitting(false);
    }

    return (
        <>
            <title>Contact — SkillJoy</title>

            <div className="ct">
                <div className="ct-head">
                    <Link to="/" className="ct-back">← Back to home</Link>
                    <h1 className="ct-title">Get in touch</h1>
                    <p className="ct-sub">Questions, feedback, or something broken — tell us and we&rsquo;ll sort it out.</p>
                </div>

                <div className="ct-body">
                    {/* ── Form ── */}
                    <div className="ct-formcol">
                        {sent ? (
                            <div className="ct-sent" role="status">
                                <span className="ct-sentring"><Check size={26} strokeWidth={3} /></span>
                                <h2 className="ct-senttitle">Message sent</h2>
                                <p className="ct-sentbody">
                                    Thanks{name ? `, ${name.split(' ')[0]}` : ''} — we&rsquo;ve got it. You&rsquo;ll hear back
                                    within 1–2 business days at <strong>{email}</strong>.
                                </p>
                                <div className="ct-sentactions">
                                    <Link to="/" className="ct-btn">Back to home</Link>
                                    <button className="ct-btn" onClick={() => {
                                        // Reset rather than reload: someone reporting two bugs
                                        // shouldn't have to re-type their name and email.
                                        setSent(false); setSubject(''); setMessage('');
                                    }}>Send another</button>
                                </div>
                            </div>
                        ) : (
                            <form className="ct-form" onSubmit={handleSubmit} noValidate={false}>
                                <div className="ct-row">
                                    <div className="ct-field">
                                        <label htmlFor="ct-name">Name</label>
                                        <input id="ct-name" type="text" value={name} autoComplete="name"
                                            onChange={e => setName(e.target.value)} placeholder="Your name" required />
                                    </div>
                                    <div className="ct-field">
                                        <label htmlFor="ct-email">Email</label>
                                        <input id="ct-email" type="email" value={email} autoComplete="email"
                                            onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                                    </div>
                                </div>

                                <div className="ct-field">
                                    <label htmlFor="ct-subject">What&rsquo;s it about?</label>
                                    <select id="ct-subject" value={subject} onChange={e => setSubject(e.target.value)} required>
                                        <option value="">Choose a topic…</option>
                                        {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>

                                <div className="ct-field">
                                    <label htmlFor="ct-message">Message</label>
                                    <textarea id="ct-message" value={message} rows={6} required
                                        onChange={e => setMessage(e.target.value)}
                                        placeholder="Tell us what's going on. If it's a bug, what you did and what happened helps a lot." />
                                    <span className="ct-hint">
                                        {subject === 'bug'
                                            ? 'Handy: what you clicked, what you expected, and what happened instead.'
                                            : 'The more detail, the faster we can help.'}
                                    </span>
                                </div>

                                {error && (
                                    <p className="ct-error" role="alert">
                                        <AlertCircle size={15} /> {error}
                                    </p>
                                )}

                                <button className="ct-submit" type="submit" disabled={submitting}>
                                    {submitting
                                        ? <><Loader2 size={16} className="ct-spin" /> Sending…</>
                                        : <>Send message <ArrowRight size={15} /></>}
                                </button>
                            </form>
                        )}
                    </div>

                    {/* ── Side info ── */}
                    <aside className="ct-side">
                        <div className="ct-sidecard">
                            <span className="ct-sideicon"><Clock size={17} /></span>
                            <h3>Response time</h3>
                            <p>We reply within 1–2 business days. Billing and payout issues get looked at first.</p>
                        </div>
                        <div className="ct-sidecard">
                            <span className="ct-sideicon"><Mail size={17} /></span>
                            <h3>Prefer email?</h3>
                            <p><a href="mailto:techkage@proton.me">techkage@proton.me</a> reaches the same place.</p>
                        </div>
                        <div className="ct-sidecard">
                            <span className="ct-sideicon"><LifeBuoy size={17} /></span>
                            <h3>Might be quicker</h3>
                            <p>
                                <Link to="/how-it-works">How SkillJoy works</Link> covers setup, selling and payouts.
                            </p>
                        </div>
                        <div className="ct-sidecard">
                            <span className="ct-sideicon"><MessageSquare size={17} /></span>
                            <h3>Reporting a bug?</h3>
                            <p>Include your browser and what you were doing. It roughly halves the back-and-forth.</p>
                        </div>
                    </aside>
                </div>
            </div>

            <Styles />
        </>
    );
}

function Styles() {
    return <style>{`
    .ct { max-width:1000px; margin:0 auto; padding:52px 24px 96px; }
    .ct-head { margin-bottom:38px; }
    .ct-back { display:inline-block; font-size:13px; font-weight:600; color:var(--text-secondary);
      background:var(--surface); border:1px solid var(--border); border-radius:var(--r-full);
      padding:7px 15px; text-decoration:none; margin-bottom:28px; transition:border-color .15s ease, color .15s ease; }
    .ct-back:hover { border-color:var(--accent); color:var(--accent); }
    .ct-title { font-size:clamp(30px,4.6vw,44px); font-weight:800; letter-spacing:-.025em; line-height:1.12;
      color:var(--text); font-family:var(--font-display); margin:0 0 10px; }
    .ct-sub { font-size:16px; line-height:1.65; color:var(--text-secondary); margin:0; max-width:52ch; }

    .ct-body { display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:40px; align-items:start; }

    /* ── Form ── */
    .ct-form { display:flex; flex-direction:column; gap:18px; }
    .ct-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .ct-field { display:flex; flex-direction:column; min-width:0; }
    .ct-field label { font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:6px; }
    .ct-hint { font-size:12.5px; color:var(--text-muted); margin-top:7px; }
    .ct-field textarea { resize:vertical; }

    .ct-error { display:flex; align-items:flex-start; gap:8px; margin:0; padding:11px 14px;
      border-radius:var(--r-sm); font-size:13.5px; font-weight:600; line-height:1.5;
      color:var(--danger); background:var(--danger-light); border:1px solid var(--danger-mid); }
    .ct-error svg { flex-shrink:0; margin-top:2px; }

    .ct-submit { align-self:flex-start; display:inline-flex; align-items:center; gap:8px; width:auto;
      padding:13px 26px; border:none; border-radius:var(--r-full); background:var(--accent);
      color:var(--accent-foreground); font-size:15px; font-weight:700; font-family:inherit; cursor:pointer;
      transition:background .15s ease, transform .13s ease; }
    .ct-submit:hover:not(:disabled) { background:var(--accent-hover); transform:translateY(-1px); }
    .ct-submit:disabled { opacity:.6; cursor:default; }
    .ct-spin { animation:ctRot .8s linear infinite; }
    @keyframes ctRot { to { transform:rotate(360deg); } }

    /* ── Sent ── */
    .ct-sent { text-align:center; padding:38px 28px; border-radius:var(--r-lg);
      background:var(--surface); border:1px solid var(--green-mid, #9ecdb8); }
    .ct-sentring { display:inline-flex; align-items:center; justify-content:center; width:58px; height:58px;
      border-radius:var(--r-full); background:var(--green, #3d8168); color:#fff; margin-bottom:16px;
      animation:ctPop .45s cubic-bezier(.2,1.3,.4,1); }
    @keyframes ctPop { 0% { transform:scale(.4); opacity:0; } 60% { transform:scale(1.08); } 100% { transform:scale(1); opacity:1; } }
    .ct-senttitle { font-size:21px; font-weight:800; color:var(--text); margin:0 0 8px; }
    .ct-sentbody { font-size:14.5px; line-height:1.65; color:var(--text-secondary); margin:0 auto; max-width:44ch; }
    .ct-sentbody strong { color:var(--text); }
    .ct-sentactions { display:flex; gap:9px; justify-content:center; flex-wrap:wrap; margin-top:22px; }
    .ct-btn { display:inline-flex; align-items:center; gap:6px; width:auto; padding:10px 20px;
      border:1.5px solid var(--border-strong); border-radius:var(--r-full); background:var(--surface);
      color:var(--text); font-size:13.5px; font-weight:700; font-family:inherit; cursor:pointer; text-decoration:none; }
    .ct-btn:hover { border-color:var(--accent); color:var(--accent); text-decoration:none; }

    /* ── Side ── */
    .ct-side { display:flex; flex-direction:column; gap:12px; }
    .ct-sidecard { padding:17px 18px; border:1px solid var(--border); border-radius:var(--r-lg); background:var(--surface-alt); }
    .ct-sideicon { display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px;
      border-radius:var(--r); background:var(--accent-light); color:var(--accent-hover); margin-bottom:10px; }
    .ct-sidecard h3 { font-size:14px; font-weight:750; color:var(--text); margin:0 0 5px; }
    .ct-sidecard p { font-size:13px; line-height:1.6; color:var(--text-secondary); margin:0; }
    .ct-sidecard a { color:var(--accent); font-weight:600; text-decoration:underline; text-underline-offset:2px; word-break:break-word; }

    @media (max-width:820px) {
      .ct { padding:34px 18px 72px; }
      /* Form first on mobile — the side panel is supporting context, and putting
         it above the form would make the actual task scroll off-screen. */
      .ct-body { grid-template-columns:1fr; gap:30px; }
    }
    @media (max-width:460px) {
      .ct-row { grid-template-columns:1fr; }
      .ct-submit { width:100%; justify-content:center; }
    }
    @media (prefers-reduced-motion: reduce) {
      .ct-sentring, .ct-spin { animation:none; }
      .ct-submit:hover:not(:disabled) { transform:none; }
    }
  `}</style>;
}
