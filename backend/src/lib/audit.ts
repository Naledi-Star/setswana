import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import { logger } from './logger.js'

export type AuditInput = {
  actorUserId?: string | null
  action: string
  targetType?: string
  targetId?: string
  ip?: string
  userAgent?: string
  metadata?: Prisma.InputJsonValue
}

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        ip: input.ip,
        userAgent: input.userAgent?.slice(0, 400),
        metadata: input.metadata,
      },
    })
  } catch (error) {
    logger.error({ err: error, action: input.action }, 'audit_write_failed')
  }
}
