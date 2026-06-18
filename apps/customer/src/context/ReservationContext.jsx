import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const ReservationContext = createContext();

export function ReservationProvider({ children }) {
  const [reservationData, setReservationData] = useState({
    restaurant: null,
    date: null,
    guests: null,
    table: null,
    timeSlot: null,
    personalInfo: null,
    verified: false,
    reservationId: null,
  });

  const [allReservations, setAllReservations] = useState(() => {
    const stored = localStorage.getItem('tableBookerReservations');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('tableBookerReservations', JSON.stringify(allReservations));
  }, [allReservations]);

  const updateReservation = (field, value) => {
    setReservationData(prev => ({ ...prev, [field]: value }));
  };

  const resetReservation = () => {
    setReservationData({
      restaurant: null,
      date: null,
      guests: null,
      table: null,
      timeSlot: null,
      personalInfo: null,
      verified: false,
      reservationId: null,
    });
  };

  // Persists the reservation to the shared backend so it immediately appears
  // in availability (and the restaurant portal). Falls back to a local-only id
  // if the API is unreachable, keeping the demo flow resilient.
  const confirmReservation = async () => {
    const { restaurant, date, guests, table, timeSlot, personalInfo } = reservationData;
    let id = 'TB-' + Date.now().toString(36).toUpperCase();

    try {
      if (restaurant?.id && date && timeSlot) {
        const created = await api.createReservation({
          restaurantId: restaurant.id,
          tableId: table?.id,
          date,
          startTime: timeSlot.start,
          endTime: timeSlot.end,
          guests: guests || 2,
          name: personalInfo?.name || '',
          surname: personalInfo?.surname || '',
          phone: personalInfo?.phone || '',
          occasion: personalInfo?.occasion || undefined,
          specialRequest: personalInfo?.specialRequest || undefined,
        });
        if (created?.id) id = created.id;
      }
    } catch (e) {
      // Keep the local fallback id; surface nothing blocking to the user.
      console.warn('Reservation API call failed, using local record:', e.message);
    }

    const newReservation = {
      ...reservationData,
      reservationId: id,
      createdAt: new Date().toISOString(),
    };
    setAllReservations(prev => [...prev, newReservation]);
    setReservationData(prev => ({ ...prev, reservationId: id }));
    return id;
  };

  return (
    <ReservationContext.Provider value={{
      reservationData,
      updateReservation,
      resetReservation,
      confirmReservation,
      allReservations,
    }}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const context = useContext(ReservationContext);
  if (!context) {
    throw new Error('useReservation must be used within a ReservationProvider');
  }
  return context;
}
