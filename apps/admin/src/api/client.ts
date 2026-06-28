const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'http://localhost:5174';
const TOKEN_KEY = 'tablebooker_admin_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export interface AdminRestaurant {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  website: string;
  phone: string;
  rating: number;
  reviewCount: number;
  priceRange: string;
  priceLevel: number;
  description: string;
  outdoorSeating: boolean;
  familyFriendly: boolean;
  status: 'PENDING' | 'APPROVED' | 'DISABLED';
  published: boolean;
  cover: string | null;
  staff: { id: string; email: string; name: string; firstLogin: boolean }[];
  reservationCount: number;
  tableCount: number;
}

export interface AdminRestaurantUpdate {
  name?: string;
  cuisine?: string;
  address?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  priceLevel?: number;
  published?: boolean;
  outdoorSeating?: boolean;
  familyFriendly?: boolean;
  description?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: 'admin' | 'staff';
  impersonating: boolean;
  restaurantId: string | null;
  restaurantName: string;
  action: string;
  target: string | null;
  oldValue: string | null;
  newValue: string | null;
  ip: string | null;
}

export interface AuditFilters {
  from?: string;
  to?: string;
  restaurantId?: string;
  user?: string;
  action?: string;
  role?: string;
  search?: string;
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
    rating?: number;
    priceRange?: string;
    ownerEmail: string;
    ownerName?: string;
    ownerPassword?: string;
  }) => request('/admin/restaurants', { method: 'POST', body: JSON.stringify(data) }),
  setStatus: (id: string, status: 'PENDING' | 'APPROVED' | 'DISABLED') =>
    request(`/admin/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateRestaurant: (id: string, data: AdminRestaurantUpdate) =>
    request(`/admin/restaurants/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword: (id: string, password: string) =>
    request(`/admin/restaurants/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),
  impersonate: (id: string) =>
    request<{ token: string; restaurant: { id: string; name: string } }>(
      `/admin/restaurants/${id}/impersonate`,
      { method: 'POST' },
    ),
  auditLogs: (filters: AuditFilters = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v) qs.set(k, v);
    }
    const q = qs.toString();
    return request<AuditEntry[]>(`/admin/audit-logs${q ? `?${q}` : ''}`);
  },
  stats: () => request<AdminStats>('/admin/stats'),
};

export { API_URL, PORTAL_URL };
