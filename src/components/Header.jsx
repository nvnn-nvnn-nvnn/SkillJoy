import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { Link, useLocation } from 'react-router-dom';
import {
  Package, Store, BarChart3, Compass, Lock, ExternalLink, User, Settings, TrendingUp,
} from 'lucide-react';
import Notifications from './Notifications';
import Logo from './Logo';

// One nav row — icon + label, active state, optional unread badge.
function NavItem({ to, icon: Icon, label, active, badge = 0, onClick }) {
  return (
    <Link to={to} className={`sb-link${active ? ' active' : ''}`} onClick={onClick}>
      <Icon size={18} strokeWidth={2} className="sb-link-icon" />
      <span className="sb-link-label">{label}</span>
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </Link>
  );
}

// v3 app chrome — a left vertical sidebar on desktop; a top bar + slide-in
// drawer on mobile. The three "Create" items keep products, the storefront
// editor, and services as distinct destinations.
export default function Header() {
  const user = useUser();
  const profile = useProfile();
  const { loading } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);

  // Onboarding is a locked, chrome-free flow — the user must finish setup before
  // any nav is available (they can't escape mid-onboarding and break the process).
  const showSidebar = !(loading || !user || currentPath === '/login' || currentPath === '/onboarding');

  // Toggle a body flag so the app shell can offset its content for the fixed rail.
  useEffect(() => {
    document.body.classList.toggle('has-sidebar', showSidebar);
    return () => document.body.classList.remove('has-sidebar');
  }, [showSidebar]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setMenuOpen(false); }, [currentPath]);

  if (!showSidebar) return null;

  const close = () => setMenuOpen(false);
  const isAdmin = user.email === 'techkage@proton.me';
  const on = (p) => currentPath.startsWith(p);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sb-topbar">
        <Link to="/" className="sb-logo" onClick={close}>
          <Logo height={30} />
        </Link>
        <button className={`sb-burger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
      </div>

      {menuOpen && createPortal(<div className="sb-backdrop" onClick={close} />, document.body)}

      {/* Sidebar — fixed rail (desktop) / slide-in drawer (mobile) */}
      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <Link to="/" className="sb-logo sb-logo-full" onClick={close}>
          <Logo height={38} />
        </Link>

        <nav className="sb-nav">
          <span className="sb-group">Create</span>
          {/* Link-in-bio first: the customizable page is the hook, products live on it. */}
          <NavItem to="/storefront/edit" icon={Store} label="My Page" active={on('/storefront')} onClick={close} />
          <NavItem to="/build" icon={Package} label="Products" active={on('/build')} onClick={close} />

          <span className="sb-group">Grow</span>
          <NavItem to="/dashboard" icon={BarChart3} label="Dashboard" active={on('/dashboard')} onClick={close} />
          <NavItem to="/analytics" icon={TrendingUp} label="Analytics" active={on('/analytics')} onClick={close} />
          {isAdmin && (
            <NavItem to="/discover" icon={Compass} label="Discover" active={on('/discover')} onClick={close} />
          )}
          <NavItem to="/locker" icon={Lock} label="Locker" active={on('/locker')} onClick={close} />

          {isAdmin && <NavItem to="/admin" icon={Settings} label="Admin" active={currentPath === '/admin'} onClick={close} />}
        </nav>

        <div className="sb-foot">
          {profile?.username && (
            <NavItem to={`/@${profile.username}`} icon={ExternalLink} label="View my page" active={currentPath === `/@${profile.username}`} onClick={close} />
          )}
          <div className="sb-foot-row">
            <NavItem to="/profile" icon={User} label="Profile" active={currentPath === '/profile'} onClick={close} />
            <Notifications />
          </div>
        </div>
      </aside>
    </>
  );
}
