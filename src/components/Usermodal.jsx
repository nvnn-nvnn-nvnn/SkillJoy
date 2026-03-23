import { Link } from 'react-router-dom';
import SkillStars from '@/components/Skillstars';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function UserModal({ user, onClose }) {
    if (!user) return null;

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

                    <div className="modal-section">
                        <h3>Wants to learn</h3>
                        <div className="skill-chips">
                            {(user.skills_learn ?? []).map((skill, i) => (
                                <span key={i} className="skill-tag skill-learn">{skill}</span>
                            ))}
                        </div>
                    </div>

                    <Link to="/matches" className="btn btn-primary" style={{ width: '100%', marginTop: 8, display: 'block', textAlign: 'center' }}>
                        Go to Matches →
                    </Link>
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