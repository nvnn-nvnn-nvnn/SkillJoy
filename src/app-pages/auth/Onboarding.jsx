import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Check, ChevronLeft, Copy, ExternalLink, Sparkles, Lock, Zap,
    LifeBuoy, Palette, User as UserIcon, FileText, Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { TOS_VERSION } from '@/lib/config';
import Logo from '@/components/Logo';

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING — 5 screens, one decision each.
//
// Shape of the flow and why it is this shape:
//
//  1 Foundations   name + handle + ToS   ← the only REQUIRED screen
//  2 Discovery     where did you hear about us      (skippable)
//  3 Use case      what are you here to do          (skippable)
//  4 Plan          free vs paid                     (intent only)
//  5 Success       your link, copy it, go
//
// Two principles run through the whole thing:
//
//  · ONE DECISION PER SCREEN. Screen 1 is the only one that asks for typing,
//    and it's first because it's the only thing we actually need. Everything
//    after it is tap-only, which is why the flow feels short despite being
//    five screens — perceived length tracks effort, not screen count.
//
//  · SKIPPING IS FREE AND SILENT. Screens 2 and 3 are research, not
//    requirements. A skip is recorded as NULL, which is real data (a question
//    most people skip is a question not worth asking) and never blocks anyone.
//    Skip is a visible peer of Continue, not hidden — a skip people can't find
//    becomes a drop-off.
//
// Nothing after screen 1 can lose the account: the profile is written at the
// end of screen 1, so a user who closes the tab on screen 3 still has a working
// handle and page. Later screens patch that row. See `saveFoundations`.
// ═══════════════════════════════════════════════════════════════════════════

const TOTAL_STEPS = 5;
const STEP_LABELS = ['Your page', 'Discovery', 'Your goals', 'Your plan', 'All set'];

