import { useUser, useProfile, useAuth } from '@/lib/stores';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import Notifications from './Notifications';

export default function Header() {
  const user = useUser();
  const profile = useProfile();
  const { loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  async function signOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  if (loading || !user) return null;

  return (
    <nav className="nav">
      <Link to="/matches" className="nav-logo">
        Skill<span>Joy</span>
      </Link>
      <div className="nav-links">
        <Link to="/matches" className={`nav-link${currentPath === '/matches' ? ' active' : ''}`}>Matches</Link>
        <Link to="/swaps" className={`nav-link${currentPath === '/swaps' ? ' active' : ''}`}>Swaps</Link>
        <Link to="/gigs" className={`nav-link${currentPath === '/gigs' ? ' active' : ''}`}>Gigs</Link>
        <Link to="/my-orders" className={`nav-link${currentPath === '/my-orders' ? ' active' : ''}`}>Orders</Link>
        <Link to="/chat" className={`nav-link${currentPath === '/chat' ? ' active' : ''}`}>Chat</Link>
        <Link to="/rewards" className={`nav-link${currentPath === '/rewards' ? ' active' : ''}`}>Rewards</Link>
        <div style={{ flex: 1 }} />
        <div className="points-badge">
          🏆 {profile?.points || 0}
        </div>
        <Notifications />
        <Link to="/profile" className={`nav-link${currentPath === '/profile' ? ' active' : ''}`}>Profile</Link>
      </div>
    </nav>
  );
}