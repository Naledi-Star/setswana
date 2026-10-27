import type { AttemptStatus, GuestSession, Prisma, User, UserStats } from '@prisma/client'
import { getTunables } from '../../config/app-config.js'
import { prisma } from '../../db/client.js'
import { badRequest, conflict, forbidden, notFound, AppError } from '../../lib/errors.js'
import { projectHearts } from '../../lib/hearts.js'
import { scoreAnswer, xpForAnswer } from '../../lib/scoring.js'
import { scheduleReview } from '../../lib/srs.js'
import { applyLessonToStreak } from '../../lib/streak.js'
import { dateOnly, todayIn } from '../../lib/time.js'
import { recordAudit } from '../../lib/audit.js'
import { assertGuestCanAccess, findLesson, isLessonUnlocked } from '../content/access.js'

type Actor = { kind: 'user'; userId: string } | { kind: 'guest'; guestId: string }

type Client = Prisma.TransactionClient | typeof prisma

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export type HeartPayload = {
  remaining: number
  max: number
  nextRefillAt: string | null
}

type HeartContext = {
  hearts: number
  heartsMax: number
  nextRefillAt: string | null
  persist: (client: Client, next: number, at: Date) => Promise<void>
}

async function loadHeartContext(actor: Actor, client: Client = prisma): Promise<HeartContext> {
  const tunables = await getTunables()

  if (actor.kind === 'user') {
    const stats =
      (await client.userStats.findUnique({ where: { userId: actor.userId } })) ??
      (await client.userStats.create({
        data: { userId: actor.userId, hearts: tunables.hearts.max },
      }))

    const projected = projectHearts(
      stats.hearts,
      stats.heartsUpdatedAt,
      tunables.hearts.max,
      tunables.hearts.refillMinutes,
    )

    if (projected.hearts !== stats.hearts) {
      await client.userStats.update({
        where: { userId: actor.userId },
        data: { hearts: projected.hearts, heartsUpdatedAt: projected.heartsUpdatedAt },
      })
    }

    return {
      hearts: projected.hearts,
      heartsMax: tunables.hearts.max,
      nextRefillAt: projected.nextRefillAt?.toISOString() ?? null,
      persist: async (tx, next, at) => {
        await tx.userStats.update({
          where: { userId: actor.userId },
          data: { hearts: next, heartsUpdatedAt: at },
        })
      },
    }
  }

  const guest = await client.guestSession.findUnique({ where: { id: actor.guestId } })
  if (!guest) throw notFound('Guest session not found.')

  const projected = projectHearts(
    guest.hearts,
    guest.heartsUpdatedAt,
    tunables.hearts.max,
    tunables.hearts.refillMinutes,
  )

  if (projected.hearts !== guest.hearts) {
    await client.guestSession.update({
      where: { id: guest.id },
      data: { hearts: projected.hearts, heartsUpdatedAt: projected.heartsUpdatedAt },
    })
  }

  return {
    hearts: projected.hearts,
    heartsMax: tunables.hearts.max,
    nextRefillAt: projected.nextRefillAt?.toISOString() ?? null,
    persist: async (tx, next, at) => {
      await tx.guestSession.update({
        where: { id: guest.id },
        data: { hearts: next, heartsUpdatedAt: at },
      })
    },
  }
}

function heartPayload(context: HeartContext, remaining: number): HeartPayload {
  return {
    remaining,
    max: context.heartsMax,
    nextRefillAt: remaining >= context.heartsMax ? null : context.nextRefillAt,
  }
}

async function assertOwnership(
  attempt: { userId: string | null; guestSessionId: string | null },
  actor: Actor,
): Promise<void> {
  if (actor.kind === 'user' && attempt.userId !== actor.userId) throw forbidden('Not your lesson.')
  if (actor.kind === 'guest' && attempt.guestSessionId !== actor.guestId) {
    throw forbidden('Not your lesson.')
  }
}

