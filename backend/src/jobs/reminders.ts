import { env } from '../config/env.js'
import { getTunables } from '../config/app-config.js'
import { prisma } from '../db/client.js'
import { logger } from '../lib/logger.js'
import { sendPush } from '../lib/push.js'
import { dateOnly, localDateString, localTimeString } from '../lib/time.js'

const INTERVAL_MS = 10 * 60 * 1000
let timer: NodeJS.Timeout | null = null

function isWithinWindow(nowLocal: string, target: string, minutes: number): boolean {
  const [nowHour, nowMinute] = nowLocal.split(':').map(Number)
  const [targetHour, targetMinute] = target.split(':').map(Number)
  if (nowHour === undefined || nowMinute === undefined || targetHour === undefined || targetMinute === undefined) {
    return false
  }
  const now = nowHour * 60 + nowMinute
  const start = targetHour * 60 + targetMinute
  return now >= start && now < start + minutes
}

async function runOnce(): Promise<void> {
  if (!env.PUSH_ENABLED) return
  const tunables = await getTunables()
  if (!tunables.features.pushEnabled) return

  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [{ reminderEnabled: true }, { streakReminderEnabled: true }],
      devices: { some: { disabledAt: null } },
    },
    include: {
      devices: { where: { disabledAt: null }, select: { expoPushToken: true } },
      stats: true,
    },
  })

  const now = new Date()

  for (const user of users) {
    const localTime = localTimeString(now, user.timezone)
    if (localTime < '07:00' || localTime >= '21:30') continue

    const localDate = localDateString(now, user.timezone)
    const activity = await prisma.dailyActivity.findUnique({
      where: { userId_localDate: { userId: user.id, localDate: dateOnly(localDate) } },
    })
    if ((activity?.lessonsCompleted ?? 0) > 0) continue

    const tokens = user.devices.map((device) => device.expoPushToken)
    if (!tokens.length) continue

    const wantsReminder =
      user.reminderEnabled && isWithinWindow(localTime, user.reminderLocalTime, 10)
    const streakAtRisk =
      user.streakReminderEnabled && (user.stats?.currentStreak ?? 0) > 0 && isWithinWindow(localTime, '22:00', 10)

    if (!wantsReminder && !streakAtRisk) continue

    const kind = streakAtRisk ? 'streak_risk' : 'daily_reminder'

    try {
      await prisma.notificationLog.create({ data: { userId: user.id, kind, localDate } })
    } catch {
      continue // already sent today
    }

    await sendPush(tokens, {
      title: streakAtRisk ? 'Keep your streak alive' : 'Pitsi o go letetse',
      body: streakAtRisk
        ? 'A lesson today keeps your streak going. · Lesson e le nngwe e boloka setlha sa gago.'
        : 'Pitsi is waiting with today’s lesson. · Pitsi o go letetse ka thuto ya gompieno.',
      data: { screen: 'Learn' },
    })
  }
}

export function startReminderJob(): void {
  if (timer) return
  timer = setInterval(() => {
    runOnce().catch((error) => logger.error({ err: error }, 'reminder_job_failed'))
  }, INTERVAL_MS)
  logger.info('reminder_job_started')
}

export function stopReminderJob(): void {
  if (timer) clearInterval(timer)
  timer = null
}