// Handles that collide with app routes — can't be claimed as a @username.
const RESERVED_USERNAMES = new Set([
    'build', 'locker', 'dashboard', 'login', 'onboarding', 'about', 'contact',
    'profile', 'settings', 'admin', 'terms', 'privacy', 'how-it-works',
    'refund-policy', 'gigs', 'swaps', 'matches', 'chat', 'disputes', 'my-orders',
    'my-listings', 'my-swaps', 'verify-college', 'main-search', 'api', 'health',
    'services', 'storefront', 'discover', 'analytics', 'rewards', 'unsubscribe',
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

// Keys are stable and stored; labels are free to be reworded later without
// invalidating past answers. (See migration 031.)
const DISCOVERY_OPTIONS = [
    { key: 'google', label: 'Google' },
    { key: 'bing', label: 'Bing' },
    { key: 'search_other', label: 'Another search engine' },
    { key: 'social_profile', label: 'On someone’s social profile' },
    { key: 'friend', label: 'A friend told me' },
    { key: 'other', label: 'Somewhere else' },
];

// MULTI-select, deliberately. "Brand promotion" and "personal store" describe
// the same creator far more often than not, and forcing one answer produces
// data that looks tidy and is quietly wrong.
const USE_CASE_OPTIONS = [
    { key: 'personal', label: 'Personal use', hint: 'A tidy home for my links' },
    { key: 'brand', label: 'Brand promotion', hint: 'Grow an audience' },
    { key: 'content', label: 'Content sharing', hint: 'Point people at my work' },
    { key: 'selling', label: 'Selling', hint: 'Products, courses, coaching' },
    { key: 'other', label: 'Something else', hint: '' },
];

export default function OnboardingPage() {
    const user = useUser();
    const profile = useProfile();
    const { setProfile, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);

    // Screen 1
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameStatus, setUsernameStatus] = useState(null); // null|'checking'|'available'|'taken'
    const [agreedTos, setAgreedTos] = useState(false);

    // Screens 2–4
    const [discovery, setDiscovery] = useState(null);
    const [discoveryOther, setDiscoveryOther] = useState('');
    const [useCases, setUseCases] = useState([]);
    const [useCaseOther, setUseCaseOther] = useState('');
    const [planIntent, setPlanIntent] = useState(null);
    const [learnMoreOpen, setLearnMoreOpen] = useState(false);

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);

    const liveRef = useRef(null); // polite announcements for screen readers

    // `startedFlow` flips the moment screen 1 writes a username. That's the ONE
    // thing that distinguishes the two cases which otherwise look identical
    // ("profile has a username"):
    //
    //   arrived already onboarded  → bounce to /build
    //   became onboarded just now  → stay, they're on screen 2 of their own flow
    //
    // An earlier version used a run-once ref instead. That broke sign-in: on a
    // later auth change `loading` was already false while `profile` was still
    // null, so the ref latched against a null profile and a returning user got
    // stuck here. The redirect check now re-runs on every profile change, which
    // is safe precisely because startedFlow makes the two cases distinguishable.
    const startedFlow = useRef(false);
    const prefilled = useRef(false);
    useEffect(() => {
        if (authLoading) return;
        if (!user) { navigate('/login'); return; }
        if (profile?.username && !startedFlow.current) { navigate('/build', { replace: true }); return; }
        if (prefilled.current) return;
        prefilled.current = true;
        // One-time prefill from async auth data (guarded by `prefilled` above).
        const meta = user.user_metadata || {};
        setFullName(profile?.full_name || meta.full_name || meta.name || '');
        setUsername(profile?.username ?? '');
    }, [user, profile, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

    // Moving between screens must return focus to the top, or a keyboard/screen
    // reader user stays parked wherever the last button was and never hears the
    // new heading.
    const headingRef = useRef(null);
    useEffect(() => { headingRef.current?.focus(); }, [step]);

    // ── Username availability (debounced) ────────────────────────────────────
    function handleUsernameChange(raw) {
        const n = normalizeUsername(raw);
        setUsername(n);
        setUsernameStatus(usernameError(n) ? null : 'checking');
    }

    useEffect(() => {
        if (usernameError(username)) return;
        const name = username;
        let cancelled = false;
        const t = setTimeout(async () => {
            const { data, error: e } = await supabase
                .from('profiles').select('id').ilike('username', name).maybeSingle();
            if (cancelled) return;
            if (e) { setUsernameStatus(null); return; }
            setUsernameStatus(!data || data.id === user?.id ? 'available' : 'taken');
        }, 400);
        return () => { cancelled = true; clearTimeout(t); };
    }, [username, user?.id]);

    // ── Persistence ──────────────────────────────────────────────────────────

    // Screen 1 writes the real row. Everything after this point is a patch, so
    // abandoning the flow mid-survey still leaves a usable account.
    async function saveFoundations() {
        if (!fullName.trim()) { setError('Please enter your name.'); return; }
        const uErr = usernameError(username);
        if (uErr) { setError(uErr); return; }
        if (usernameStatus === 'taken') { setError('That handle is taken — try another.'); return; }
        if (usernameStatus === 'checking') { setError('Just checking that handle — one moment.'); return; }
        if (!agreedTos) { setError('Please accept the Terms and Privacy Policy to continue.'); return; }

        setError(''); setBusy(true);
        const { error: e } = await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: fullName.trim(),
            username,
            tos_accepted_at: new Date().toISOString(),
            tos_version: TOS_VERSION,
        });
        setBusy(false);
        if (e) {
            // A unique-index violation means someone claimed it between our
            // check and our write. Rare, but the only honest recovery is to
            // send them back to the field.
            setError(/duplicate|unique/i.test(e.message)
                ? 'That handle was just claimed — try another.'
                : e.message);
            setUsernameStatus('taken');
            return;
        }
        // From here on this profile HAS a username. Tell the entry guard that we
        // are the ones who put it there, so it stops trying to eject us to /build.
        startedFlow.current = true;
        setStep(2);
    }

    // Survey patches are FIRE-AND-FORGET by design: this is optional research,
    // and a failed analytics write must never block someone from finishing
    // signup. Logged, not surfaced.
    const patchProfile = useCallback(async (patch) => {
        const { error: e } = await supabase.from('profiles').update(patch).eq('id', user.id);
        if (e) console.warn('[onboarding] survey patch failed:', e.message);
    }, [user?.id]);

    function goDiscovery(skip = false) {
        patchProfile(skip ? { discovery_source: null } : {
            discovery_source: discovery,
            discovery_source_other: discovery === 'other' ? (discoveryOther.trim() || null) : null,
        });
        setStep(3);
    }

    function goUseCase(skip = false) {
        patchProfile(skip ? { use_cases: null } : {
            use_cases: useCases.length ? useCases : null,
            use_case_other: useCases.includes('other') ? (useCaseOther.trim() || null) : null,
        });
        setStep(4);
    }

    function choosePlan(intent) {
        setPlanIntent(intent);
        patchProfile({ plan_intent: intent, onboarding_completed_at: new Date().toISOString() });
        setStep(5);
    }

    async function finish(dest) {
        setBusy(true);
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) setProfile(updated);
        navigate(dest);
    }

    const pageUrl = `skilljoy.me/@${username}`;
    const fullUrl = `https://skilljoy.me/@${username}`;

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(fullUrl);
            setCopied(true);
            if (liveRef.current) liveRef.current.textContent = 'Link copied to clipboard';
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API needs a secure context and can be blocked outright.
            // Select-the-text is the honest fallback rather than a silent no-op.
            setError('Couldn’t copy automatically — select the link above and copy it.');
        }
    }

    function toggleUseCase(key) {
        setUseCases(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    }

    const handleValid = username && !usernameError(username);
    const canContinue1 = !!fullName.trim() && handleValid && usernameStatus === 'available' && agreedTos;

    return (
        <>
            <title>Set up your page — SkillJoy</title>

            <div className="onb">
                <div className="onb-shell">

                    {/* ── Brand panel — copy tracks the current step so it feels
                        like part of the flow rather than static decoration. ── */}
                    <aside className="onb-brand">
                        <div>
                            <Logo height={30} className="onb-logo-img" />
                            <h2 className="onb-brand-h">
                                {step === 5 ? <>Your page is<br />ready to share.</> : <>Your link in bio,<br />built to sell.</>}
                            </h2>
                            <p className="onb-brand-sub">
                                {step === 5
                                    ? 'Everything you make and sell, behind one link.'
                                    : 'A customizable page for all your links, socials & everything you sell — one link in your bio.'}
                            </p>
                        </div>

                        <ul className="onb-benefits">
                            <li><span className="onb-check"><Check size={12} strokeWidth={3} /></span> A customizable link-in-bio page</li>
                            <li><span className="onb-check"><Check size={12} strokeWidth={3} /></span> All your links &amp; socials in one place</li>
                            <li><span className="onb-check"><Check size={12} strokeWidth={3} /></span> Sell products, courses &amp; memberships</li>
                        </ul>

                        <div className="onb-linkcard">
                            <span className="onb-linkcard-label">Your link</span>
                            <span className="onb-linkcard-url">skilljoy.me/@<b>{username || 'yourname'}</b></span>
                        </div>
                    </aside>

                    {/* ── Form card ── */}
                    <div className="onb-card">
                        <div className="onb-top">
                            {step > 1 && step < 5 && (
                                <button type="button" className="onb-back" onClick={() => { setError(''); setStep(s => s - 1); }}>
                                    <ChevronLeft size={15} /> Back
                                </button>
                            )}
                            <span className="onb-step-label">Step {step} of {TOTAL_STEPS} · {STEP_LABELS[step - 1]}</span>
                        </div>

                        <div className="onb-progress" role="progressbar" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step} aria-label="Onboarding progress">
                            {STEP_LABELS.map((label, i) => (
                                <span key={label} className={`onb-progress-seg${i < step ? ' on' : ''}`} />
                            ))}
                        </div>

                        {/* Announcements for assistive tech (copy success, etc.) */}
                        <span ref={liveRef} className="onb-sr" aria-live="polite" />

                        <div className="onb-step" key={step}>

                            {/* ══ 1 · Foundations ══ */}
                            {step === 1 && (
                                <>
                                    <h1 className="onb-h1" tabIndex={-1} ref={headingRef}>Claim your link</h1>
                                    <p className="onb-p">This is the address you’ll share. You can change it later.</p>

                                    <div className="onb-field">
                                        <label htmlFor="name">Preferred name</label>
                                        <input id="name" type="text" value={fullName}
                                            onChange={e => { setFullName(e.target.value); if (error) setError(''); }}
                                            placeholder="e.g. Maya" autoComplete="nickname" />
                                    </div>

                                    <div className="onb-field">
                                        <label htmlFor="username">Your page link</label>
                                        <div className={`onb-handle${usernameStatus === 'taken' || (username && usernameError(username)) ? ' bad' : (handleValid && usernameStatus === 'available') ? ' ok' : ''}`}>
                                            <span className="onb-handle-prefix">skilljoy.me/@</span>
                                            <input id="username" type="text" value={username}
                                                onChange={e => { handleUsernameChange(e.target.value); if (error) setError(''); }}
                                                placeholder="mayachen" autoComplete="off" autoCapitalize="none" spellCheck={false}
                                                aria-describedby="handle-state" />
                                            <span className="onb-handle-state" aria-hidden="true">
                                                {handleValid && usernameStatus === 'checking' && <Loader2 size={14} className="onb-spin" />}
                                                {handleValid && usernameStatus === 'available' && <Check size={14} strokeWidth={3} />}
                                                {usernameStatus === 'taken' && '✕'}
                                            </span>
                                        </div>
                                        <p className="onb-hint" id="handle-state" aria-live="polite">
                                            {username && usernameError(username) ? <span className="bad">{usernameError(username)}</span>
                                                : handleValid && usernameStatus === 'checking' ? 'Checking…'
                                                : handleValid && usernameStatus === 'available' ? <span className="ok">@{username} is available</span>
                                                : handleValid && usernameStatus === 'taken' ? <span className="bad">That handle is taken — try another.</span>
                                                : 'Letters, numbers and underscores. 3–20 characters.'}
                                        </p>
                                    </div>

                                    <label className="onb-tos">
                                        <input type="checkbox" checked={agreedTos}
                                            onChange={e => { setAgreedTos(e.target.checked); if (error) setError(''); }} />
                                        <span>
                                            I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> and{' '}
                                            <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                                        </span>
                                    </label>

                                    {error && <p className="onb-error" role="alert">{error}</p>}

                                    <button className="onb-cta" onClick={saveFoundations} disabled={busy || !canContinue1}>
                                        {busy ? <><Loader2 size={16} className="onb-spin" /> Creating your page…</> : 'Continue'}
                                    </button>
                                </>
                            )}

                            {/* ══ 2 · Discovery ══ */}
                            {step === 2 && (
                                <>
                                    <h1 className="onb-h1" tabIndex={-1} ref={headingRef}>How did you find SkillJoy?</h1>
                                    <p className="onb-p">This helps us know where to show up. One tap, then you’re moving.</p>

                                    <div className="onb-options" role="radiogroup" aria-label="How did you find SkillJoy?">
                                        {DISCOVERY_OPTIONS.map(o => (
                                            <button key={o.key} type="button" role="radio" aria-checked={discovery === o.key}
                                                className={`onb-option${discovery === o.key ? ' on' : ''}`}
                                                onClick={() => setDiscovery(o.key)}>
                                                <span className="onb-radio" aria-hidden="true">{discovery === o.key && <Check size={12} strokeWidth={3} />}</span>
                                                <span className="onb-option-label">{o.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {discovery === 'other' && (
                                        <div className="onb-field onb-reveal">
                                            <label htmlFor="disc-other">Where was it?</label>
                                            <input id="disc-other" type="text" value={discoveryOther} autoFocus
                                                onChange={e => setDiscoveryOther(e.target.value)}
                                                placeholder="e.g. a Discord server, a newsletter…" />
                                        </div>
                                    )}

                                    <div className="onb-actions">
                                        <button className="onb-skip" onClick={() => goDiscovery(true)}>Skip</button>
                                        <button className="onb-cta onb-cta-inline" onClick={() => goDiscovery(false)} disabled={!discovery}>Continue</button>
                                    </div>
                                </>
                            )}

                            {/* ══ 3 · Use case ══ */}
                            {step === 3 && (
                                <>
                                    <h1 className="onb-h1" tabIndex={-1} ref={headingRef}>What brings you here?</h1>
                                    <p className="onb-p">Pick as many as fit — we’ll tune your setup around them.</p>

                                    <div className="onb-options" role="group" aria-label="How do you plan to use SkillJoy?">
                                        {USE_CASE_OPTIONS.map(o => {
                                            const on = useCases.includes(o.key);
                                            return (
                                                <button key={o.key} type="button" role="checkbox" aria-checked={on}
                                                    className={`onb-option${on ? ' on' : ''}`}
                                                    onClick={() => toggleUseCase(o.key)}>
                                                    <span className="onb-checkbox" aria-hidden="true">{on && <Check size={12} strokeWidth={3} />}</span>
                                                    <span className="onb-option-body">
                                                        <span className="onb-option-label">{o.label}</span>
                                                        {o.hint && <span className="onb-option-hint">{o.hint}</span>}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {useCases.includes('other') && (
                                        <div className="onb-field onb-reveal">
                                            <label htmlFor="uc-other">Tell us a bit more</label>
                                            <input id="uc-other" type="text" value={useCaseOther} autoFocus
                                                onChange={e => setUseCaseOther(e.target.value)}
                                                placeholder="e.g. a portfolio for client work" />
                                        </div>
                                    )}

                                    <div className="onb-actions">
                                        <button className="onb-skip" onClick={() => goUseCase(true)}>Skip</button>
                                        <button className="onb-cta onb-cta-inline" onClick={() => goUseCase(false)} disabled={!useCases.length}>Continue</button>
                                    </div>
                                </>
                            )}

                            {/* ══ 4 · Plan ══ */}
                            {step === 4 && (
                                <>
                                    <h1 className="onb-h1" tabIndex={-1} ref={headingRef}>Pick where to start</h1>
                                    <p className="onb-p">You can switch at any time — nothing here is locked in.</p>

                                    <div className="onb-plans">
                                        <div className="onb-plan">
                                            <span className="onb-plan-name">Free</span>
                                            <span className="onb-plan-price">$0<span>/month</span></span>
                                            <p className="onb-plan-sub">Everything you need to put your links somewhere good.</p>
                                            <ul className="onb-plan-list">
                                                <li><Check size={13} strokeWidth={3} /> Your link-in-bio page</li>
                                                <li><Check size={13} strokeWidth={3} /> Unlimited links &amp; socials</li>
                                                <li><Check size={13} strokeWidth={3} /> Themes and customization</li>
                                                <li><Check size={13} strokeWidth={3} /> No verification needed</li>
                                            </ul>
                                            <button className="onb-plan-btn" onClick={() => choosePlan('free')} disabled={busy}>
                                                Start free
                                            </button>
                                        </div>

                                        <div className="onb-plan onb-plan-pro">
                                            <span className="onb-plan-flag"><Sparkles size={11} /> For selling</span>
                                            <span className="onb-plan-name">Pro</span>
                                            <span className="onb-plan-price">14 days free<span>then billed monthly</span></span>
                                            <p className="onb-plan-sub">Everything in Free, plus the tools to actually take money.</p>
                                            <ul className="onb-plan-list">
                                                <li><Zap size={13} strokeWidth={3} /> Sell products, courses &amp; coaching</li>
                                                <li><Zap size={13} strokeWidth={3} /> Bookings, checkout &amp; payouts</li>
                                                <li><Zap size={13} strokeWidth={3} /> Email capture &amp; analytics</li>
                                                <li><Zap size={13} strokeWidth={3} /> Discount codes &amp; order bumps</li>
                                            </ul>
                                            <p className="onb-plan-verify">
                                                <Lock size={12} /> To sell, we verify your <strong>name, email and phone</strong>. It keeps
                                                payouts secure — nothing is charged today, and you can add your number later.
                                            </p>
                                            <button className="onb-plan-btn onb-plan-btn-primary" onClick={() => choosePlan('paid')} disabled={busy}>
                                                Start with Pro
                                            </button>
                                        </div>
                                    </div>

                                    <button className="onb-learn" onClick={() => setLearnMoreOpen(v => !v)} aria-expanded={learnMoreOpen}>
                                        {learnMoreOpen ? 'Hide details' : 'Learn more about Pro'}
                                    </button>
                                    {learnMoreOpen && (
                                        <div className="onb-learnbody onb-reveal">
                                            <p><strong>Nothing is charged today.</strong> Pro starts a 14-day free trial when you publish your first paid product. We capture a card at that point and the first payment is on day 14 — cancel before then and you pay nothing.</p>
                                            <p><strong>Why verification?</strong> Taking payments means money moves to a real person. Your name, email and phone confirm that. Your phone is never shown on your page or given to buyers.</p>
                                            <p><strong>Free stays free.</strong> Choosing Pro now doesn’t remove anything from Free, and you can stay on Free as long as you like.</p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ══ 5 · Success ══ */}
                            {step === 5 && (
                                <>
                                    <div className="onb-celebrate" aria-hidden="true">
                                        <span className="onb-celebrate-ring"><Check size={26} strokeWidth={3} /></span>
                                    </div>

                                    <h1 className="onb-h1 onb-h1-center" tabIndex={-1} ref={headingRef}>You’re live, {fullName.split(' ')[0] || 'friend'} 🎉</h1>
                                    <p className="onb-p onb-p-center">Your page exists. Share the link, then make it yours.</p>

                                    <div className="onb-urlbox">
                                        <span className="onb-urltext">{pageUrl}</span>
                                    </div>

                                    <div className="onb-urlactions">
                                        <button className={`onb-copy${copied ? ' done' : ''}`} onClick={copyLink}>
                                            {copied ? <><Check size={15} strokeWidth={3} /> Copied</> : <><Copy size={15} /> Copy link</>}
                                        </button>
                                        <a className="onb-openbtn" href={`/@${username}`} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink size={15} /> Open page
                                        </a>
                                    </div>

                                    {error && <p className="onb-error" role="alert">{error}</p>}

                                    <div className="onb-quick">
                                        <p className="onb-quick-head">Quick links</p>
                                        <div className="onb-quick-grid">
                                            <button className="onb-quick-item" onClick={() => finish('/profile')}><UserIcon size={15} /> Account</button>
                                            <button className="onb-quick-item" onClick={() => finish('/storefront/edit')}><Palette size={15} /> Customize</button>
                                            <button className="onb-quick-item" onClick={() => finish('/contact')}><LifeBuoy size={15} /> Support</button>
                                            <button className="onb-quick-item" onClick={() => finish('/how-it-works')}><Sparkles size={15} /> Help</button>
                                            <a className="onb-quick-item" href="/terms" target="_blank" rel="noopener noreferrer"><FileText size={15} /> Terms</a>
                                        </div>
                                    </div>

                                    <button className="onb-cta" onClick={() => finish('/storefront/edit')} disabled={busy}>
                                        {busy ? 'Opening…' : planIntent === 'paid' ? 'Start building' : 'Customize my page'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Styles />
        </>
    );
}

function Styles() {
    return <style>{`
    .onb { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px 16px; background:var(--bg); }
    .onb-shell { display:grid; grid-template-columns:minmax(0,0.85fr) minmax(0,1fr); gap:0; width:100%; max-width:940px;
      background:var(--surface); border:1px solid var(--border); border-radius:var(--r-2xl); overflow:hidden; box-shadow:var(--shadow-xl); }
    .onb-sr { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }

    /* ── Brand panel ── */
    .onb-brand { display:flex; flex-direction:column; justify-content:space-between; gap:28px; padding:38px 32px;
      background:linear-gradient(160deg, var(--accent-light), var(--surface-alt)); border-right:1px solid var(--border); }
    .onb-logo-img { margin-bottom:26px; }
    .onb-brand-h { font-size:26px; font-weight:800; letter-spacing:-.02em; line-height:1.2; color:var(--text); font-family:var(--font-display); margin:0; }
    .onb-brand-sub { font-size:14px; line-height:1.6; color:var(--text-secondary); margin:12px 0 0; }
    .onb-benefits { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:11px; }
    .onb-benefits li { display:flex; gap:10px; align-items:flex-start; font-size:13.5px; line-height:1.5; color:var(--text-secondary); }
    .onb-check { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px;
      margin-top:1px; border-radius:var(--r-full); background:var(--accent); color:var(--accent-foreground); }
    .onb-linkcard { padding:13px 15px; border-radius:var(--r); background:var(--surface); border:1px solid var(--border); }
    .onb-linkcard-label { display:block; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin-bottom:5px; }
    .onb-linkcard-url { font-size:14px; color:var(--text-secondary); word-break:break-all; }
    .onb-linkcard-url b { color:var(--accent); font-weight:700; }

    /* ── Card ── */
    .onb-card { padding:34px 34px 30px; display:flex; flex-direction:column; min-width:0; }
    .onb-top { display:flex; align-items:center; gap:12px; margin-bottom:10px; min-height:24px; }
    .onb-back { display:inline-flex; align-items:center; gap:3px; padding:4px 9px 4px 5px; width:auto; border:none;
      background:none; color:var(--text-muted); font-size:12.5px; font-weight:700; font-family:inherit; cursor:pointer; border-radius:var(--r-sm); }
    .onb-back:hover { background:var(--surface-alt); color:var(--text); }
    .onb-step-label { margin-left:auto; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-muted); }

    .onb-progress { display:flex; gap:5px; margin-bottom:26px; }
    .onb-progress-seg { flex:1; height:4px; border-radius:var(--r-full); background:var(--border);
      transition:background .35s cubic-bezier(.4,0,.2,1); }
    .onb-progress-seg.on { background:var(--accent); }

    .onb-step { display:flex; flex-direction:column; animation:onbIn .28s cubic-bezier(.2,.9,.3,1); }
    @keyframes onbIn { from { opacity:0; transform:translateY(8px); } }

    .onb-h1 { font-size:26px; font-weight:800; letter-spacing:-.02em; line-height:1.2; color:var(--text);
      font-family:var(--font-display); margin:0 0 8px; outline:none; }
    .onb-h1-center, .onb-p-center { text-align:center; }
    .onb-p { font-size:14.5px; line-height:1.6; color:var(--text-secondary); margin:0 0 22px; }

    .onb-field { display:flex; flex-direction:column; margin-bottom:16px; }
    .onb-field label { font-size:12.5px; font-weight:700; color:var(--text); margin-bottom:6px; }
    .onb-optional { margin-left:6px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em;
      color:var(--text-muted); background:var(--border); padding:2px 7px; border-radius:var(--r-full); vertical-align:middle; }
    .onb-hint { font-size:12.5px; font-weight:500; margin-top:7px; color:var(--text-muted); }
    .onb-hint .ok, .ok { color:var(--green, #3d8168); }
    .onb-hint .bad, .bad { color:var(--danger); }
    .onb-reveal { animation:onbReveal .22s ease; }
    @keyframes onbReveal { from { opacity:0; transform:translateY(-4px); } }

    .onb-handle { display:flex; align-items:center; border:1.5px solid var(--border-strong); border-radius:var(--r);
      background:var(--surface); overflow:hidden; transition:border-color .15s ease, box-shadow .15s ease; }
    .onb-handle:focus-within { border-color:var(--accent); box-shadow:0 0 0 3px rgb(var(--accent-rgb) / .18); }
    .onb-handle.ok { border-color:var(--green-mid, #9ecdb8); }
    .onb-handle.bad { border-color:var(--danger); }
    .onb-handle-prefix { padding-left:13px; font-size:14px; color:var(--text-muted); white-space:nowrap; }
    .onb-handle input { border:none; background:none; padding:12px 6px; flex:1; min-width:0; }
    .onb-handle input:focus { outline:none; }
    .onb-handle-state { display:inline-flex; align-items:center; justify-content:center; width:34px; flex-shrink:0; color:var(--green, #3d8168); }
    .onb-handle.bad .onb-handle-state { color:var(--danger); }
    .onb-spin { animation:onbRot .8s linear infinite; }
    @keyframes onbRot { to { transform:rotate(360deg); } }

    .onb-tos { display:flex; gap:10px; align-items:flex-start; margin:6px 0 20px; font-size:13px;
      line-height:1.55; color:var(--text-secondary); cursor:pointer; }
    .onb-tos input { width:17px; height:17px; flex:0 0 17px; margin:1px 0 0; padding:0; accent-color:var(--accent); cursor:pointer; }
    .onb-tos a { color:var(--accent); font-weight:600; text-decoration:underline; text-underline-offset:2px; }

    /* ── Option lists (screens 2 & 3) ── */
    .onb-options { display:flex; flex-direction:column; gap:8px; margin-bottom:18px; }
    .onb-option { display:flex; align-items:center; gap:11px; width:100%; padding:13px 15px; text-align:left;
      border:1.5px solid var(--border); border-radius:var(--r); background:var(--surface); cursor:pointer;
      font-family:inherit; white-space:normal; transition:border-color .13s ease, background .13s ease, transform .13s ease; }
    .onb-option:hover { border-color:var(--accent-mid); background:var(--surface-alt); }
    .onb-option:active { transform:scale(.99); }
    .onb-option.on { border-color:var(--accent); background:var(--accent-light); }
    .onb-option:focus-visible { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgb(var(--accent-rgb) / .22); }
    .onb-radio, .onb-checkbox { flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;
      width:20px; height:20px; border:1.5px solid var(--border-strong); background:var(--surface); color:var(--accent-foreground); }
    .onb-radio { border-radius:var(--r-full); }
    .onb-checkbox { border-radius:5px; }
    .onb-option.on .onb-radio, .onb-option.on .onb-checkbox { background:var(--accent); border-color:var(--accent); }
    .onb-option-body { display:flex; flex-direction:column; gap:1px; min-width:0; }
    .onb-option-label { font-size:14px; font-weight:600; color:var(--text); }
    .onb-option-hint { font-size:12px; color:var(--text-muted); }

    /* ── Actions ── */
    .onb-cta { width:100%; margin-top:6px; padding:14px 24px; border:none; border-radius:var(--r-full);
      background:var(--accent); color:var(--accent-foreground); font-size:15px; font-weight:700; font-family:inherit;
      cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px;
      transition:background .15s ease, transform .13s ease; }
    .onb-cta:hover:not(:disabled) { background:var(--accent-hover); transform:translateY(-1px); }
    .onb-cta:disabled { opacity:.45; cursor:default; }
    .onb-actions { display:flex; align-items:center; gap:10px; margin-top:4px; }
    .onb-cta-inline { flex:1; margin-top:0; }
    /* Skip is a visible peer of Continue, never hidden — a skip people can't
       find turns into an abandon. Quiet, but present and full height. */
    .onb-skip { padding:14px 20px; width:auto; flex-shrink:0; border:1.5px solid var(--border-strong);
      border-radius:var(--r-full); background:var(--surface); color:var(--text-secondary);
      font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; }
    .onb-skip:hover { background:var(--surface-alt); color:var(--text); }

    .onb-error { margin:0 0 14px; padding:10px 13px; border-radius:var(--r-sm); font-size:13px; font-weight:600;
      color:var(--danger); background:var(--danger-light); border:1px solid var(--danger-mid); }

    /* ── Plans ── */
    /* Stacked at every width, not side-by-side. Two dense feature lists in
       parallel columns force the eye to ping-pong to compare them; one under the
       other is read top-to-bottom in a single pass. It also means the mobile and
       desktop layouts are the same shape, so only one has to be got right. */
    .onb-plans { display:flex; flex-direction:column; gap:12px; margin-bottom:14px; }
    .onb-plan { position:relative; display:flex; flex-direction:column; padding:20px 18px; border:1.5px solid var(--border);
      border-radius:var(--r-lg); background:var(--surface); }
    /* Pro is distinguished by an accent border and a flag, NOT by making Free
       look broken — a crippled-looking free tier reads as bait. */
    .onb-plan-pro { border-color:var(--accent); box-shadow:0 8px 24px rgb(var(--accent-rgb) / .13); }
    .onb-plan-flag { position:absolute; top:-9px; left:18px; display:inline-flex; align-items:center; gap:4px;
      padding:3px 9px; border-radius:var(--r-full); background:var(--accent); color:var(--accent-foreground);
      font-size:9.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; }
    .onb-plan-name { font-size:13px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; color:var(--text-muted); }
    .onb-plan-price { display:block; margin-top:6px; font-size:22px; font-weight:800; letter-spacing:-.02em; color:var(--text); }
    .onb-plan-price span { display:block; font-size:11.5px; font-weight:600; color:var(--text-muted); letter-spacing:0; margin-top:2px; }
    .onb-plan-sub { font-size:12.5px; line-height:1.55; color:var(--text-secondary); margin:10px 0 12px; }
    .onb-plan-list { list-style:none; margin:0 0 14px; padding:0; display:flex; flex-direction:column; gap:8px; flex:1; }
    .onb-plan-list li { display:flex; gap:8px; align-items:flex-start; font-size:12.5px; line-height:1.45; color:var(--text-secondary); }
    .onb-plan-list svg { flex-shrink:0; margin-top:2px; color:var(--accent); }
    .onb-plan-verify { display:flex; gap:7px; align-items:flex-start; font-size:11.5px; line-height:1.5;
      color:var(--text-muted); background:var(--surface-alt); border-radius:var(--r-sm); padding:9px 11px; margin:0 0 12px; }
    .onb-plan-verify svg { flex-shrink:0; margin-top:1px; }
    .onb-plan-verify strong { color:var(--text-secondary); }
    .onb-plan-btn { width:100%; padding:11px 18px; border-radius:var(--r-full); border:1.5px solid var(--border-strong);
      background:var(--surface); color:var(--text); font-size:13.5px; font-weight:700; font-family:inherit; cursor:pointer; }
    .onb-plan-btn:hover:not(:disabled) { border-color:var(--accent); color:var(--accent); }
    .onb-plan-btn-primary { background:var(--accent); border-color:var(--accent); color:var(--accent-foreground); }
    .onb-plan-btn-primary:hover:not(:disabled) { background:var(--accent-hover); border-color:var(--accent-hover); color:var(--accent-foreground); }

    .onb-learn { width:auto; align-self:center; padding:8px 14px; border:none; background:none; color:var(--text-secondary);
      font-size:13px; font-weight:700; font-family:inherit; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
    .onb-learn:hover { color:var(--accent); }
    .onb-learnbody { margin-top:6px; padding:14px 16px; border-radius:var(--r); background:var(--surface-alt); border:1px solid var(--border); }
    .onb-learnbody p { font-size:12.5px; line-height:1.6; color:var(--text-secondary); margin:0 0 10px; }
    .onb-learnbody p:last-child { margin-bottom:0; }
    .onb-learnbody strong { color:var(--text); }

    /* ── Success ── */
    .onb-celebrate { display:flex; justify-content:center; margin-bottom:16px; }
    .onb-celebrate-ring { display:inline-flex; align-items:center; justify-content:center; width:60px; height:60px;
      border-radius:var(--r-full); background:var(--accent); color:var(--accent-foreground);
      animation:onbPop .45s cubic-bezier(.2,1.3,.4,1); }
    @keyframes onbPop { 0% { transform:scale(.4); opacity:0; } 60% { transform:scale(1.08); } 100% { transform:scale(1); opacity:1; } }

    .onb-urlbox { display:flex; align-items:center; justify-content:center; padding:14px 16px; margin:18px 0 10px;
      border:1.5px dashed var(--accent-mid); border-radius:var(--r); background:var(--accent-light); }
    .onb-urltext { font-size:15px; font-weight:700; color:var(--accent-hover); word-break:break-all; text-align:center;
      /* Selectable on purpose: it's the clipboard fallback. */
      user-select:all; }
    .onb-urlactions { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:22px; }
    .onb-copy, .onb-openbtn { display:inline-flex; align-items:center; justify-content:center; gap:7px; padding:12px 16px;
      border-radius:var(--r-full); border:1.5px solid var(--border-strong); background:var(--surface); color:var(--text);
      font-size:13.5px; font-weight:700; font-family:inherit; cursor:pointer; text-decoration:none;
      transition:border-color .14s ease, color .14s ease, background .14s ease; }
    .onb-copy:hover, .onb-openbtn:hover { border-color:var(--accent); color:var(--accent); }
    .onb-copy.done { border-color:var(--green-mid, #9ecdb8); background:var(--green-light, #E9F2EA); color:var(--green, #3d8168); }

    .onb-quick { padding-top:18px; border-top:1px solid var(--border); margin-bottom:20px; }
    .onb-quick-head { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:var(--text-muted); margin:0 0 10px; }
    .onb-quick-grid { display:flex; flex-wrap:wrap; gap:7px; }
    .onb-quick-item { display:inline-flex; align-items:center; gap:6px; padding:8px 13px; width:auto;
      border:1px solid var(--border); border-radius:var(--r-full); background:var(--surface); color:var(--text-secondary);
      font-size:12.5px; font-weight:600; font-family:inherit; cursor:pointer; text-decoration:none; }
    .onb-quick-item:hover { border-color:var(--accent); color:var(--accent); }

    /* ── Mobile-first reality check ── */
    @media (max-width:820px) {
      .onb { padding:0; align-items:flex-start; }
      .onb-shell { grid-template-columns:1fr; max-width:520px; border:none; border-radius:0; min-height:100vh; box-shadow:none; }
      /* The brand panel is reassurance, not information — on a phone it costs a
         full screen of scrolling before the user reaches the actual form, so it
         collapses to a compact header. */
      .onb-brand { padding:22px 20px; border-right:none; border-bottom:1px solid var(--border); gap:16px; }
      .onb-logo-img { margin-bottom:14px; }
      .onb-brand-h { font-size:20px; }
      .onb-benefits, .onb-linkcard { display:none; }
      .onb-card { padding:24px 20px 34px; }
      .onb-h1 { font-size:22px; }
      .onb-plan-pro { order:-1; }
    }
    @media (max-width:400px) {
      .onb-urlactions { grid-template-columns:1fr; }
      .onb-actions { flex-direction:column-reverse; }
      .onb-skip, .onb-cta-inline { width:100%; }
    }
    @media (prefers-reduced-motion: reduce) {
      .onb-step, .onb-celebrate-ring, .onb-reveal { animation:none; }
      .onb-spin { animation:none; }
      .onb-cta:hover:not(:disabled) { transform:none; }
    }
  `}</style>;
}