export async function startAttempt(actor: Actor, lessonId: string) {
  const lesson = await findLesson(lessonId)
  const exerciseCount = await prisma.exercise.count({ where: { lessonId } })
  if (exerciseCount === 0) throw conflict('This lesson has no exercises yet.', 'LESSON_EMPTY')

  if (actor.kind === 'guest') {
    await assertGuestCanAccess(lesson, actor.guestId)
  } else {
    const unlocked = await isLessonUnlocked(actor.userId, lesson)
    if (!unlocked) throw forbidden('Finish the earlier unit first.')
  }

  const hearts = await loadHeartContext(actor)
  if (hearts.hearts <= 0) {
    throw new AppError(409, 'HEARTS_EMPTY', 'You are out of hearts. Review some words while they refill.', {
      fields: { hearts: '0' },
    })
  }

  const existing = await prisma.lessonAttempt.findFirst({
    where: {
      lessonId,
      status: 'IN_PROGRESS',
      ...(actor.kind === 'user' ? { userId: actor.userId } : { guestSessionId: actor.guestId }),
    },
    orderBy: { startedAt: 'desc' },
  })

  if (existing) {
    const answered = await prisma.exerciseAttempt.findMany({
      where: { lessonAttemptId: existing.id },
      select: { exerciseId: true },
      distinct: ['exerciseId'],
    })
    return {
      attemptId: existing.id,
      lessonId,
      resumed: true,
      hearts: heartPayload(hearts, hearts.hearts),
      progress: { answered: answered.length, total: existing.totalCount },
    }
  }

  const attempt = await prisma.lessonAttempt.create({
    data: {
      lessonId,
      ...(actor.kind === 'user'
        ? { userId: actor.userId }
        : { guestSessionId: actor.guestId }),
      heartsAtStart: hearts.hearts,
      totalCount: exerciseCount,
    },
  })

  return {
    attemptId: attempt.id,
    lessonId,
    resumed: false,
    hearts: heartPayload(hearts, hearts.hearts),
    progress: { answered: 0, total: exerciseCount },
  }
}

export async function submitAnswer(
  actor: Actor,
  attemptId: string,
  input: { exerciseId: string; answer: unknown; timeMs?: number },
) {
  const tunables = await getTunables()

  const attempt = await prisma.lessonAttempt.findUnique({
    where: { id: attemptId },
    include: {
      lesson: { include: { exercises: true } },
      user: true,
      guestSession: true,
    },
  })

  if (!attempt) throw notFound('Attempt not found.')
  await assertOwnership(attempt, actor)

  if (attempt.status !== 'IN_PROGRESS') {
    throw conflict('This lesson attempt has already ended.', 'ATTEMPT_ENDED')
  }

  const exercise = attempt.lesson.exercises.find((entry) => entry.id === input.exerciseId)
  if (!exercise) throw badRequest('That exercise is not part of this lesson.')

  const hearts = await loadHeartContext(actor)
  if (hearts.hearts <= 0) {
    throw new AppError(409, 'HEARTS_EMPTY', 'You are out of hearts. Review some words while they refill.')
  }

  const prior = await prisma.exerciseAttempt.findMany({
    where: { lessonAttemptId: attempt.id, exerciseId: exercise.id },
  })
  const hadWrong = prior.some((entry) => !entry.isCorrect && !entry.skipped)
  const hadCorrect = prior.some((entry) => entry.isCorrect && !entry.skipped)
  const hadSkip = prior.some((entry) => entry.skipped)

  const submitted = asRecord(input.answer)
  const wantsSkip = submitted.skipped === true
  // Dictation (a listen-first typed answer) skips like a listening exercise when the clip is missing.
  const listenFirst = exercise.type === 'TYPE_ANSWER' && asRecord(exercise.prompt).listenFirst === true
  const skipAllowed = wantsSkip && (exercise.type === 'LISTEN_CHOOSE' || listenFirst)

  const outcome = skipAllowed
    ? { isCorrect: false, correctAnswer: {} as Record<string, unknown>, skipped: true }
    : scoreAnswer({
        type: exercise.type,
        prompt: exercise.prompt,
        answerKey: exercise.answerKey,
        submitted: input.answer,
        typoToleranceMinLength: tunables.typoToleranceMinLength,
      })

  const xpAwarded =
    outcome.isCorrect && !hadCorrect ? xpForAnswer(exercise.xp, hadWrong) : 0
  const heartLost = !outcome.isCorrect && !outcome.skipped ? 1 : 0
  const remainingHearts = Math.max(0, hearts.hearts - heartLost)
  const now = new Date()
  const isNewSkip = outcome.skipped && !hadSkip

  const result = await prisma.$transaction(async (tx) => {
    await tx.exerciseAttempt.create({
      data: {
        lessonAttemptId: attempt.id,
        exerciseId: exercise.id,
        submitted: (input.answer ?? {}) as Prisma.InputJsonValue,
        isCorrect: outcome.isCorrect,
        skipped: outcome.skipped,
        attemptNumber: prior.length + 1,
        timeMs: input.timeMs ?? null,
      },
    })

    await tx.lessonAttempt.update({
      where: { id: attempt.id },
      data: {
        xpAwarded: { increment: xpAwarded },
        ...(outcome.isCorrect && !hadCorrect ? { correctCount: { increment: 1 } } : {}),
        ...(isNewSkip ? { totalCount: { decrement: 1 } } : {}),
      },
    })

    if (heartLost) {
      await hearts.persist(tx, remainingHearts, now)
    }

    return { remainingHearts }
  })

  const answered = await prisma.exerciseAttempt.findMany({
    where: { lessonAttemptId: attempt.id },
    select: { exerciseId: true },
    distinct: ['exerciseId'],
  })
  const attemptAfter = await prisma.lessonAttempt.findUniqueOrThrow({ where: { id: attempt.id } })

  return {
    isCorrect: outcome.isCorrect,
    skipped: outcome.skipped,
    correctAnswer: outcome.correctAnswer,
    explanation: exercise.explanation,
    xpAwarded,
    hearts: heartPayload(
      { ...hearts, nextRefillAt: heartLost && remainingHearts < hearts.heartsMax ? now.toISOString() : hearts.nextRefillAt },
      result.remainingHearts,
    ),
    progress: {
      answered: answered.length,
      total: Math.max(0, attemptAfter.totalCount),
    },
    ended: result.remainingHearts <= 0,
  }
}

