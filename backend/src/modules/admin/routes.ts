import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import path from 'node:path'
import { open, readdir, readFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import type { ExerciseType, Prisma } from '@prisma/client'
import { getTunables, updateTunables } from '../../config/app-config.js'
import { prisma } from '../../db/client.js'
import { audioDir, audioUrlExists, contentDir } from '../../lib/media.js'
import { auditListQuery, readAudit } from '../../lib/audit-query.js'
import { recordAudit } from '../../lib/audit.js'
import { badRequest, forbidden, notFound } from '../../lib/errors.js'
import { asyncHandler } from '../../lib/http.js'
import { slugify } from '../../lib/slug.js'
import { parseBody, parseQuery } from '../../lib/validation.js'
import { assertAdmin, authenticate } from '../../middleware/auth.js'
import { adminLimiter } from '../../middleware/rate-limit.js'
import {
  checkExerciseContent,
  unitContentSchema,
  validateUnitContent,
  type ExerciseContent,
  type ContentIssue,
} from '../../content/schema.js'
import { EXERCISE_TYPES } from '../../config/tunables.js'

export const adminRouter = Router()

function adminOnly(req: Request, _res: Response, next: NextFunction) {
  try {
    assertAdmin(req)
    next()
  } catch (error) {
    next(error)
  }
}

adminRouter.use(authenticate, adminOnly, adminLimiter)

const colourSchema = z.enum(['blue', 'coral', 'gold', 'green'])

async function adminMeta(req: Request) {
  return { ip: req.ip, userAgent: req.header('user-agent') }
}

/* ------------------------------------------------------------------ units */

adminRouter.get(
  '/units',
  asyncHandler(async (_req, res) => {
    const units = await prisma.unit.findMany({
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      include: {
        lessons: {
          orderBy: [{ position: 'asc' }, { slug: 'asc' }],
          include: { _count: { select: { exercises: true } } },
        },
        _count: { select: { words: true } },
      },
    })

    res.json({
      units: units.map((unit) => ({
        id: unit.id,
        slug: unit.slug,
        title: unit.title,
        titleEn: unit.titleEn,
        description: unit.description,
        colour: unit.colour,
        position: unit.position,
        isPublished: unit.isPublished,
        wordCount: unit._count.words,
        lessons: unit.lessons.map((lesson) => ({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          subtitle: lesson.subtitle,
          kind: lesson.kind,
          position: lesson.position,
          isPublished: lesson.isPublished,
          exerciseCount: lesson._count.exercises,
        })),
      })),
    })
  }),
)

const unitCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    titleEn: z.string().trim().min(1).max(80),
    slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80).optional(),
    description: z.string().trim().max(400).optional(),
    colour: colourSchema.default('blue'),
    position: z.number().int().min(0).max(999).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()

adminRouter.post(
  '/units',
  asyncHandler(async (req, res) => {
    const body = parseBody(unitCreateSchema, req.body)
    const position =
      body.position ??
      ((await prisma.unit.aggregate({ _max: { position: true } }))._max.position ?? -1) + 1

    const unit = await prisma.unit.create({
      data: {
        slug: body.slug ?? slugify(body.title, 'unit'),
        title: body.title,
        titleEn: body.titleEn,
        description: body.description ?? null,
        colour: body.colour,
        position,
        isPublished: body.isPublished ?? false,
      },
    })

    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.unit.create', targetType: 'unit', targetId: unit.id })
    res.status(201).json(unit)
  }),
)

const unitUpdateSchema = unitCreateSchema.partial()

adminRouter.patch(
  '/units/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = parseBody(unitUpdateSchema, req.body)
    const unit = await prisma.unit.update({
      where: { id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.titleEn ? { titleEn: body.titleEn } : {}),
        ...(body.slug ? { slug: body.slug } : {}),
        ...(body.description !== undefined ? { description: body.description ?? null } : {}),
        ...(body.colour ? { colour: body.colour } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
      },
    })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.unit.update', targetType: 'unit', targetId: id })
    res.json(unit)
  }),
)

