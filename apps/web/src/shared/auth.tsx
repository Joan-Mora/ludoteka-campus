import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Role } from '@eduquest/contracts';
import { api, setToken } from './api';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isMinor: boolean;
  guardianConsent: boolean;
}

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  enter: (accessToken: string, user: SessionUser) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api<SessionUser>('/api/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  async function login(email: string, password: string) {
    const data = await api<{ accessToken: string; user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.accessToken);
    setUser(data.user);
  }

  async function register(fullName: string, email: string, password: string) {
    const data = await api<{ accessToken: string; user: SessionUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ fullName, email, password }),
    });
    setToken(data.accessToken);
    setUser(data.user);
  }

  function enter(accessToken: string, next: SessionUser) {
    setToken(accessToken);
    setUser(next);
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, ready, login, register, enter, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('auth');
  return ctx;
}
