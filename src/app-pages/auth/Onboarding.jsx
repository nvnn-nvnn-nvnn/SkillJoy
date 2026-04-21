import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth, SKILL_CATEGORIES, AVAILABILITY_OPTIONS, hasSkill, setSkillStars, removeSkill, getSkillName, normalizeSkills } from '@/lib/stores';
import ProfileView from '@/components/Profileview';
import SkillEditor from '@/components/Skillededitor';

const TOTAL_STEPS = 4;

const STEP_LABELS = ['About You', 'Teach', 'Learn', 'Availability'];

// Reusable chip-grid for both Teach (step 2) and Learn (step 3)
function SkillChipGrid({ categories, selected, isSelected, onToggle }) {
    return categories.map(cat => (
        <div key={cat.label} className="skill-group">
            <p className="section-label">{cat.label}</p>
            <div className="skill-chips">
                {cat.skills.map(name => {
                    const active = isSelected(name);
                    return (
                        <button
                            key={name}
                            className={`skill-tag skill-select ${active ? (selected === 'teach' ? 'active-teach' : 'active-learn') : (selected === 'teach' ? 'skill-teach' : 'skill-learn')}`}
                            onClick={() => onToggle(name)}
                        >
                            {active && <span>&#10003; </span>}{name}
                        </button>
                    );
                })}
            </div>
        </div>
    ));
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const user = useUser();
    const profile = useProfile();
    const { setProfile } = useAuth();
    const navigate = useNavigate();

    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [skillsTeach, setSkillsTeach] = useState([]);
    const [skillsLearn, setSkillsLearn] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [customTeach, setCustomTeach] = useState('');
    const [customLearn, setCustomLearn] = useState('');
    const [serviceType, setServiceType] = useState('swap');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState(1);
    const [viewMode, setViewMode] = useState(false);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }
        if (profile) {
            setFullName(profile.full_name ?? '');
            setBio(profile.bio ?? '');
            setSkillsTeach(normalizeSkills(profile.skills_teach ?? []));
            setSkillsLearn(normalizeSkills(profile.skills_learn ?? []).map(s => getSkillName(s)));
            setAvailability(profile.availability ?? []);
            setServiceType(profile.service_type ?? 'swap');
            if (profile.full_name) setViewMode(true);
        }
    }, [user, profile]);

    // ── Teach helpers ────────────────────────────────────────────────────────

    function toggleTeach(name) {
        setSkillsTeach(prev =>
            hasSkill(prev, name) ? removeSkill(prev, name) : setSkillStars(prev, name, 3)
        );
    }

    function addCustomTeach() {
        const val = customTeach.trim().slice(0, 50);
        if (!val) return;
        if (!hasSkill(skillsTeach, val)) setSkillsTeach(prev => setSkillStars(prev, val, 3));
        setCustomTeach('');
    }

    // ── Learn helpers ────────────────────────────────────────────────────────

    function toggleLearn(skill) {
        setSkillsLearn(prev =>
            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
        );
    }

    function addCustomLearn() {
        const val = customLearn.trim().slice(0, 50);
        if (!val || skillsLearn.includes(val)) return;
        setSkillsLearn(prev => [...prev, val]);
        setCustomLearn('');
    }

    function handleKey(e, type) {
        if (e.key === 'Enter') {
            e.preventDefault();
            type === 'teach' ? addCustomTeach() : addCustomLearn();
        }
    }

    // ── Availability toggle ──────────────────────────────────────────────────

    function toggleAvailability(opt) {
        setAvailability(prev =>
            prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]
        );
    }

    // ── Save ─────────────────────────────────────────────────────────────────

    async function save() {
        if (!fullName.trim()) { setError('Please enter your name.'); return; }
        if (!skillsTeach.length) { setError('Add at least one skill you can teach.'); setStep(2); return; }
        if (!skillsLearn.length) { setError('Add at least one skill you want to learn.'); setStep(3); return; }

        setError(''); setBusy(true);
        const { error: e } = await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: fullName.trim(),
            bio: bio.trim(),
            skills_teach: skillsTeach,
            skills_learn: skillsLearn,
            availability,
            service_type: serviceType,
        });
        setBusy(false);
        if (e) { setError(e.message); return; }
        const { data: updated } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (updated) setProfile(updated);
        navigate('/matches');
    }

    // ── Service type options ─────────────────────────────────────────────────

    const serviceOptions = [
        { value: 'swap', label: 'Skill Swap', desc: 'Exchange skills with others for free' },
        { value: 'gigs', label: 'Paid Services', desc: 'Offer your skills for money (gig work)' },
        { value: 'both', label: 'Both', desc: 'Open to swapping and paid gigs' },
    ];

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
                                    <h1 className="onboard-title">Let's set up your profile</h1>
                                    <p className="onboard-sub">Tell other students a little about yourself.</p>
                                    <div className="field">
                                        <label htmlFor="name">Your full name</label>
                                        <input id="name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Maya Chen" autoComplete="name" />
                                    </div>
                                    <div className="field" style={{ marginTop: 20 }}>
                                        <label htmlFor="bio">
                                            Short bio <span className="label-optional">(optional)</span>
                                        </label>
                                        <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. CS junior who loves code and music." rows={3} style={{ resize: 'vertical' }} />
                                    </div>
                                </div>
                            )}

                            {/* ── Step 2: Skills to Teach ── */}
                            {step === 2 && (
                                <div className="step-body">
                                    <h1 className="onboard-title">What can you teach?</h1>
                                    <p className="onboard-sub">Pick skills you can share, then rate your level with stars.</p>
                                    {/* SkillEditor has its own add input + Browse modal — no need for a second input */}
                                    {/* <div className="custom-input">
                                        <input type="text" value={customTeach} onChange={e => setCustomTeach(e.target.value)} onKeyDown={e => handleKey(e, 'teach')} placeholder="Add a custom skill..." />
                                        <button className="btn btn-secondary btn-sm" onClick={addCustomTeach}>Add</button>
                                    </div> */}
                                    <SkillEditor skills={skillsTeach} onChange={setSkillsTeach} />
                                </div>
                            )}

                            {/* ── Step 3: Skills to Learn ── */}
                            {step === 3 && (
                                <div className="step-body">
                                    <h1 className="onboard-title">What do you want to learn?</h1>
                                    <p className="onboard-sub">Pick skills you've always wanted to pick up.</p>
                                    {/* SkillChipGrid kept for the browse-by-category view */}
                                    <SkillChipGrid
                                        categories={SKILL_CATEGORIES}
                                        selected="learn"
                                        isSelected={name => skillsLearn.includes(name)}
                                        onToggle={toggleLearn}
                                    />
                                    <div className="custom-input">
                                        <input type="text" value={customLearn} onChange={e => setCustomLearn(e.target.value)} onKeyDown={e => handleKey(e, 'learn')} placeholder="Add a custom skill..." />
                                        <button className="btn btn-secondary btn-sm" onClick={addCustomLearn}>Add</button>
                                    </div>
                                    {skillsLearn.length > 0 && (
                                        <div className="selected-preview">
                                            <p className="section-label" style={{ marginBottom: 8 }}>Selected ({skillsLearn.length})</p>
                                            <div className="skill-chips">
                                                {skillsLearn.map(s => (
                                                    <button key={s} className="skill-tag active-learn" onClick={() => toggleLearn(s)}>
                                                        {s} <span style={{ opacity: 0.6 }}>&times;</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Step 4: Availability + Service Type ── */}
                            {step === 4 && (
                                <div className="step-body">
                                    <h1 className="onboard-title">When are you free?</h1>
                                    <p className="onboard-sub">Help matches know when to reach out.</p>
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

                                    <div className="service-section">
                                        <p className="section-label" style={{ marginBottom: 12 }}>What are you open to?</p>
                                        <div className="service-options">
                                            {serviceOptions.map(opt => (
                                                <label
                                                    key={opt.value}
                                                    className={`service-option ${serviceType === opt.value ? 'selected' : ''}`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="serviceType"
                                                        value={opt.value}
                                                        checked={serviceType === opt.value}
                                                        onChange={e => setServiceType(e.target.value)}
                                                    />
                                                    <div>
                                                        <p className="service-label">{opt.label}</p>
                                                        <p className="service-desc">{opt.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
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
                                        Save & find matches
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
