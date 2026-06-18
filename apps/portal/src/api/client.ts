import type {
  BlockedPeriod,
  DashboardSummary,
  Reservation,
  Restaurant,
  Staff,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'tablebooker_portal_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
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

export interface LoginResponse {
  token: string;
  staff: Staff;
  restaurant: Restaurant;
  firstLogin: boolean;
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request<{ role: string; staff: Staff; restaurant: Restaurant }>('/auth/me'),

  getRestaurant: (id: string) => request<Restaurant>(`/restaurants/${id}/manage`),
  updateRestaurant: (id: string, data: Partial<Restaurant>) =>
    request<Restaurant>(`/restaurants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  setZones: (id: string, zones: { id?: string; name: string }[]) =>
    request<Restaurant>(`/restaurants/${id}/zones`, { method: 'PUT', body: JSON.stringify({ zones }) }),
  setTables: (id: string, tables: unknown[]) =>
    request<Restaurant>(`/restaurants/${id}/tables`, { method: 'PUT', body: JSON.stringify({ tables }) }),
  setFloorPlan: (id: string, elements: unknown[], background?: string | null) =>
    request<Restaurant>(`/restaurants/${id}/floorplan`, {
      method: 'PUT',
      body: JSON.stringify({ elements, background }),
    }),

  importMaps: (url: string) =>
    request<{ provider: string; data: Record<string, unknown> }>('/import', {
      method: 'POST',
      body: JSON.stringify({ url, provider: 'GOOGLE_MAPS' }),
    }),

  uploadImage: async (file: File): Promise<string> => {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/upload/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    const data = await res.json();
    return data.url as string;
  },

  addImage: (id: string, url: string, type?: string) =>
    request<Restaurant>(`/restaurants/${id}/images`, {
      method: 'POST',
      body: JSON.stringify({ url, type }),
    }),
  deleteImage: (id: string, imageId: string) =>
    request<Restaurant>(`/restaurants/${id}/images/${imageId}`, { method: 'DELETE' }),

  addMenuItem: (id: string, data: { category?: string; name: string; description?: string; price?: string; photo?: string }) =>
    request<Restaurant>(`/restaurants/${id}/menu`, { method: 'POST', body: JSON.stringify(data) }),
  updateMenuItem: (id: string, itemId: string, data: Partial<import('../types').MenuItem>) =>
    request<Restaurant>(`/restaurants/${id}/menu/${itemId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMenuItem: (id: string, itemId: string) =>
    request<Restaurant>(`/restaurants/${id}/menu/${itemId}`, { method: 'DELETE' }),

  syncGoogle: (id: string, importUrl?: string) =>
    request<Restaurant>(`/restaurants/${id}/sync`, { method: 'POST', body: JSON.stringify({ importUrl }) }),

  listReservations: (date?: string) =>
    request<Reservation[]>(`/reservations${date ? `?date=${date}` : ''}`),
  createReservation: (data: Partial<Reservation>) =>
    request<Reservation>('/reservations/manual', { method: 'POST', body: JSON.stringify(data) }),
  updateReservation: (id: string, data: Partial<Reservation>) =>
    request<{ reservation: Reservation; notifyCustomer: boolean; actions: string[] }>(
      `/reservations/${id}`,
      { method: 'PATCH', body: JSON.stringify(data) },
    ),
  deleteReservation: (id: string) =>
    request<{ ok: boolean }>(`/reservations/${id}`, { method: 'DELETE' }),

  listBlocked: () => request<BlockedPeriod[]>('/blocked'),
  createBlocked: (data: Partial<BlockedPeriod>) =>
    request<BlockedPeriod>('/blocked', { method: 'POST', body: JSON.stringify(data) }),
  updateBlocked: (id: string, data: Partial<BlockedPeriod>) =>
    request<BlockedPeriod>(`/blocked/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBlocked: (id: string) =>
    request<{ ok: boolean }>(`/blocked/${id}`, { method: 'DELETE' }),

  dashboard: (date?: string) =>
    request<DashboardSummary>(`/dashboard/summary${date ? `?date=${date}` : ''}`),
};

export { API_URL };
