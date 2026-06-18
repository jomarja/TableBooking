import { createContext, useContext, useState, type ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from '../api/client';

interface Admin {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  admin: Admin | null;
  authed: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // The token alone gates access; admin profile is set on login.
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [authed, setAuthed] = useState(!!getToken());

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    setToken(res.token);
    setAdmin(res.admin);
    setAuthed(true);
  };

  const logout = () => {
    clearToken();
    setAdmin(null);
    setAuthed(false);
  };

  return (
    <AuthContext.Provider value={{ admin, authed, login, logout }}>
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
