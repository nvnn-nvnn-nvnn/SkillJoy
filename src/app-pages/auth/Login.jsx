import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/lib/stores';
import { useNavigate } from 'react-router-dom';
import SkillJoyLogo3 from '../../assets/SkillJoy-Logo2.svg'

export default function LoginPage() {
    const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [busy, setBusy] = useState(false);

    const user = useUser();
    const navigate = useNavigate();

    useEffect(() => {
        if (user) navigate('/matches');
    }, [user, navigate]);

    async function submit(e) {
        e.preventDefault();
        setError(''); setSuccess(''); setBusy(true);
        try {
            if (mode === 'signup') {
                const { error: e } = await supabase.auth.signUp({ email, password });
                if (e) throw e;
                setSuccess('Check your email to confirm your account, then sign in.');
            } else {
                const { error: e } = await supabase.auth.signInWithPassword({ email, password });
                if (e) throw e;
                const { data: { user: signedInUser } } = await supabase.auth.getUser();
                const { data: userProfile } = await supabase.from('profiles').select('full_name').eq('id', signedInUser.id).single();
                if (!userProfile?.full_name) {
                    navigate('/onboarding');
                } else {
                    navigate('/matches');
                }
            }
        } catch (e) {
            setError(e.message ?? 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    }

    function switchMode(next) {
        setMode(next);
        setError('');
        setSuccess('');
    }

    return (
        <>
            <title>Sign in — SkillJoy</title>

            <div className="login-bg">
                <div className="login-card fade-up">
                    {/* <a href="/" className="login-logo">
                        Skill<span>Joy</span>
                    </a> */}
                    <img 
                    style={{ height: '45px'}}
                    src={SkillJoyLogo3} alt="" />

                    <h1 className="login-title">
                        {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                    </h1>
                    <p className="login-sub">
                        {mode === 'signup'
                            ? 'Start swapping skills with students on your campus.'
                            : 'Sign in to see your matches and swaps.'}
                    </p>

                    <form onSubmit={submit} className="login-form">
                        <div className="field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@university.edu"
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor="password">Password</label>
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
                            {mode === 'signup' ? 'Create account' : 'Sign in'}
                        </button>
                    </form>

                    <div className="login-toggle">
                        {mode === 'signin' ? (
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