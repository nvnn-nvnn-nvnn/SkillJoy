import { Link, useNavigate } from 'react-router-dom';
import SkillStars from '@/components/Skillstars';
import { getSkillName } from '@/lib/stores';
import { supabase } from '@/lib/supabase';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ProfileView({ profile, acceptedSwapsCount, onEdit }) {
    const navigate = useNavigate();

    async function handleSignOut() {
        await supabase.auth.signOut();
        navigate('/');
    }

    return (
        <>
            <div className="profile-view-container">
                <div className="view-header">
                    <h1 className="page-title">My Profile</h1>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-secondary" onClick={onEdit}>✏️ Edit Profile</button>
                        <button className="btn btn-ghost" onClick={handleSignOut} style={{ border: '2px solid var(--border)', color: '#fff' }}>Sign Out</button>
                    </div>
                </div>

                <div className="profile-card">
                    {/* Header */}
                    <div className="profile-header-section">
                        <div className="avatar avatar-xl">{initials(profile.full_name)}</div>
                        <div className="profile-header-info">
                            <h2>{profile.full_name}</h2>
                            <p className="profile-email">{profile.email}</p>
                            {profile.bio && <p className="bio">{profile.bio}</p>}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="stats-grid">
                        {[
                            { icon: '🏆', value: profile.points || 0, label: 'Points Earned' },
                            { icon: '📚', value: profile.skills_teach?.length || 0, label: 'Skills I Teach' },
                            { icon: '🎯', value: profile.skills_learn?.length || 0, label: 'Skills I Want' },
                            { icon: '🤝', value: acceptedSwapsCount, label: 'Swaps Completed' },
                        ].map(({ icon, value, label }) => (
                            <div key={label} className="stat-card">
                                <div className="stat-icon">{icon}</div>
                                <div className="stat-value">{value}</div>
                                <div className="stat-label">{label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Skills */}
                    <div className="profile-skills-container">
                        <div className="profile-section">
                            <div className="section-header">
                                <h3>💡 I can teach</h3>
                                <span className="skill-count">{profile.skills_teach?.length || 0} skills</span>
                            </div>
                            {profile.skills_teach?.length ? (
                                <div className="rated-skill-list">
                                    {profile.skills_teach.map((s, i) => {
                                        const name = getSkillName(s);
                                        const stars = (typeof s === 'object' && s.stars) ? s.stars : 3;
                                        return (
                                            <div key={i} className="rated-skill-row">
                                                <span className="skill-tag skill-teach">{name}</span>
                                                <SkillStars stars={stars} readonly size="sm" />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="empty-text">No skills added yet</p>
                            )}
                        </div>

                        <div className="profile-section">
                            <div className="section-header">
                                <h3>🎓 I want to learn</h3>
                                <span className="skill-count">{profile.skills_learn?.length || 0} skills</span>
                            </div>
                            {profile.skills_learn?.length ? (
                                <div className="skill-chips">
                                    {profile.skills_learn.map((skill, i) => (
                                        <span key={i} className="skill-tag skill-learn">{getSkillName(skill)}</span>
                                    ))}
                                </div>
                            ) : (
                                <p className="empty-text">No skills added yet</p>
                            )}
                        </div>

                        {profile.availability?.length > 0 && (
                            <div className="profile-section">
                                <div className="section-header"><h3>📅 Availability</h3></div>
                                <div className="availability-tags">
                                    {profile.availability.map((time, i) => (
                                        <span key={i} className="avail-chip active">{time}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="profile-actions">
                        <Link to="/matches" className="btn btn-primary">🔍 Find Matches</Link>
                        <Link to="/swaps" className="btn btn-secondary">💬 View Swaps</Link>
                    </div>
                </div>
            </div>

            <style>{`
        .profile-view-container { width: 100%; max-width: 800px; }
        .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
        .profile-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 32px; box-shadow: var(--shadow-sm); }
        .profile-header-section { display: flex; gap: 20px; align-items: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
        .avatar-xl { width: 80px !important; height: 80px !important; font-size: 32px !important; }
        .profile-header-info { flex: 1; }
        .profile-header-info h2 { font-size: 28px; margin-bottom: 4px; }
        .profile-email { font-size: 14px; color: var(--text-muted); margin-bottom: 8px; }
        .bio { font-size: 14px; color: var(--text-secondary); }

        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .stat-card { background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; text-align: center; transition: all 0.2s; }
        .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-sm); }
        .stat-icon { font-size: 32px; margin-bottom: 8px; }
        .stat-value { font-size: 28px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
        .stat-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

        .profile-skills-container { display: flex; flex-direction: column; gap: 24px; margin-bottom: 32px; }
        .profile-section { background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--r); padding: 20px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .profile-section h3 { font-size: 16px; margin: 0; }
        .skill-count { font-size: 12px; color: var(--text-muted); background: var(--surface); padding: 4px 10px; border-radius: var(--r-full); border: 1px solid var(--border); }
        .empty-text { font-size: 14px; color: var(--text-muted); font-style: italic; }
        .rated-skill-list { display: flex; flex-direction: column; gap: 8px; }
        .rated-skill-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .availability-tags { display: flex; flex-wrap: wrap; gap: 8px; }
        .profile-actions { display: flex; gap: 12px; justify-content: center; padding-top: 24px; border-top: 1px solid var(--border); }
        .profile-actions .btn { flex: 1; max-width: 200px; }
      `}</style>
        </>
    );
}