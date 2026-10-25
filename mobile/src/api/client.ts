import Constants from 'expo-constants'
import { getDeviceInfo } from '../lib/device'
import { storage } from '../lib/storage'
import type {
  AdminConfig,
  AdminExercise,
  AdminLessonDetail,
  AdminUnit,
  AdminWord,
  AnswerFeedback,
  CompletionSummary,
  GuestNextLesson,
  GuestSessionResponse,
  LessonDto,
  MeResponse,
  PathResponse,
  ProgressSummary,
  PublicConfig,
  RefreshedSessionResponse,
  ReviewAnswerResponse,
  ReviewQueueResponse,
  SessionResponse,
  StartAttemptResponse,
  WordsResponse,
} from './types'

function defaultBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL
  if (configured) return configured.replace(/\/$/, '')

  const hostUri = Constants.expoConfig?.hostUri
  if (hostUri) {
    const host = hostUri.split(':')[0]
    if (host) return `http://${host}:4000`
  }
  return 'http://localhost:4000'
}

export const API_URL = defaultBaseUrl()

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fields?: Record<string, string>
  readonly retryAfter?: number

  constructor(
    status: number,
    code: string,
    message: string,
    fields?: Record<string, string>,
    retryAfter?: number,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
    this.retryAfter = retryAfter
  }
}

let accessToken: string | null = null
let guestToken: string | null = null
let refreshing: Promise<boolean> | null = null
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setGuestAuthToken(token: string | null) {
  guestToken = token
}

export function clearAuthToken() {
  accessToken = null
  guestToken = null
}

export function onUnauthorized(listener: () => void) {
  onSessionExpired = listener
}

export function authToken(): string | null {
  return accessToken ?? guestToken
}

