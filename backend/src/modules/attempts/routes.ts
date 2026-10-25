import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/client.js'
import { actorScope, asyncHandler } from '../../lib/http.js'
import { conflict } from '../../lib/errors.js'
import { parseBody } from '../../lib/validation.js'
import { authenticate } from '../../middleware/auth.js'
import { answerLimiter } from '../../middleware/rate-limit.js'
import {
  abandonAttempt,
  completeAttempt,
  getAttempt,
  startAttempt,
  submitAnswer,
  type HeartPayload,
} from './service.js'

export const attemptsRouter = Router()
attemptsRouter.use(authenticate)

function actorFrom(req: Parameters<typeof actorScope>[0]) {
  if (!req.auth) throw conflict('Start a guest session or sign in.', 'UNAUTHENTICATED')
  return req.auth.kind === 'user'
    ? ({ kind: 'user', userId: req.auth.userId } as const)
    : ({ kind: 'guest', guestId: req.auth.guestId } as const)
}

attemptsRouter.post(
  '/lessons/:id/start',
  answerLimiter,
  asyncHandler(async (req, res) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params)
    res.status(201).json(await startAttempt(actorFrom(req), params.id))
  }),
)

const answerSchema = z
  .object({
    exerciseId: z.string().uuid(),
    answer: z.unknown(),
    timeMs: z.number().int().min(0).max(600_000).optional(),
  })
  .strict()

attemptsRouter.post(
  '/attempts/:id/answers',
  answerLimiter,
  asyncHandler(async (req, res) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = parseBody(answerSchema, req.body)
    const { scope, userId } = actorScope(req)
    const rawKey = req.header('idempotency-key')?.trim()
    const idempotencyKey = rawKey ? rawKey.slice(0, 120) : null

    if (idempotencyKey) {
      const cached = await prisma.idempotencyKey.findUnique({
        where: { scope_key: { scope, key: idempotencyKey } },
      })
      if (cached) {
        res.json(cached.response)
        return
      }
    }

    const result = await submitAnswer(actorFrom(req), params.id, body)

    if (idempotencyKey) {
      await prisma.idempotencyKey
        .create({
          data: {
            scope,
            key: idempotencyKey,
            userId,
            response: result as unknown as never,
          },
        })
        .catch(() => undefined)
    }

    res.json(result)
  }),
)

attemptsRouter.post(
  '/attempts/:id/complete',
  asyncHandler(async (req, res) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params)
    res.json(await completeAttempt(actorFrom(req), params.id))
  }),
)

attemptsRouter.post(
  '/attempts/:id/abandon',
  asyncHandler(async (req, res) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params)
    res.json(await abandonAttempt(actorFrom(req), params.id))
  }),
)

attemptsRouter.get(
  '/attempts/:id',
  asyncHandler(async (req, res) => {
    const params = z.object({ id: z.string().uuid() }).parse(req.params)
    res.json(await getAttempt(actorFrom(req), params.id))
  }),
)

export type { HeartPayload }
