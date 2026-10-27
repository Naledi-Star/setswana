export type Platform = 'ios' | 'android'

export type UserDto = {
  id: string
  email: string | null
  displayName: string
  role: 'LEARNER' | 'ADMIN'
  avatarUrl: string | null
  timezone: string
  dailyGoalLessons: number
  notificationPrefs: {
    reminderEnabled: boolean
    reminderLocalTime: string
    streakReminderEnabled: boolean
  }
  createdAt: string
}

export type StatsDto = {
  totalXp: number
  currentStreak: number
  longestStreak: number
  hearts: number
  heartsMax: number
  nextRefillAt: string | null
  lessonsToday: number
  dailyGoal: number
  localDate: string
}

export type MeResponse = {
  user: UserDto
  stats: StatsDto
  dateLabel: string
}

export type SessionResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  user: UserDto
  stats: StatsDto
}

export type RefreshedSessionResponse = Omit<SessionResponse, 'stats'>

export type PublicConfig = {
  hearts: { max: number; refillMinutes: number }
  xp: Record<string, number>
  lessonBonusXp: number
  dailyGoalOptions: number[]
  defaultDailyGoal: number
  reviewQueueCap: number
  guestLessons: number
  linearLessons: boolean
  features: {
    googleSignIn: boolean
    pushEnabled: boolean
    emailDelivery: boolean
    guestPlay: boolean
  }
}

export type ExerciseType =
  | 'TRANSLATE_MC'
  | 'MATCH_PAIRS'
  | 'FILL_BLANK'
  | 'LISTEN_CHOOSE'
  | 'TYPE_ANSWER'
  | 'BUILD_SENTENCE'
  | 'SPEAK'
  | 'REVIEW_CARD'

export type ExerciseDto = {
  id: string
  slug: string
  type: ExerciseType
  prompt: Record<string, unknown>
  xp: number
  audioUrl: string | null
  position: number
}

export type LessonGuideRow = {
  setswana: string
  pronunciation: string | null
  english: string
  sample: string | null
}

export type LessonGuideSection = {
  heading: string
  rows: LessonGuideRow[]
}

export type LessonGuide = {
  sections: LessonGuideSection[]
  tips: { heading: string; items: string[] } | null
}

export type LessonDto = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  xpBonus: number
  guide: LessonGuide | null
  unit: { id: string; title: string; colour: string }
  exercises: ExerciseDto[]
}

export type PathLesson = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  xp: number
  exerciseCount: number
  state: 'done' | 'active' | 'open' | 'locked'
}

export type PathUnit = {
  id: string
  slug: string
  title: string
  titleEn: string
  description: string | null
  colour: string
  state: 'done' | 'active' | 'locked'
  lessons: PathLesson[]
}

export type PathResponse = {
  units: PathUnit[]
  continueLessonId: string | null
}

export type HeartState = {
  remaining: number
  max: number
  nextRefillAt: string | null
}

export type StartAttemptResponse = {
  attemptId: string
  lessonId: string
  resumed: boolean
  hearts: HeartState
  progress: { answered: number; total: number }
}

export type AnswerFeedback = {
  isCorrect: boolean
  skipped: boolean
  correctAnswer: Record<string, unknown>
  explanation: string | null
  xpAwarded: number
  hearts: HeartState
  progress: { answered: number; total: number }
  ended: boolean
}

export type CompletionSummary = {
  lessonId: string
  xpAwarded: number
  lessonXp: number
  bonusXp: number
  totalXp: number
  streak: number | null
  longestStreak?: number
  hearts: HeartState | null
  newWords: number
  nextLessonId: string | null
  needsAccount: boolean
}

export type WordDto = {
  id: string
  setswana: string
  english: string
  phonetic: string | null
  audioUrl: string | null
  notes: string | null
  pluralForm: string | null
  formalForm: string | null
  partOfSpeech: string | null
  stage: number
  status: 'new' | 'learning' | 'known'
  dueAt: string
  unit?: { title: string; colour: string } | null
}

export type WordsResponse = {
  words: WordDto[]
  counts: { all: number; new: number; learning: number; known: number }
}

export type ReviewItem = {
  kind: 'due' | 'new'
  wordId: string
  setswana: string
  english: string
  phonetic: string | null
  audioUrl: string | null
  notes: string | null
  stage: number
}

export type ReviewQueueResponse = {
  items: ReviewItem[]
  dueCount: number
}

export type ReviewAnswerResponse = {
  wordId: string
  stage: number
  dueAt: string
  status: 'new' | 'learning' | 'known'
  xpAwarded: number
  correct: boolean
}

export type ProgressSummary = StatsDto & {
  accuracy: number
  lessonsCompleted: number
  lessonsThisWeek: number
  week: { localDate: string; xp: number; lessons: number }[]
  wordsKnown: number
  wordsLearning: number
  wordsNew: number
}

export type GuestSessionResponse = {
  guestToken: string
  guestSessionId: string
  expiresAt: string
}

export type GuestNextLesson = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  unitTitle: string
  colour: string
}

export type AdminLessonSummary = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  kind: string
  position: number
  isPublished: boolean
  exerciseCount: number
}

export type AdminUnit = {
  id: string
  slug: string
  title: string
  titleEn: string
  description: string | null
  colour: string
  position: number
  isPublished: boolean
  wordCount: number
  lessons: AdminLessonSummary[]
}

export type AdminExercise = {
  id: string
  slug: string
  type: ExerciseType
  position: number
  prompt: Record<string, unknown>
  answerKey: Record<string, unknown>
  explanation: string | null
  xp: number
  audioUrl: string | null
  words: { id: string; setswana: string; english: string }[]
}

export type AdminLessonDetail = {
  id: string
  unitId: string
  slug: string
  title: string
  subtitle: string | null
  kind: string
  position: number
  isPublished: boolean
  xpBonus: number
  exercises: AdminExercise[]
}

export type AdminWord = {
  id: string
  slug: string
  setswana: string
  english: string
  notes: string | null
  pluralForm: string | null
  formalForm: string | null
  phonetic: string | null
  audioUrl: string | null
  partOfSpeech: string | null
  unitId: string | null
  unit?: { id: string; title: string } | null
}

export type AdminConfig = PublicConfig & {
  defaultDailyGoal: number
  typoToleranceMinLength: number
  srsIntervalsDays: number[]
  features: PublicConfig['features']
}
