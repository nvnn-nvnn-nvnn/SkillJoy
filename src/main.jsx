import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/stores'
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

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
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
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/:userId" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/verify-college" element={<VerifyCollege />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
        <Footer />
        </div>
      </BrowserRouter>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
