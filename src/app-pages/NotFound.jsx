import { useNavigate } from 'react-router-dom';

export default function NotFound() {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '70vh',
            textAlign: 'center',
            padding: '0 24px',
            gap: 0,
        }}>
            <div style={{ fontSize: 80, marginBottom: 16, lineHeight: 1 }}>🔍</div>
            <h1 style={{ fontSize: 48, fontWeight: 800, margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>404</h1>
            <p style={{ fontSize: 20, fontWeight: 600, margin: '0 0 12px', color: 'var(--text-primary)' }}>Page not found</p>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 32px', maxWidth: 360, lineHeight: 1.6 }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button className="btn btn-primary" onClick={() => navigate(-1)}>Go back</button>
                <button className="btn btn-secondary" onClick={() => navigate('/')}>Home</button>
            </div>
        </div>
    );
}