adminRouter.delete(
  '/units/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    await prisma.unit.delete({ where: { id } })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.unit.delete', targetType: 'unit', targetId: id })
    res.status(204).end()
  }),
)

/* ---------------------------------------------------------------- lessons */

const lessonCreateSchema = z
  .object({
    unitId: z.string().uuid(),
    title: z.string().trim().min(1).max(80),
    subtitle: z.string().trim().max(120).optional(),
    slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80).optional(),
    kind: z.enum(['LESSON', 'PRACTICE']).default('LESSON'),
    xpBonus: z.number().int().min(0).max(200).optional(),
    position: z.number().int().min(0).max(999).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()

adminRouter.post(
  '/lessons',
  asyncHandler(async (req, res) => {
    const body = parseBody(lessonCreateSchema, req.body)
    const unit = await prisma.unit.findUnique({ where: { id: body.unitId } })
    if (!unit) throw notFound('Unit not found.')

    const position =
      body.position ??
      ((await prisma.lesson.aggregate({ where: { unitId: body.unitId }, _max: { position: true } }))._max
        .position ?? -1) + 1

    const lesson = await prisma.lesson.create({
      data: {
        unitId: body.unitId,
        slug: body.slug ?? slugify(body.title, 'lesson'),
        title: body.title,
        subtitle: body.subtitle ?? null,
        kind: body.kind,
        xpBonus: body.xpBonus ?? 10,
        position,
        isPublished: body.isPublished ?? false,
      },
    })

    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.lesson.create', targetType: 'lesson', targetId: lesson.id })
    res.status(201).json(lesson)
  }),
)

adminRouter.get(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        exercises: {
          orderBy: [{ position: 'asc' }, { slug: 'asc' }],
          include: { words: { include: { word: true } } },
        },
      },
    })
    if (!lesson) throw notFound('Lesson not found.')

    res.json({
      ...lesson,
      exercises: lesson.exercises.map((exercise) => ({
        id: exercise.id,
        slug: exercise.slug,
        type: exercise.type,
        position: exercise.position,
        prompt: exercise.prompt,
        answerKey: exercise.answerKey,
        explanation: exercise.explanation,
        xp: exercise.xp,
        audioUrl: exercise.audioUrl,
        words: exercise.words.map((link) => ({ id: link.word.id, setswana: link.word.setswana, english: link.word.english })),
      })),
    })
  }),
)

const lessonUpdateSchema = lessonCreateSchema.omit({ unitId: true }).partial()

adminRouter.patch(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = parseBody(lessonUpdateSchema, req.body)
    const lesson = await prisma.lesson.update({
      where: { id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.subtitle !== undefined ? { subtitle: body.subtitle ?? null } : {}),
        ...(body.slug ? { slug: body.slug } : {}),
        ...(body.kind ? { kind: body.kind } : {}),
        ...(body.xpBonus !== undefined ? { xpBonus: body.xpBonus } : {}),
        ...(body.position !== undefined ? { position: body.position } : {}),
        ...(body.isPublished !== undefined ? { isPublished: body.isPublished } : {}),
      },
    })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.lesson.update', targetType: 'lesson', targetId: id })
    res.json(lesson)
  }),
)

adminRouter.delete(
  '/lessons/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    await prisma.lesson.delete({ where: { id } })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.lesson.delete', targetType: 'lesson', targetId: id })
    res.status(204).end()
  }),
)

/* -------------------------------------------------------------- exercises */

const exerciseBodySchema = z
  .object({
    lessonId: z.string().uuid().optional(),
    slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80).optional(),
    type: z.enum(EXERCISE_TYPES),
    prompt: z.record(z.string(), z.unknown()),
    answerKey: z.record(z.string(), z.unknown()),
    explanation: z.string().trim().max(500).optional().nullable(),
    xp: z.number().int().min(0).max(500).optional(),
    audioUrl: z.string().trim().max(300).optional().nullable(),
    wordIds: z.array(z.string().uuid()).max(20).default([]),
    position: z.number().int().min(0).max(999).optional(),
  })
  .strict()

