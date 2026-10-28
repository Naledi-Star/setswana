import { z } from 'zod'
import { EXERCISE_TYPES, type ExerciseTypeName } from '../config/tunables.js'

const nonEmpty = z.string().trim().min(1)
const optionalText = z.string().trim().min(1).optional().nullable()

/** The learner-facing lesson page: reference tables plus cultural notes. */
export const lessonGuideSchema = z
  .object({
    sections: z
      .array(
        z
          .object({
            heading: nonEmpty,
            rows: z.array(
              z
                .object({
                  setswana: nonEmpty,
                  pronunciation: optionalText,
                  english: nonEmpty,
                  sample: optionalText,
                  /** Clip of this row, so the learner can hear the phrase while reading. */
                  audioUrl: optionalText,
                })
                .strict(),
            ),
          })
          .strict(),
      )
      .default([]),
    tips: z
      .object({ heading: nonEmpty, items: z.array(nonEmpty) })
      .strict()
      .optional()
      .nullable(),
  })
  .strict()

export const wordContentSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Word slugs use lowercase letters, numbers and dashes.'),
    setswana: nonEmpty,
    english: nonEmpty,
    notes: optionalText,
    pluralForm: optionalText,
    formalForm: optionalText,
    phonetic: optionalText,
    audioUrl: optionalText,
    partOfSpeech: optionalText,
  })
  .strict()

export const exerciseContentSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Exercise slugs use lowercase letters, numbers and dashes.'),
    type: z.enum(EXERCISE_TYPES),
    prompt: z.record(z.string(), z.unknown()),
    answerKey: z.record(z.string(), z.unknown()),
    explanation: optionalText,
    xp: z.number().int().min(0).max(500).optional(),
    audioUrl: optionalText,
    words: z.array(nonEmpty).default([]),
  })
  .strict()

export const lessonContentSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Lesson slugs use lowercase letters, numbers and dashes.'),
    title: nonEmpty,
    subtitle: optionalText,
    kind: z.enum(['LESSON', 'PRACTICE']).default('LESSON'),
    xpBonus: z.number().int().min(0).max(500).optional(),
    guide: lessonGuideSchema.optional().nullable(),
    exercises: z.array(exerciseContentSchema).min(1),
  })
  .strict()

export const unitContentSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/, 'Unit slugs use lowercase letters, numbers and dashes.'),
    title: nonEmpty,
    titleEn: nonEmpty,
    description: optionalText,
    colour: z.enum(['blue', 'coral', 'gold', 'green']).default('blue'),
    /** Clips are declared but not recorded yet, so missing audio is a warning, not an error. */
    audioPending: z.boolean().default(false),
    words: z.array(wordContentSchema).default([]),
    lessons: z.array(lessonContentSchema).default([]),
  })
  .strict()

export type LessonGuideContent = z.infer<typeof lessonGuideSchema>
export type WordContent = z.infer<typeof wordContentSchema>
export type ExerciseContent = z.infer<typeof exerciseContentSchema>
export type LessonContent = z.infer<typeof lessonContentSchema>
export type UnitContent = z.infer<typeof unitContentSchema>

export type ContentIssue = { path: string; message: string; severity: 'error' | 'warning' }

export type ValidateOptions = {
  /** Returns true when the audio file referenced by the url exists. */
  audioExists?: (url: string) => boolean
  /**
   * The unit declares clips that are not recorded yet. Declared-but-missing audio is then
   * reported as a warning (a to-record checklist) instead of failing the seed.
   */
  audioPending?: boolean
}

