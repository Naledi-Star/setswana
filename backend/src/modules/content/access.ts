import type { Lesson, Prisma } from '@prisma/client'
import { getTunables } from '../../config/app-config.js'
import { prisma } from '../../db/client.js'
import { forbidden, notFound } from '../../lib/errors.js'

export type LessonWithUnit = Prisma.LessonGetPayload<{ include: { unit: true } }>

export async function findLesson(lessonId: string): Promise<LessonWithUnit> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { unit: true },
  })

  if (!lesson || !lesson.isPublished || !lesson.unit.isPublished) {
    throw notFound('That lesson is not available.')
  }

  return lesson
}

export async function completedLessonIds(userId: string): Promise<Set<string>> {
  const completed = await prisma.lessonAttempt.findMany({
    where: { userId, status: 'COMPLETED' },
    select: { lessonId: true },
  })
  return new Set(completed.map((attempt) => attempt.lessonId))
}

export async function isLessonUnlocked(userId: string, lesson: LessonWithUnit): Promise<boolean> {
  const tunables = await getTunables()
  const units = await prisma.unit.findMany({
    where: { isPublished: true },
    orderBy: [{ position: 'asc' }, { slug: 'asc' }],
    include: {
      lessons: {
        where: { isPublished: true },
        orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      },
    },
  })

  const unitIndex = units.findIndex((unit) => unit.id === lesson.unitId)
  if (unitIndex < 0) return false

  const done = await completedLessonIds(userId)

  for (const previous of units.slice(0, unitIndex)) {
    const allDone = previous.lessons.every((entry) => done.has(entry.id))
    if (!allDone) return false
  }

  if (tunables.linearLessons) {
    const unit = units[unitIndex]
    if (!unit) return false
    const indexInUnit = unit.lessons.findIndex((entry) => entry.id === lesson.id)
    const previousLessons = unit.lessons.slice(0, Math.max(0, indexInUnit))
    if (previousLessons.some((entry) => !done.has(entry.id))) return false
  }

  return true
}

export async function firstPublishedLesson(): Promise<(Lesson & { unit: { title: string; colour: string } }) | null> {
  const unit = await prisma.unit.findFirst({
    where: { isPublished: true, lessons: { some: { isPublished: true } } },
    orderBy: [{ position: 'asc' }, { slug: 'asc' }],
    include: {
      lessons: {
        where: { isPublished: true },
        orderBy: [{ position: 'asc' }, { slug: 'asc' }],
        take: 1,
      },
    },
  })

  const lesson = unit?.lessons[0]
  if (!unit || !lesson) return null
  return { ...lesson, unit: { title: unit.title, colour: unit.colour } }
}

export async function assertGuestCanAccess(lesson: LessonWithUnit, guestSessionId: string): Promise<void> {
  const tunables = await getTunables()
  if (!tunables.features.guestPlay) throw forbidden('Guest play is turned off.')

  const guest = await prisma.guestSession.findUnique({ where: { id: guestSessionId } })
  if (!guest || guest.mergedIntoUserId || guest.expiresAt.getTime() < Date.now()) {
    throw forbidden('This guest session has ended.')
  }

  const first = await firstPublishedLesson()
  if (!first || first.id !== lesson.id) {
    throw forbidden('Create an account to continue this lesson.')
  }

  const completed = await prisma.lessonAttempt.count({
    where: { guestSessionId, status: 'COMPLETED' },
  })
  if (completed >= tunables.guestLessons) {
    throw forbidden('That was your free lesson. Create an account to keep going.')
  }
}
