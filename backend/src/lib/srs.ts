export type SelfMark = 'again' | 'good' | 'easy'

export type ReviewSchedule = {
  stage: number
  dueAt: Date
}

export function scheduleReview(
  stage: number,
  selfMark: SelfMark,
  intervalsDays: number[],
  now = new Date(),
): ReviewSchedule {
  const maxStage = Math.max(0, intervalsDays.length - 1)

  let nextStage: number
  if (selfMark === 'again') {
    nextStage = Math.max(0, stage - 2)
  } else if (selfMark === 'easy') {
    nextStage = Math.min(maxStage, stage + 2)
  } else {
    nextStage = Math.min(maxStage, stage + 1)
  }

  // 'again' repeats the shortest interval tomorrow; correct marks use the new stage's interval.
  const intervalIndex = selfMark === 'again' ? 0 : nextStage
  const days = intervalsDays[intervalIndex] ?? intervalsDays[intervalsDays.length - 1] ?? 1

  const dueAt = new Date(now)
  dueAt.setUTCDate(dueAt.getUTCDate() + days)

  return { stage: nextStage, dueAt }
}

export function initialReviewDue(intervalsDays: number[], now = new Date()): Date {
  const days = intervalsDays[0] ?? 1
  const dueAt = new Date(now)
  dueAt.setUTCDate(dueAt.getUTCDate() + days)
  return dueAt
}

export function wordStatus(stage: number, reviews: number): 'new' | 'learning' | 'known' {
  if (reviews === 0) return 'new'
  if (stage >= 3) return 'known'
  return 'learning'
}
