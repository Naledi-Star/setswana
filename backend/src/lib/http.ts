import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { unauthorized } from './errors.js'

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function requireUserId(req: Request): string {
  if (!req.auth || req.auth.kind !== 'user') throw unauthorized()
  return req.auth.userId
}

export function requireGuestId(req: Request): string {
  if (!req.auth || req.auth.kind !== 'guest') throw unauthorized('Start a guest session first.')
  return req.auth.guestId
}

/** Stable scope key for idempotency: user id, or guest session id. */
export function actorScope(req: Request): { scope: string; userId: string | null } {
  if (!req.auth) throw unauthorized()
  if (req.auth.kind === 'user') return { scope: `user:${req.auth.userId}`, userId: req.auth.userId }
  return { scope: `guest:${req.auth.guestId}`, userId: null }
}
