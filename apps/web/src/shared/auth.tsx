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
  companion?: 'luka' | 'luna';
  mustChangePassword?: boolean;
  /** Current terms or data policy not accepted yet (by the user, or by a guardian for their wards). */
  legalPending?: boolean;
}

export interface OtpChallenge {
  challengeId: string;
  maskedEmail: string;
  devCode?: string;
}

interface SessionResponse {
  accessToken: string;
  user: SessionUser;
}

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
  /** Password step. Returns the code challenge when the device is not trusted, or the user when the session is already open. */
  login: (email: string, password: string) => Promise<{ otp: OtpChallenge } | { user: SessionUser }>;
  verifyOtp: (challengeId: string, code: string, trustDevice: boolean) => Promise<SessionUser>;
  resendOtp: (challengeId: string) => Promise<OtpChallenge>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<SessionUser>;
  enter: (accessToken: string, user: SessionUser) => void;
  update: (patch: Partial<SessionUser>) => void;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
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

  function enter(accessToken: string, next: SessionUser) {
    setToken(accessToken);
    setUser(next);
  }

  async function login(email: string, password: string) {
    const data = await api<SessionResponse | { otp: OtpChallenge }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if ('otp' in data) return { otp: data.otp };
    enter(data.accessToken, data.user);
    return { user: data.user };
  }

  async function verifyOtp(challengeId: string, code: string, trustDevice: boolean) {
    const data = await api<SessionResponse>('/api/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code, trustDevice }),
    });
    enter(data.accessToken, data.user);
    return data.user;
  }

  async function resendOtp(challengeId: string) {
    const data = await api<{ otp: OtpChallenge }>('/api/auth/otp/resend', { method: 'POST', body: JSON.stringify({ challengeId }) });
    return data.otp;
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    const data = await api<SessionResponse>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    enter(data.accessToken, data.user);
    return data.user;
  }

  function update(patch: Partial<SessionUser>) {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setUser(null);
  }

  async function logoutEverywhere() {
    await api('/api/auth/logout-all', { method: 'POST' });
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, verifyOtp, resendOtp, changePassword, enter, update, logout, logoutEverywhere }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('auth');
  return ctx;
}
