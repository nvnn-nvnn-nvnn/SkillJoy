import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { TOS_VERSION } from '@/lib/config';
import Logo from '@/components/Logo';

const TOTAL_STEPS = 1;

// Handles that collide with app routes — can't be claimed as a @username.
const RESERVED_USERNAMES = new Set([
    'build', 'locker', 'dashboard', 'login', 'onboarding', 'about', 'contact',
    'profile', 'settings', 'admin', 'terms', 'privacy', 'how-it-works',
    'refund-policy', 'gigs', 'swaps', 'matches', 'chat', 'disputes', 'my-orders',
    'my-listings', 'my-swaps', 'verify-college', 'main-search', 'api', 'health',
]);

function normalizeUsername(raw) {
    return (raw || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
}

function usernameError(name) {
    if (!name) return 'Pick a username for your storefront link.';
    if (name.length < 3) return 'At least 3 characters.';
    if (RESERVED_USERNAMES.has(name)) return 'That handle is reserved — try another.';
    return null;
}

const STEP_LABELS = ['About you'];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const user = useUser();
    const profile = useProfile();
    const { setProfile } = useAuth();
    const navigate = useNavigate();

    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameStatus, setUsernameStatus] = useState(null); // null | 'checking' | 'available' | 'taken'
    const [bio, setBio] = useState('');
    const [phone, setPhone] = useState(''); // captured at account creation, persisted here
    const [agreedTos, setAgreedTos] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        // Already onboarded (has a handle) → they don't belong here anymore.
        if (profile?.username) { navigate('/build', { replace: true }); return; }
        // Prefill from the profile row when present, else from the name/phone
        // captured at account creation (email signup metadata, or Google). The
        // metadata fallback ALSO applies when a profile row exists but its
        // full_name/phone are null (e.g. a Google row) — otherwise the name field
        // would render empty (or hidden) and validation would dead-end.
        const meta = user.user_metadata || {};
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFullName(profile?.full_name || meta.full_name || meta.name || '');
        setUsername(profile?.username ?? '');
        setBio(profile?.bio ?? '');
        setPhone(profile?.phone || meta.phone || '');
    }, [user, profile]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Username availability (debounced) ────────────────────────────────────

    function handleUsernameChange(raw) {
        const n = normalizeUsername(raw);
        setUsername(n);
        setUsernameStatus(usernameError(n) ? null : 'checking'); // status set here, not in the effect
    }

    useEffect(() => {
        if (usernameError(username)) return; // invalid → status already cleared by handler
        const name = username;
        let cancelled = false;
        const t = setTimeout(async () => {
            const { data, error } = await supabase
                .from('profiles').select('id').ilike('username', name).maybeSingle();
            if (cancelled) return;
            if (error) { setUsernameStatus(null); return; }
            setUsernameStatus(!data || data.id === user?.id ? 'available' : 'taken');
        }, 400);
        return () => { cancelled = true; clearTimeout(t); };
    }, [username, user?.id]);

    // ── Save ─────────────────────────────────────────────────────────────────

    async function save() {
        if (!fullName.trim()) { setError('Please enter your name.'); return; }
        if (!phone.trim()) { setError('Please enter your phone number.'); return; }
        const uErr = usernameError(username);
        if (uErr) { setError(uErr); return; }
        if (usernameStatus === 'taken') { setError('That username is taken — try another.'); return; }
        if (!agreedTos) { setError('Please agree to the Terms of Service to continue.'); return; }

        setError(''); setBusy(true);
        const { error: e } = await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: fullName.trim(),
            username,
            bio: bio.trim(),
            phone: phone.trim() || null,
            // Proof of consent — agreedTos is required by the validation above,
            // so acceptance is always recorded with the save (migration 025).
            tos_accepted_at: new Date().toISOString(),
            tos_version: TOS_VERSION,
        });
        setBusy(false);
        if (e) {
            // Unique-index violation on username races past the live check.
            setError(/duplicate|unique/i.test(e.message) ? 'That username was just taken — try another.' : e.message);
            return;
        }
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) setProfile(updated);
        // First-time account: land on the page builder (customize your storefront),
        // NOT the digital-products hub — get them building their page first.
        navigate('/storefront/edit');
    }

    // ── Render ───────────────────────────────────────────────────────────────

    const handleValid = username && !usernameError(username);

    return (
        <>
            <title>Set up your profile — SkillJoy</title>

            <div className="onb">
                <div className="onb-shell fade-up">

                    {/* ── Left: brand / value panel ── */}
                    <aside className="onb-brand">
                            <div>
                                <Logo height={30} className="onb-logo-img" />
                                <h2 className="onb-brand-h">Your link in bio,<br />built to sell.</h2>
                                <p className="onb-brand-sub">A customizable page for all your links, socials &amp; everything you sell — one link in your bio.</p>
                            </div>

                            <ul className="onb-benefits">
                                <li><span className="onb-check">✓</span> A customizable link-in-bio page</li>
                                <li><span className="onb-check">✓</span> All your links &amp; socials in one place</li>
                                <li><span className="onb-check">✓</span> Sell products, courses &amp; memberships</li>
                            </ul>

                            <div className="onb-linkcard">
                                <span className="onb-linkcard-label">Your link</span>
                                <span className="onb-linkcard-url">skilljoy.me/@<b>{username || 'yourname'}</b></span>
                            </div>
                        </aside>

                    {/* ── Right: form card ── */}
                    <div className="onb-card">
                                <div className="onb-top">
                                    <span className="onb-step-label">Step 1 of {TOTAL_STEPS} · {STEP_LABELS[0]}</span>
                                </div>

                                <div className="onb-progress">
                                    {STEP_LABELS.map(label => (
                                        <span key={label} className="onb-progress-seg on" />
                                    ))}
                                </div>

                                <div className="onb-step">
                                    {/* ── Name + handle + bio ── */}
                                    <h1 className="onb-h1">Let’s set up your page</h1>
                                            <p className="onb-p">Tell your audience who you are and claim your link.</p>

                                            <div className="onb-field">
                                                <label htmlFor="name">Your name</label>
                                                <input id="name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Maya Chen" autoComplete="name" />
                                            </div>

                                            <div className="onb-field">
                                                <label htmlFor="phone">Confirm your phone number</label>
                                                <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. +1 555 123 4567" autoComplete="tel" />
                                                <p className="onb-hint">Pulled from sign-up — double-check it's correct. Used for account verification, never shown on your page.</p>
                                            </div>

                                            <div className="onb-field">
                                                <label htmlFor="username">Your page link</label>
                                                <div className={`onb-handle${usernameStatus === 'taken' || (username && usernameError(username)) ? ' bad' : (handleValid && usernameStatus === 'available') ? ' ok' : ''}`}>
                                                    <span className="onb-handle-prefix">skilljoy.me/@</span>
                                                    <input
                                                        id="username"
                                                        type="text"
                                                        value={username}
                                                        onChange={e => handleUsernameChange(e.target.value)}
                                                        placeholder="mayachen"
                                                        autoComplete="off"
                                                        autoCapitalize="none"
                                                        spellCheck={false}
                                                    />
                                                    <span className="onb-handle-state">
                                                        {handleValid && usernameStatus === 'checking' && <span className="onb-mini-spin" />}
                                                        {handleValid && usernameStatus === 'available' && '✓'}
                                                        {(usernameStatus === 'taken') && '✕'}
                                                    </span>
                                                </div>
                                                {username && usernameError(username) && <p className="onb-hint bad">{usernameError(username)}</p>}
                                                {handleValid && usernameStatus === 'available' && <p className="onb-hint ok">@{username} is yours ✨</p>}
                                                {handleValid && usernameStatus === 'taken' && <p className="onb-hint bad">That handle is taken — try another.</p>}
                                            </div>

                                            <div className="onb-field">
                                                <label htmlFor="bio">Short bio <span className="onb-opt">(optional)</span></label>
                                                <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. CS junior who loves code and music." rows={3} style={{ resize: 'vertical' }} />
                                            </div>

                                            <label className="onb-tos">
                                                <input type="checkbox" checked={agreedTos} onChange={e => setAgreedTos(e.target.checked)} />
                                                <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span>
                                            </label>
                                </div>

                                {error && <p className="form-error onb-err">{error}</p>}

                                <div className="onb-nav">
                                    <div />
                                    <button className="btn btn-primary" onClick={save} disabled={busy || !agreedTos}>
                                        {busy && <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: 16, height: 16 }} />}
                                        Save &amp; start building
                                    </button>
                                </div>
                    </div>
                </div>
            </div>

            <style>{`
        .onb {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            background: var(--bg);
            position: relative;
        }
        /* Ambient warmth — soft, restrained (no hard glows). */
        .onb::before {
            content: '';
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
                radial-gradient(58% 55% at 14% 8%, rgb(var(--accent-bright-rgb) / 0.08), transparent 68%),
                radial-gradient(48% 50% at 92% 96%, rgba(201, 151, 114, 0.07), transparent 70%);
        }

        .onb-shell {
            position: relative;
            width: 100%;
            max-width: 960px;
            display: grid;
            grid-template-columns: 0.82fr 1fr;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--r-2xl);
            box-shadow: var(--shadow-xl);
            overflow: hidden;
        }
        .onb-shell-solo { grid-template-columns: 1fr; max-width: 640px; }

        /* ── Brand / value panel ── */
        .onb-brand {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 30px;
            padding: 46px 40px;
            background: linear-gradient(158deg, var(--accent-light) 0%, var(--surface-alt) 100%);
            border-right: 1px solid var(--border);
        }
        .onb-logo {
            font-family: var(--font-display);
            font-weight: 800;
            font-size: 20px;
            letter-spacing: -0.02em;
            color: var(--text);
        }
        .onb-logo-img {
            height: 30px;
            width: auto;
            display: block;
        }
        .onb-brand-h {
            font-size: 30px;
            font-weight: 800;
            line-height: 1.12;
            letter-spacing: -0.025em;
            color: var(--text);
            margin-top: 26px;
        }
        .onb-brand-sub {
            font-size: 15px;
            color: var(--text-secondary);
            line-height: 1.55;
            margin-top: 12px;
            max-width: 30ch;
        }
        .onb-benefits {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 13px;
        }
        .onb-benefits li {
            display: flex;
            align-items: center;
            gap: 11px;
            font-size: 14px;
            font-weight: 500;
            color: var(--text-secondary);
        }
        .onb-check {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            flex-shrink: 0;
            border-radius: 50%;
            background: var(--accent);
            color: #fff;
            font-size: 11px;
            font-weight: 700;
        }
        .onb-linkcard {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 14px 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--r);
            box-shadow: var(--shadow-sm);
        }
        .onb-linkcard-label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
        }
        .onb-linkcard-url { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
        .onb-linkcard-url b { color: var(--accent); font-weight: 700; }

        /* ── Form card ── */
        .onb-card {
            display: flex;
            flex-direction: column;
            padding: 44px 44px 38px;
        }

        .onb-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        .onb-step-label {
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: var(--text-muted);
        }
        .onb-exit {
            width: auto;
            min-width: 0;
            padding: 0;
            background: none;
            border: none;
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            cursor: pointer;
        }
        .onb-exit:hover { color: var(--text); }

        .onb-progress {
            display: flex;
            gap: 6px;
            margin-bottom: 30px;
        }
        .onb-progress-seg {
            flex: 1;
            height: 5px;
            border-radius: var(--r-full);
            background: var(--border);
            transition: background 0.3s ease;
        }
        .onb-progress-seg.on { background: var(--accent); }

        .onb-step { animation: onbStep 0.32s ease; }
        @keyframes onbStep {
            from { opacity: 0; transform: translateY(9px); }
            to   { opacity: 1; transform: none; }
        }

        .onb-h1 {
            font-size: 27px;
            font-weight: 800;
            letter-spacing: -0.025em;
            line-height: 1.15;
            color: var(--text);
        }
        .onb-p {
            font-size: 15px;
            color: var(--text-secondary);
            line-height: 1.55;
            margin: 8px 0 26px;
        }

        .onb-field { display: flex; flex-direction: column; margin-bottom: 18px; }
        .onb-field label {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            color: var(--text-secondary);
            margin-bottom: 8px;
        }
        .onb-opt { color: var(--text-muted); font-weight: 500; text-transform: none; letter-spacing: 0; }

        /* ── "Claim your handle" input ── */
        .onb-handle {
            display: flex;
            align-items: center;
            border: 1.5px solid var(--border-strong);
            border-radius: var(--r);
            background: var(--surface);
            overflow: hidden;
            transition: border-color 0.15s, box-shadow 0.15s;
        }
        .onb-handle:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px rgb(var(--accent-rgb) / 0.15); }
        .onb-handle.ok { border-color: var(--accent); }
        .onb-handle.bad { border-color: #dc2626; }
        .onb-handle-prefix {
            padding: 0 2px 0 14px;
            font-size: 15px;
            color: var(--text-muted);
            white-space: nowrap;
            user-select: none;
        }
        .onb-handle input {
            flex: 1;
            border: none;
            outline: none;
            padding: 13px 6px 13px 0;
            background: transparent;
            font-size: 15px;
            box-shadow: none;
        }
        .onb-handle input:focus { box-shadow: none; }
        .onb-handle-state {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 40px;
            font-size: 15px;
            font-weight: 800;
            color: var(--text-muted);
        }
        .onb-handle.ok .onb-handle-state { color: var(--accent); }
        .onb-handle.bad .onb-handle-state { color: #dc2626; }
        .onb-mini-spin {
            width: 14px; height: 14px;
            border: 2px solid var(--border-strong);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }
        .onb-hint { font-size: 13px; font-weight: 500; margin-top: 7px; }
        .onb-hint.ok { color: var(--accent); }
        .onb-hint.bad { color: #dc2626; }

        /* ── Terms of Service agreement ── */
        .onb-tos {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-top: 20px;
            font-size: 13.5px;
            line-height: 1.5;
            color: var(--text-secondary);
            cursor: pointer;
        }
        .onb-tos input {
            width: 18px;
            height: 18px;
            margin-top: 1px;
            flex-shrink: 0;
            accent-color: var(--accent);
            cursor: pointer;
        }
        .onb-tos a { color: var(--accent); font-weight: 600; text-decoration: none; }
        .onb-tos a:hover { text-decoration: underline; }

        /* ── Nav + error ── */
        .onb-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 32px;
            padding-top: 22px;
            border-top: 1px solid var(--border);
        }
        .form-error.onb-err {
            font-size: 13px;
            color: #b91c1c;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: var(--r-sm);
            padding: 10px 14px;
            margin-top: 18px;
        }

        /* ── Responsive ── */
        @media (max-width: 820px) {
            .onb { padding: 24px 16px; align-items: flex-start; }
            .onb-shell, .onb-shell-solo { grid-template-columns: 1fr; max-width: 480px; }
            .onb-brand {
                padding: 28px 26px;
                border-right: none;
                border-bottom: 1px solid var(--border);
                gap: 18px;
            }
            .onb-brand-h { font-size: 24px; margin-top: 14px; }
            .onb-benefits { display: none; }
            .onb-card { padding: 30px 24px 26px; }
            .onb-h1 { font-size: 23px; }
        }
      `}</style>
        </>
    );
}
