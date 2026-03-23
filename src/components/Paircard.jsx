export default function PairCard({ pair, index }) {
    return (
        <>
            <div className="pair-card fade-up" style={{ animationDelay: `${index * 0.06}s` }}>
                <div className="pair-person">
                    <div className="avatar" style={{ fontSize: 14 }}>{pair.a[0]}</div>
                    <div>
                        <p className="pair-name">{pair.a}</p>
                        <span className="skill-tag skill-teach">teaches {pair.teach}</span>
                    </div>
                </div>
                <div className="pair-arrow">⇄</div>
                <div className="pair-person pair-person-right">
                    <div>
                        <p className="pair-name" style={{ textAlign: 'right' }}>{pair.b}</p>
                        <span className="skill-tag skill-learn">teaches {pair.learn}</span>
                    </div>
                    <div
                        className="avatar"
                        style={{
                            fontSize: 14,
                            background: 'var(--accent-light)',
                            color: 'var(--accent)',
                            borderColor: 'var(--accent-mid)',
                        }}
                    >
                        {pair.b[0]}
                    </div>
                </div>
            </div>

            <style>{`
        .pair-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s;
        }
        .pair-card:hover {
          box-shadow: var(--shadow);
          transform: translateY(-2px);
          border-color: var(--border-strong);
        }
        .pair-person {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .pair-person-right { justify-content: flex-end; }
        .pair-name { font-size: 13px; font-weight: 500; margin-bottom: 4px; }
        .pair-arrow { font-size: 18px; color: var(--text-muted); flex-shrink: 0; }
      `}</style>
        </>
    );
}