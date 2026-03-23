import { useUser, useProfile, useAuth } from '@/lib/stores';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

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
        <Link to="/main-search" className={`nav-link${currentPath === '/main-search' ? ' active' : ''}`}>Search</Link>
        <Link to="/swaps" className={`nav-link${currentPath === '/swaps' ? ' active' : ''}`}>Swaps</Link>
        <Link to="/rewards" className={`nav-link${currentPath === '/rewards' ? ' active' : ''}`}>Rewards</Link>
        <Link to="/chat" className={`nav-link${currentPath === '/chat' ? ' active' : ''}`}>Chat</Link>
        <Link to="/onboarding" className={`nav-link${currentPath === '/onboarding' ? ' active' : ''}`}>Profile</Link>
        <div className="points-badge">
          🏆 {profile?.points || 0}
        </div>
        <button className="btn btn-ghost" onClick={signOut} style={{ marginLeft: 4 }}>Sign out</button>
      </div>
    </nav>
  );
}