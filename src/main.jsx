import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/stores'
import './index.css'

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
import Rewards from './app-pages/Rewards'

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
          <Route path="/main-search" element={<DiscoverPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/swaps" element={<Swaps />} />
          <Route path="/rewards" element={<Rewards />} />
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
