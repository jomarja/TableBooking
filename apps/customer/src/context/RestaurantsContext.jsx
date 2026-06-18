import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

const RestaurantsContext = createContext(null);

// Fetches the published restaurant list once and shares it across pages
// (discovery, search bar, etc.) so we don't refetch on every component.
export function RestaurantsProvider({ children }) {
  const [restaurants, setRestaurants] = useState([]);
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
  };

  useEffect(load, []);

  return (
    <RestaurantsContext.Provider value={{ restaurants, loading, error, reload: load }}>
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
