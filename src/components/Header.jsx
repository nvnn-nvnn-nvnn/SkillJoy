import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { Link, useLocation } from 'react-router-dom';
import Notifications from './Notifications';
import SkillJoyLogo from '../assets/SkillJoy-Logo.svg'
import SkillJoyLogo2 from '../assets/SkillJoy-Logo2.svg'
import SkillJoyLogo3 from '../assets/skilljoy-logo3.svg'


export default function Header() {
  const user = useUser();
  const profile = useProfile();
  const { loading } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() { setMenuOpen(false); }

  if (loading || !user) return null;

  return (
    <>
    <nav className="nav">
      <Link to="/" className="nav-logo" onClick={closeMenu}>
        <img src={SkillJoyLogo3} alt="SkillJoy Logo" style={{ height: 35, width: 'auto' }} />
      </Link>

      <button className={`nav-hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
        <span />
        <span />
        <span />
      </button>

      {/* Desktop nav */}
      <div className="nav-links">
        <Link to="/matches" className={`nav-link${currentPath === '/matches' ? ' active' : ''}`}>Matches</Link>
        <Link to="/swaps" className={`nav-link${currentPath === '/swaps' ? ' active' : ''}`}>Swaps</Link>
        <Link to="/gigs" className={`nav-link${currentPath === '/gigs' ? ' active' : ''}`}>Gigs</Link>
        <Link to="/my-orders" className={`nav-link${currentPath === '/my-orders' ? ' active' : ''}`}>Orders</Link>
        <Link to="/disputes" className={`nav-link${currentPath === '/disputes' ? ' active' : ''}`}>Disputes</Link>
        <Link to="/chat" className={`nav-link${currentPath === '/chat' ? ' active' : ''}`}>Chat</Link>
        {/* <Link to="/rewards" className={`nav-link${currentPath === '/rewards' ? ' active' : ''}`}>Rewards</Link> */}
        {user.email === 'techkage@proton.me' && (
          <Link to="/admin" className={`nav-link${currentPath === '/admin' ? ' active' : ''}`} style={{ color: '#ec9146', fontWeight: 700 }}>Admin</Link>
        )}
        <div style={{ flex: 1 }} />
        <div className="points-badge">🏆 {profile?.points || 0}</div>
        <Notifications />
        <Link to="/profile" className={`nav-link${currentPath === '/profile' ? ' active' : ''}`}>Profile</Link>
      </div>

    </nav>

    {createPortal(
      <>
        {menuOpen && <div className="nav-backdrop" onClick={closeMenu} />}
        <div className={`nav-drawer${menuOpen ? ' open' : ''}`}>
          <div className="nav-drawer-top">
            <span className="nav-drawer-title">Menu</span>
            <div className="points-badge">🏆 {profile?.points || 0}</div>
          </div>
          <Link to="/matches" className={`nav-link${currentPath === '/matches' ? ' active' : ''}`} onClick={closeMenu}>Matches</Link>
          <Link to="/swaps" className={`nav-link${currentPath === '/swaps' ? ' active' : ''}`} onClick={closeMenu}>Swaps</Link>
          <Link to="/gigs" className={`nav-link${currentPath === '/gigs' ? ' active' : ''}`} onClick={closeMenu}>Gigs</Link>
          <Link to="/my-orders" className={`nav-link${currentPath === '/my-orders' ? ' active' : ''}`} onClick={closeMenu}>Orders</Link>
          <Link to="/disputes" className={`nav-link${currentPath === '/disputes' ? ' active' : ''}`} onClick={closeMenu}>Disputes</Link>
          <Link to="/chat" className={`nav-link${currentPath === '/chat' ? ' active' : ''}`} onClick={closeMenu}>Chat</Link>
          <Link to="/rewards" className={`nav-link${currentPath === '/rewards' ? ' active' : ''}`} onClick={closeMenu}>Rewards</Link>
          {user.email === 'techkage@proton.me' && (
            <Link to="/admin" className={`nav-link${currentPath === '/admin' ? ' active' : ''}`} onClick={closeMenu} style={{ color: '#ec9146', fontWeight: 700 }}>Admin</Link>
          )}
          <div style={{ flex: 1 }} />
          <div className="nav-drawer-bottom">
            <Notifications />
            <Link to="/profile" className={`nav-link${currentPath === '/profile' ? ' active' : ''}`} onClick={closeMenu} style={{ fontSize: 15 }}>Profile</Link>
          </div>
        </div>
      </>,
      document.body
    )}
    </>
  );
}
