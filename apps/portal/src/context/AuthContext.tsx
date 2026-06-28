import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { ADMIN_URL, api, clearToken, getToken, setToken } from '../api/client';
import type { Restaurant, Staff } from '../types';

interface AuthState {
  staff: Staff | null;
  restaurant: Restaurant | null;
  loading: boolean;
  // Admin display name when this session is an admin impersonating the
  // restaurant ("Login as Restaurant"); null for a normal owner session.
  impersonatedBy: string | null;
  login: (email: string, password: string) => Promise<{ firstLogin: boolean }>;
  logout: () => void;
  exitImpersonation: () => Promise<void>;
  refresh: () => Promise<void>;
  setRestaurant: (r: Restaurant) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [impersonatedBy, setImpersonatedBy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = async () => {
    // The admin app hands off an impersonation token via a one-time URL param.
    // Adopt it, then scrub it from the address bar.
    const params = new URLSearchParams(window.location.search);
    const handoff = params.get('impersonate');
    if (handoff) {
      setToken(handoff);
      params.delete('impersonate');
      const clean =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
      window.history.replaceState({}, '', clean);
    }

    if (!getToken()) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.me();
      setStaff(me.staff);
      setRestaurant(me.restaurant);
      setImpersonatedBy(me.impersonatedBy ?? null);
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
    setImpersonatedBy(null);
    return { firstLogin: res.firstLogin };
  };

  const logout = () => {
    clearToken();
    setStaff(null);
    setRestaurant(null);
    setImpersonatedBy(null);
  };

  const exitImpersonation = async () => {
    try {
      await api.endImpersonation();
    } catch {
      /* logging the end is best-effort */
    }
    clearToken();
    setStaff(null);
    setRestaurant(null);
    setImpersonatedBy(null);
    window.location.href = ADMIN_URL;
  };

  const refresh = async () => {
    const me = await api.me();
    setStaff(me.staff);
    setRestaurant(me.restaurant);
    setImpersonatedBy(me.impersonatedBy ?? null);
  };

  return (
    <AuthContext.Provider
      value={{
        staff,
        restaurant,
        loading,
        impersonatedBy,
        login,
        logout,
        exitImpersonation,
        refresh,
        setRestaurant,
      }}
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
