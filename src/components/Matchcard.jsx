import SkillStars from '@/components/Skillstars';

function initials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function MatchCard({ match, maxScore, index, onPropose }) {
    const barWidth = Math.round((match.score / maxScore) * 100);

    return (
        <>
            <div className="card match-card fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
                {/* Header */}
                <div className="match-header">
                    <div className="avatar avatar-lg">{initials(match.full_name)}</div>
                    <div className="match-info">
                        <h3 className="match-name">{match.full_name}</h3>
                        {match.bio && <p className="match-bio">{match.bio}</p>}
                        {match.availability?.length > 0 && (
                            <p className="match-avail">
                                Available: {match.availability.slice(0, 3).join(', ')}{match.availability.length > 3 ? '…' : ''}
                            </p>
                        )}
                    </div>
                </div>

                {/* Match score bar */}
                <div style={{ margin: '16px 0 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="section-label" style={{ marginBottom: 0 }}>Match strength</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--primary)' }}>
                            {match.score.toFixed(1)} pts
                        </span>
                    </div>
                    <div className="match-bar">
                        <div className="match-bar-fill" style={{ width: `${barWidth}%` }} />
                    </div>
                </div>

                <hr className="divider" style={{ margin: '16px 0' }} />

                {/* Skills exchange */}
                <div className="skills-exchange">
                    <div className="skills-col">
                        <p className="section-label">They can teach you</p>
                        <div className="rated-tag-list">
                            {match.theyCanTeach.map((s, i) => (
                                <div key={i} className="rated-tag-row">
                                    <span className="skill-tag skill-teach">{s.name}</span>
                                    <SkillStars stars={s.stars} readonly size="sm" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="exchange-arrow">⇄</div>
                    <div className="skills-col">
                        <p className="section-label">You can teach them</p>
                        <div className="rated-tag-list">
                            {match.iCanTeach.map((s, i) => (
                                <div key={i} className="rated-tag-row">
                                    <span className="skill-tag skill-learn">{s.name}</span>
                                    <SkillStars stars={s.stars} readonly size="sm" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} onClick={() => onPropose(match)}>
                    Propose a swap
                </button>
            </div>

            <style>{`
        .match-card { display: flex; flex-direction: column; }
        .match-header { display: flex; gap: 14px; align-items: flex-start; }
        .match-info { flex: 1; min-width: 0; }
        .match-name { font-size: 18px; margin-bottom: 4px; }
        .match-bio {
          font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 4px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .match-avail { font-size: 12px; color: var(--text-muted); }
        .skills-exchange { display: flex; gap: 12px; align-items: flex-start; }
        .skills-col { flex: 1; min-width: 0; }
        .exchange-arrow { font-size: 18px; color: var(--text-muted); padding-top: 20px; flex-shrink: 0; }
        .rated-tag-list { display: flex; flex-direction: column; gap: 6px; }
        .rated-tag-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        @media (max-width: 480px) {
            .skills-exchange { flex-direction: column; gap: 6px; }
            .exchange-arrow { padding-top: 0; align-self: center; font-size: 22px; }
        }
      `}</style>
        </>
    );
}