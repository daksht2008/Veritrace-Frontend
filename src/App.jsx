/**
 * App.jsx — Root application shell
 * 
 * Renders the persistent layout (Topbar, Navbar, Footer) and
 * switches page content via react-router-dom Routes.
 */
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Topbar from './components/Topbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import RegisterPage from './pages/RegisterPage'
import VerifyPage from './pages/VerifyPage'
import LibraryPage from './pages/LibraryPage'

function App() {
  return (
    <>
      {/* Network status bar + faucet marquee */}
      <Topbar />

      {/* Sticky navigation with wallet connect */}
      <Navbar />

      {/* Page content — swapped by the router */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Site footer */}
      <Footer />
    </>
  )
}

export default App