async function findNextLessonId(lesson: { unitId: string; id: string; position: number }) {
  const sameUnit = await prisma.lesson.findFirst({
    where: { unitId: lesson.unitId, isPublished: true, position: { gt: lesson.position } },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  })
  if (sameUnit) return sameUnit.id

  const unit = await prisma.unit.findUnique({ where: { id: lesson.unitId }, select: { position: true } })
  if (!unit) return null

  const nextUnit = await prisma.unit.findFirst({
    where: {
      isPublished: true,
      position: { gt: unit.position },
      lessons: { some: { isPublished: true } },
    },
    orderBy: [{ position: 'asc' }],
    include: { lessons: { where: { isPublished: true }, orderBy: [{ position: 'asc' }], take: 1 } },
  })

  return nextUnit?.lessons[0]?.id ?? null
}

export async function completeAttempt(actor: Actor, attemptId: string) {
  const attempt = await prisma.lessonAttempt.findUnique({
    where: { id: attemptId },
    include: {
      lesson: { include: { exercises: { include: { words: true } } } },
      user: true,
      guestSession: true,
      answers: true,
    },
  })

  if (!attempt) throw notFound('Attempt not found.')
  await assertOwnership(attempt, actor)

  if (attempt.status === 'COMPLETED') {
    return buildCompletionSummary(actor, attempt.id)
  }
  if (attempt.status !== 'IN_PROGRESS') {
    throw conflict('This attempt was abandoned.', 'ATTEMPT_ENDED')
  }

  const exerciseIds = new Set(attempt.lesson.exercises.map((exercise) => exercise.id))
  const resolved = new Set(
    attempt.answers.filter((answer) => answer.isCorrect || answer.skipped).map((answer) => answer.exerciseId),
  )
  const unresolved = [...exerciseIds].filter((id) => !resolved.has(id))

  if (unresolved.length > 0) {
    throw new AppError(409, 'LESSON_INCOMPLETE', 'Answer every exercise before finishing.', {
      fields: { unresolved: String(unresolved.length) },
    })
  }

  const tunables = await getTunables()
  const bonus = attempt.lesson.xpBonus

  if (actor.kind === 'guest') {
    const guest = attempt.guestSession
    if (!guest) throw forbidden('Guest session missing.')
    const totalAwarded = attempt.xpAwarded + bonus
    const localDate = todayIn(guest.timezone)

    await prisma.$transaction([
      prisma.lessonAttempt.update({
        where: { id: attempt.id },
        data: { status: 'COMPLETED', completedAt: new Date(), xpAwarded: totalAwarded },
      }),
      prisma.guestSession.update({
        where: { id: guest.id },
        data: {
          xp: guest.xp + totalAwarded,
          correctCount: guest.correctCount + attempt.correctCount,
          totalCount: guest.totalCount + attempt.totalCount,
          lastLocalDate: localDate,
        },
      }),
    ])

    return {
      lessonId: attempt.lessonId,
      xpAwarded: totalAwarded,
      lessonXp: attempt.xpAwarded,
      bonusXp: bonus,
      totalXp: guest.xp + totalAwarded,
      streak: null,
      hearts: null,
      newWords: 0,
      nextLessonId: null,
      needsAccount: true,
    }
  }

  const user = attempt.user
  if (!user) throw badRequest('This attempt has no owner.')

  const totalAwarded = attempt.xpAwarded + bonus
  const localDate = todayIn(user.timezone)

  const summary = await prisma.$transaction(async (tx) => {
    const stats =
      (await tx.userStats.findUnique({ where: { userId: user.id } })) ??
      (await tx.userStats.create({ data: { userId: user.id } }))

    const streak = applyLessonToStreak(
      {
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        lastStreakDate: stats.lastStreakDate ? stats.lastStreakDate.toISOString().slice(0, 10) : null,
      },
      localDate,
    )

    const updatedStats = await tx.userStats.update({
      where: { userId: user.id },
      data: {
        totalXp: { increment: bonus },
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastStreakDate: streak.lastStreakDate ? dateOnly(streak.lastStreakDate) : null,
      },
    })

    await tx.lessonAttempt.update({
      where: { id: attempt.id },
      data: { status: 'COMPLETED', completedAt: new Date(), xpAwarded: totalAwarded },
    })

    await tx.dailyActivity.upsert({
      where: { userId_localDate: { userId: user.id, localDate: dateOnly(localDate) } },
      create: {
        userId: user.id,
        localDate: dateOnly(localDate),
        lessonsCompleted: 1,
        xpEarned: totalAwarded,
        correctCount: attempt.correctCount,
        totalCount: attempt.totalCount,
      },
      update: {
        lessonsCompleted: { increment: 1 },
        xpEarned: { increment: totalAwarded },
        correctCount: { increment: attempt.correctCount },
        totalCount: { increment: attempt.totalCount },
      },
    })

    const wordIds = new Set<string>()
    for (const exercise of attempt.lesson.exercises) {
      for (const link of exercise.words) wordIds.add(link.wordId)
    }

    let newWords = 0
    if (wordIds.size) {
      const existing = await tx.reviewItem.findMany({
        where: { userId: user.id, wordId: { in: [...wordIds] } },
        select: { wordId: true },
      })
      const existingIds = new Set(existing.map((item) => item.wordId))
      newWords = [...wordIds].filter((id) => !existingIds.has(id)).length

      await tx.reviewItem.createMany({
        data: [...wordIds].map((wordId) => ({
          userId: user.id,
          wordId,
          stage: 0,
          dueAt: scheduleReview(0, 'good', tunables.srsIntervalsDays).dueAt,
        })),
        skipDuplicates: true,
      })
    }

    const projected = projectHearts(
      updatedStats.hearts,
      updatedStats.heartsUpdatedAt,
      tunables.hearts.max,
      tunables.hearts.refillMinutes,
    )

    return {
      stats: updatedStats,
      streak,
      hearts: projected,
      newWords,
    }
  })

  const nextLessonId = await findNextLessonId(attempt.lesson)

  return {
    lessonId: attempt.lessonId,
    xpAwarded: totalAwarded,
    lessonXp: attempt.xpAwarded,
    bonusXp: bonus,
    totalXp: summary.stats.totalXp,
    streak: summary.streak.currentStreak,
    longestStreak: summary.streak.longestStreak,
    hearts: {
      remaining: summary.hearts.hearts,
      max: tunables.hearts.max,
      nextRefillAt: summary.hearts.nextRefillAt?.toISOString() ?? null,
    },
    newWords: summary.newWords,
    nextLessonId,
    needsAccount: false,
  }
}

