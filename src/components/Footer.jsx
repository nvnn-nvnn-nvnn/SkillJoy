import { Link, useLocation } from 'react-router-dom';

export default function Footer() {
    const { pathname } = useLocation();
    if (pathname === '/chat') return null;

    return (
        <footer style={{
            background: '#1a1a1a',
            color: '#a3a3a3',
            marginTop: 'auto',
            padding: '48px 24px 28px',
        }}>
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 40, marginBottom: 40 }}>

                    {/* Brand */}
                    <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                            Skill<span style={{ color: '#ec9146' }}>Joy</span>
                        </div>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a3a3a3', margin: 0 }}>
                            The campus marketplace for skill swaps and paid gigs. Learn, earn, and connect.
                        </p>
                    </div>

                    {/* Platform */}
                    <div>
                        <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Platform</h4>
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <FooterLink to="/gigs">Browse Gigs</FooterLink>
                            <FooterLink to="/swaps">Skill Swaps</FooterLink>
                            <FooterLink to="/my-listings">My Listings</FooterLink>
                            <FooterLink to="/my-orders">My Orders</FooterLink>
                        </nav>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Company</h4>
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <FooterLink to="/about">About</FooterLink>
                            <FooterLink to="/how-it-works">How It Works</FooterLink>
                            <FooterLink to="/contact">Contact</FooterLink>
                        </nav>
                    </div>

                    {/* Legal */}
                    <div>
                        <h4 style={{ color: '#fff', fontSize: 13, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legal</h4>
                        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <FooterLink to="/terms">Terms of Service</FooterLink>
                            <FooterLink to="/privacy">Privacy Policy</FooterLink>
                            <FooterLink to="/refund-policy">Refund Policy</FooterLink>
                        </nav>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid #2d2d2d', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                        © {new Date().getFullYear()} SkillJoy. All rights reserved.
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                        Payments secured by <span style={{ color: '#a3a3a3' }}>Stripe</span>
                    </p>
                </div>
            </div>
        </footer>
    );
}

function FooterLink({ to, children }) {
    return (
        <Link to={to} style={{ color: '#a3a3a3', textDecoration: 'none', fontSize: 13, transition: 'color 0.15s' }}
            onMouseEnter={e => e.target.style.color = '#fff'}
            onMouseLeave={e => e.target.style.color = '#a3a3a3'}
        >
            {children}
        </Link>
    );
}
