import { z } from 'zod'

export const EXERCISE_TYPES = [
  'TRANSLATE_MC',
  'MATCH_PAIRS',
  'FILL_BLANK',
  'LISTEN_CHOOSE',
  'TYPE_ANSWER',
  'BUILD_SENTENCE',
  'SPEAK',
  'REVIEW_CARD',
] as const

export type ExerciseTypeName = (typeof EXERCISE_TYPES)[number]

export type Tunables = {
  hearts: { max: number; refillMinutes: number }
  xp: Record<ExerciseTypeName, number>
  lessonBonusXp: number
  dailyGoalOptions: number[]
  defaultDailyGoal: number
  srsIntervalsDays: number[]
  reviewQueueCap: number
  typoToleranceMinLength: number
  guestLessons: number
  linearLessons: boolean
  features: {
    googleSignIn: boolean
    pushEnabled: boolean
    emailDelivery: boolean
    guestPlay: boolean
  }
}

export const DEFAULT_TUNABLES: Tunables = {
  hearts: { max: 5, refillMinutes: 30 },
  xp: {
    TRANSLATE_MC: 10,
    MATCH_PAIRS: 20,
    FILL_BLANK: 10,
    LISTEN_CHOOSE: 10,
    TYPE_ANSWER: 15,
    BUILD_SENTENCE: 15,
    SPEAK: 10,
    REVIEW_CARD: 5,
  },
  lessonBonusXp: 10,
  dailyGoalOptions: [3, 5, 8],
  defaultDailyGoal: 5,
  srsIntervalsDays: [1, 3, 7, 16, 35, 60],
  reviewQueueCap: 20,
  typoToleranceMinLength: 5,
  guestLessons: 1,
  linearLessons: false,
  features: {
    googleSignIn: true,
    pushEnabled: false,
    emailDelivery: false,
    guestPlay: true,
  },
}

const patchSchema = z
  .object({
    hearts: z
      .object({
        max: z.number().int().min(1).max(10).optional(),
        refillMinutes: z.number().int().min(1).max(1440).optional(),
      })
      .strict()
      .optional(),
    xp: z.record(z.enum(EXERCISE_TYPES), z.number().int().min(0).max(1000)).optional(),
    lessonBonusXp: z.number().int().min(0).max(1000).optional(),
    dailyGoalOptions: z.array(z.number().int().min(1).max(50)).min(1).max(5).optional(),
    defaultDailyGoal: z.number().int().min(1).max(50).optional(),
    srsIntervalsDays: z.array(z.number().int().min(1).max(365)).min(1).max(10).optional(),
    reviewQueueCap: z.number().int().min(1).max(200).optional(),
    typoToleranceMinLength: z.number().int().min(2).max(20).optional(),
    guestLessons: z.number().int().min(0).max(10).optional(),
    linearLessons: z.boolean().optional(),
    features: z
      .object({
        googleSignIn: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        emailDelivery: z.boolean().optional(),
        guestPlay: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const tunablesPatchSchema = patchSchema
export type TunablesPatch = z.infer<typeof patchSchema>

export function mergeTunables(base: Tunables, patch: TunablesPatch): Tunables {
  return {
    ...base,
    ...patch,
    hearts: { ...base.hearts, ...(patch.hearts ?? {}) },
    xp: { ...base.xp, ...(patch.xp ?? {}) },
    dailyGoalOptions: patch.dailyGoalOptions ?? base.dailyGoalOptions,
    srsIntervalsDays: patch.srsIntervalsDays ?? base.srsIntervalsDays,
    features: { ...base.features, ...(patch.features ?? {}) },
  }
}

/** The subset of tunables a learner client needs in order to render the UI. */
export function publicConfig(tunables: Tunables) {
  return {
    hearts: { max: tunables.hearts.max, refillMinutes: tunables.hearts.refillMinutes },
    xp: tunables.xp,
    lessonBonusXp: tunables.lessonBonusXp,
    dailyGoalOptions: tunables.dailyGoalOptions,
    defaultDailyGoal: tunables.defaultDailyGoal,
    reviewQueueCap: tunables.reviewQueueCap,
    guestLessons: tunables.guestLessons,
    linearLessons: tunables.linearLessons,
    features: {
      googleSignIn: tunables.features.googleSignIn,
      pushEnabled: tunables.features.pushEnabled,
      emailDelivery: tunables.features.emailDelivery,
      guestPlay: tunables.features.guestPlay,
    },
  }
}