async function validateExerciseOrThrow(input: {
  type: ExerciseType
  prompt: Record<string, unknown>
  answerKey: Record<string, unknown>
  audioUrl?: string | null
  words: string[]
}) {
  const candidate: ExerciseContent = {
    slug: 'draft',
    type: input.type,
    prompt: input.prompt,
    answerKey: input.answerKey,
    words: input.words,
    ...(input.audioUrl ? { audioUrl: input.audioUrl } : {}),
  }

  const issues: ContentIssue[] = checkExerciseContent(candidate, new Set(input.words), {
    audioExists: audioUrlExists,
  })
  const errors = issues.filter((issue) => issue.severity === 'error')
  if (errors.length) {
    throw badRequest(errors[0]?.message ?? 'Exercise content is invalid.', {
      exercise: errors.map((issue) => issue.message).join(' '),
    })
  }
}

async function wordsForIds(wordIds: string[]) {
  if (!wordIds.length) return []
  const words = await prisma.word.findMany({ where: { id: { in: wordIds } } })
  return words
}

adminRouter.get(
  '/exercises',
  asyncHandler(async (req, res) => {
    const query = parseQuery(z.object({ lessonId: z.string().uuid() }).strict(), req.query)
    const exercises = await prisma.exercise.findMany({
      where: { lessonId: query.lessonId },
      orderBy: [{ position: 'asc' }, { slug: 'asc' }],
      include: { words: { include: { word: true } } },
    })
    res.json({ exercises })
  }),
)

adminRouter.post(
  '/exercises',
  asyncHandler(async (req, res) => {
    const body = parseBody(exerciseBodySchema, req.body)
    if (!body.lessonId) throw badRequest('lessonId is required.', { lessonId: 'Required.' })

    const lesson = await prisma.lesson.findUnique({ where: { id: body.lessonId } })
    if (!lesson) throw notFound('Lesson not found.')

    const words = await wordsForIds(body.wordIds)
    await validateExerciseOrThrow({
      type: body.type,
      prompt: body.prompt,
      answerKey: body.answerKey,
      audioUrl: body.audioUrl,
      words: words.map((word) => word.slug),
    })

    const position =
      body.position ??
      ((await prisma.exercise.aggregate({ where: { lessonId: body.lessonId }, _max: { position: true } }))
        ._max.position ?? -1) + 1

    const exercise = await prisma.exercise.create({
      data: {
        lessonId: body.lessonId,
        slug: body.slug ?? slugify(`${body.type}-${position + 1}`, 'exercise'),
        position,
        type: body.type,
        prompt: body.prompt as Prisma.InputJsonValue,
        answerKey: body.answerKey as Prisma.InputJsonValue,
        explanation: body.explanation ?? null,
        xp: body.xp ?? 10,
        audioUrl: body.audioUrl ?? null,
        words: { create: words.map((word) => ({ wordId: word.id })) },
      },
    })

    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.exercise.create', targetType: 'exercise', targetId: exercise.id })
    res.status(201).json(exercise)
  }),
)

const exerciseUpdateSchema = exerciseBodySchema.partial().omit({ lessonId: true })

