import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useUser, useProfile, useAuth, SKILL_CATEGORIES, AVAILABILITY_OPTIONS, hasSkill, setSkillStars, removeSkill, getSkillName, normalizeSkills } from '@/lib/stores';
import ProfileView from '@/components/Profileview';
import SkillEditor from '@/components/Skillededitor';

const TOTAL_STEPS = 4;

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

    const progress = (step / TOTAL_STEPS) * 100;

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

    // ── Teach helpers ─────────────────────────────────────────────────────────

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

    // ── Learn helpers ─────────────────────────────────────────────────────────

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

    // ── Availability toggle ───────────────────────────────────────────────────

    function toggleAvailability(opt) {
        setAvailability(prev =>
            prev.includes(opt) ? prev.filter(a => a !== opt) : [...prev, opt]
        );
    }

    // ── Save ──────────────────────────────────────────────────────────────────

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

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <title>Set up your profile — SkillJoy</title>

            <div className="onboard-bg">
                <div className="onboard-wrap fade-up">

                    {viewMode && profile ? (
                        <ProfileView
                            profile={profile}
                            acceptedSwapsCount={0} /* pass real count from your swaps query if needed */
                            onEdit={() => setViewMode(false)}
                        />
                    ) : (
                        <>
                            {profile?.full_name && (
                                <div className="mode-toggle">
                                    <button className="btn btn-ghost btn-sm" onClick={() => setViewMode(true)}>← Back to Profile View</button>
                                </div>
                            )}

                            {/* Progress */}
                            <div className="progress-bar">
                                <div className="progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="header-row">
                                <p className="step-indicator">Step {step} of {TOTAL_STEPS}</p>
                                <button className="btn btn-secondary exit-btn" onClick={() => navigate('/')}>Exit</button>
                            </div>

                            {/* ── Step 1: Name + Bio ── */}
                            {step === 1 && (
                                <>
                                    <h1 className="onboard-title">Let's set up your profile</h1>
                                    <p className="onboard-sub">Tell other students a little about yourself.</p>
                                    <div className="field">
                                        <label htmlFor="name">Your full name</label>
                                        <input id="name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Maya Chen" autoComplete="name" />
                                    </div>
                                    <div className="field" style={{ marginTop: 20 }}>
                                        <label htmlFor="bio">
                                            Short bio <span style={{ color: '#fff', fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                                        </label>
                                        <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="e.g. CS junior who loves code and music." rows={3} style={{ resize: 'vertical' }} />
                                    </div>
                                </>
                            )}

                            {/* ── Step 2: Skills to Teach ── */}
                            {step === 2 && (
                                <>
                                    <h1 className="onboard-title">What can you teach?</h1>
                                    <p className="onboard-sub">Pick skills you can share, then rate your level with stars.</p>
                                    {SKILL_CATEGORIES.map(cat => (
                                        <div key={cat.label} className="skill-group">
                                            <p className="section-label">{cat.label}</p>
                                            <div className="skill-chips">
                                                {cat.skills.map(name => {
                                                    const selected = hasSkill(skillsTeach, name);
                                                    return (
                                                        <button
                                                            key={name}
                                                            className={`skill-tag skill-select ${selected ? 'active-teach' : 'skill-teach'}`}
                                                            onClick={() => toggleTeach(name)}
                                                        >
                                                            {selected && <span>✓ </span>}{name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="custom-input">
                                        <input type="text" value={customTeach} onChange={e => setCustomTeach(e.target.value)} onKeyDown={e => handleKey(e, 'teach')} placeholder="Add a custom skill…" />
                                        <button className="btn btn-secondary btn-sm" onClick={addCustomTeach}>Add</button>
                                    </div>
                                    <SkillEditor skills={skillsTeach} onChange={setSkillsTeach} />
                                </>
                            )}

                            {/* ── Step 3: Skills to Learn ── */}
                            {step === 3 && (
                                <>
                                    <h1 className="onboard-title">What do you want to learn?</h1>
                                    <p className="onboard-sub">Pick skills you've always wanted to pick up.</p>
                                    {SKILL_CATEGORIES.map(cat => (
                                        <div key={cat.label} className="skill-group">
                                            <p className="section-label">{cat.label}</p>
                                            <div className="skill-chips">
                                                {cat.skills.map(skill => {
                                                    const selected = skillsLearn.includes(skill);
                                                    return (
                                                        <button
                                                            key={skill}
                                                            className={`skill-tag skill-select ${selected ? 'active-learn' : 'skill-learn'}`}
                                                            onClick={() => toggleLearn(skill)}
                                                        >
                                                            {selected && <span>✓ </span>}{skill}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="custom-input">
                                        <input type="text" value={customLearn} onChange={e => setCustomLearn(e.target.value)} onKeyDown={e => handleKey(e, 'learn')} placeholder="Add a custom skill…" />
                                        <button className="btn btn-secondary btn-sm" onClick={addCustomLearn}>Add</button>
                                    </div>
                                    {skillsLearn.length > 0 && (
                                        <div className="selected-preview">
                                            <p className="section-label" style={{ marginBottom: 8 }}>Selected ({skillsLearn.length})</p>
                                            <div className="skill-chips">
                                                {skillsLearn.map(s => (
                                                    <button key={s} className="skill-tag active-learn" onClick={() => toggleLearn(s)}>
                                                        {s} <span style={{ opacity: 0.7 }}>✕</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ── Step 4: Availability ── */}
                            {step === 4 && (
                                <>
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

                                    <div style={{ marginTop: 32 }}>
                                        <p className="section-label" style={{ marginBottom: 12 }}>What are you open to?</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {[
                                                { value: 'swap', label: 'Skill Swap', desc: 'Exchange skills with others for free' },
                                                { value: 'gigs', label: 'Paid Services', desc: 'Offer your skills for money (gig work)' },
                                                { value: 'both', label: 'Both', desc: 'Open to swapping and paid gigs' },
                                            ].map(opt => (
                                                <label
                                                    key={opt.value}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                                                        padding: '14px 16px', background: serviceType === opt.value ? 'var(--surface-alt)' : '#fff',
                                                        borderRadius: 'var(--r)', border: `1px solid ${serviceType === opt.value ? 'var(--primary)' : 'var(--border)'}`,
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="serviceType"
                                                        value={opt.value}
                                                        checked={serviceType === opt.value}
                                                        onChange={e => setServiceType(e.target.value)}
                                                        style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                                                    />
                                                    <div>
                                                        <p style={{ fontWeight: 600, fontSize: 15 }}>{opt.label}</p>
                                                        <p style={{ fontSize: 13, color: '#fff', marginTop: 2 }}>{opt.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {error && <p className="form-error" style={{ marginTop: 16 }}>{error}</p>}

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
        .onboard-bg { min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 48px 24px 80px; background: var(--bg); }
        .onboard-wrap { width: 100%; max-width: 600px; }
        .progress-bar { height: 3px; background: var(--border); border-radius: var(--r-full); margin-bottom: 12px; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent)); border-radius: var(--r-full); transition: width 0.3s ease; }
        .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 36px; }
        .step-indicator { font-size: 12px; color: #fff; letter-spacing: 0.04em; }
        .exit-btn { font-size: 14px; padding: 6px 12px; }
        .onboard-title { font-size: 32px; margin-bottom: 8px; }
        .onboard-sub { font-size: 16px; color: #fff; margin-bottom: 36px; }
        .skill-group { margin-bottom: 24px; }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .custom-input { display: flex; gap: 8px; margin-top: 24px; margin-bottom: 8px; }
        .custom-input input { flex: 1; }
        .selected-preview { margin-top: 24px; padding: 20px; background: var(--surface-alt); border-radius: var(--r); border: 1px solid var(--border); }
        .avail-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 24px; }
        .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border); }
        .form-error { font-size: 13px; color: var(--accent); background: var(--accent-light); border: 1px solid var(--accent-mid); border-radius: var(--r-sm); padding: 10px 14px; }
        .mode-toggle { margin-bottom: 16px; }
      `}</style>
        </>
    );
}