export function mediaUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl
  return `${API_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  idempotencyKey?: string
  anonymous?: boolean
  allowRefresh?: boolean
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function refreshAccessToken(): Promise<boolean> {
  if (refreshing) return refreshing

  refreshing = (async () => {
    const stored = await storage.getRefreshToken()
    if (!stored) return false

    try {
      const device = await getDeviceInfo()
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored, deviceId: device.deviceId }),
      })
      if (!response.ok) return false
      const data = (await parseResponse(response)) as RefreshedSessionResponse | null
      if (!data?.accessToken) return false
      accessToken = data.accessToken
      await storage.setRefreshToken(data.refreshToken)
      return true
    } catch {
      return false
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', ...options.headers }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (!options.anonymous) {
    const token = authToken()
    if (token) headers.authorization = `Bearer ${token}`
  }
  if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey

  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Puo needs a connection. Check your network and try again.')
  }

  const rawBody = await parseResponse(response)

  if (response.status === 401 && options.allowRefresh !== false && !guestToken) {
    const errorBody = rawBody as { error?: { code?: string } } | null
    if (errorBody?.error?.code === 'TOKEN_EXPIRED' && (await refreshAccessToken())) {
      return request<T>(path, { ...options, allowRefresh: false })
    }
    if (accessToken) {
      accessToken = null
      onSessionExpired?.()
    }
  }

  const body = rawBody as
    | { error?: { code?: string; message?: string; fields?: Record<string, string> }; retryAfter?: number }
    | T
    | null

  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)
      ?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL',
      error?.message ?? 'Something went wrong. Please try again.',
      error?.fields,
    )
  }

  return body as T
}

export const api = {
  config: () => request<PublicConfig>('/api/v1/config', { anonymous: true, allowRefresh: false }),

  register: (input: {
    email: string
    password: string
    displayName: string
    timezone: string
    deviceId: string
    platform: 'ios' | 'android'
    guestToken?: string | null
  }) =>
    request<SessionResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: input,
      anonymous: true,
      allowRefresh: false,
    }),

  login: (input: { email: string; password: string; deviceId: string; platform: 'ios' | 'android' }) =>
    request<SessionResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: input,
      anonymous: true,
      allowRefresh: false,
    }),

  google: (input: {
    idToken: string
    deviceId: string
    platform: 'ios' | 'android'
    guestToken?: string | null
  }) =>
    request<SessionResponse>('/api/v1/auth/google', {
      method: 'POST',
      body: input,
      anonymous: true,
      allowRefresh: false,
    }),

  refresh: (refreshToken: string, deviceId: string) =>
    request<RefreshedSessionResponse>('/api/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken, deviceId },
      anonymous: true,
      allowRefresh: false,
    }),

  logout: (refreshToken: string, allDevices = false) =>
    request<null>('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken, allDevices },
    }),

  guest: (input: { deviceId: string; platform: 'ios' | 'android'; timezone: string }) =>
    request<GuestSessionResponse>('/api/v1/auth/guest', {
      method: 'POST',
      body: input,
      anonymous: true,
      allowRefresh: false,
    }),

  forgotPassword: (email: string) =>
    request<{ status: string; emailDelivery: boolean }>('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: { email },
      anonymous: true,
      allowRefresh: false,
    }),

  me: () => request<MeResponse>('/api/v1/me'),

  updateMe: (input: {
    displayName?: string
    timezone?: string
    dailyGoalLessons?: number
    notificationPrefs?: {
      reminderEnabled?: boolean
      reminderLocalTime?: string
      streakReminderEnabled?: boolean
    }
  }) => request<MeResponse>('/api/v1/me', { method: 'PATCH', body: input }),

  deleteAccount: (password: string) =>
    request<null>('/api/v1/me', { method: 'DELETE', body: { password, confirm: 'DELETE' } }),

  path: () => request<PathResponse>('/api/v1/path'),

  guestNextLesson: () => request<GuestNextLesson>('/api/v1/lessons/guest-next'),

  lesson: (lessonId: string) => request<LessonDto>(`/api/v1/lessons/${lessonId}`),

  startLesson: (lessonId: string) =>
    request<StartAttemptResponse>(`/api/v1/lessons/${lessonId}/start`, { method: 'POST', body: {} }),

  answer: (
    attemptId: string,
    input: { exerciseId: string; answer: unknown; timeMs?: number },
    idempotencyKey?: string,
  ) =>
    request<AnswerFeedback>(`/api/v1/attempts/${attemptId}/answers`, {
      method: 'POST',
      body: input,
      idempotencyKey,
    }),

  completeAttempt: (attemptId: string) =>
    request<CompletionSummary>(`/api/v1/attempts/${attemptId}/complete`, { method: 'POST', body: {} }),

  abandonAttempt: (attemptId: string) =>
    request<{ attemptId: string }>(`/api/v1/attempts/${attemptId}/abandon`, { method: 'POST', body: {} }),

  words: (status: 'all' | 'new' | 'learning' | 'known' = 'all') =>
    request<WordsResponse>(`/api/v1/words?status=${status}`),

  word: (wordId: string) => request<Record<string, unknown>>(`/api/v1/words/${wordId}`),

  reviewQueue: () => request<ReviewQueueResponse>('/api/v1/review/queue'),

  reviewAnswer: (wordId: string, selfMark: 'again' | 'good' | 'easy') =>
    request<ReviewAnswerResponse>('/api/v1/review/answers', {
      method: 'POST',
      body: { wordId, selfMark },
    }),

  progress: () => request<ProgressSummary>('/api/v1/progress/summary'),

  registerDevice: (input: { expoPushToken: string; platform: 'ios' | 'android'; deviceId: string }) =>
    request<{ id: string }>('/api/v1/devices', { method: 'POST', body: input }),

  admin: {
    units: () => request<{ units: AdminUnit[] }>('/api/v1/admin/units'),
    createUnit: (input: { title: string; titleEn: string; colour?: string; isPublished?: boolean }) =>
      request<AdminUnit>('/api/v1/admin/units', { method: 'POST', body: input }),
    updateUnit: (id: string, input: Partial<{ title: string; titleEn: string; description: string; colour: string; position: number; isPublished: boolean }>) =>
      request<AdminUnit>(`/api/v1/admin/units/${id}`, { method: 'PATCH', body: input }),
    deleteUnit: (id: string) => request<null>(`/api/v1/admin/units/${id}`, { method: 'DELETE' }),
    createLesson: (input: { unitId: string; title: string; subtitle?: string; isPublished?: boolean }) =>
      request<AdminLessonDetail>('/api/v1/admin/lessons', { method: 'POST', body: input }),
    lesson: (id: string) => request<AdminLessonDetail>(`/api/v1/admin/lessons/${id}`),
    updateLesson: (id: string, input: Partial<{ title: string; subtitle: string; isPublished: boolean; xpBonus: number }>) =>
      request<AdminLessonDetail>(`/api/v1/admin/lessons/${id}`, { method: 'PATCH', body: input }),
    deleteLesson: (id: string) => request<null>(`/api/v1/admin/lessons/${id}`, { method: 'DELETE' }),
    createExercise: (input: {
      lessonId: string
      type: string
      prompt: Record<string, unknown>
      answerKey: Record<string, unknown>
      explanation?: string
      xp?: number
      audioUrl?: string
    }) => request<AdminExercise>('/api/v1/admin/exercises', { method: 'POST', body: input }),
    updateExercise: (id: string, input: Record<string, unknown>) =>
      request<AdminExercise>(`/api/v1/admin/exercises/${id}`, { method: 'PATCH', body: input }),
    deleteExercise: (id: string) => request<null>(`/api/v1/admin/exercises/${id}`, { method: 'DELETE' }),
    words: () => request<{ words: AdminWord[] }>('/api/v1/admin/words'),
    createWord: (input: Record<string, unknown>) =>
      request<AdminWord>('/api/v1/admin/words', { method: 'POST', body: input }),
    updateWord: (id: string, input: Record<string, unknown>) =>
      request<AdminWord>(`/api/v1/admin/words/${id}`, { method: 'PATCH', body: input }),
    deleteWord: (id: string) => request<null>(`/api/v1/admin/words/${id}`, { method: 'DELETE' }),
    config: () => request<AdminConfig>('/api/v1/admin/config'),
    updateConfig: (patch: Record<string, unknown>) =>
      request<AdminConfig>('/api/v1/admin/config', { method: 'PATCH', body: patch }),
    validateContent: () =>
      request<{ files: number; errors: { path: string; message: string }[]; warnings: { path: string; message: string }[] }>(
        '/api/v1/admin/content/validate',
      ),
    health: () =>
      request<{ units: number; lessons: number; exercises: number; words: number; users: number }>(
        '/api/v1/admin/health',
      ),
  },
}

export type Api = typeof api
