import type {
  ApiErrorBody,
  AttemptDetail,
  AuthResponse,
  FacialConsent,
  IntegrityType,
  JoinResponse,
  PracticeMessage,
  QuizSession,
  User,
} from '../types/api'

const TOKEN_KEY = 'eduquest_token'
const USER_KEY = 'eduquest_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as User } catch { return null }
}

export function setSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json')
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`/api${path}`, { ...init, headers })
  if (res.status === 204) return undefined as T

  const body = (await res.json().catch(() => null)) as T | ApiErrorBody | null
  if (!res.ok) {
    const err = body && typeof body === 'object' && 'error' in body ? (body as ApiErrorBody).error : null
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Error de red')
  }
  return body as T
}

export const api = {
  health: () => request<{ ok: boolean; db: string }>('/health'),
  register: (body: { email: string; password: string; name: string; role?: string }) =>
    request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  forgotPassword: (email: string) =>
    request<void>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, newPassword: string) =>
    request<void>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  createSession: (title?: string) =>
    request<QuizSession>('/sessions', { method: 'POST', body: JSON.stringify({ title }) }),
  joinSession: (code: string) =>
    request<JoinResponse>(`/sessions/${encodeURIComponent(code)}/join`, { method: 'POST' }),
  startSession: (id: string) => request<void>(`/sessions/${id}/start`, { method: 'POST' }),
  endSession: (id: string) => request<void>(`/sessions/${id}/end`, { method: 'POST' }),
  getSession: (id: string) => request<Record<string, unknown>>(`/sessions/${id}`),
  postAnswer: (attemptId: string, body: { questionId: string; optionId?: string; value?: string; elapsedMs?: number }) =>
    request<{ correct: boolean; points: number; score: number }>(`/attempts/${attemptId}/answers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  postIntegrity: (attemptId: string, type: IntegrityType) =>
    request<Record<string, unknown>>(`/attempts/${attemptId}/integrity-events`, {
      method: 'POST',
      body: JSON.stringify({ type, at: new Date().toISOString() }),
    }),
  getAttempt: (id: string) => request<AttemptDetail>(`/attempts/${id}`),
  getFacialConsent: () => request<FacialConsent>('/facial/consent'),
  postFacialConsent: (body: { policyVersion: string; accepted: boolean }) =>
    request<void>('/facial/consent', { method: 'POST', body: JSON.stringify(body) }),
  enrollFacial: (body: { embedding: number[]; modelId: string }) =>
    request<{ enrolled: boolean }>('/facial/enroll', { method: 'POST', body: JSON.stringify(body) }),
  loginFacial: (body: { email: string; embedding: number[]; modelId: string }) =>
    request<AuthResponse>('/facial/login', { method: 'POST', body: JSON.stringify(body) }),
  deleteFacialEnroll: () => request<void>('/facial/enroll', { method: 'DELETE' }),
  practiceChat: (body: { message: string; history?: PracticeMessage[] }) =>
    request<{ reply: string }>('/practice/chat', { method: 'POST', body: JSON.stringify(body) }),
}

export function certificateUrl(attemptId: string) {
  return `/api/attempts/${attemptId}/certificate.pdf`
}

export function sessionReportUrl(sessionId: string) {
  return `/api/sessions/${sessionId}/report.xlsx`
}

export function sessionReportPdfUrl(sessionId: string) {
  return `/api/sessions/${sessionId}/report.pdf`
}

export async function downloadAuthed(url: string, filename: string) {
  const token = getToken()
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'No se pudo descargar el archivo')
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}