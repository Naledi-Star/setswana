import { isYesterday } from './time.js'

export type StreakState = {
  currentStreak: number
  longestStreak: number
  lastStreakDate: string | null
}

export function applyLessonToStreak(state: StreakState, today: string): StreakState {
  let current = state.currentStreak

  if (state.lastStreakDate === today) {
    // Already counted today.
  } else if (state.lastStreakDate && isYesterday(state.lastStreakDate, today)) {
    current = Math.max(1, current + 1)
  } else {
    current = 1
  }

  return {
    currentStreak: current,
    longestStreak: Math.max(state.longestStreak, current),
    lastStreakDate: today,
  }
}
