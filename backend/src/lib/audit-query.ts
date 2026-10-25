import { z } from 'zod'
import { prisma } from '../db/client.js'

export const auditListQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().uuid().optional(),
  })
  .strict()

export async function readAudit(limit: number, cursor?: string) {
  const items = await prisma.auditEvent.findMany({
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { id: true, displayName: true, email: true } } },
  })

  const hasMore = items.length > limit
  const page = hasMore ? items.slice(0, limit) : items

  return {
    items: page.map((item) => ({
      id: item.id,
      action: item.action,
      actor: item.actor,
      targetType: item.targetType,
      targetId: item.targetId,
      ip: item.ip,
      metadata: item.metadata,
      createdAt: item.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  }
}
