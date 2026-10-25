import type { Request } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { isTest } from '../config/env.js'

function limiterKey(req: Request): string {
  if (req.auth?.kind === 'user') return `user:${req.auth.userId}`
  if (req.auth?.kind === 'guest') return `guest:${req.auth.guestId}`
  return ipKeyGenerator(req.ip ?? '0.0.0.0')
}

function buildLimiter(options: {
  windowMs: number
  limit: number
  message: string
  keyGenerator?: (req: Request) => string
}) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: options.keyGenerator ?? limiterKey,
    skip: () => isTest,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: options.message,
          requestId: res.locals.requestId,
        },
      })
    },
  })
}

const quarterHour = 15 * 60 * 1000
const hour = 60 * 60 * 1000
const minute = 60 * 1000

export const loginLimiter = buildLimiter({
  windowMs: quarterHour,
  limit: 10,
  message: 'Too many sign-in attempts. Try again in a few minutes.',
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '0.0.0.0'),
})

export const registerLimiter = buildLimiter({
  windowMs: hour,
  limit: 5,
  message: 'Too many accounts created from here. Try again later.',
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '0.0.0.0'),
})

export const forgotLimiter = buildLimiter({
  windowMs: hour,
  limit: 10,
  message: 'Too many reset requests. Try again later.',
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '0.0.0.0'),
})

export const refreshLimiter = buildLimiter({
  windowMs: hour,
  limit: 120,
  message: 'Too many session refreshes.',
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '0.0.0.0'),
})

export const answerLimiter = buildLimiter({
  windowMs: minute,
  limit: 120,
  message: 'Slow down a little and try again.',
})

export const adminLimiter = buildLimiter({
  windowMs: minute,
  limit: 60,
  message: 'Too many admin changes at once.',
})

export const authenticatedLimiter = buildLimiter({
  windowMs: minute,
  limit: 300,
  message: 'Too many requests. Try again shortly.',
})

export const publicLimiter = buildLimiter({
  windowMs: minute,
  limit: 120,
  message: 'Too many requests. Try again shortly.',
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? '0.0.0.0'),
})