function optionsFrom(prompt: Record<string, unknown>): { id: string; text: string }[] {
  if (!Array.isArray(prompt.options)) return []
  return prompt.options.flatMap((option) => {
    if (!option || typeof option !== 'object') return []
    const record = option as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.text === 'string'
      ? [{ id: record.id, text: record.text }]
      : []
  })
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function validateExercise(
  exercise: ExerciseContent,
  path: string,
  opts: ValidateOptions,
  issues: ContentIssue[],
  wordSlugs: Set<string>,
): void {
  const push = (message: string, severity: ContentIssue['severity'] = 'error') =>
    issues.push({ path, message, severity })

  const type = exercise.type as ExerciseTypeName
  const prompt = exercise.prompt
  const key = exercise.answerKey

  for (const slug of exercise.words) {
    if (!wordSlugs.has(slug)) push(`References unknown word "${slug}".`)
  }

  if (exercise.audioUrl) {
    if (opts.audioExists && !opts.audioExists(exercise.audioUrl)) {
      push(
        `Recording not found: ${exercise.audioUrl}. Record it and drop the file in content/audio/.`,
        opts.audioPending ? 'warning' : 'error',
      )
    }
  }

  switch (type) {
    case 'TRANSLATE_MC':
    case 'LISTEN_CHOOSE': {
      const options = optionsFrom(prompt)
      if (options.length < 2 || options.length > 4) {
        push('Multiple choice needs 2–4 options.')
      }
      const correctId = key.correctOptionId
      if (typeof correctId !== 'string' || !options.some((option) => option.id === correctId)) {
        push('correctOptionId must reference one of the options.')
      }
      if (!exercise.audioUrl && type === 'LISTEN_CHOOSE') {
        push(
          'No recording yet; this listening exercise is skipped until audio is added at the URL above.',
          'warning',
        )
      }
      break
    }

    case 'MATCH_PAIRS': {
      const pairs = Array.isArray(key.pairs) ? key.pairs : []
      if (pairs.length < 3 || pairs.length > 5) push('Match exercises need 3–5 pairs.')
      for (const pair of pairs) {
        const record = pair as Record<string, unknown>
        if (typeof record.id !== 'string' || typeof record.setswana !== 'string' || typeof record.english !== 'string') {
          push('Every pair needs id, setswana and english.')
        }
      }
      break
    }

    case 'FILL_BLANK': {
      const answers = stringArray(key.answers)
      if (!answers.length) push('Fill-in-the-blank needs at least one answer.')
      if (typeof prompt.sentence !== 'string' || !prompt.sentence.includes('___')) {
        push('Fill-in-the-blank prompt needs a sentence containing ___.')
      }
      break
    }

    case 'TYPE_ANSWER': {
      if (!stringArray(key.answers).length) push('Typed answers need at least one accepted answer.')
      if (typeof prompt.sourceText !== 'string') push('Typed answers need prompt.sourceText.')
      if (prompt.listenFirst === true && !exercise.audioUrl) {
        push(
          'No recording yet; this listen-and-write exercise is skipped until audio is added at the URL above.',
          'warning',
        )
      }
      break
    }

    case 'BUILD_SENTENCE': {
      const tokens = Array.isArray(prompt.tokens) ? prompt.tokens : []
      const tokenIds = new Set(
        tokens.flatMap((token) => {
          const record = token as Record<string, unknown>
          return typeof record.id === 'string' ? [record.id] : []
        }),
      )
      const order = stringArray(key.order)
      if (!tokens.length || tokens.length < 2) push('Build-the-sentence needs at least two tokens.')
      if (order.length !== tokenIds.size) push('answerKey.order must use every token exactly once.')
      if (new Set(order).size !== order.length) push('answerKey.order contains duplicate tokens.')
      for (const tokenId of order) {
        if (!tokenIds.has(tokenId)) push(`answerKey.order references unknown token "${tokenId}".`)
      }
      const canonical = order.map((id) => {
        const token = tokens.find((entry) => (entry as Record<string, unknown>).id === id)
        return (token as Record<string, unknown> | undefined)?.text ?? ''
      })
      const shuffled = tokens.map((token) => (token as Record<string, unknown>).text)
      if (canonical.join(' ') === shuffled.join(' ')) {
        push('Tokens are already in the correct order; the client would show the answer.', 'warning')
      }
      break
    }

    case 'SPEAK': {
      if (typeof prompt.phrase !== 'string') push('Speak exercises need prompt.phrase.')
      break
    }

    case 'REVIEW_CARD': {
      if (typeof prompt.setswana !== 'string' || typeof prompt.english !== 'string') {
        push('Review cards need prompt.setswana and prompt.english.')
      }
      break
    }
  }
}

export function checkExerciseContent(
  exercise: ExerciseContent,
  wordSlugs: Set<string> = new Set(),
  opts: ValidateOptions = {},
): ContentIssue[] {
  const issues: ContentIssue[] = []
  validateExercise(exercise, 'exercise', opts, issues, wordSlugs)
  return issues
}

export function validateUnitContent(
  unit: UnitContent,
  opts: ValidateOptions = {},
  basePath = unit.slug,
): ContentIssue[] {
  const issues: ContentIssue[] = []
  const audioOpts: ValidateOptions = { ...opts, audioPending: unit.audioPending }
  const wordSlugs = new Set<string>()
  const seenSetswana = new Map<string, string>()

  for (const [index, word] of unit.words.entries()) {
    const path = `${basePath}.words[${index}]`
    if (wordSlugs.has(word.slug)) issues.push({ path, message: `Duplicate word slug "${word.slug}".`, severity: 'error' })
    wordSlugs.add(word.slug)

    const normalised = word.setswana.trim().toLowerCase()
    const existing = seenSetswana.get(normalised)
    if (existing) {
      issues.push({ path, message: `Duplicate Setswana word "${word.setswana}" (also ${existing}).`, severity: 'error' })
    } else {
      seenSetswana.set(normalised, path)
    }

    if (Boolean(word.pluralForm) !== Boolean(word.formalForm)) {
      issues.push({
        path,
        message: 'Provide pluralForm and formalForm together, or neither.',
        severity: 'warning',
      })
    }

    if (word.audioUrl && audioOpts.audioExists && !audioOpts.audioExists(word.audioUrl)) {
      issues.push({
        path,
        message: `Recording not found: ${word.audioUrl}. Record it and drop the file in content/audio/.`,
        severity: audioOpts.audioPending ? 'warning' : 'error',
      })
    }
  }

  if (!unit.lessons.length) {
    issues.push({ path: basePath, message: 'A unit needs at least one lesson.', severity: 'error' })
  }

  const lessonSlugs = new Set<string>()
  for (const [lessonIndex, lesson] of unit.lessons.entries()) {
    const path = `${basePath}.lessons[${lessonIndex}]`
    if (lessonSlugs.has(lesson.slug)) {
      issues.push({ path, message: `Duplicate lesson slug "${lesson.slug}".`, severity: 'error' })
    }
    lessonSlugs.add(lesson.slug)

    if (lesson.exercises.length < 3 || lesson.exercises.length > 12) {
      issues.push({ path, message: 'A lesson needs 3–12 exercises.', severity: 'error' })
    }

    for (const [sectionIndex, section] of (lesson.guide?.sections ?? []).entries()) {
      for (const [rowIndex, row] of section.rows.entries()) {
        if (!row.audioUrl || !audioOpts.audioExists || audioOpts.audioExists(row.audioUrl)) continue
        issues.push({
          path: `${path}.guide.sections[${sectionIndex}].rows[${rowIndex}]`,
          message: `Recording not found: ${row.audioUrl}. Record it and drop the file in content/audio/.`,
          severity: audioOpts.audioPending ? 'warning' : 'error',
        })
      }
    }

    const exerciseSlugs = new Set<string>()
    for (const [exerciseIndex, exercise] of lesson.exercises.entries()) {
      const exercisePath = `${path}.exercises[${exerciseIndex}]`
      if (exerciseSlugs.has(exercise.slug)) {
        issues.push({
          path: exercisePath,
          message: `Duplicate exercise slug "${exercise.slug}".`,
          severity: 'error',
        })
      }
      exerciseSlugs.add(exercise.slug)
      validateExercise(exercise, exercisePath, audioOpts, issues, wordSlugs)
    }
  }

  return issues
}

export function errorsOnly(issues: ContentIssue[]): ContentIssue[] {
  return issues.filter((issue) => issue.severity === 'error')
}
