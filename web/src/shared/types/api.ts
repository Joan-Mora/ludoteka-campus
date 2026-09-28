export type Role = 'student' | 'teacher' | 'admin'

export interface User {
  id: string
  email: string
  name: string
  role: Role
}

export interface AuthResponse {
  accessToken: string
  user: User
}

export interface ApiErrorBody {
  error: { code: string; message: string }
}

export interface QuizSession {
  id: string
  code: string
  status: 'lobby' | 'live' | 'ended'
  title?: string | null
}

export interface JoinResponse {
  attemptId: string
  sessionId: string
}

export type IntegrityType = 'blur' | 'visibility' | 'escape' | 'fullscreen_exit'

export interface FacialConsent {
  accepted: boolean
  policyVersion: string | null
  acceptedAt: string | null
  policyCurrent: string
  needsReconsent: boolean
}

export interface PracticeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface QuizOption {
  id: string
  label: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: QuizOption[]
  position: number
}

export interface AttemptAnswer {
  questionId: string
  optionId: string | null
  correct: boolean
  points: number
}

export interface AttemptDetail {
  id: string
  sessionId: string
  score: number
  status: 'active' | 'completed' | 'suspended' | string
  questions: QuizQuestion[]
  answers: AttemptAnswer[]
}

export const FACIAL_MODEL_ID = 'eduquest-lab-luma-v1'
export const FACIAL_POLICY_VERSION = '2026-09-28'