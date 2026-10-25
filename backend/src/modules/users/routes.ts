import { Router } from 'express'
import { z } from 'zod'
import { getTunables } from '../../config/app-config.js'
import { prisma } from '../../db/client.js'
import { asyncHandler, requireUserId } from '../../lib/http.js'
import { badRequest, unauthorized } from '../../lib/errors.js'
import { verifyPassword } from '../../lib/passwords.js'
import { loadStatsSnapshot } from '../../lib/stats.js'
import { isValidTimezone, learnerDateLabel } from '../../lib/time.js'
import { parseBody } from '../../lib/validation.js'
import { authenticate, requireUser } from '../../middleware/auth.js'
import { softDeleteAccount, serializeUser } from '../auth/service.js'

export const usersRouter = Router()
const userOnly = [authenticate, requireUser]

async function mePayload(userId: string) {
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } })
  const stats = await loadStatsSnapshot(user.id, user.timezone, user.dailyGoalLessons)
  return {
    user: serializeUser(user),
    stats,
    dateLabel: learnerDateLabel(new Date(), user.timezone),
  }
}

usersRouter.get(
  '/me',
  userOnly,
  asyncHandler(async (req, res) => {
    res.json(await mePayload(requireUserId(req)))
  }),
)

const updateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60).optional(),
    timezone: z.string().trim().max(64).optional(),
    dailyGoalLessons: z.number().int().min(1).max(50).optional(),
    notificationPrefs: z
      .object({
        reminderEnabled: z.boolean().optional(),
        reminderLocalTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM in 24-hour time.')
          .optional(),
        streakReminderEnabled: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

usersRouter.patch(
  '/me',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const body = parseBody(updateSchema, req.body)

    if (body.timezone && !isValidTimezone(body.timezone)) {
      throw badRequest('Unknown timezone.', { timezone: 'Use an IANA timezone such as Africa/Gaborone.' })
    }

    if (body.dailyGoalLessons) {
      const tunables = await getTunables()
      if (!tunables.dailyGoalOptions.includes(body.dailyGoalLessons)) {
        throw badRequest('Choose one of the offered daily goals.', {
          dailyGoalLessons: `Allowed: ${tunables.dailyGoalOptions.join(', ')}.`,
        })
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.displayName ? { displayName: body.displayName } : {}),
        ...(body.timezone ? { timezone: body.timezone } : {}),
        ...(body.dailyGoalLessons ? { dailyGoalLessons: body.dailyGoalLessons } : {}),
        ...(body.notificationPrefs?.reminderEnabled !== undefined
          ? { reminderEnabled: body.notificationPrefs.reminderEnabled }
          : {}),
        ...(body.notificationPrefs?.reminderLocalTime
          ? { reminderLocalTime: body.notificationPrefs.reminderLocalTime }
          : {}),
        ...(body.notificationPrefs?.streakReminderEnabled !== undefined
          ? { streakReminderEnabled: body.notificationPrefs.streakReminderEnabled }
          : {}),
      },
    })

    res.json(await mePayload(userId))
  }),
)

const deleteSchema = z
  .object({
    password: z.string().max(128).optional(),
    confirm: z.literal('DELETE'),
  })
  .strict()

usersRouter.delete(
  '/me',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const body = parseBody(deleteSchema, req.body)
    const user = await prisma.user.findFirstOrThrow({ where: { id: userId, deletedAt: null } })

    if (user.passwordHash) {
      if (!body.password) throw badRequest('Enter your password to delete the account.', { password: 'Required.' })
      const valid = await verifyPassword(user.passwordHash, body.password)
      if (!valid) throw unauthorized('That password is not correct.')
    }

    await softDeleteAccount(userId)
    res.status(204).end()
  }),
)
