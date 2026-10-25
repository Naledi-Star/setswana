import { Router } from 'express'
import { z } from 'zod'
import { getTunables } from '../../config/app-config.js'
import { prisma } from '../../db/client.js'
import { asyncHandler, requireUserId } from '../../lib/http.js'
import { notFound } from '../../lib/errors.js'
import { scheduleReview, wordStatus } from '../../lib/srs.js'
import { dateOnly, todayIn } from '../../lib/time.js'
import { parseBody, parseQuery } from '../../lib/validation.js'
import { authenticate, requireUser } from '../../middleware/auth.js'

export const wordsRouter = Router()
const userOnly = [authenticate, requireUser]

const listQuerySchema = z
  .object({ status: z.enum(['new', 'learning', 'known', 'all']).default('all') })
  .strict()

wordsRouter.get(
  '/words',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const query = parseQuery(listQuerySchema, req.query)

    const items = await prisma.reviewItem.findMany({
      where: { userId },
      include: { word: { include: { unit: { select: { title: true, colour: true } } } } },
      orderBy: { createdAt: 'desc' },
    })

    const words = items
      .map((item) => {
        const status = wordStatus(item.stage, item.timesCorrect + item.timesWrong)
        return {
          id: item.word.id,
          setswana: item.word.setswana,
          english: item.word.english,
          phonetic: item.word.phonetic,
          audioUrl: item.word.audioUrl,
          notes: item.word.notes,
          pluralForm: item.word.pluralForm,
          formalForm: item.word.formalForm,
          partOfSpeech: item.word.partOfSpeech,
          stage: item.stage,
          status,
          dueAt: item.dueAt.toISOString(),
          unit: item.word.unit,
        }
      })
      .filter((word) => query.status === 'all' || word.status === query.status)

    res.json({
      words,
      counts: {
        all: items.length,
        new: items.filter((item) => wordStatus(item.stage, item.timesCorrect + item.timesWrong) === 'new').length,
        learning: items.filter(
          (item) => wordStatus(item.stage, item.timesCorrect + item.timesWrong) === 'learning',
        ).length,
        known: items.filter((item) => wordStatus(item.stage, item.timesCorrect + item.timesWrong) === 'known')
          .length,
      },
    })
  }),
)

const wordParamsSchema = z.object({ id: z.string().uuid() })

wordsRouter.get(
  '/words/:id',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const { id } = parseQuery(wordParamsSchema, req.params)

    const word = await prisma.word.findUnique({
      where: { id },
      include: { unit: { select: { title: true, titleEn: true, colour: true } } },
    })
    if (!word) throw notFound('That word does not exist.')

    const item = await prisma.reviewItem.findUnique({
      where: { userId_wordId: { userId, wordId: id } },
    })

    res.json({
      id: word.id,
      setswana: word.setswana,
      english: word.english,
      phonetic: word.phonetic,
      audioUrl: word.audioUrl,
      notes: word.notes,
      pluralForm: word.pluralForm,
      formalForm: word.formalForm,
      partOfSpeech: word.partOfSpeech,
      unit: word.unit,
      stage: item?.stage ?? 0,
      status: wordStatus(item?.stage ?? 0, item ? item.timesCorrect + item.timesWrong : 0),
      dueAt: item?.dueAt.toISOString() ?? null,
    })
  }),
)

wordsRouter.get(
  '/review/queue',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const tunables = await getTunables()
    const now = new Date()

    const due = await prisma.reviewItem.findMany({
      where: { userId, dueAt: { lte: now } },
      include: { word: true },
      orderBy: { dueAt: 'asc' },
      take: tunables.reviewQueueCap,
    })

    const remaining = tunables.reviewQueueCap - due.length
    const seenIds = new Set(due.map((item) => item.wordId))

    // Words met in a lesson can be practised straight away; their first spaced review stays scheduled.
    const fresh =
      remaining > 0
        ? await prisma.reviewItem.findMany({
            where: {
              userId,
              timesCorrect: 0,
              timesWrong: 0,
              wordId: { notIn: [...seenIds] },
            },
            include: { word: true },
            orderBy: { createdAt: 'desc' },
            take: Math.min(5, remaining),
          })
        : []

    res.json({
      items: [
        ...due.map((item) => ({
          kind: 'due' as const,
          wordId: item.wordId,
          setswana: item.word.setswana,
          english: item.word.english,
          phonetic: item.word.phonetic,
          audioUrl: item.word.audioUrl,
          notes: item.word.notes,
          stage: item.stage,
        })),
        ...fresh.map((item) => ({
          kind: 'new' as const,
          wordId: item.wordId,
          setswana: item.word.setswana,
          english: item.word.english,
          phonetic: item.word.phonetic,
          audioUrl: item.word.audioUrl,
          notes: item.word.notes,
          stage: item.stage,
        })),
      ],
      dueCount: due.length,
    })
  }),
)

const reviewAnswerSchema = z
  .object({
    wordId: z.string().uuid(),
    selfMark: z.enum(['again', 'good', 'easy']),
  })
  .strict()

wordsRouter.post(
  '/review/answers',
  userOnly,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const body = parseBody(reviewAnswerSchema, req.body)
    const tunables = await getTunables()

    const word = await prisma.word.findUnique({ where: { id: body.wordId } })
    if (!word) throw notFound('That word does not exist.')

    const existing = await prisma.reviewItem.findUnique({
      where: { userId_wordId: { userId, wordId: body.wordId } },
    })

    const stage = existing?.stage ?? 0
    const schedule = scheduleReview(stage, body.selfMark, tunables.srsIntervalsDays)
    const isCorrect = body.selfMark !== 'again'
    const xpAwarded = isCorrect ? tunables.xp.REVIEW_CARD : 0
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const localDate = todayIn(user.timezone)

    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.reviewItem.upsert({
        where: { userId_wordId: { userId, wordId: body.wordId } },
        create: {
          userId,
          wordId: body.wordId,
          stage: schedule.stage,
          dueAt: schedule.dueAt,
          lastReviewedAt: new Date(),
          timesCorrect: isCorrect ? 1 : 0,
          timesWrong: isCorrect ? 0 : 1,
        },
        update: {
          stage: schedule.stage,
          dueAt: schedule.dueAt,
          lastReviewedAt: new Date(),
          ...(isCorrect ? { timesCorrect: { increment: 1 } } : { timesWrong: { increment: 1 } }),
        },
      })

      if (xpAwarded > 0) {
        await tx.userStats.upsert({
          where: { userId },
          create: { userId, totalXp: xpAwarded },
          update: { totalXp: { increment: xpAwarded } },
        })

        await tx.dailyActivity.upsert({
          where: { userId_localDate: { userId, localDate: dateOnly(localDate) } },
          create: { userId, localDate: dateOnly(localDate), xpEarned: xpAwarded },
          update: { xpEarned: { increment: xpAwarded } },
        })
      }

      return updated
    })

    res.json({
      wordId: body.wordId,
      stage: item.stage,
      dueAt: item.dueAt.toISOString(),
      status: wordStatus(item.stage, item.timesCorrect + item.timesWrong),
      xpAwarded,
      correct: isCorrect,
    })
  }),
)
