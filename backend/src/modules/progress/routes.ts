import { Router } from 'express'
import { prisma } from '../../db/client.js'
import { asyncHandler, requireUserId } from '../../lib/http.js'
import { loadStatsSnapshot } from '../../lib/stats.js'
import { addDaysToDateString, dateOnly, todayIn } from '../../lib/time.js'
import { authenticate, requireUser } from '../../middleware/auth.js'

export const progressRouter = Router()
const userOnly = [authenticate, requireUser]

progressRouter.get(
  '/progress/summary',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const stats = await loadStatsSnapshot(user.id, user.timezone, user.dailyGoalLessons)
    const today = todayIn(user.timezone)

    const weekDates = Array.from({ length: 7 }, (_, index) => addDaysToDateString(today, index - 6))
    const activities = await prisma.dailyActivity.findMany({
      where: { userId, localDate: { gte: dateOnly(weekDates[0] ?? today), lte: dateOnly(today) } },
    })

    const byDate = new Map(
      activities.map((activity) => [activity.localDate.toISOString().slice(0, 10), activity]),
    )

    const totals = await prisma.dailyActivity.aggregate({
      where: { userId },
      _sum: { correctCount: true, totalCount: true, lessonsCompleted: true, xpEarned: true },
    })

    const reviewItems = await prisma.reviewItem.findMany({
      where: { userId },
      select: { stage: true, timesCorrect: true, timesWrong: true },
    })

    const correct = totals._sum.correctCount ?? 0
    const attempted = totals._sum.totalCount ?? 0

    res.json({
      ...stats,
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
      lessonsCompleted: totals._sum.lessonsCompleted ?? 0,
      lessonsThisWeek: weekDates.reduce((sum, date) => sum + (byDate.get(date)?.lessonsCompleted ?? 0), 0),
      week: weekDates.map((date) => {
        const activity = byDate.get(date)
        return {
          localDate: date,
          xp: activity?.xpEarned ?? 0,
          lessons: activity?.lessonsCompleted ?? 0,
        }
      }),
      wordsKnown: reviewItems.filter((item) => item.timesCorrect + item.timesWrong > 0 && item.stage >= 3).length,
      wordsLearning: reviewItems.filter(
        (item) => item.timesCorrect + item.timesWrong > 0 && item.stage > 0 && item.stage < 3,
      ).length,
      wordsNew: reviewItems.filter((item) => item.timesCorrect + item.timesWrong === 0).length,
    })
  }),
)
