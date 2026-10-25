import { randomUUID } from 'node:crypto'
import type { Platform, Prisma, User } from '@prisma/client'
import { OAuth2Client } from 'google-auth-library'
import { env, googleClientIds, isProduction } from '../../config/env.js'
import { getTunables } from '../../config/app-config.js'
import { prisma } from '../../db/client.js'
import { conflict, unauthorized, AppError, badRequest } from '../../lib/errors.js'
import { hashPassword, passwordPolicyError, verifyPassword } from '../../lib/passwords.js'
import { initialReviewDue, scheduleReview } from '../../lib/srs.js'
import { applyLessonToStreak } from '../../lib/streak.js'
import {
  accessTokenExpiresInSeconds,
  newFamilyId,
  randomToken,
  refreshExpiryFromNow,
  sha256,
  signAccessToken,
} from '../../lib/tokens.js'
import { dateOnly, localDateString, safeTimezone, todayIn } from '../../lib/time.js'
import { recordAudit } from '../../lib/audit.js'
import { sendPasswordResetEmail } from '../../lib/email.js'
import { ensureStats, loadStatsSnapshot } from '../../lib/stats.js'

const googleClient = new OAuth2Client()

export type SessionTokens = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export type UserDto = {
  id: string
  email: string | null
  displayName: string
  role: 'LEARNER' | 'ADMIN'
  avatarUrl: string | null
  timezone: string
  dailyGoalLessons: number
  notificationPrefs: {
    reminderEnabled: boolean
    reminderLocalTime: string
    streakReminderEnabled: boolean
  }
  createdAt: string
}

export function serializeUser(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    timezone: user.timezone,
    dailyGoalLessons: user.dailyGoalLessons,
    notificationPrefs: {
      reminderEnabled: user.reminderEnabled,
      reminderLocalTime: user.reminderLocalTime,
      streakReminderEnabled: user.streakReminderEnabled,
    },
    createdAt: user.createdAt.toISOString(),
  }
}

type Client = Prisma.TransactionClient | typeof prisma

export async function issueSession(
  user: { id: string; role: 'LEARNER' | 'ADMIN' },
  deviceId: string,
  platform: Platform,
  client: Client = prisma,
  familyId = newFamilyId(),
): Promise<SessionTokens & { refreshTokenId: string }> {
  const rawRefreshToken = `rt_${randomToken(32)}`
  const accessToken = await signAccessToken({ userId: user.id, role: user.role })

  const record = await client.refreshToken.create({
    data: {
      userId: user.id,
      familyId,
      tokenHash: sha256(rawRefreshToken),
      deviceId,
      platform,
      expiresAt: refreshExpiryFromNow(),
    },
  })

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: accessTokenExpiresInSeconds(),
    tokenType: 'Bearer',
    refreshTokenId: record.id,
  }
}

export async function sessionResponse(user: User, deviceId: string, platform: Platform) {
  const tokens = await issueSession(user, deviceId, platform)
  const stats = await loadStatsSnapshot(user.id, user.timezone, user.dailyGoalLessons)
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresIn: tokens.expiresIn,
    tokenType: 'Bearer' as const,
    user: serializeUser(user),
    stats,
  }
}

export type RegisterInput = {
  email: string
  password: string
  displayName: string
  timezone?: string
  guestToken?: string
}

export async function register(input: RegisterInput, meta: { ip?: string; userAgent?: string }) {
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName.trim()

  const policyError = passwordPolicyError(input.password, { email, displayName })
  if (policyError) throw badRequest(policyError, { password: policyError })

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw conflict('An account with that email already exists.', 'EMAIL_IN_USE')

  const passwordHash = await hashPassword(input.password)
  const timezone = input.timezone?.trim() || 'Africa/Gaborone'
  const tunables = await getTunables()

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      displayName,
      timezone,
      dailyGoalLessons: tunables.defaultDailyGoal,
      stats: { create: { hearts: tunables.hearts.max } },
    },
  })

  if (input.guestToken) {
    await mergeGuestIntoUser(input.guestToken, user.id).catch(() => undefined)
  }

  await recordAudit({
    actorUserId: user.id,
    action: 'auth.register',
    targetType: 'user',
    targetId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { guestMerged: Boolean(input.guestToken) },
  })

  return user
}

