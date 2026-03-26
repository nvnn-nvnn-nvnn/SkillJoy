import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/stores'
import './index.css'
import './App.css'

// Layout
import Header from './components/Header'

// Pages
import LandingPage from './introduction-pages/Home'
import LoginPage from './app-pages/auth/Login'
import Onboarding from './app-pages/auth/Onboarding'
import ChatPage from './app-pages/Chat'
import MatchesPage from './app-pages/Matches'
import DiscoverPage from './app-pages/MainSearch'
import Swaps from './app-pages/Swaps'
import MySwaps from './app-pages/MySwaps'
import Rewards from './app-pages/Rewards'
import Gigs from './app-pages/Gigs'
import MyListings from './app-pages/MyListings'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/matches" element={<MatchesPage />} />
          <Route path="/main-search" element={<Swaps />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/swaps" element={<Swaps />} />
          <Route path="/my-swaps" element={<MySwaps />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/gigs" element={<Gigs />} />
          <Route path="/my-listings" element={<MyListings />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
