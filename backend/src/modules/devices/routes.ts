import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/client.js'
import { asyncHandler, requireUserId } from '../../lib/http.js'
import { forbidden } from '../../lib/errors.js'
import { parseBody } from '../../lib/validation.js'
import { authenticate, requireUser } from '../../middleware/auth.js'

export const devicesRouter = Router()
const userOnly = [authenticate, requireUser]

const registerSchema = z
  .object({
    expoPushToken: z.string().trim().min(10).max(300),
    platform: z.enum(['ios', 'android']),
    deviceId: z.string().trim().min(1).max(128),
  })
  .strict()

devicesRouter.post(
  '/devices',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const body = parseBody(registerSchema, req.body)

    const device = await prisma.deviceToken.upsert({
      where: { expoPushToken: body.expoPushToken },
      create: {
        userId,
        expoPushToken: body.expoPushToken,
        platform: body.platform,
        deviceId: body.deviceId,
        lastSeenAt: new Date(),
      },
      update: {
        userId,
        platform: body.platform,
        deviceId: body.deviceId,
        lastSeenAt: new Date(),
        disabledAt: null,
      },
    })

    res.status(201).json({ id: device.id })
  }),
)

devicesRouter.delete(
  '/devices/:id',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const params = z.object({ id: z.string().uuid() }).parse(req.params)
    const device = await prisma.deviceToken.findUnique({ where: { id: params.id } })
    if (!device) {
      res.status(204).end()
      return
    }
    if (device.userId !== userId) throw forbidden()
    await prisma.deviceToken.delete({ where: { id: device.id } })
    res.status(204).end()
  }),
)
