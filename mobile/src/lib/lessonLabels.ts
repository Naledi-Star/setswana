import type { PathLesson } from '../api/types'

/**
 * Sections and reviews are numbered inside the lesson (unit) they belong to, not
 * across the whole path: "Basic Greetings and Expressions" is Lesson 1, and the
 * twelve items inside it read Section 1-9 and Review 1-3. Lesson 2 will start its
 * own Section 1.
 */
export function lessonLabels(lessons: Pick<PathLesson, 'kind'>[]): string[] {
  let sections = 0
  let reviews = 0

  return lessons.map((lesson) => {
    if (lesson.kind === 'PRACTICE') {
      reviews += 1
      return `Review ${reviews}`
    }
    sections += 1
    return `Section ${sections}`
  })
}