adminRouter.patch(
  '/exercises/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = parseBody(exerciseUpdateSchema, req.body)
    const existing = await prisma.exercise.findUnique({ where: { id }, include: { words: true } })
    if (!existing) throw notFound('Exercise not found.')

    const words = body.wordIds ? await wordsForIds(body.wordIds) : null
    await validateExerciseOrThrow({
      type: (body.type ?? existing.type) as ExerciseType,
      prompt: body.prompt ?? (existing.prompt as Record<string, unknown>),
      answerKey: body.answerKey ?? (existing.answerKey as Record<string, unknown>),
      audioUrl: body.audioUrl ?? existing.audioUrl,
      words: (words ?? existing.words).map((word) => ('slug' in word ? word.slug : '')),
    })

    const exercise = await prisma.$transaction(async (tx) => {
      if (words) {
        await tx.exerciseWord.deleteMany({ where: { exerciseId: id } })
        await tx.exerciseWord.createMany({
          data: words.map((word) => ({ exerciseId: id, wordId: word.id })),
        })
      }

      return tx.exercise.update({
        where: { id },
        data: {
          ...(body.slug ? { slug: body.slug } : {}),
          ...(body.type ? { type: body.type } : {}),
          ...(body.prompt ? { prompt: body.prompt as Prisma.InputJsonValue } : {}),
          ...(body.answerKey ? { answerKey: body.answerKey as Prisma.InputJsonValue } : {}),
          ...(body.explanation !== undefined ? { explanation: body.explanation ?? null } : {}),
          ...(body.xp !== undefined ? { xp: body.xp } : {}),
          ...(body.audioUrl !== undefined ? { audioUrl: body.audioUrl ?? null } : {}),
          ...(body.position !== undefined ? { position: body.position } : {}),
        },
      })
    })

    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.exercise.update', targetType: 'exercise', targetId: id })
    res.json(exercise)
  }),
)

adminRouter.delete(
  '/exercises/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    await prisma.exercise.delete({ where: { id } })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.exercise.delete', targetType: 'exercise', targetId: id })
    res.status(204).end()
  }),
)

/* ------------------------------------------------------------------ words */

const wordBodySchema = z
  .object({
    setswana: z.string().trim().min(1).max(120),
    english: z.string().trim().min(1).max(120),
    slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80).optional(),
    unitId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(400).optional().nullable(),
    pluralForm: z.string().trim().max(120).optional().nullable(),
    formalForm: z.string().trim().max(120).optional().nullable(),
    phonetic: z.string().trim().max(160).optional().nullable(),
    audioUrl: z.string().trim().max(300).optional().nullable(),
    partOfSpeech: z.string().trim().max(40).optional().nullable(),
  })
  .strict()

adminRouter.get(
  '/words',
  asyncHandler(async (_req, res) => {
    const words = await prisma.word.findMany({
      orderBy: { createdAt: 'desc' },
      include: { unit: { select: { id: true, title: true } } },
    })
    res.json({ words })
  }),
)

adminRouter.post(
  '/words',
  asyncHandler(async (req, res) => {
    const body = parseBody(wordBodySchema, req.body)
    const word = await prisma.word.create({
      data: {
        slug: body.slug ?? slugify(body.setswana, 'word'),
        setswana: body.setswana,
        english: body.english,
        unitId: body.unitId ?? null,
        notes: body.notes ?? null,
        pluralForm: body.pluralForm ?? null,
        formalForm: body.formalForm ?? null,
        phonetic: body.phonetic ?? null,
        audioUrl: body.audioUrl ?? null,
        partOfSpeech: body.partOfSpeech ?? null,
      },
    })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.word.create', targetType: 'word', targetId: word.id })
    res.status(201).json(word)
  }),
)

adminRouter.patch(
  '/words/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    const body = parseBody(wordBodySchema.partial(), req.body)
    const word = await prisma.word.update({
      where: { id },
      data: {
        ...(body.setswana ? { setswana: body.setswana } : {}),
        ...(body.english ? { english: body.english } : {}),
        ...(body.slug ? { slug: body.slug } : {}),
        ...(body.unitId !== undefined ? { unitId: body.unitId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
        ...(body.pluralForm !== undefined ? { pluralForm: body.pluralForm ?? null } : {}),
        ...(body.formalForm !== undefined ? { formalForm: body.formalForm ?? null } : {}),
        ...(body.phonetic !== undefined ? { phonetic: body.phonetic ?? null } : {}),
        ...(body.audioUrl !== undefined ? { audioUrl: body.audioUrl ?? null } : {}),
        ...(body.partOfSpeech !== undefined ? { partOfSpeech: body.partOfSpeech ?? null } : {}),
      },
    })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.word.update', targetType: 'word', targetId: id })
    res.json(word)
  }),
)

adminRouter.delete(
  '/words/:id',
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params)
    await prisma.word.delete({ where: { id } })
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.word.delete', targetType: 'word', targetId: id })
    res.status(204).end()
  }),
)

