import { Router } from 'express'
import { z } from 'zod'
import { getTunables } from '../../config/app-config.js'
import { asyncHandler, requireUserId } from '../../lib/http.js'
import { badRequest } from '../../lib/errors.js'
import { parseBody } from '../../lib/validation.js'
import { authenticate } from '../../middleware/auth.js'
import {
  forgotLimiter,
  loginLimiter,
  refreshLimiter,
  registerLimiter,
} from '../../middleware/rate-limit.js'
import {
  createGuestSession,
  login,
  loginWithGoogle,
  logout,
  mergeGuestIntoUser,
  refreshSession,
  register,
  requestPasswordReset,
  resetPassword,
  sessionResponse,
} from './service.js'

export const authRouter = Router()

const platformSchema = z.enum(['ios', 'android'])
const deviceIdSchema = z.string().trim().min(1).max(128).default('unknown-device')

const registerSchema = z
  .object({
    email: z.string().trim().email().max(200),
    password: z.string().min(1).max(128),
    displayName: z.string().trim().min(1).max(60),
    timezone: z.string().trim().max(64).optional(),
    guestToken: z.string().trim().max(200).optional(),
    deviceId: deviceIdSchema,
    platform: platformSchema,
  })
  .strict()

const deviceRegisterSchema = z
  .object({
    deviceId: deviceIdSchema,
    platform: platformSchema,
  })
  .strict()

authRouter.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body)
    const user = await register(body, { ip: req.ip, userAgent: req.header('user-agent') })

    if (body.guestToken) {
      await mergeGuestIntoUser(body.guestToken, user.id)
    }

    res.status(201).json(await sessionResponse(user, body.deviceId, body.platform))
  }),
)

const loginSchema = z
  .object({
    email: z.string().trim().email().max(200),
    password: z.string().min(1).max(128),
    deviceId: deviceIdSchema,
    platform: platformSchema,
  })
  .strict()

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body)
    const user = await login(body, { ip: req.ip, userAgent: req.header('user-agent') })
    res.json(await sessionResponse(user, body.deviceId, body.platform))
  }),
)

const googleSchema = z
  .object({
    idToken: z.string().trim().min(20).max(4096),
    deviceId: deviceIdSchema,
    platform: platformSchema,
    guestToken: z.string().trim().max(200).optional(),
  })
  .strict()

authRouter.post(
  '/google',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(googleSchema, req.body)
    const user = await loginWithGoogle(body, { ip: req.ip, userAgent: req.header('user-agent') })

    if (body.guestToken) {
      await mergeGuestIntoUser(body.guestToken, user.id)
    }

    res.json(await sessionResponse(user, body.deviceId, body.platform))
  }),
)

const refreshSchema = z
  .object({
    refreshToken: z.string().trim().min(10).max(300),
    deviceId: deviceIdSchema,
  })
  .strict()

authRouter.post(
  '/refresh',
  refreshLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(refreshSchema, req.body)
    res.json(await refreshSession(body.refreshToken, body.deviceId))
  }),
)

const logoutSchema = z
  .object({
    refreshToken: z.string().trim().min(10).max(300),
    allDevices: z.boolean().optional(),
  })
  .strict()

authRouter.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = parseBody(logoutSchema, req.body)
    const userId = req.auth?.kind === 'user' ? req.auth.userId : null
    await logout(body.refreshToken, userId, body.allDevices ?? false)
    res.status(204).end()
  }),
)

const guestSchema = z
  .object({
    deviceId: deviceIdSchema,
    platform: platformSchema,
    timezone: z.string().trim().max(64).optional(),
  })
  .strict()

authRouter.post(
  '/guest',
  asyncHandler(async (req, res) => {
    const body = parseBody(guestSchema, req.body)
    const session = await createGuestSession(body.deviceId, body.platform, body.timezone)
    const tunables = await getTunables()
    res.status(201).json({ ...session, config: { hearts: tunables.hearts } })
  }),
)

const forgotSchema = z.object({ email: z.string().trim().email().max(200) }).strict()

authRouter.post(
  '/password/forgot',
  forgotLimiter,
  asyncHandler(async (req, res) => {
    const body = parseBody(forgotSchema, req.body)
    const tunables = await getTunables()
    await requestPasswordReset(body.email)
    res.status(202).json({
      status: 'accepted',
      emailDelivery: tunables.features.emailDelivery,
    })
  }),
)

const resetSchema = z
  .object({
    token: z.string().trim().min(10).max(300),
    password: z.string().min(1).max(128),
  })
  .strict()

authRouter.post(
  '/password/reset',
  asyncHandler(async (req, res) => {
    const body = parseBody(resetSchema, req.body)
    await resetPassword(body.token, body.password)
    res.status(204).end()
  }),
)

authRouter.get(
  '/session',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.auth?.kind !== 'user') throw badRequest('No user session.')
    const userId = requireUserId(req)
    res.json({ userId })
  }),
)
