import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useProfile, useAuth, useUnreadCounts } from '@/lib/stores';
import { LEGACY_MODE } from '@/lib/config';
import { Link, useLocation } from 'react-router-dom';
import Notifications from './Notifications';
import SkillJoyLogo from '../assets/SkillJoy-Logo.svg'
import SkillJoyLogo2 from '../assets/SkillJoy-Logo2.svg'
import SkillJoyLogo3 from '../assets/skilljoy-logo3.svg'
import SkillJoyPurpleBlack from '../assets/skilljoypurple.svg'
import SkillJoyGreen from '../assets/skilljoy-green.svg'


export default function Header() {
  const user = useUser();
  const profile = useProfile();
  const { loading } = useAuth();
  const unread = useUnreadCounts();
  const location = useLocation();
  const currentPath = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() { setMenuOpen(false); }

  if (loading || !user || currentPath === '/login') return null;

  return (
    <>
    <nav className="nav">
      <Link to="/" className="nav-logo" onClick={closeMenu}>
        <img src={SkillJoyGreen} alt="SkillJoy Logo" style={{ height: 40, width: 'auto' }} />
      </Link>

      <button className={`nav-hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
        <span />
        <span />
        <span />
      </button>

      {/* Desktop nav */}
      <div className="nav-links">
        {/* ── v3 Skill-platform nav ── */}
        <Link to="/discover" className={`nav-link${currentPath.startsWith('/discover') ? ' active' : ''}`}>Discover</Link>
        <Link to="/build" className={`nav-link${currentPath.startsWith('/build') ? ' active' : ''}`}>Build</Link>
        <Link to="/locker" className={`nav-link${currentPath.startsWith('/locker') ? ' active' : ''}`}>Locker</Link>
        <Link to="/dashboard" className={`nav-link${currentPath.startsWith('/dashboard') ? ' active' : ''}`}>Dashboard</Link>
        <Link to="/services" className={`nav-link${currentPath.startsWith('/services') ? ' active' : ''}`}>Services</Link>
        {profile?.username && (
          <Link to={`/@${profile.username}`} className={`nav-link${currentPath === `/@${profile.username}` ? ' active' : ''}`}>Storefront</Link>
        )}

        {/* ── v1 legacy nav (campus swap/gig/escrow) — parked behind LEGACY_MODE ── */}
        {LEGACY_MODE && <>
          <Link to="/matches" className={`nav-link${currentPath === '/matches' ? ' active' : ''}`}>Matches</Link>
          <Link to="/swaps" className={`nav-link${currentPath === '/swaps' ? ' active' : ''}`}>
            Swaps{unread.swap > 0 && <span className="nav-badge">{unread.swap}</span>}
          </Link>
          <Link to="/gigs" className={`nav-link${currentPath === '/gigs' ? ' active' : ''}`}>
            Gigs{unread.gig > 0 && <span className="nav-badge">{unread.gig}</span>}
          </Link>
          <Link to="/my-orders" className={`nav-link${currentPath === '/my-orders' ? ' active' : ''}`}>
            Orders{unread.gig > 0 && <span className="nav-badge">{unread.gig}</span>}
          </Link>
          <Link to="/disputes" className={`nav-link${currentPath === '/disputes' ? ' active' : ''}`}>Disputes</Link>
          <Link to="/chat" className={`nav-link${currentPath === '/chat' ? ' active' : ''}`}>
            Chat{(unread.gig + unread.swap) > 0 && <span className="nav-badge">{unread.gig + unread.swap}</span>}
          </Link>
        </>}
        {user.email === 'techkage@proton.me' && (
          <Link to="/admin" className={`nav-link${currentPath === '/admin' ? ' active' : ''}`} style={{ color: '#ec9146', fontWeight: 700 }}>Admin</Link>
        )}
        <div style={{ flex: 1 }} />
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
          </div>
          {/* ── v3 Skill-platform nav ── */}
          <Link to="/discover" className={`nav-link${currentPath.startsWith('/discover') ? ' active' : ''}`} onClick={closeMenu}>Discover</Link>
          <Link to="/build" className={`nav-link${currentPath.startsWith('/build') ? ' active' : ''}`} onClick={closeMenu}>Build</Link>
          <Link to="/locker" className={`nav-link${currentPath.startsWith('/locker') ? ' active' : ''}`} onClick={closeMenu}>Locker</Link>
          <Link to="/dashboard" className={`nav-link${currentPath.startsWith('/dashboard') ? ' active' : ''}`} onClick={closeMenu}>Dashboard</Link>
          <Link to="/services" className={`nav-link${currentPath.startsWith('/services') ? ' active' : ''}`} onClick={closeMenu}>Services</Link>
          {profile?.username && (
            <Link to={`/@${profile.username}`} className={`nav-link${currentPath === `/@${profile.username}` ? ' active' : ''}`} onClick={closeMenu}>Storefront</Link>
          )}

          {/* ── v1 legacy nav — parked behind LEGACY_MODE ── */}
          {LEGACY_MODE && <>
            <Link to="/matches" className={`nav-link${currentPath === '/matches' ? ' active' : ''}`} onClick={closeMenu}>Matches</Link>
            <Link to="/swaps" className={`nav-link${currentPath === '/swaps' ? ' active' : ''}`} onClick={closeMenu}>
              Swaps{unread.swap > 0 && <span className="nav-badge">{unread.swap}</span>}
            </Link>
            <Link to="/gigs" className={`nav-link${currentPath === '/gigs' ? ' active' : ''}`} onClick={closeMenu}>
              Gigs{unread.gig > 0 && <span className="nav-badge">{unread.gig}</span>}
            </Link>
            <Link to="/my-orders" className={`nav-link${currentPath === '/my-orders' ? ' active' : ''}`} onClick={closeMenu}>
              Orders{unread.gig > 0 && <span className="nav-badge">{unread.gig}</span>}
            </Link>
            <Link to="/disputes" className={`nav-link${currentPath === '/disputes' ? ' active' : ''}`} onClick={closeMenu}>Disputes</Link>
            <Link to="/chat" className={`nav-link${currentPath === '/chat' ? ' active' : ''}`} onClick={closeMenu}>
              Chat{(unread.gig + unread.swap) > 0 && <span className="nav-badge">{unread.gig + unread.swap}</span>}
            </Link>
          </>}
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
