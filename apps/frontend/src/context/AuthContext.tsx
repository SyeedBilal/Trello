import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiRequestError, apiRequest, registerAccessTokenRefresher } from '../services/api';

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

function getTokenExpiry(token: string): number | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
    const expiry = (JSON.parse(decoded) as { exp?: unknown }).exp;
    return typeof expiry === 'number' ? expiry * 1000 : undefined;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef<Promise<string> | null>(null);

  const refreshSession = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current;

    let request: Promise<string>;
    request = apiRequest<AuthResponse>('/auth/refresh', { method: 'POST' })
      .then((result) => {
        setUser(result.data.user);
        setAccessToken(result.data.accessToken);
        return result.data.accessToken;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 401) {
          setUser(null);
          setAccessToken(null);
        }
        throw error;
      })
      .finally(() => {
        if (refreshInFlight.current === request) refreshInFlight.current = null;
      });

    refreshInFlight.current = request;
    return request;
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      await refreshSession();
    } catch (error) {
      if (!(error instanceof ApiRequestError && error.status === 401)) {
        console.error('Unable to restore the session', error);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshSession]);

  useEffect(() => registerAccessTokenRefresher(refreshSession), [refreshSession]);
  useEffect(() => { void restoreSession(); }, [restoreSession]);

  useEffect(() => {
    if (!accessToken) return;
    const expiresAt = getTokenExpiry(accessToken);
    if (!expiresAt) return;

    let retryTimer: number | undefined;
    let retries = 0;
    const refreshBeforeExpiry = () => {
      void refreshSession().catch((error: unknown) => {
        if (error instanceof ApiRequestError && error.status === 401) return;
        console.error('Unable to refresh the access token', error);
        if (retries < 3) {
          retries += 1;
          retryTimer = window.setTimeout(refreshBeforeExpiry, 15_000);
        }
      });
    };

    const timer = window.setTimeout(refreshBeforeExpiry, Math.max(0, expiresAt - Date.now() - 60_000));
    return () => {
      window.clearTimeout(timer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [accessToken, refreshSession]);

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