export async function login(
  input: { email: string; password: string },
  meta: { ip?: string; userAgent?: string },
) {
  const email = input.email.trim().toLowerCase()
  const throttle = await prisma.loginThrottle.findUnique({ where: { email } })

  if (throttle?.lockedUntil && throttle.lockedUntil.getTime() > Date.now()) {
    const retryAfter = Math.ceil((throttle.lockedUntil.getTime() - Date.now()) / 1000)
    throw new AppError(429, 'RATE_LIMITED', 'Too many failed attempts. Try again shortly.', { retryAfter })
  }

  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  const valid = user?.passwordHash ? await verifyPassword(user.passwordHash, input.password) : false

  if (!user || !valid) {
    await registerFailedLogin(email)
    await recordAudit({
      actorUserId: user?.id,
      action: 'auth.login_failed',
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { email },
    })
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.')
  }

  await prisma.loginThrottle.deleteMany({ where: { email } })
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } })
  await recordAudit({
    actorUserId: user.id,
    action: 'auth.login',
    targetType: 'user',
    targetId: user.id,
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return user
}

async function registerFailedLogin(email: string) {
  const now = new Date()
  const existing = await prisma.loginThrottle.findUnique({ where: { email } })
  const withinWindow =
    existing?.firstFailedAt && now.getTime() - existing.firstFailedAt.getTime() < 15 * 60 * 1000

  const failedCount = withinWindow ? (existing?.failedCount ?? 0) + 1 : 1
  const lockedUntil = failedCount >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null

  await prisma.loginThrottle.upsert({
    where: { email },
    create: {
      email,
      failedCount,
      firstFailedAt: now,
      lockedUntil,
    },
    update: {
      failedCount,
      firstFailedAt: withinWindow ? existing?.firstFailedAt ?? now : now,
      lockedUntil,
    },
  })
}

export async function loginWithGoogle(
  input: { idToken: string },
  meta: { ip?: string; userAgent?: string },
) {
  if (!googleClientIds.length) {
    throw new AppError(503, 'GOOGLE_NOT_CONFIGURED', 'Google sign-in is not configured yet.')
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: input.idToken,
    audience: googleClientIds,
  })
  const payload = ticket.getPayload()

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw unauthorized('Google did not return a verified email.')
  }

  const email = payload.email.toLowerCase()
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleSub: payload.sub }, { email }], deletedAt: null },
  })

  if (user) {
    if (!user.googleSub) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleSub: payload.sub,
          avatarUrl: payload.picture ?? user.avatarUrl,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      })
    }
  } else {
    const tunables = await getTunables()
    user = await prisma.user.create({
      data: {
        email,
        emailVerifiedAt: new Date(),
        googleSub: payload.sub,
        avatarUrl: payload.picture ?? null,
        displayName: payload.name?.trim() || email.split('@')[0] || 'Learner',
        stats: { create: { hearts: tunables.hearts.max } },
      },
    })
    await recordAudit({
      actorUserId: user.id,
      action: 'auth.register_google',
      targetType: 'user',
      targetId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
  }

  return user
}

export async function refreshSession(rawToken: string, deviceId: string) {
  const tokenHash = sha256(rawToken)
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (!record) throw unauthorized('Your session has ended. Sign in again.')

  if (record.revokedAt) {
    // A rotated token presented again: revoke the whole family.
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    await recordAudit({
      actorUserId: record.userId,
      action: 'auth.refresh_reuse',
      targetType: 'refresh_token',
      targetId: record.id,
      metadata: { familyId: record.familyId },
    })
    throw unauthorized('Your session has ended. Sign in again.')
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Your session has expired. Sign in again.')
  }

  if (record.user.deletedAt) throw unauthorized('This account is no longer available.')

  const rotated = await prisma.$transaction(async (tx) => {
    const next = await issueSession(
      { id: record.userId, role: record.user.role },
      deviceId || record.deviceId,
      record.platform,
      tx,
      record.familyId,
    )

    await tx.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: next.refreshTokenId, lastUsedAt: new Date() },
    })

    return next
  })

  return {
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    expiresIn: rotated.expiresIn,
    tokenType: 'Bearer' as const,
    user: serializeUser(record.user),
  }
}

