import { createContext, useContext, useState, useEffect } from 'react';

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

  const confirmReservation = () => {
    const id = 'TB-' + Date.now().toString(36).toUpperCase();
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
