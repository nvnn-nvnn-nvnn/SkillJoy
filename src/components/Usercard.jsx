import SkillStars from '@/components/Skillstars';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

const BADGE_STYLES = {
    indigo: { background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' },
    green: { background: 'var(--green-light)', color: 'var(--green)', border: '1px solid var(--green-mid)' },
    blue: { background: '#DBEAFE', color: '#1E40AF', border: '1px solid #BFDBFE' },
    gray: { background: 'var(--surface-alt)', color: 'var(--text-muted)', border: '1px solid var(--border)' },
};

export default function UserCard({ user, match, onViewProfile }) {
    return (
        <>
            <div className="user-card">
                <div className="user-header">
                    <div className="avatar avatar-lg">{initials(user.full_name)}</div>
                    <div className="user-info">
                        <h3>{user.full_name}</h3>
                        {user.bio && <p className="bio">{user.bio}</p>}
                    </div>
                </div>

                <span className="match-badge" style={BADGE_STYLES[match.color]}>
                    {match.label}
                </span>

                <div className="skills-section">
                    <div className="skill-list">
                        <p className="section-label">Can teach</p>
                        <div className="rated-tag-list">
                            {(user.skills_teach ?? []).slice(0, 3).map((s, i) => {
                                const name = typeof s === 'string' ? s : s.name;
                                const stars = typeof s === 'string' ? 3 : (s.stars ?? 3);
                                return (
                                    <div key={i} className="rated-tag-row">
                                        <span className="skill-tag skill-teach">{name}</span>
                                        <SkillStars stars={stars} readonly size="sm" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="skill-list">
                        <p className="section-label">Wants to learn</p>
                        <div className="skill-chips">
                            {(user.skills_learn ?? []).slice(0, 3).map((skill, i) => (
                                <span key={i} className="skill-tag skill-learn">{skill}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <button className="btn btn-primary" onClick={() => onViewProfile(user)}>
                    View Profile
                </button>
            </div>

            <style>{`
        .user-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 20px;
          box-shadow: var(--shadow-sm);
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .user-card:hover { box-shadow: var(--shadow); transform: translateY(-2px); }
        .user-header { display: flex; gap: 12px; align-items: flex-start; }
        .user-info { flex: 1; min-width: 0; }
        .user-info h3 { font-size: 18px; margin-bottom: 4px; }
        .bio { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
        .match-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: var(--r-full);
          font-size: 12px;
          font-weight: 500;
        }
        .skills-section { display: flex; flex-direction: column; gap: 12px; }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .rated-tag-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
        .rated-tag-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      `}</style>
        </>
    );
}