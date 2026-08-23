import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';
import { LEGACY_MODE } from '@/lib/config';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SkillJoyLogo3 from '../../assets/SkillJoy-Logo2.svg'
import Logo from '@/components/Logo';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

// Base site URL with any trailing slash(es) stripped. Without this, a
// VITE_SITE_URL like "https://skilljoy.me/" + "/login" becomes
// "https://skilljoy.me//login" — a malformed redirect that Supabase rejects.
const SITE_URL = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/+$/, '');

export default function LoginPage() {
    const isRecovery = useRef(window.location.hash.includes('type=recovery'));
    const [mode, setMode] = useState(() =>
        window.location.hash.includes('type=recovery') ? 'new-password' : 'signin'
    );
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');       // collected at account creation
    const [phone, setPhone] = useState('');     // collected at account creation
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const user = useUser();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Where to land after auth: an explicit ?redirect=, else the v3 creator home.
    const redirectTo = searchParams.get('redirect') || (LEGACY_MODE ? '/matches' : '/build');

    // Intercept Supabase's PASSWORD_RECOVERY event before the redirect fires
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                isRecovery.current = true;
                setMode('new-password');
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // Central post-auth routing for EVERY sign-in path (password + Google OAuth).
    // OAuth logins land here via the session, not through submit(), so the
    // onboarding gate must live here — otherwise a new Google user (who has no
    // profile row yet) would skip onboarding and land profile-less on /build.
    useEffect(() => {
        if (!user || isRecovery.current) return;
        let alive = true;
        (async () => {
            const { data: profile } = await supabase
                .from('profiles').select('full_name, username').eq('id', user.id).maybeSingle();
            if (!alive) return;
            if (!profile?.full_name || (!LEGACY_MODE && !profile?.username)) navigate('/onboarding');
            else navigate(redirectTo);
        })();
        return () => { alive = false; };
    }, [user, navigate, redirectTo]);

    async function submit(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setBusy(true);
        try {
            if (mode === 'signup') {
                if (!name.trim()) throw new Error('Please enter a preferred name.');
                // Phone is OPTIONAL at signup (see note 169): it's required to
                // SELL, not to have an account, and demanding it at the least
                // committed moment costs signups. PhoneLock on /build asks for it
                // when the creator actually wants something in return.
                //
                // NOTE on `full_name`: the column keeps its legacy name, but what
                // we now collect and store is a PREFERRED name — a display name,
                // not a legal one. It has always rendered publicly as the
                // storefront display name, so this is both more private and more
                // honest about what the field really was. Renaming the column
                // touches ~30 call sites and a migration; see the exercise in
                // note 174 before attempting it.
                const { error: e } = await supabase.auth.signUp({
                    email, password,
                    options: {
                        data: {
                            full_name: name.trim(),
                            ...(phone.trim() ? { phone: phone.trim() } : {}),
                        },
                    },
                });
                if (e) throw e;
                setSuccess('Check your email to confirm your account, then sign in.');
            } else if (mode === 'reset') {
                const { error: e } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${SITE_URL}/login`,
                });
                if (e) throw e;
                setSuccess('Check your email for a password reset link.');
            } else if (mode === 'new-password') {
                if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
                if (newPassword !== confirmPassword) throw new Error('Passwords do not match.');
                const { error: e } = await supabase.auth.updateUser({ password: newPassword });
                if (e) throw e;
                await supabase.auth.signOut();
                isRecovery.current = false;
                setNewPassword('');
                setConfirmPassword('');
                setMode('signin');
                setSuccess('Password updated! Please sign in with your new password.');
            } else {
                const { error: e } = await supabase.auth.signInWithPassword({ email, password });
                if (e) throw e;
                // Routing (incl. the onboarding gate) is handled by the user effect
                // above, so password and Google logins share one code path.
            }
        } catch (e) {
            setError(e.message ?? 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    }

    async function signInWithGoogle() {
        setError('');
        // Preserve any ?redirect= so the user still lands where they were headed.
        const back = searchParams.get('redirect');
        const redirectUrl = `${SITE_URL}/login` + (back ? `?redirect=${encodeURIComponent(back)}` : '');
        const { error: e } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: redirectUrl },
        });
        if (e) setError(e.message);
    }

    function switchMode(next) {
        setMode(next);
        setError('');
        setSuccess('');
    }

    const titles = { signup: 'Create your account', signin: 'Welcome back', reset: 'Reset your password', 'new-password': 'Set a new password' };
    const subs = {
        signup: 'Start selling your skills from one link.',
        signin: 'Sign in to your storefront and Skills.',
        reset: "Enter your email and we'll send you a reset link.",
        'new-password': 'Choose a new password for your account.',
    };

    return (
        <>
            <title>Sign in — SkillJoy</title>

            <div className="login-bg">
                <div className="login-card fade-up">
                    <Logo height={45} />

                    <h1 className="login-title">{titles[mode]}</h1>
                    <p className="login-sub">{subs[mode]}</p>

                    <form onSubmit={submit} className="login-form">
                        {mode === 'new-password' ? (
                            <>
                                {/* One toggle for both fields — revealing "new"
                                    while "confirm" stays dotted doesn't let you
                                    check the thing you're actually checking. */}
                                <div className="field">
                                    <label htmlFor="new-password">New password</label>
                                    <div className="pw-wrap">
                                        <input
                                            id="new-password"
                                            type={showPw ? 'text' : 'password'}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="At least 6 characters"
                                            required
                                            minLength={6}
                                            autoComplete="new-password"
                                        />
                                        <button type="button" className="pw-eye" onClick={() => setShowPw(v => !v)}
                                            aria-pressed={showPw} aria-label={showPw ? 'Hide passwords' : 'Show passwords'}>
                                            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="field">
                                    <label htmlFor="confirm-password">Confirm password</label>
                                    <input
                                        id="confirm-password"
                                        type={showPw ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {mode === 'signup' && (
                                    <>
                                        <div className="field">
                                            <label htmlFor="name">Preferred name</label>
                                            <input
                                                id="name"
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Maya"
                                                required
                                                // "nickname", not "name": autofilling a legal name into a
                                                // field we deliberately don't want a legal name in would
                                                // undo the whole point of asking this way.
                                                autoComplete="nickname"
                                            />
                                            <span className="field-hint">
                                                What you want to be called — this shows on your public page.
                                                No need for your full or legal name.
                                            </span>
                                        </div>
                                        <div className="field">
                                            <label htmlFor="phone">
                                                Phone number <span className="field-optional">optional</span>
                                            </label>
                                            <input
                                                id="phone"
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="(555) 123-4567"
                                                autoComplete="tel"
                                            />
                                            <span className="field-hint">
                                                Only needed later, to verify your account before you sell. Never shown publicly.
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className="field">
                                    <label htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="you@email.com"
                                        required
                                        autoComplete="email"
                                    />
                                </div>

                                {mode !== 'reset' && (
                                    <div className="field">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <label htmlFor="password" style={{ margin: 0 }}>Password</label>
                                            {mode === 'signin' && (
                                                <button
                                                    type="button"
                                                    className="btn-text"
                                                    style={{ fontSize: 13 }}
                                                    onClick={() => switchMode('reset')}
                                                >
                                                    Forgot password?
                                                </button>
                                            )}
                                        </div>
                                        {/* Reveal matters most on SIGNUP — you're
                                            inventing a password you can't yet
                                            check against anything. */}
                                        <div className="pw-wrap">
                                            <input
                                                id="password"
                                                type={showPw ? 'text' : 'password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                                                required
                                                minLength={6}
                                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                            />
                                            <button type="button" className="pw-eye" onClick={() => setShowPw(v => !v)}
                                                aria-pressed={showPw} aria-label={showPw ? 'Hide password' : 'Show password'}>
                                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Says plainly what we don't ask for. Cheap to add, and
                            it's the difference between "optional" reading as
                            "we'll nag later" and reading as a real choice. */}
                        {mode === 'signup' && (
                            <p className="login-privacy">
                                <ShieldCheck size={14} />
                                <span>We don’t ask for your legal name or address. Just a name to show, and an email to reach you.</span>
                            </p>
                        )}

                        {error && <p className="form-error">{error}</p>}
                        {success && <p className="form-success">{success}</p>}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '4px' }}
                            disabled={busy}
                        >
                            {busy && (
                                <span
                                    className="spinner"
                                    style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
                                />
                            )}
                            {mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : mode === 'new-password' ? 'Set new password' : 'Sign in'}
                        </button>
                    </form>

                    {(mode === 'signin' || mode === 'signup') && (
                        <>
                            <div className="login-or"><span>or</span></div>
                            <button type="button" className="btn-google" onClick={signInWithGoogle} disabled={busy}>
                                <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.34A9 9 0 0 0 9 18z" />
                                    <path fill="#FBBC05" d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.02-2.34z" />
                                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.94l3.02 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
                                </svg>
                                Continue with Google
                            </button>
                        </>
                    )}

                    <div className="login-toggle">
                        {mode === 'reset' ? (
                            <>
                                Remember your password?{' '}
                                <button className="btn-text" onClick={() => switchMode('signin')}>
                                    Sign in
                                </button>
                            </>
                        ) : mode === 'signin' ? (
                            <>
                                Don't have an account?{' '}
                                <button className="btn-text" onClick={() => switchMode('signup')}>
                                    Sign up
                                </button>
                            </>
                        ) : (
                            <>
                                Already have an account?{' '}
                                <button className="btn-text" onClick={() => switchMode('signin')}>
                                    Sign in
                                </button>
                            </>
                        )}
                    </div>

                    {mode === 'signin' && (
                        <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                            Your username is your email address.
                        </p>
                    )}
                </div>
            </div>

            <style>{`
        .login-bg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: var(--bg);
          position: relative;
        }
        .login-bg::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 60% at 20% 20%, rgba(193, 123, 43, 0.07) 0%, transparent 60%),
            radial-gradient(ellipse 50% 50% at 80% 80%, rgba(212, 82, 42, 0.06) 0%, transparent 60%);
          pointer-events: none;
        }
        .login-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          padding: 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: var(--shadow-lg);
          position: relative;
        }
        .login-logo {
          display: block;
          font-family: var(--font-display);
          font-size: 22px;
          color: var(--text);
          margin-bottom: 32px;
          text-decoration: none;
        }
        .login-logo span { color: var(--accent); }

        .login-title { font-size: 28px; margin-bottom: 8px; }
        .login-sub   { font-size: 15px; color: var(--text-secondary); margin-bottom: 32px; }

        .login-form  { display: flex; flex-direction: column; gap: 18px; }
        .field       { display: flex; flex-direction: column; }
        .field label { font-size: 13px; font-weight: 700; color: var(--text); margin-bottom: 6px; }

        /* Helper text under a field. Carries the privacy promises ("never shown
           publicly", "no need for your legal name") that make an optional field
           read as genuinely optional rather than deferred. */
        .field-hint {
          font-size: 12.5px;
          line-height: 1.5;
          color: var(--text-muted);
          margin-top: 6px;
        }
        .field-optional {
          margin-left: 6px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          background: var(--border);
          padding: 2px 7px;
          border-radius: var(--r-full);
          vertical-align: middle;
        }

        /* Password reveal. The button sits INSIDE the field's box by padding the
           input rather than wrapping it in a bordered row — that way the global
           input styling (border, focus ring, radius) still applies to the real
           element instead of being reimplemented on a div. */
        .pw-wrap { position: relative; display: flex; }
        .pw-wrap input { padding-right: 44px; width: 100%; }
        .pw-eye {
          position: absolute;
          right: 4px;
          top: 50%;
          transform: translateY(-50%);
          width: 34px;
          height: 34px;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: var(--r-sm);
        }
        .pw-eye:hover { color: var(--text); background: var(--surface-alt); }

        .login-privacy {
          display: flex;
          gap: 9px;
          align-items: flex-start;
          margin: -2px 0 0;
          padding: 11px 13px;
          border-radius: var(--r);
          background: var(--surface-alt);
          border: 1px solid var(--border);
          font-size: 12.5px;
          line-height: 1.55;
          color: var(--text-secondary);
        }
        .login-privacy svg { flex-shrink: 0; margin-top: 1px; color: var(--green); }

        .form-error {
          font-size: 13px;
          color: var(--accent);
          background: var(--accent-light);
          border: 1px solid var(--accent-mid);
          border-radius: var(--r-sm);
          padding: 10px 14px;
        }
        .form-success {
          font-size: 13px;
          color: var(--green);
          background: var(--green-light);
          border: 1px solid var(--green-mid);
          border-radius: var(--r-sm);
          padding: 10px 14px;
        }

        .login-or {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 20px 0;
          color: var(--text-muted);
          font-size: 13px;
        }
        .login-or::before, .login-or::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .login-or span { padding: 0 12px; }
        .btn-google {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 11px;
          border: 1px solid var(--border-strong);
          border-radius: var(--r);
          background: var(--surface);
          color: var(--text);
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: background .12s ease, border-color .12s ease;
        }
        .btn-google:hover:not(:disabled) { background: var(--surface-alt); border-color: var(--text-muted); }
        .btn-google:disabled { opacity: .6; cursor: default; }

        .login-toggle {
          margin-top: 24px;
          text-align: center;
          font-size: 14px;
          color: var(--text-secondary);
        }
        .btn-text {
          background: none;
          border: none;
          color: var(--primary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          padding: 0 2px;
          text-decoration: underline;
          font-family: var(--font-body);
        }
        .btn-text:hover { color: var(--accent); }
      `}</style>
        </>
    );
}