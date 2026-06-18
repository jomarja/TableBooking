import { useEffect, useState } from 'react';
import { api } from '../api/client';

// Returns the restaurant list in the shape the existing components expect.
export function useRestaurants() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .listRestaurants()
      .then((data) => {
        if (active) {
          setRestaurants(data);
          setError(null);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return { restaurants, loading, error };
}

export function useRestaurant(id) {
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    api
      .getRestaurant(id)
      .then((data) => {
        if (active) {
          setRestaurant(data);
          setError(null);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  return { restaurant, loading, error };
}