async function buildCompletionSummary(actor: Actor, attemptId: string) {
  const attempt = await prisma.lessonAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { user: true, guestSession: true, lesson: true },
  })

  if (actor.kind === 'guest' && attempt.guestSession) {
    return {
      lessonId: attempt.lessonId,
      xpAwarded: attempt.xpAwarded,
      totalXp: attempt.guestSession.xp,
      streak: null,
      newWords: 0,
      nextLessonId: null,
      needsAccount: true,
      alreadyCompleted: true,
    }
  }

  const user = attempt.user
  if (!user) throw badRequest('Attempt has no owner.')
  const stats = await prisma.userStats.findUnique({ where: { userId: user.id } })
  const tunables = await getTunables()
  const projected = stats
    ? projectHearts(stats.hearts, stats.heartsUpdatedAt, tunables.hearts.max, tunables.hearts.refillMinutes)
    : null

  return {
    lessonId: attempt.lessonId,
    xpAwarded: attempt.xpAwarded,
    totalXp: stats?.totalXp ?? 0,
    streak: stats?.currentStreak ?? 0,
    hearts: projected
      ? { remaining: projected.hearts, max: tunables.hearts.max, nextRefillAt: projected.nextRefillAt?.toISOString() ?? null }
      : null,
    newWords: 0,
    nextLessonId: await findNextLessonId(attempt.lesson),
    needsAccount: false,
    alreadyCompleted: true,
  }
}

