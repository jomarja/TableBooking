import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ReservationProvider } from './context/ReservationContext'
import { RestaurantsProvider } from './context/RestaurantsContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <RestaurantsProvider>
        <ReservationProvider>
          <App />
        </ReservationProvider>
      </RestaurantsProvider>
    </BrowserRouter>
  </StrictMode>,
)
