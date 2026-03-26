import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import SkillStars from '@/components/Skillstars';
import { getSkillName, useProfile } from '@/lib/stores';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function starString(stars) {
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

function skillStars(s) {
    return typeof s === 'string' ? 3 : (s.stars ?? 3);
}

export default function UserModal({ user, onClose, onPropose, submitting }) {
    const profile = useProfile();
    const [swapTeach, setSwapTeach] = useState('');
    const [swapLearn, setSwapLearn] = useState('');
    const [swapMessage, setSwapMessage] = useState('');
    const [showProposal, setShowProposal] = useState(false);

    useEffect(() => {
        if (!user || !profile) return;

        const myLearnLower = (profile.skills_learn ?? []).map(s => getSkillName(s).toLowerCase());
        const theirLearnLower = (user.skills_learn ?? []).map(s => getSkillName(s).toLowerCase());

        const theyCanTeach = (user.skills_teach ?? [])
            .filter(s => myLearnLower.includes(getSkillName(s).toLowerCase()));
        const iCanTeach = (profile.skills_teach ?? [])
            .filter(s => theirLearnLower.includes(getSkillName(s).toLowerCase()));

        const teach = iCanTeach[0] ? getSkillName(iCanTeach[0]) : '';
        const learn = theyCanTeach[0] ? getSkillName(theyCanTeach[0]) : '';

        setSwapTeach(teach);
        setSwapLearn(learn);
        setSwapMessage(
            `Hey ${user.full_name}! I'd love to swap skills — I can teach you ${teach} and I'm keen to learn ${learn} from you. Want to set something up?`
        );
        setShowProposal(false);
    }, [user, profile]);

    if (!user) return null;

    const myLearnLower = (profile?.skills_learn ?? []).map(s => getSkillName(s).toLowerCase());
    const theirLearnLower = (user.skills_learn ?? []).map(s => getSkillName(s).toLowerCase());

    const theyCanTeach = (user.skills_teach ?? [])
        .filter(s => myLearnLower.includes(getSkillName(s).toLowerCase()));
    const iCanTeach = (profile?.skills_teach ?? [])
        .filter(s => theirLearnLower.includes(getSkillName(s).toLowerCase()));

    function handleSubmit() {
        if (onPropose) {
            onPropose({ swapTeach, swapLearn, swapMessage });
        }
    }

    return (
        <>
            <div className="modal-backdrop" onClick={onClose}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                    <button className="modal-close" onClick={onClose}>✕</button>

                    <div className="user-header" style={{ marginBottom: 20 }}>
                        <div className="avatar avatar-lg">{initials(user.full_name)}</div>
                        <div>
                            <h2>{user.full_name}</h2>
                            {user.bio && <p className="bio">{user.bio}</p>}
                        </div>
                    </div>

                    <div className="modal-section">
                        <h3>Can teach</h3>
                        <div className="rated-tag-list">
                            {(user.skills_teach ?? []).map((s, i) => {
                                const name = getSkillName(s);
                                const stars = (typeof s === 'object' && s.stars) ? s.stars : 3;
                                return (
                                    <div key={i} className="rated-tag-row">
                                        <span className="skill-tag skill-teach">{name}</span>
                                        <SkillStars stars={stars} readonly size="sm" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="modal-section">
                        <h3>Wants to learn</h3>
                        <div className="skill-chips">
                            {(user.skills_learn ?? []).map((skill, i) => (
                                <span key={i} className="skill-tag skill-learn">{getSkillName(skill)}</span>
                            ))}
                        </div>
                    </div>

                    {showProposal ? (
                        <>
                            <div className="modal-section" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                                <h3>Propose a swap</h3>

                                <div className="field" style={{ marginTop: 16, marginBottom: 16 }}>
                                    <label>You'll teach</label>
                                    <select value={swapTeach} onChange={e => setSwapTeach(e.target.value)} disabled={iCanTeach.length === 0}>
                                        {iCanTeach.length === 0 ? (
                                            <option>No matching skills</option>
                                        ) : (
                                            iCanTeach.map(s => {
                                                const name = getSkillName(s);
                                                const stars = skillStars(s);
                                                return <option key={name} value={name}>{name} ({starString(stars)})</option>;
                                            })
                                        )}
                                    </select>
                                </div>

                                <div className="field" style={{ marginBottom: 16 }}>
                                    <label>You'll learn</label>
                                    <select value={swapLearn} onChange={e => setSwapLearn(e.target.value)} disabled={theyCanTeach.length === 0}>
                                        {theyCanTeach.length === 0 ? (
                                            <option>No matching skills</option>
                                        ) : (
                                            theyCanTeach.map(s => {
                                                const name = getSkillName(s);
                                                const stars = skillStars(s);
                                                return <option key={name} value={name}>{name} ({starString(stars)})</option>;
                                            })
                                        )}
                                    </select>
                                </div>

                                <div className="field" style={{ marginBottom: 20 }}>
                                    <label>Message</label>
                                    <textarea
                                        value={swapMessage}
                                        onChange={e => setSwapMessage(e.target.value)}
                                        rows={4}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                <div style={{ display: 'flex', gap: 12 }}>
                                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowProposal(false)}>Cancel</button>
                                    <button
                                        className="btn btn-primary"
                                        style={{ flex: 2 }}
                                        onClick={handleSubmit}
                                        disabled={submitting || !swapTeach || !swapLearn || iCanTeach.length === 0 || theyCanTeach.length === 0}
                                    >
                                        {submitting && (
                                            <span className="spinner" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white', width: 16, height: 16 }} />
                                        )}
                                        Send proposal
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                            {iCanTeach.length > 0 && theyCanTeach.length > 0 && (
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setShowProposal(true)}>
                                    Propose Swap
                                </button>
                            )}
                            <Link to="/matches" className="btn btn-secondary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                Go to Matches →
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        .modal-close {
          position: absolute;
          top: 16px; right: 16px;
          background: var(--surface-alt);
          border: none;
          width: 32px; height: 32px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 16px;
          color: var(--text-secondary);
        }
        .modal-close:hover { background: var(--border); }
        .modal-section { margin: 16px 0; }
        .modal-section h3 {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .bio { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .rated-tag-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
        .rated-tag-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .user-header { display: flex; gap: 12px; align-items: flex-start; }
      `}</style>
        </>
    );
}