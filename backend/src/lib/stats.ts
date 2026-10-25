import type { Prisma } from '@prisma/client'
import { getTunables } from '../config/app-config.js'
import { prisma } from '../db/client.js'
import { projectHearts } from './hearts.js'
import { todayIn } from './time.js'

export type StatsSnapshot = {
  totalXp: number
  currentStreak: number
  longestStreak: number
  hearts: number
  heartsMax: number
  nextRefillAt: string | null
  lessonsToday: number
  dailyGoal: number
  localDate: string
}

type Client = Prisma.TransactionClient | typeof prisma

export async function ensureStats(userId: string, client: Client = prisma) {
  const existing = await client.userStats.findUnique({ where: { userId } })
  if (existing) return existing
  return client.userStats.create({ data: { userId } })
}

export async function loadStatsSnapshot(
  userId: string,
  timezone: string,
  dailyGoal: number,
  client: Client = prisma,
): Promise<StatsSnapshot> {
  const tunables = await getTunables()
  const stats = await ensureStats(userId, client)
  const projected = projectHearts(
    stats.hearts,
    stats.heartsUpdatedAt,
    tunables.hearts.max,
    tunables.hearts.refillMinutes,
  )

  if (projected.hearts !== stats.hearts) {
    await client.userStats.update({
      where: { userId },
      data: { hearts: projected.hearts, heartsUpdatedAt: projected.heartsUpdatedAt },
    })
  }

  const localDate = todayIn(timezone)
  const activity = await client.dailyActivity.findUnique({
    where: { userId_localDate: { userId, localDate: new Date(`${localDate}T00:00:00.000Z`) } },
  })

  return {
    totalXp: stats.totalXp,
    currentStreak: stats.currentStreak,
    longestStreak: stats.longestStreak,
    hearts: projected.hearts,
    heartsMax: tunables.hearts.max,
    nextRefillAt: projected.nextRefillAt?.toISOString() ?? null,
    lessonsToday: activity?.lessonsCompleted ?? 0,
    dailyGoal,
    localDate,
  }
}