export async function abandonAttempt(actor: Actor, attemptId: string) {
  const attempt = await prisma.lessonAttempt.findUnique({ where: { id: attemptId } })
  if (!attempt) throw notFound('Attempt not found.')
  await assertOwnership(attempt, actor)

  if (attempt.status === 'IN_PROGRESS') {
    await prisma.lessonAttempt.update({
      where: { id: attemptId },
      data: { status: 'ABANDONED', completedAt: new Date() },
    })
  }

  const hearts = await loadHeartContext(actor)
  return { attemptId, status: 'ABANDONED' as AttemptStatus, hearts: heartPayload(hearts, hearts.hearts) }
}

export async function getAttempt(actor: Actor, attemptId: string) {
  const attempt = await prisma.lessonAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: { orderBy: { createdAt: 'asc' } },
      lesson: { include: { exercises: { select: { id: true } } } },
    },
  })
  if (!attempt) throw notFound('Attempt not found.')
  await assertOwnership(attempt, actor)

  const hearts = await loadHeartContext(actor)

  return {
    attemptId: attempt.id,
    lessonId: attempt.lessonId,
    status: attempt.status,
    hearts: heartPayload(hearts, hearts.hearts),
    progress: {
      answered: new Set(attempt.answers.map((answer) => answer.exerciseId)).size,
      total: attempt.totalCount,
    },
    answers: attempt.answers.map((answer) => ({
      exerciseId: answer.exerciseId,
      isCorrect: answer.isCorrect,
      skipped: answer.skipped,
      attemptNumber: answer.attemptNumber,
    })),
  }
}

/** Housekeeping used by the reminder job to skip today's completed users. */
export async function hasLessonToday(user: Pick<User, 'id' | 'timezone'>): Promise<boolean> {
  const localDate = todayIn(user.timezone)
  const activity = await prisma.dailyActivity.findUnique({
    where: { userId_localDate: { userId: user.id, localDate: dateOnly(localDate) } },
  })
  return (activity?.lessonsCompleted ?? 0) > 0
}

export type { GuestSession, UserStats }
