import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, clearToken, getToken, setToken } from '../api/client';
import type { User } from '../lib/types';

const USER_CACHE = 'petguardian_user';
function cacheUser(u: User | null) {
  try {
    if (u) localStorage.setItem(USER_CACHE, JSON.stringify(u));
    else localStorage.removeItem(USER_CACHE);
  } catch {
    /* ignore */
  }
}
function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role?: 'OWNER' | 'ATTORNEY';
  state?: string;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get<{ user: User }>('/auth/me')
      .then((r) => {
        setUser(r.user);
        cacheUser(r.user);
      })
      .catch((err) => {
        // Only sign out on an actual auth rejection. On a network error (offline),
        // keep the session and restore the last known user so the app still works.
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          cacheUser(null);
        } else {
          setUser(readCachedUser());
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { email, password });
    setToken(r.token);
    setUser(r.user);
    cacheUser(r.user);
  }

  async function register(input: RegisterInput) {
    const r = await api.post<{ token: string; user: User }>('/auth/register', input);
    setToken(r.token);
    setUser(r.user);
    cacheUser(r.user);
  }

  function logout() {
    clearToken();
    cacheUser(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
