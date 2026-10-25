import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose'
import type { Role } from '@prisma/client'
import { env } from '../config/env.js'
import { AppError } from './errors.js'

const secret = new TextEncoder().encode(env.JWT_SECRET)

export type AccessClaims = {
  userId: string
  role: Role
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function newFamilyId(): string {
  return randomUUID()
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ role: claims.role, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(env.ISSUER)
    .setAudience(env.AUDIENCE)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(secret)
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: env.ISSUER,
      audience: env.AUDIENCE,
    })

    if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid access token.')
    }

    const role = payload.role === 'ADMIN' ? 'ADMIN' : 'LEARNER'
    return { userId: payload.sub, role }
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Your session expired. Refreshing…')
    }
    if (error instanceof AppError) throw error
    throw new AppError(401, 'UNAUTHENTICATED', 'Invalid access token.')
  }
}

export function refreshExpiryFromNow(): Date {
  const expiresAt = new Date()
  expiresAt.setUTCDate(expiresAt.getUTCDate() + env.REFRESH_TOKEN_TTL_DAYS)
  return expiresAt
}

export function accessTokenExpiresInSeconds(): number {
  const match = /^(\d+)([smhd])$/.exec(env.ACCESS_TOKEN_TTL)
  if (!match) return 900
  const amount = Number(match[1])
  const unit = match[2] ?? 's'
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return amount * (multipliers[unit] ?? 1)
}
