import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useProfile, useAuth } from '@/lib/stores';
import { Link, useLocation } from 'react-router-dom';
import {
  Package, Store, BarChart3, Compass, Lock, ExternalLink, User, Settings, TrendingUp, ChevronDown,
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

// A nav item that expands into sub-destinations.
//
// Open state is DERIVED from the route, not stored: if you're anywhere under
// /storefront the group is open, otherwise it's closed. A remembered toggle
// would let you be on /storefront/links with the group collapsed, which hides
// where you actually are — the one thing nav must never do.
//
// The parent is a Link (to the first item), not a button. It has a real
// destination, so making it a button would break middle-click and open-in-new-tab
// for no gain; the chevron is decoration on top of a working link.
function NavGroup({ icon, label, active, items, currentPath, onNavigate }) {
  // Assigned as a VARIABLE, not renamed in the param list — eslint's
  // varsIgnorePattern ^[A-Z_] covers variables but not args (LANDMINES §11).
  const Icon = icon;
  const open = active;
  return (
    <div className={`sb-group-nav${open ? ' open' : ''}`}>
      <Link
        to={items[0].to}
        className={`sb-link${active ? ' active' : ''}`}
        onClick={onNavigate}
        aria-expanded={open}
      >
        <Icon size={18} strokeWidth={2} className="sb-link-icon" />
        <span className="sb-link-label">{label}</span>
        <ChevronDown size={15} className={`sb-caret${open ? ' open' : ''}`} aria-hidden="true" />
      </Link>
      {open && (
        <div className="sb-sub">
          {items.map(it => (
            <Link
              key={it.to}
              to={it.to}
              className={`sb-sublink${currentPath === it.to ? ' active' : ''}`}
              onClick={onNavigate}
              aria-current={currentPath === it.to ? 'page' : undefined}
            >
              {it.label}
            </Link>
          ))}
        </div>
      )}
    </div>
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
          {/* Link-in-bio first: the customizable page is the hook, products live on it.
              My Page expands into its sections rather than hiding them behind a tab
              row inside the editor — one nav for the whole app, and each section is
              a real URL you can link to or hit back from. */}
          <NavGroup
            icon={Store}
            label="My Page"
            active={on('/storefront')}
            items={[
              { to: '/storefront/edit', label: 'Customize' },
              { to: '/storefront/links', label: 'Links' },
              { to: '/storefront/templates', label: 'Templates' },
            ]}
            currentPath={currentPath}
            onNavigate={close}
          />
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