export async function logout(rawToken: string, userId: string | null, allDevices = false) {
  if (allDevices && userId) {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return
  }

  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export async function createGuestSession(deviceId: string, platform: Platform, timezone?: string) {
  const tunables = await getTunables()
  if (!tunables.features.guestPlay) {
    throw new AppError(403, 'GUEST_DISABLED', 'Guest play is turned off.')
  }

  const token = `guest_${randomToken(32)}`
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const session = await prisma.guestSession.create({
    data: {
      tokenHash: sha256(token),
      deviceId,
      platform,
      timezone: safeTimezone(timezone),
      expiresAt,
      hearts: tunables.hearts.max,
    },
  })

  return {
    guestToken: token,
    guestSessionId: session.id,
    expiresAt: expiresAt.toISOString(),
  }
}

export async function mergeGuestIntoUser(rawGuestToken: string, userId: string) {
  const session = await prisma.guestSession.findUnique({
    where: { tokenHash: sha256(rawGuestToken) },
  })

  if (!session || session.mergedIntoUserId || session.expiresAt.getTime() < Date.now()) {
    return { merged: false }
  }

  const completedAttempts = await prisma.lessonAttempt.findMany({
    where: { guestSessionId: session.id, status: 'COMPLETED' },
    include: {
      lesson: { include: { exercises: { include: { words: true } } } },
    },
  })

  await prisma.$transaction(async (tx) => {
    await tx.lessonAttempt.updateMany({
      where: { guestSessionId: session.id },
      data: { userId, guestSessionId: null },
    })

    const stats = await ensureStats(userId, tx)
    const localDate = session.lastLocalDate

    await tx.userStats.update({
      where: { userId },
      data: {
        totalXp: stats.totalXp + session.xp,
        ...(completedAttempts.length && localDate
          ? {
              currentStreak: Math.max(1, stats.currentStreak),
              longestStreak: Math.max(stats.longestStreak, 1),
              lastStreakDate: dateOnly(localDate),
            }
          : {}),
      },
    })

    if (completedAttempts.length && localDate) {
      await tx.dailyActivity.upsert({
        where: { userId_localDate: { userId, localDate: dateOnly(localDate) } },
        create: {
          userId,
          localDate: dateOnly(localDate),
          lessonsCompleted: completedAttempts.length,
          xpEarned: session.xp,
          correctCount: session.correctCount,
          totalCount: session.totalCount,
        },
        update: {
          lessonsCompleted: { increment: completedAttempts.length },
          xpEarned: { increment: session.xp },
          correctCount: { increment: session.correctCount },
          totalCount: { increment: session.totalCount },
        },
      })
    }

    const tunables = await getTunables()
    const wordIds = new Set<string>()
    for (const attempt of completedAttempts) {
      for (const exercise of attempt.lesson.exercises) {
        for (const link of exercise.words) wordIds.add(link.wordId)
      }
    }

    if (wordIds.size) {
      await tx.reviewItem.createMany({
        data: [...wordIds].map((wordId) => ({
          userId,
          wordId,
          stage: 0,
          dueAt: initialReviewDue(tunables.srsIntervalsDays),
        })),
        skipDuplicates: true,
      })
    }

    await tx.guestSession.update({
      where: { id: session.id },
      data: { mergedIntoUserId: userId, mergedAt: new Date() },
    })
  })

  return { merged: true, xp: session.xp, lessons: completedAttempts.length }
}

export async function requestPasswordReset(emailInput: string) {
  const email = emailInput.trim().toLowerCase()
  const user = await prisma.user.findFirst({ where: { email, deletedAt: null } })
  if (!user) return

  const tunables = await getTunables()
  if (!tunables.features.emailDelivery && isProduction) {
    // Deliberately silent: no provider configured, nothing to send.
    return
  }

  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  })
  if (recent >= 3) return

  const rawToken = randomToken(32)
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(rawToken),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    },
  })

  if (user.email) await sendPasswordResetEmail(user.email, rawToken)
}

export async function resetPassword(rawToken: string, password: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: { user: true },
  })

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw badRequest('That reset link is invalid or has expired.', { token: 'Invalid or expired token.' })
  }

  const policyError = passwordPolicyError(password, {
    email: record.user.email,
    displayName: record.user.displayName,
  })
  if (policyError) throw badRequest(policyError, { password: policyError })

  const passwordHash = await hashPassword(password)

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await recordAudit({
    actorUserId: record.userId,
    action: 'auth.password_reset',
    targetType: 'user',
    targetId: record.userId,
  })
}

export async function softDeleteAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: `deleted+${user.id}@puo.invalid`,
        googleSub: null,
        passwordHash: null,
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.deviceToken.updateMany({ where: { userId }, data: { disabledAt: new Date() } }),
  ])
  await recordAudit({
    actorUserId: userId,
    action: 'account.deleted',
    targetType: 'user',
    targetId: userId,
  })
}

/** Used by tests and the seed helper to get a user's local date. */
export function userLocalDate(timezone: string, at = new Date()): string {
  return localDateString(at, timezone)
}

export function newUuid(): string {
  return randomUUID()
}

export { scheduleReview }
