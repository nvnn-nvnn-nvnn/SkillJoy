import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';
import { LEGACY_MODE } from '@/lib/config';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SkillJoyLogo3 from '../../assets/SkillJoy-Logo2.svg'

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
                if (!name.trim()) throw new Error('Please enter your name.');
                if (!phone.trim()) throw new Error('Please enter your phone number.');
                // Name + phone are captured now (account creation) and carried in
                // user_metadata; the handle is claimed afterward in onboarding.
                const { error: e } = await supabase.auth.signUp({
                    email, password,
                    options: { data: { full_name: name.trim(), phone: phone.trim() } },
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
                    <img
                    style={{ height: '45px'}}
                    src={SkillJoyLogo3} alt="" />

                    <h1 className="login-title">{titles[mode]}</h1>
                    <p className="login-sub">{subs[mode]}</p>

                    <form onSubmit={submit} className="login-form">
                        {mode === 'new-password' ? (
                            <>
                                <div className="field">
                                    <label htmlFor="new-password">New password</label>
                                    <input
                                        id="new-password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="At least 6 characters"
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="field">
                                    <label htmlFor="confirm-password">Confirm password</label>
                                    <input
                                        id="confirm-password"
                                        type="password"
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
                                            <label htmlFor="name">Full name</label>
                                            <input
                                                id="name"
                                                type="text"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                placeholder="Maya Chen"
                                                required
                                                autoComplete="name"
                                            />
                                        </div>
                                        <div className="field">
                                            <label htmlFor="phone">Phone number</label>
                                            <input
                                                id="phone"
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="(555) 123-4567"
                                                required
                                                autoComplete="tel"
                                            />
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
                                        <input
                                            id="password"
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                                            required
                                            minLength={6}
                                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                        />
                                    </div>
                                )}
                            </>
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

        .login-form  { display: flex; flex-direction: column; gap: 20px; }
        .field       { display: flex; flex-direction: column; }

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