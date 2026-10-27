import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  api,
  clearAuthToken,
  onUnauthorized,
  setAccessToken,
  setGuestAuthToken,
} from '../api/client'
import type { MeResponse, StatsDto, UserDto } from '../api/types'
import { getDeviceInfo } from '../lib/device'
import { storage } from '../lib/storage'

type AuthStatus = 'loading' | 'signedOut' | 'guest' | 'signedIn'

type AuthContextValue = {
  status: AuthStatus
  user: UserDto | null
  stats: StatsDto | null
  dateLabel: string | null
  needsOnboarding: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: { email: string; password: string; displayName: string }) => Promise<void>
  signInWithGoogleToken: (idToken: string) => Promise<void>
  continueAsGuest: () => Promise<void>
  signOut: () => Promise<void>
  refreshMe: () => Promise<MeResponse | null>
  applyStats: (stats: Partial<StatsDto>) => void
  finishOnboarding: () => Promise<void>
  updateProfile: (input: {
    displayName?: string
    dailyGoalLessons?: number
    notificationPrefs?: {
      reminderEnabled?: boolean
      reminderLocalTime?: string
      streakReminderEnabled?: boolean
    }
  }) => Promise<void>
  deleteAccount: (password: string) => Promise<void>
  guestToken: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<UserDto | null>(null)
  const [stats, setStats] = useState<StatsDto | null>(null)
  const [dateLabel, setDateLabel] = useState<string | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [guestToken, setGuestToken] = useState<string | null>(null)

  const clearSession = useCallback(async () => {
    clearAuthToken()
    await storage.setRefreshToken(null)
    await storage.setGuestToken(null)
    setUser(null)
    setStats(null)
    setDateLabel(null)
    setNeedsOnboarding(false)
    setGuestToken(null)
    setStatus('signedOut')
  }, [])

  useEffect(() => {
    onUnauthorized(() => {
      void clearSession()
    })
  }, [clearSession])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const device = await getDeviceInfo()
      const storedRefresh = await storage.getRefreshToken()
      const storedGuest = await storage.getGuestToken()

      if (storedRefresh) {
        try {
          const refreshed = await api.refresh(storedRefresh, device.deviceId)
          if (cancelled) return
          setAccessToken(refreshed.accessToken)
          await storage.setRefreshToken(refreshed.refreshToken)
          const me = await api.me()
          if (cancelled) return
          setUser(me.user)
          setStats(me.stats)
          setDateLabel(me.dateLabel)
          const onboarded = await storage.hasOnboarded(me.user.id)
          setNeedsOnboarding(!onboarded)
          setStatus('signedIn')
          return
        } catch {
          await storage.setRefreshToken(null)
        }
      }

      if (storedGuest) {
        setGuestAuthToken(storedGuest)
        setGuestToken(storedGuest)
        setStatus('guest')
        return
      }

      if (!cancelled) setStatus('signedOut')
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const adoptSession = useCallback(
    async (session: { accessToken: string; refreshToken: string; user: UserDto; stats: StatsDto }) => {
      setAccessToken(session.accessToken)
      await storage.setRefreshToken(session.refreshToken)
      await storage.setGuestToken(null)
      setGuestAuthToken(null)
      setGuestToken(null)
      setUser(session.user)
      setStats(session.stats)
      const me = await api.me()
      setDateLabel(me.dateLabel)
      setStats(me.stats)
      const onboarded = await storage.hasOnboarded(session.user.id)
      setNeedsOnboarding(!onboarded)
      setStatus('signedIn')
    },
    [],
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      const device = await getDeviceInfo()
      const session = await api.login({
        email: email.trim(),
        password,
        deviceId: device.deviceId,
        platform: device.platform,
      })
      await adoptSession(session)
    },
    [adoptSession],
  )

  const signUp = useCallback(
    async (input: { email: string; password: string; displayName: string }) => {
      const device = await getDeviceInfo()
      const session = await api.register({
        email: input.email.trim(),
        password: input.password,
        displayName: input.displayName.trim(),
        timezone: device.timezone,
        deviceId: device.deviceId,
        platform: device.platform,
        // null means "not a guest" — the key is omitted rather than sent as null.
        guestToken: guestToken ?? undefined,
      })
      await adoptSession(session)
    },
    [adoptSession, guestToken],
  )

  const signInWithGoogleToken = useCallback(
    async (idToken: string) => {
      const device = await getDeviceInfo()
      const session = await api.google({
        idToken,
        deviceId: device.deviceId,
        platform: device.platform,
        guestToken: guestToken ?? undefined,
      })
      await adoptSession(session)
    },
    [adoptSession, guestToken],
  )

  const continueAsGuest = useCallback(async () => {
    const device = await getDeviceInfo()
    const session = await api.guest({
      deviceId: device.deviceId,
      platform: device.platform,
      timezone: device.timezone,
    })
    await storage.setGuestToken(session.guestToken)
    setGuestAuthToken(session.guestToken)
    setGuestToken(session.guestToken)
    setUser(null)
    setStats(null)
    setStatus('guest')
  }, [])

  const signOut = useCallback(async () => {
    const refreshToken = await storage.getRefreshToken()
    if (refreshToken) {
      await api.logout(refreshToken).catch(() => undefined)
    }
    await clearSession()
  }, [clearSession])

  const refreshMe = useCallback(async () => {
    if (status !== 'signedIn') return null
    try {
      const me = await api.me()
      setUser(me.user)
      setStats(me.stats)
      setDateLabel(me.dateLabel)
      return me
    } catch {
      return null
    }
  }, [status])

  const applyStats = useCallback((patch: Partial<StatsDto>) => {
    setStats((current) => (current ? { ...current, ...patch } : current))
  }, [])

  const finishOnboarding = useCallback(async () => {
    if (user) await storage.markOnboarded(user.id)
    setNeedsOnboarding(false)
  }, [user])

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(
    async (input) => {
      const me = await api.updateMe(input)
      setUser(me.user)
      setStats(me.stats)
      setDateLabel(me.dateLabel)
    },
    [],
  )

  const deleteAccount = useCallback(
    async (password: string) => {
      await api.deleteAccount(password)
      await clearSession()
    },
    [clearSession],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      stats,
      dateLabel,
      needsOnboarding,
      isAdmin: user?.role === 'ADMIN',
      signIn,
      signUp,
      signInWithGoogleToken,
      continueAsGuest,
      signOut,
      refreshMe,
      applyStats,
      finishOnboarding,
      updateProfile,
      deleteAccount,
      guestToken,
    }),
    [
      status,
      user,
      stats,
      dateLabel,
      needsOnboarding,
      signIn,
      signUp,
      signInWithGoogleToken,
      continueAsGuest,
      signOut,
      refreshMe,
      applyStats,
      finishOnboarding,
      updateProfile,
      deleteAccount,
      guestToken,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
