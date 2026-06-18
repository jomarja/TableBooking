// Thin fetch wrapper around the TableBooker API.
// Base URL is configurable via VITE_API_URL (defaults to the local Nest server).

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listRestaurants: () => request('/restaurants'),
  getRestaurant: (id) => request(`/restaurants/${id}`),
  getAvailability: (id, date) =>
    request(`/restaurants/${id}/availability?date=${encodeURIComponent(date)}`),
  getReservationConfig: (id) => request(`/restaurants/${id}/reservation-config`),
  createReservation: (payload) =>
    request('/reservations', { method: 'POST', body: JSON.stringify(payload) }),
};

export { API_URL };
