import { Link } from 'react-router-dom';

export default function AboutPage() {
    return (
        <div className="page" style={{ maxWidth: 800 }}>
            <Link to="/" 
                style={{ 
                fontSize: 14, 
                textDecoration: 'none', display: 'inline-block',
                marginBottom: 24,
                color: '#000',
                backgroundColor: "#fff",
                padding: '7px',
                borderRadius: '10px',
                border: '1px solid #000'

                

                
                
                }}
            
            >← Back to Home</Link>

            <h1 style={{ fontSize: 36, fontWeight: 700, marginBottom: 8 }}>About SkillJoy</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 40, lineHeight: 1.7 }}>
                A campus marketplace built to make learning and earning easier for students.
            </p>

            <div style={{ background: '#f0ede8', borderRadius: 16, padding: '28px 32px', marginBottom: 24 }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>The idea</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
                    SkillJoy started as a simple question: what if students could help each other out — not just by swapping favors,
                    but by building real transactional trust? Every campus is full of untapped expertise. Someone who's great at
                    graphic design needs their laundry done. Someone who gives rides wants help with their resume.
                    SkillJoy connects those dots, with payments held securely in escrow so both sides are protected.
                </p>
            </div>

            <div style={{ background: '#f0ede8', borderRadius: 16, padding: '28px 32px', marginBottom: 24 }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>How it works</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 12 }}>
                    Users can post gigs (paid services) or propose skill swaps (free exchanges). When a gig is booked,
                    the buyer's payment is held in escrow via Stripe until the work is delivered and confirmed.
                    After release, funds enter a <strong>14-day clearance window</strong> — a safety buffer that protects sellers
                    from chargebacks — before being transferred to the seller's Stripe account.
                </p>
                <Link to="/how-it-works" style={{ fontSize: 14, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
                    See the full walkthrough →
                </Link>
            </div>

            <div style={{ background: '#f0ede8', borderRadius: 16, padding: '28px 32px', marginBottom: 40 }}>
                <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 16 }}>Built by</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0 }}>
                        DL
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Devan Lee</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
                            🏆 3rd place — Northland Hackathon<br />
                            Designer, developer, and the person who decided students deserve a better way to trade skills.
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link to="/gigs" className="btn btn-primary">Browse Gigs</Link>
                <Link to="/how-it-works" className="btn btn-secondary"
                style={{
                    backgroundColor: "#fff",
                    color: "#000"
                }}
                >How It Works</Link>
                <Link to="/contact" className="btn btn-secondary"
                style={{
                    backgroundColor: "#fff",
                    color: "#000"
                }}
                >Contact</Link>
            </div>
        </div>
    );
}
