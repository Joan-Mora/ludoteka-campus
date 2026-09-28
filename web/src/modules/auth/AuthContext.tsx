import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, clearSession, getStoredUser, getToken, setSession } from '../../shared/api/client'
import type { User } from '../../shared/types/api'

interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  loginFacial: (email: string, embedding: number[], modelId: string) => Promise<void>
  register: (input: { email: string; password: string; name: string }) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [token, setToken] = useState<string | null>(() => getToken())

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password })
    setSession(res.accessToken, res.user)
    setToken(res.accessToken)
    setUser(res.user)
  }, [])

  const loginFacial = useCallback(async (email: string, embedding: number[], modelId: string) => {
    const res = await api.loginFacial({ email, embedding, modelId })
    setSession(res.accessToken, res.user)
    setToken(res.accessToken)
    setUser(res.user)
  }, [])

  const register = useCallback(async (input: { email: string; password: string; name: string }) => {
    const res = await api.register({ ...input, role: 'student' })
    setSession(res.accessToken, res.user)
    setToken(res.accessToken)
    setUser(res.user)
  }, [])

  const logout = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    clearSession()
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, login, loginFacial, register, logout }),
    [user, token, login, loginFacial, register, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}