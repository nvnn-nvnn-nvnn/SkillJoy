import { useState, useEffect } from 'react';
import SkillStars from '@/components/Skillstars';
import { getSkillName } from '@/lib/stores';
import { supabase } from '@/lib/supabase';

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
    const [avgRating, setAvgRating] = useState(null);
    const [ratingCount, setRatingCount] = useState(0);

    useEffect(() => {
        if (!user?.id) return;
        (async () => {
            const { data } = await supabase
                .from('ratings')
                .select('rating')
                .eq('rated_id', user.id);
            if (data && data.length > 0) {
                const avg = data.reduce((sum, r) => sum + r.rating, 0) / data.length;
                setAvgRating(avg);
                setRatingCount(data.length);
            }
        })();
    }, [user?.id]);

    return (
        <>
            <div className="user-card">
                <div className="user-header">
                    <div className="avatar avatar-lg">{initials(user.full_name)}</div>
                    <div className="user-info">
                        <h3>{user.full_name}</h3>
                        {(user.service_type === 'gigs' || user.service_type === 'both') && (
                            <span className="gig-badge">Available for hire</span>
                        )}
                        {user.service_type === 'both' && (
                            <span className="swap-badge">Open to swap</span>
                        )}
                        {user.bio && <p className="bio">{user.bio}</p>}
                        {avgRating !== null && (
                            <div className="user-rating">
                                <span className="user-rating-stars">{'★'.repeat(Math.round(avgRating))}{'☆'.repeat(5 - Math.round(avgRating))}</span>
                                <span className="user-rating-text">{avgRating.toFixed(1)} ({ratingCount})</span>
                            </div>
                        )}
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

                    <div className="skill-list">
                        <p className="section-label">Wants to learn</p>
                        <div className="skill-chips">
                            {(user.skills_learn ?? []).slice(0, 3).map((skill, i) => (
                                <span key={i} className="skill-tag skill-learn">{getSkillName(skill)}</span>
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
        .gig-badge, .swap-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: var(--r-full);
          font-size: 11px;
          font-weight: 500;
          margin-right: 4px;
        }
        .gig-badge {
          background: #FFF7ED;
          color: #C2410C;
          border: 1px solid #FDBA74;
        }
        .swap-badge {
          background: #F0FDF4;
          color: #15803D;
          border: 1px solid #86EFAC;
        }
        .skills-section { display: flex; flex-direction: column; gap: 12px; }
        .skill-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
        .rated-tag-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
        .rated-tag-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .user-rating { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
        .user-rating-stars { color: #FBBF24; font-size: 14px; letter-spacing: 1px; }
        .user-rating-text { font-size: 12px; color: var(--text-muted); font-weight: 500; }
      `}</style>
        </>
    );
}