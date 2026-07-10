import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    // Surface the crash so it isn't swallowed silently in prod.
    // TODO(observability): forward to Sentry/LogRocket here.
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.error) return (
      <div style={{
        minHeight: '70vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px',
      }}>
        <div style={{ fontSize: 64, marginBottom: 12, lineHeight: 1 }}>😵</div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 8px', fontFamily: 'var(--font-display)' }}>Something went wrong</h1>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', margin: '0 0 28px', maxWidth: 380, lineHeight: 1.6 }}>
          An unexpected error crashed this page. Try reloading — if it keeps happening, let us know.
        </p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
    return this.props.children;
  }
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/stores'
import { DialogProvider } from './components/Dialog'
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
import Discover from './app-pages/Discover'
import Profile from './app-pages/Profile'
import Settings from './app-pages/Settings'
import Admin from './app-pages/Admin'
import NotFound from './app-pages/NotFound'
// v3 Skill-platform pages
import SkillBuilder from './app-pages/SkillBuilder'
import AddProduct from './app-pages/AddProduct'
import LessonEditor from './app-pages/LessonEditor'
import Locker from './app-pages/Locker'
import Dashboard from './app-pages/Dashboard'
import ServicesDashboard from './app-pages/ServicesDashboard'
import Storefront from './app-pages/Storefront'
import StorefrontEditor from './app-pages/StorefrontEditor'
import SkillPublic from './app-pages/SkillPublic'
import Checkout from './app-pages/Checkout'
import Unsubscribe from './app-pages/Unsubscribe'
import AdminPayouts from './app-pages/AdminPayouts'

function AppRoutes() {
  return (
    <div className="app-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* ── v3 Skill-platform routes ── */}
          {/* Products hub — the ServicesDashboard is the single "everything I sell"
              surface. /build/new (create) + /build/:id (editor) stay below. */}
          <Route path="/build" element={<ServicesDashboard />} />
          <Route path="/build/new" element={<AddProduct />} />
          <Route path="/build/:skillId/lesson/:lessonId" element={<LessonEditor />} />
          <Route path="/build/:skillId" element={<SkillBuilder />} />
          <Route path="/locker" element={<Locker />} />
          <Route path="/locker/:skillId" element={<Locker />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* Old /services route folded into the products hub. */}
          <Route path="/services" element={<Navigate to="/build" replace />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/storefront/edit" element={<StorefrontEditor />} />
          <Route path="/checkout/:skillId" element={<Checkout />} />

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
      <DialogProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </DialogProvider>
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
