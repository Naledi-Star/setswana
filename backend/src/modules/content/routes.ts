import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../db/client.js'
import { asyncHandler, requireUserId } from '../../lib/http.js'
import { forbidden, notFound } from '../../lib/errors.js'
import { parseQuery } from '../../lib/validation.js'
import { authenticate, requireUser } from '../../middleware/auth.js'
import {
  assertGuestCanAccess,
  completedLessonIds,
  findLesson,
  firstPublishedLesson,
  isLessonUnlocked,
} from './access.js'

export const contentRouter = Router()
contentRouter.use(authenticate)

contentRouter.get(
  '/path',
  requireUser,
  asyncHandler(async (req, res) => {
    const userId = requireUserId(req)
    const done = await completedLessonIds(userId)

    const units = await prisma.unit.findMany({
      where: { isPublished: true },
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      include: {
        lessons: {
          where: { isPublished: true },
          orderBy: [{ position: 'asc' }, { slug: 'asc' }],
          include: { exercises: { select: { id: true } } },
        },
      },
    })

    const path = []
    let unlocked = true
    let continueLessonId: string | null = null

    for (const unit of units) {
      const lessons = unit.lessons.map((lesson) => {
        const completed = done.has(lesson.id)
        const state = completed ? 'done' : unlocked && !continueLessonId ? 'active' : unlocked ? 'open' : 'locked'
        if (!completed && unlocked && !continueLessonId) continueLessonId = lesson.id
        return {
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          subtitle: lesson.subtitle,
          xp: lesson.xpBonus,
          exerciseCount: lesson.exercises.length,
          state,
        }
      })

      const allDone = unit.lessons.every((lesson) => done.has(lesson.id))
      const state = allDone ? 'done' : unlocked ? 'active' : 'locked'

      path.push({
        id: unit.id,
        slug: unit.slug,
        title: unit.title,
        titleEn: unit.titleEn,
        description: unit.description,
        colour: unit.colour,
        state,
        lessons,
      })

      unlocked = unlocked && allDone
    }

    res.json({ units: path, continueLessonId })
  }),
)

contentRouter.get(
  '/lessons/guest-next',
  asyncHandler(async (_req, res) => {
    const lesson = await firstPublishedLesson()
    if (!lesson) throw notFound('No lessons are published yet.')
    res.json({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      subtitle: lesson.subtitle,
      unitTitle: lesson.unit.title,
      colour: lesson.unit.colour,
    })
  }),
)

const lessonQuerySchema = z.object({ id: z.string().uuid() })

contentRouter.get(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseQuery(lessonQuerySchema, req.params)
    const lesson = await findLesson(id)

    if (req.auth?.kind === 'guest') {
      await assertGuestCanAccess(lesson, req.auth.guestId)
    } else if (req.auth?.kind === 'user') {
      const unlocked = await isLessonUnlocked(req.auth.userId, lesson)
      if (!unlocked) throw forbidden('Finish the earlier unit first.')
    } else {
      throw forbidden('Start a guest session or sign in.')
    }

    const exercises = await prisma.exercise.findMany({
      where: { lessonId: lesson.id },
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      select: {
        id: true,
        slug: true,
        type: true,
        prompt: true,
        explanation: false,
        xp: true,
        audioUrl: true,
        position: true,
      },
    })

    res.json({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      subtitle: lesson.subtitle,
      xpBonus: lesson.xpBonus,
      unit: {
        id: lesson.unit.id,
        title: lesson.unit.title,
        colour: lesson.unit.colour,
      },
      exercises,
    })
  }),
)

contentRouter.get(
  '/lessons/:id/words',
  asyncHandler(async (req, res) => {
    const { id } = parseQuery(lessonQuerySchema, req.params)
    const lesson = await findLesson(id)

    if (req.auth?.kind === 'user') {
      const unlocked = await isLessonUnlocked(req.auth.userId, lesson)
      if (!unlocked) throw forbidden('Finish the earlier unit first.')
    }

    const links = await prisma.exerciseWord.findMany({
      where: { exercise: { lessonId: lesson.id } },
      include: { word: true },
      distinct: ['wordId'],
    })

    res.json({
      words: links.map((link) => ({
        id: link.word.id,
        setswana: link.word.setswana,
        english: link.word.english,
        phonetic: link.word.phonetic,
        audioUrl: link.word.audioUrl,
        notes: link.word.notes,
        pluralForm: link.word.pluralForm,
        formalForm: link.word.formalForm,
      })),
    })
  }),
)