/* ------------------------------------------------------------------ audio */

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, audioDir),
  filename: (req, file, callback) => {
    const requested = typeof req.body?.name === 'string' ? req.body.name : path.parse(file.originalname).name
    const extension = path.extname(file.originalname).toLowerCase()
    callback(null, `${slugify(requested, 'clip')}${extension}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase()
    const allowed = ['.mp3', '.m4a', '.wav']
    if (!allowed.includes(extension) || !file.mimetype.startsWith('audio/')) {
      callback(new Error('Upload an mp3, m4a or wav audio file.'))
      return
    }
    callback(null, true)
  },
})

async function hasAudioSignature(filePath: string, extension: string): Promise<boolean> {
  const handle = await open(filePath, 'r')
  try {
    const buffer = Buffer.alloc(12)
    await handle.read(buffer, 0, 12, 0)
    if (extension === '.mp3') {
      const id3 = buffer.subarray(0, 3).toString() === 'ID3'
      const frame = buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0
      return id3 || frame
    }
    if (extension === '.m4a') return buffer.subarray(4, 8).toString() === 'ftyp'
    if (extension === '.wav') return buffer.subarray(0, 4).toString() === 'RIFF'
    return false
  } finally {
    await handle.close()
  }
}

adminRouter.post(
  '/audio',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file
    if (!file) throw badRequest('Attach an audio file in the "file" field.')
    const extension = path.extname(file.path).toLowerCase()
    const valid = await hasAudioSignature(file.path, extension)

    if (!valid) {
      await unlink(file.path).catch(() => undefined)
      throw badRequest('That file does not look like valid audio.')
    }

    const url = `/media/${path.basename(file.path)}`
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.audio.upload', targetType: 'audio', targetId: url })
    res.status(201).json({ url })
  }),
)

/* ----------------------------------------------------------------- config */

adminRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    res.json(await getTunables())
  }),
)

adminRouter.patch(
  '/config',
  asyncHandler(async (req, res) => {
    const config = await updateTunables(req.body)
    await recordAudit({ actorUserId: req.auth?.kind === 'user' ? req.auth.userId : null, ...(await adminMeta(req)), action: 'admin.config.update' })
    res.json(config)
  }),
)

/* ------------------------------------------------------- content validation */

adminRouter.get(
  '/content/validate',
  asyncHandler(async (_req, res) => {
    const dir = path.join(contentDir, 'units')
    const files = existsSync(dir) ? (await readdir(dir)).filter((file) => file.endsWith('.json')) : []
    const errors: ContentIssue[] = []
    const warnings: ContentIssue[] = []

    for (const file of files) {
      try {
        const raw = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown
        const parsed = unitContentSchema.safeParse(raw)
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            errors.push({ path: `${file}:${issue.path.join('.')}`, message: issue.message, severity: 'error' })
          }
          continue
        }
        const issues = validateUnitContent(parsed.data, { audioExists: audioUrlExists }, `${file}:${parsed.data.slug}`)
        for (const issue of issues) {
          if (issue.severity === 'error') errors.push(issue)
          else warnings.push(issue)
        }
      } catch (error) {
        errors.push({
          path: file,
          message: error instanceof Error ? error.message : 'Could not parse file.',
          severity: 'error',
        })
      }
    }

    res.json({ files: files.length, errors, warnings })
  }),
)

/* ------------------------------------------------------------------ audit */

adminRouter.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const query = parseQuery(auditListQuery, req.query)
    res.json(await readAudit(query.limit, query.cursor))
  }),
)

adminRouter.get(
  '/health',
  asyncHandler(async (req, res) => {
    if (req.auth?.kind !== 'user') throw forbidden()
    const [units, lessons, exercises, words, users] = await Promise.all([
      prisma.unit.count(),
      prisma.lesson.count(),
      prisma.exercise.count(),
      prisma.word.count(),
      prisma.user.count({ where: { deletedAt: null } }),
    ])
    res.json({ units, lessons, exercises, words, users })
  }),
)
