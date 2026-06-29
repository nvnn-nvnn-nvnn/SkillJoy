import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Something went wrong.</h2>
        <p style={{ color: '#888', marginBottom: 16 }}>{this.state.error.message}</p>
        <button onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
    return this.props.children;
  }
}
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/stores'
import { LEGACY_MODE } from './lib/config'
import './index.css'
import './App.css'

// Layout
import Header from './components/Header'
import Footer from './components/Footer'

// Pages
import LandingPage from './introduction-pages/Home'
import LoginPage from './app-pages/auth/Login'
import Onboarding from './app-pages/auth/Onboarding'
import About from './introduction-pages/About'
import Contact from './introduction-pages/Contact'
import HowItWorks from './introduction-pages/HowItWorks'
import Terms from './introduction-pages/Terms'
import Privacy from './introduction-pages/Privacy'
import RefundPolicy from './introduction-pages/RefundPolicy'
import ChatPage from './app-pages/Chat'
import MatchesPage from './app-pages/Matches'
import DiscoverPage from './app-pages/MainSearch'
import Swaps from './app-pages/Swaps'
import MySwaps from './app-pages/MySwaps'
// import Rewards from './app-pages/Rewards'
import Gigs from './app-pages/Gigs'
import GigDetails from './app-pages/GigDetails'
import MyListings from './app-pages/MyListings'
import MyOrders from './app-pages/MyOrders'
import Disputes from './app-pages/Disputes'
import DisputeDetail from './app-pages/DisputeDetail'
import Profile from './app-pages/Profile'
import Settings from './app-pages/Settings'
import Admin from './app-pages/Admin'
import VerifyCollege from './app-pages/VerifyCollege'
import NotFound from './app-pages/NotFound'
// v3 Skill-platform pages
import SkillBuilder from './app-pages/SkillBuilder'
import Locker from './app-pages/Locker'
import Dashboard from './app-pages/Dashboard'
import Storefront from './app-pages/Storefront'
import StorefrontEditor from './app-pages/StorefrontEditor'
import SkillPublic from './app-pages/SkillPublic'
import Checkout from './app-pages/Checkout'
import Unsubscribe from './app-pages/Unsubscribe'
import AdminPayouts from './app-pages/AdminPayouts'

function AppRoutes() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* ── v3 Skill-platform routes ── */}
          <Route path="/build" element={<SkillBuilder />} />
          <Route path="/build/:skillId" element={<SkillBuilder />} />
          <Route path="/locker" element={<Locker />} />
          <Route path="/locker/:skillId" element={<Locker />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/storefront/edit" element={<StorefrontEditor />} />
          <Route path="/checkout/:skillId" element={<Checkout />} />

          {/* ── v1 legacy routes — parked behind LEGACY_MODE, never deleted ── */}
          {LEGACY_MODE && <>
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/main-search" element={<Swaps />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/swaps" element={<Swaps />} />
            <Route path="/my-swaps" element={<MySwaps />} />
            {/* <Route path="/rewards" element={<Rewards />} /> */}
            <Route path="/gigs" element={<Gigs />} />
            <Route path="/gigs/:gigId" element={<GigDetails />} />
            <Route path="/my-listings" element={<MyListings />} />
            <Route path="/my-orders" element={<MyOrders />} />
            <Route path="/disputes" element={<Disputes />} />
            <Route path="/disputes/:disputeId" element={<DisputeDetail />} />
            <Route path="/verify-college" element={<VerifyCollege />} />
          </>}

          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/payouts" element={<AdminPayouts />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />

          {/* Public storefront — must be LAST before catch-all so static
              routes win. Matches /@username (handle keeps the leading @). */}
          <Route path="/:handle" element={<Storefront />} />
          <Route path="/:handle/:skillId" element={<SkillPublic />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
