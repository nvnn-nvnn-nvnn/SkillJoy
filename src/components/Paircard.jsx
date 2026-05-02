export default function PairCard({ pair, index }) {
    return (
        <>
            <div className="pair-card fade-up" style={{ animationDelay: `${index * 0.06}s` }}>
                {/* Person A */}
                <div className="pair-person">
                    <div className="pair-avatar pair-avatar-a">{pair.a[0]}</div>
                    <div className="pair-info">
                        <p className="pair-name">{pair.a}</p>
                        <span className="skill-tag skill-teach">teaches {pair.teach}</span>
                    </div>
                </div>

                {/* Exchange connector */}
                <div className="pair-connector" aria-hidden="true">
                    <div className="pair-connector-line" />
                    <div className="pair-connector-icon">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 5h10M9 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M12 9H2M5 6l-3 3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div className="pair-connector-line" />
                </div>

                {/* Person B */}
                <div className="pair-person">
                    <div className="pair-avatar pair-avatar-b">{pair.b[0]}</div>
                    <div className="pair-info">
                        <p className="pair-name">{pair.b}</p>
                        <span className="skill-tag skill-learn">teaches {pair.learn}</span>
                    </div>
                </div>
            </div>

            <style>{`
        .pair-card {
          display: flex;
          flex-direction: column;
          gap: 0;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm);
          transition: all 0.2s;
          overflow: hidden;
        }
        .pair-card:hover {
          box-shadow: var(--shadow);
          transform: translateY(-2px);
          border-color: var(--border-strong);
        }
        .pair-person {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 18px;
        }
        .pair-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
          font-weight: 600;
          flex-shrink: 0;
          border: 1.5px solid transparent;
        }
        .pair-avatar-a {
          background: var(--primary-light);
          color: var(--text);
          border-color: var(--primary-mid);
        }
        .pair-avatar-b {
          background: var(--accent-light);
          color: var(--accent);
          border-color: var(--accent-mid);
        }
        .pair-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .pair-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pair-connector {
          display: flex;
          align-items: center;
          padding: 0 18px;
          gap: 8px;
          color: var(--text-muted);
        }
        .pair-connector-line {
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .pair-connector-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--surface-alt);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: var(--text-secondary);
        }
      `}</style>
        </>
    );
}
