import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import RestaurantsPage from './pages/RestaurantsPage'
import RestaurantPage from './pages/RestaurantPage'
import ReservationFormPage from './pages/ReservationFormPage'
import VerificationPage from './pages/VerificationPage'
import ConfirmationPage from './pages/ConfirmationPage'
import MyReservationsPage from './pages/MyReservationsPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/restaurants" element={<RestaurantsPage />} />
          <Route path="/restaurant/:id" element={<RestaurantPage />} />
          <Route path="/reservation/form" element={<ReservationFormPage />} />
          <Route path="/reservation/verify" element={<VerificationPage />} />
          <Route path="/reservation/confirmation" element={<ConfirmationPage />} />
          <Route path="/reservations" element={<MyReservationsPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
