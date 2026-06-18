import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';
import type { Restaurant, Staff } from '../types';

interface AuthState {
  staff: Staff | null;
  restaurant: Restaurant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ firstLogin: boolean }>;
  logout: () => void;
  refresh: () => Promise<void>;
  setRestaurant: (r: Restaurant) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setStaff(me.staff);
      setRestaurant(me.restaurant);
    } catch {
      clearToken();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setStaff(res.staff);
    setRestaurant(res.restaurant);
    return { firstLogin: res.firstLogin };
  };

  const logout = () => {
    clearToken();
    setStaff(null);
    setRestaurant(null);
  };

  const refresh = async () => {
    const me = await api.me();
    setStaff(me.staff);
    setRestaurant(me.restaurant);
  };

  return (
    <AuthContext.Provider
      value={{ staff, restaurant, loading, login, logout, refresh, setRestaurant }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
