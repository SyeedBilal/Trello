import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiRequest } from '../services/api';

export interface User { id: string; name: string; email: string }
interface AuthResponse { success: true; message: string; data: { user: User; accessToken: string } }
interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      const result = await apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' });
      setUser(result.data.user);
      setAccessToken(result.data.accessToken);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void restoreSession(); }, [restoreSession]);

  const login = async (email: string, password: string) => {
    const result = await apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setUser(result.data.user);
    setAccessToken(result.data.accessToken);
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    setUser(result.data.user);
    setAccessToken(result.data.accessToken);
  };

  const logout = async () => {
    await apiRequest<{ success: true }>('/auth/logout', { method: 'POST' }, accessToken ?? undefined);
    setUser(null);
    setAccessToken(null);
  };

  const value = useMemo(() => ({ user, accessToken, loading, login, register, logout }), [user, accessToken, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
