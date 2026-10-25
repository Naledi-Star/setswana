import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { prisma } from '../db/client.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import { sha256, verifyAccessToken } from '../lib/tokens.js'

export const authenticate: RequestHandler = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.header('authorization')
    if (!header?.startsWith('Bearer ')) return next()

    const token = header.slice('Bearer '.length).trim()
    if (!token) return next()

    if (token.startsWith('guest_')) {
      const session = await prisma.guestSession.findUnique({
        where: { tokenHash: sha256(token) },
      })

      if (!session || session.mergedIntoUserId || session.expiresAt.getTime() < Date.now()) {
        return next()
      }

      req.auth = { kind: 'guest', guestId: session.id }
      return next()
    }

    const claims = await verifyAccessToken(token)
    const user = await prisma.user.findFirst({
      where: { id: claims.userId, deletedAt: null },
      select: { id: true, role: true },
    })

    if (!user) return next()

    req.auth = { kind: 'user', userId: user.id, role: user.role }
    return next()
  } catch (error) {
    return next(error)
  }
}

export function assertUser(req: Request): void {
  if (!req.auth || req.auth.kind !== 'user') throw unauthorized()
}

export function assertAdmin(req: Request): void {
  if (!req.auth || req.auth.kind !== 'user') throw unauthorized()
  if (req.auth.role !== 'ADMIN') throw forbidden('Admin access only.')
}

export const requireUser: RequestHandler = (req, _res, next) => {
  try {
    assertUser(req)
    next()
  } catch (error) {
    next(error)
  }
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  try {
    assertAdmin(req)
    next()
  } catch (error) {
    next(error)
  }
}
