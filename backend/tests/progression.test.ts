import { describe, expect, it } from 'vitest'
import { projectHearts } from '../src/lib/hearts.js'
import { scheduleReview, wordStatus, initialReviewDue } from '../src/lib/srs.js'
import { applyLessonToStreak } from '../src/lib/streak.js'
import { addDaysToDateString, isYesterday, localDateString, safeTimezone } from '../src/lib/time.js'

const HOUR = 60 * 60 * 1000
const now = new Date('2026-10-24T12:00:00.000Z')

describe('hearts', () => {
  it('does nothing before the first refill interval', () => {
    const state = projectHearts(2, new Date(now.getTime() - 10 * 60_000), 5, 30, now)
    expect(state.hearts).toBe(2)
    expect(state.nextRefillAt?.toISOString()).toBe(new Date(now.getTime() + 20 * 60_000).toISOString())
  })

  it('refills one heart per interval', () => {
    const state = projectHearts(2, new Date(now.getTime() - 65 * 60_000), 5, 30, now)
    expect(state.hearts).toBe(4)
  })

  it('caps at the maximum and clears the timer', () => {
    const state = projectHearts(3, new Date(now.getTime() - 10 * HOUR), 5, 30, now)
    expect(state.hearts).toBe(5)
    expect(state.nextRefillAt).toBeNull()
  })

  it('never exceeds the max even with a large elapsed time', () => {
    expect(projectHearts(4, new Date(now.getTime() - 100 * HOUR), 5, 30, now).hearts).toBe(5)
  })
})

describe('streaks', () => {
  it('starts at one on the first lesson', () => {
    const result = applyLessonToStreak({ currentStreak: 0, longestStreak: 0, lastStreakDate: null }, '2026-10-24')
    expect(result).toMatchObject({ currentStreak: 1, longestStreak: 1, lastStreakDate: '2026-10-24' })
  })

  it('does not double count the same day', () => {
    const result = applyLessonToStreak(
      { currentStreak: 4, longestStreak: 4, lastStreakDate: '2026-10-24' },
      '2026-10-24',
    )
    expect(result.currentStreak).toBe(4)
  })

  it('increments on the next day and tracks the longest', () => {
    const result = applyLessonToStreak(
      { currentStreak: 4, longestStreak: 4, lastStreakDate: '2026-10-23' },
      '2026-10-24',
    )
    expect(result).toMatchObject({ currentStreak: 5, longestStreak: 5 })
  })

  it('resets after a missed day', () => {
    const result = applyLessonToStreak(
      { currentStreak: 9, longestStreak: 9, lastStreakDate: '2026-10-20' },
      '2026-10-24',
    )
    expect(result).toMatchObject({ currentStreak: 1, longestStreak: 9 })
  })
})

describe('dates and timezones', () => {
  it('computes local dates across the date line', () => {
    expect(localDateString(new Date('2026-10-24T22:30:00.000Z'), 'Africa/Gaborone')).toBe('2026-10-25')
    expect(localDateString(new Date('2026-10-24T22:30:00.000Z'), 'America/Bogota')).toBe('2026-10-24')
  })

  it('falls back for unknown timezones', () => {
    expect(safeTimezone('Mars/Olympus')).toBe('Africa/Gaborone')
  })

  it('recognises yesterday', () => {
    expect(isYesterday('2026-10-23', '2026-10-24')).toBe(true)
    expect(isYesterday('2026-10-22', '2026-10-24')).toBe(false)
  })

  it('adds days across a month boundary', () => {
    expect(addDaysToDateString('2026-10-31', 1)).toBe('2026-11-01')
  })
})

describe('spaced repetition', () => {
  const intervals = [1, 3, 7, 16, 35, 60]

  it('schedules the first review a day out', () => {
    const due = initialReviewDue(intervals, now)
    expect(due.toISOString().slice(0, 10)).toBe('2026-10-25')
  })

  it('advances a stage on good', () => {
    const result = scheduleReview(1, 'good', intervals, now)
    expect(result.stage).toBe(2)
    expect(result.dueAt.toISOString().slice(0, 10)).toBe('2026-10-31')
  })

  it('jumps two stages on easy', () => {
    expect(scheduleReview(1, 'easy', intervals, now).stage).toBe(3)
  })

  it('drops two stages and repeats tomorrow on again', () => {
    const result = scheduleReview(4, 'again', intervals, now)
    expect(result.stage).toBe(2)
    expect(result.dueAt.toISOString().slice(0, 10)).toBe('2026-10-25')
  })

  it('never drops below zero or above the last interval', () => {
    expect(scheduleReview(0, 'again', intervals, now).stage).toBe(0)
    expect(scheduleReview(5, 'easy', intervals, now).stage).toBe(5)
  })

  it('derives word status from practice history', () => {
    expect(wordStatus(0, 0)).toBe('new')
    expect(wordStatus(2, 3)).toBe('learning')
    expect(wordStatus(3, 4)).toBe('known')
  })
})
