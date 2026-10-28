import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkExerciseContent,
  unitContentSchema,
  validateUnitContent,
  type ExerciseContent,
} from '../src/content/schema.js'
import { contentDir, servableLessonGuide } from '../src/lib/media.js'

async function loadUnit() {
  const raw = JSON.parse(
    await readFile(path.join(contentDir, 'units', 'basic-greetings.json'), 'utf8'),
  ) as unknown
  return unitContentSchema.parse(raw)
}

describe('seed content', () => {
  it('parses and validates without errors', async () => {
    const unit = await loadUnit()
    const issues = validateUnitContent(unit)
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([])
  })

  it('uses unique word slugs and lesson slugs', async () => {
    const unit = await loadUnit()
    const wordSlugs = unit.words.map((word) => word.slug)
    const lessonSlugs = unit.lessons.map((lesson) => lesson.slug)
    expect(new Set(wordSlugs).size).toBe(wordSlugs.length)
    expect(new Set(lessonSlugs).size).toBe(lessonSlugs.length)
  })

  it('never ships an answer key inside a prompt', async () => {
    const unit = await loadUnit()
    for (const lesson of unit.lessons) {
      for (const exercise of lesson.exercises) {
        expect(JSON.stringify(exercise.prompt)).not.toContain('correctOptionId')
      }
    }
  })
})

describe('lesson 1 structure', () => {
  // Nine section lessons, each a full lesson, with a review after every three sections.
  it('ships nine section lessons and three reviews in order', async () => {
    const unit = await loadUnit()
    const titles = unit.lessons.map((lesson) => lesson.title)
    expect(titles).toEqual([
      'Basic Greetings (Singular)',
      'Greetings (Plural / Groups)',
      "Asking 'How Are You?'",
      'Review 1: Sections 1-3',
      'Responding to Greetings',
      'Morning Greeting (Well-being)',
      'Responding (General Well-being)',
      'Review 2: Sections 4-6',
      'Saying Thank You',
      'Saying Goodbye (Polite Expressions)',
      'Polite Expressions',
      'Review 3: Sections 7-9',
    ])
  })

  it('gives every section lesson a recording, a blank, a speak task and a closing test', async () => {
    const unit = await loadUnit()
    for (const lesson of unit.lessons.filter((entry) => entry.kind === 'LESSON')) {
      const types = lesson.exercises.map((exercise) => exercise.type)
      expect(types).toContain('LISTEN_CHOOSE')
      expect(types).toContain('FILL_BLANK')
      expect(types).toContain('SPEAK')
      expect(types[types.length - 1]).toBe('TYPE_ANSWER')
      expect(lesson.guide?.sections.length).toBe(1)
      // Match the pairs needs at least three words, so one-phrase sections skip it.
      if (lesson.guide?.sections[0]?.rows.length === 1) {
        expect(types).not.toContain('MATCH_PAIRS')
      }
    }
  })

  it('keeps the cultural tips at the end, after every section', async () => {
    const unit = await loadUnit()
    const withTips = unit.lessons.filter((lesson) => lesson.guide?.tips)
    expect(withTips).toHaveLength(1)
    expect(withTips[0]).toBe(unit.lessons[unit.lessons.length - 1])
    expect(withTips[0]?.guide?.tips?.heading).toBe('Cultural Context Tips')
  })

  it('serves guide audio only once the recording is on disk', async () => {
    const unit = await loadUnit()
    const sectionOne = unit.lessons[0]
    const guide = servableLessonGuide(sectionOne?.guide)
    const rows = guide?.sections[0]?.rows ?? []
    expect(rows[0]?.setswana).toBe('Dumela')
    expect(rows[0]?.audioUrl).toBe('/media/dumela.m4a')
    // Rra and Mma are declared but not recorded yet.
    expect(rows[1]?.audioUrl).toBeNull()
  })
})

describe('exercise validation', () => {
  const base: ExerciseContent = {
    slug: 'bad-choice',
    type: 'TRANSLATE_MC',
    prompt: {
      options: [
        { id: 'a', text: 'One' },
        { id: 'b', text: 'Two' },
      ],
    },
    answerKey: { correctOptionId: 'missing' },
    words: [],
  }

  it('flags a correct option that is not among the options', () => {
    const issues = checkExerciseContent(base)
    expect(issues.some((issue) => issue.message.includes('correctOptionId'))).toBe(true)
  })

  it('flags an unknown word reference', () => {
    const issues = checkExerciseContent({ ...base, words: ['ghost'] })
    expect(issues.some((issue) => issue.message.includes('ghost'))).toBe(true)
  })

  it('flags a listen exercise with no recording', () => {
    const issues = checkExerciseContent({
      ...base,
      type: 'LISTEN_CHOOSE',
      answerKey: { correctOptionId: 'a' },
    })
    expect(issues.some((issue) => issue.message.includes('recording'))).toBe(true)
  })

  it('flags a duplicate token order', () => {
    const issues = checkExerciseContent({
      slug: 'build',
      type: 'BUILD_SENTENCE',
      prompt: {
        tokens: [
          { id: 't1', text: 'Ke' },
          { id: 't2', text: 'nna' },
        ],
      },
      answerKey: { order: ['t1', 't1'] },
      words: [],
    })
    expect(issues.length).toBeGreaterThan(0)
  })
})
