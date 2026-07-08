import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth, AVAILABILITY_OPTIONS } from '@/lib/stores';
import { LEGACY_MODE } from '@/lib/config';
import ProfileView from '@/components/Profileview';

const TOTAL_STEPS = 2;

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

const STEP_LABELS = ['About You', 'Availability'];

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
    const [availability, setAvailability] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);
    const [viewMode, setViewMode] = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (profile) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setFullName(profile.full_name ?? '');
            setUsername(profile.username ?? '');
            setBio(profile.bio ?? '');
            setAvailability(profile.availability ?? []);
            if (profile.full_name) setViewMode(true);
        } else {
            // New Google user has no profile row yet — prefill the name Google gave us.
            const meta = user.user_metadata || {};
            const googleName = meta.full_name || meta.name;
            if (googleName) setFullName(googleName);
        }
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

    // ── Availability toggle ──────────────────────────────────────────────────

    function toggleAvailability(opt) {
        setAvailability(prev =>
            prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]
        );
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    async function save() {
        if (!fullName.trim()) { setError('Please enter your name.'); return; }
        const uErr = usernameError(username);
        if (uErr) { setError(uErr); setStep(1); return; }
        if (usernameStatus === 'taken') { setError('That username is taken — try another.'); setStep(1); return; }

        setError(''); setBusy(true);
        const { error: e } = await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: fullName.trim(),
            username,
            bio: bio.trim(),
            availability,
        });
        setBusy(false);
        if (e) {
            // Unique-index violation on username races past the live check.
            setError(/duplicate|unique/i.test(e.message) ? 'That username was just taken — try another.' : e.message);
            return;
        }
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) setProfile(updated);
        navigate(LEGACY_MODE ? '/matches' : '/build');
    }

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            <title>Set up your profile — SkillJoy</title>

            <div className="onboard-bg">
                <div className="onboard-card fade-up">

                    {viewMode && profile ? (
                        <ProfileView
                            profile={profile}
                            acceptedSwapsCount={0}
                            onEdit={() => setViewMode(false)}
                        />
                    ) : (
                        <>
                            {/* Header: step dots + exit */}
                            <div className="onboard-header">
                                <div className="step-dots">
                                    {STEP_LABELS.map((label, i) => (
                                        <div key={label} className="step-dot-group">
                                            <div className={`step-dot ${i + 1 < step ? 'done' : ''} ${i + 1 === step ? 'current' : ''}`}>
                                                {i + 1 < step ? '\u2713' : i + 1}
                                            </div>
                                            <span className={`step-dot-label ${i + 1 === step ? 'current' : ''}`}>{label}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    className="btn btn-ghost exit-link"
                                    onClick={() => profile?.full_name ? setViewMode(true) : navigate('/')}
                                >
                                    {profile?.full_name ? 'Cancel' : 'Exit'}
                                </button>
                            </div>

                            {/* Progress bar */}
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
                            </div>

                            {/* ── Step 1: Name + Bio ── */}
                            {step === 1 && (
                                <div className="step-body">
                                    <h1 className="onboard-title">Let's set up your storefront</h1>
                                    <p className="onboard-sub">Tell your audience a little about you and claim your link.</p>
                                    <div className="field">
                                        <label htmlFor="name">Your full name</label>
                                        <input id="name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Maya Chen" autoComplete="name" />
                                    </div>
                                    <div className="field" style={{ marginTop: 20 }}>
                                        <label htmlFor="username">Your storefront link</label>
                                        <div className="username-input">
                                            <span className="username-prefix">skilljoy.me/@</span>
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
                                        </div>
                                        {username && usernameStatus === 'checking' && <p className="username-hint">Checking…</p>}
                                        {username && usernameStatus === 'available' && <p className="username-hint ok">✓ @{username} is available</p>}
                                        {username && usernameStatus === 'taken' && <p className="username-hint bad">That handle is taken</p>}
                                        {username && usernameError(username) && <p className="username-hint bad">{usernameError(username)}</p>}
                                    </div>
                                    <div className="field" style={{ marginTop: 20 }}>
                                        <label htmlFor="bio">
                                            Short bio <span className="label-optional">(optional)</span>
                                        </label>
                                        <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. CS junior who loves code and music." rows={3} style={{ resize: 'vertical' }} />
                                    </div>
                                </div>
                            )}

                            {/* ── Step 2: Availability ── */}
                            {step === 2 && (
                                <div className="step-body">
                                    <h1 className="onboard-title">When are you available?</h1>
                                    <p className="onboard-sub">Optional — helps buyers know when you can take coaching calls or sessions.</p>
                                    <div className="avail-grid">
                                        {AVAILABILITY_OPTIONS.map(opt => (
                                            <button
                                                key={opt}
                                                className={`avail-chip ${availability.includes(opt) ? 'active' : ''}`}
                                                onClick={() => toggleAvailability(opt)}
                                            >
                                                {opt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {error && <p className="form-error">{error}</p>}

                            {/* Nav */}
                            <div className="step-nav">
                                {step > 1 ? (
                                    <button className="btn btn-secondary" onClick={() => { setStep(s => s - 1); setError(''); }}>Back</button>
                                ) : (
                                    <div />
                                )}
                                {step < TOTAL_STEPS ? (
                                    <button className="btn btn-primary" onClick={() => { setError(''); setStep(s => s + 1); }}>Continue</button>
                                ) : (
                                    <button className="btn btn-primary" onClick={save} disabled={busy}>
                                        {busy && <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: 16, height: 16 }} />}
                                        Save & start building
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
        .onboard-bg {
            min-height: 100vh;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            padding: 40px 20px 80px;
            background: var(--bg);
        }
        .onboard-card {
            width: 100%;
            max-width: 620px;
            background: var(--surface);
            border-radius: 16px;
            padding: 36px 40px 40px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04);
        }

        /* ── Header ── */
        .onboard-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
        }
        .step-dots {
            display: flex;
            gap: 20px;
        }
        .step-dot-group {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 6px;
        }
        .step-dot {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 13px;
            font-weight: 600;
            border: 2px solid var(--border-strong);
            color: var(--text-muted);
            background: var(--surface);
            transition: all 0.2s ease;
        }
        .step-dot.current {
            border-color: var(--accent);
            color: var(--surface);
            background: var(--accent);
        }
        .step-dot.done {
            border-color: var(--accent);
            color: var(--accent);
            background: var(--accent-light);
        }
        .step-dot-label {
            font-size: 11px;
            color: var(--text-muted);
            font-weight: 500;
            letter-spacing: 0.02em;
        }
        .step-dot-label.current {
            color: var(--text);
            font-weight: 600;
        }
        .exit-link {
            font-size: 14px;
            color: var(--text-muted);
            padding: 6px 0;
            margin-top: 4px;
        }
        .exit-link:hover { color: var(--text); }

        /* ── Progress bar ── */
        .progress-bar {
            height: 4px;
            background: var(--border);
            border-radius: var(--r-full);
            margin-bottom: 32px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--accent), #e8774a);
            border-radius: var(--r-full);
            transition: width 0.35s ease;
        }

        /* ── Step body ── */
        .step-body { min-height: 200px; }

        .onboard-title {
            font-size: 28px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 6px;
            line-height: 1.2;
        }
        .onboard-sub {
            font-size: 15px;
            color: var(--text-secondary);
            margin-bottom: 32px;
            line-height: 1.5;
        }
        .label-optional {
            color: var(--text-muted);
            font-weight: 400;
            text-transform: none;
        }

        /* ── Username / storefront handle ── */
        .username-input {
            display: flex;
            align-items: center;
            border: 1.5px solid var(--border-strong);
            border-radius: var(--r);
            background: var(--surface);
            overflow: hidden;
        }
        .username-input:focus-within { border-color: var(--accent); }
        .username-prefix {
            padding: 0 4px 0 12px;
            font-size: 14px;
            color: var(--text-muted);
            white-space: nowrap;
            user-select: none;
        }
        .username-input input {
            border: none;
            outline: none;
            flex: 1;
            padding: 10px 12px 10px 0;
            background: transparent;
            font-size: 14px;
        }
        .username-hint { font-size: 13px; margin-top: 6px; color: var(--text-muted); }
        .username-hint.ok { color: #16a34a; }
        .username-hint.bad { color: var(--accent); }

        /* ── Skills ── */
        .skill-group { margin-bottom: 24px; }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .custom-input { display: flex; gap: 8px; margin-top: 24px; margin-bottom: 8px; }
        .custom-input input { flex: 1; }
        .selected-preview {
            margin-top: 24px;
            padding: 20px;
            background: var(--surface-alt);
            border-radius: var(--r);
            border: 1px solid var(--border);
        }

        /* ── Availability ── */
        .avail-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
        .avail-chip {
            padding: 10px 18px;
            border-radius: var(--r-full);
            border: 1.5px solid var(--border-strong);
            background: var(--surface);
            color: var(--text-secondary);
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }
        .avail-chip:hover {
            border-color: var(--accent-mid);
            background: var(--surface-alt);
        }
        .avail-chip.active {
            background: var(--accent-light);
            color: var(--accent);
            border-color: var(--accent);
            font-weight: 600;
        }

        /* ── Service type ── */
        .service-section { margin-top: 32px; }
        .service-options { display: flex; flex-direction: column; gap: 10px; }
        .service-option {
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            padding: 14px 16px;
            background: var(--surface);
            border-radius: var(--r);
            border: 1.5px solid var(--border);
            transition: all 0.15s ease;
        }
        .service-option:hover { border-color: var(--border-strong); }
        .service-option.selected {
            background: var(--surface-alt);
            border-color: var(--accent);
        }
        .service-option input[type="radio"] {
            width: 18px;
            height: 18px;
            accent-color: var(--accent);
            flex-shrink: 0;
        }
        .service-label {
            font-weight: 600;
            font-size: 15px;
            color: var(--text);
        }
        .service-desc {
            font-size: 13px;
            color: var(--text-muted);
            margin-top: 2px;
        }

        /* ── Nav + Error ── */
        .step-nav {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 36px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
        }
        .form-error {
            font-size: 13px;
            color: var(--accent);
            background: var(--accent-light);
            border: 1px solid var(--accent-mid);
            border-radius: var(--r-sm);
            padding: 10px 14px;
            margin-top: 16px;
        }

        /* ── Responsive ── */
        @media (max-width: 600px) {
            .onboard-card { padding: 28px 20px 32px; border-radius: 12px; }
            .onboard-title { font-size: 24px; }
            .step-dots { gap: 12px; }
            .step-dot { width: 28px; height: 28px; font-size: 12px; }
            .step-dot-label { font-size: 10px; }
        }
      `}</style>
        </>
    );
}
