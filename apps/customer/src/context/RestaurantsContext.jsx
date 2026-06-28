import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const RestaurantsContext = createContext(null);

// Local (not UTC) YYYY-MM-DD so "today" matches the customer's calendar day.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Fetches the published restaurant list once and shares it across pages
// (discovery, search bar, etc.) so we don't refetch on every component.
// Also fetches today's per-restaurant availability so the discovery UI can
// show real "Available / Fully Booked Today" state without trial and error.
export function RestaurantsProvider({ children }) {
  const [restaurants, setRestaurants] = useState([]);
  const [availabilityToday, setAvailabilityToday] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .listRestaurants()
      .then((data) => {
        setRestaurants(data);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    // Best-effort; never blocks the list. Map of restaurantId -> summary row
    // { status, freeTables, totalTables, earliest }.
    api
      .availabilitySummary(todayStr())
      .then((rows) => {
        const map = {};
        for (const r of rows) map[r.restaurantId] = r;
        setAvailabilityToday(map);
      })
      .catch(() => setAvailabilityToday({}));
  };

  useEffect(load, []);

  return (
    <RestaurantsContext.Provider
      value={{ restaurants, availabilityToday, loading, error, reload: load }}
    >
      {children}
    </RestaurantsContext.Provider>
  );
}

export function useRestaurantsContext() {
  const ctx = useContext(RestaurantsContext);
  if (!ctx) {
    throw new Error('useRestaurantsContext must be used within RestaurantsProvider');
  }
  return ctx;
}
