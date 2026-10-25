import type { Prisma } from '@prisma/client'
import { prisma } from '../db/client.js'
import {
  DEFAULT_TUNABLES,
  mergeTunables,
  tunablesPatchSchema,
  type Tunables,
  type TunablesPatch,
} from './tunables.js'

const CACHE_TTL_MS = 15_000
let cache: { tunables: Tunables; expiresAt: number } | null = null

function normalize(raw: unknown): Tunables {
  return mergeTunables(DEFAULT_TUNABLES, (raw ?? {}) as TunablesPatch)
}

export async function getTunables(): Promise<Tunables> {
  if (cache && cache.expiresAt > Date.now()) return cache.tunables

  const row = await prisma.appConfig.findUnique({ where: { id: 1 } })
  const tunables = normalize(row?.data)
  cache = { tunables, expiresAt: Date.now() + CACHE_TTL_MS }
  return tunables
}

export async function updateTunables(patch: unknown): Promise<Tunables> {
  const parsed = tunablesPatchSchema.parse(patch)
  const current = await getTunables()
  const next = mergeTunables(current, parsed)
  const data = next as unknown as Prisma.InputJsonValue

  await prisma.appConfig.upsert({
    where: { id: 1 },
    create: { id: 1, data },
    update: { data },
  })

  cache = { tunables: next, expiresAt: Date.now() + CACHE_TTL_MS }
  return next
}

export function invalidateConfigCache() {
  cache = null
}
