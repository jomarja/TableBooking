const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'tablebooker_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export interface AdminRestaurant {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  status: 'PENDING' | 'APPROVED' | 'DISABLED';
  published: boolean;
  importSource: string;
  cover: string | null;
  staff: { id: string; email: string; name: string; firstLogin: boolean }[];
  reservationCount: number;
  tableCount: number;
}

export interface AdminStats {
  restaurants: number;
  approved: number;
  pending: number;
  disabled: number;
  reservations: number;
  blockedPeriods: number;
  todayReservations: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message || message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) clearToken();
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; admin: { id: string; email: string; name: string } }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  listRestaurants: () => request<AdminRestaurant[]>('/admin/restaurants'),
  createRestaurant: (data: {
    name: string;
    cuisine?: string;
    address?: string;
    importUrl?: string;
    ownerEmail: string;
    ownerName?: string;
    ownerPassword?: string;
  }) => request('/admin/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  setStatus: (id: string, status: 'PENDING' | 'APPROVED' | 'DISABLED') =>
    request(`/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  resetPassword: (id: string, password: string) =>
    request(`/admin/restaurants/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  syncRestaurant: (id: string) =>
    request<{ ok: boolean }>(`/admin/restaurants/${id}/sync`, { method: 'POST' }),
  syncAll: () =>
    request<{ ok: boolean; count: number }>('/admin/restaurants/sync-all', { method: 'POST' }),
  stats: () => request<AdminStats>('/admin/stats'),
};

export { API_URL };
