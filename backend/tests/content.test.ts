import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkExerciseContent,
  unitContentSchema,
  validateUnitContent,
  type ExerciseContent,
} from '../src/content/schema.js'
import { contentDir } from '../src/lib/media.js'

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
