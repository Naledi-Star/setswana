import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { CompositeScreenProps } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { CompletionSummary } from '../api/types'

export type AuthStackParamList = {
  Welcome: undefined
  SignIn: undefined
  SignUp: undefined
  ForgotPassword: undefined
}

export type LearnStackParamList = {
  Home: undefined
  Lesson: { lessonId: string }
  Complete: {
    summary: CompletionSummary
    lessonTitle: string
    nextLessonId: string | null
  }
  Settings: undefined
}

export type LessonsStackParamList = {
  Lessons: undefined
  LessonGuide: { lessonId: string }
  Lesson: { lessonId: string }
  Complete: {
    summary: CompletionSummary
    lessonTitle: string
    nextLessonId: string | null
  }
}

export type WordsStackParamList = {
  Words: undefined
  WordDetail: { wordId: string }
  Review: undefined
}

export type ProgressStackParamList = {
  Progress: undefined
}

export type AdminStackParamList = {
  AdminHome: undefined
  UnitEditor: { unitId: string }
  LessonEditor: { lessonId: string; title: string }
  ExerciseEditor: { lessonId: string; exerciseId?: string }
  WordsAdmin: undefined
  ConfigAdmin: undefined
}

export type GuestStackParamList = {
  GuestHome: undefined
  Lesson: { lessonId: string }
  Complete: {
    summary: CompletionSummary
    lessonTitle: string
    nextLessonId: string | null
  }
  GuestSignUp: undefined
}

export type TabParamList = {
  LearnTab: undefined
  LessonsTab: undefined
  WordsTab: undefined
  ProgressTab: undefined
  AdminTab: undefined
}

export type LearnScreenProps<T extends keyof LearnStackParamList> = NativeStackScreenProps<
  LearnStackParamList,
  T
>

export type LessonsScreenProps<T extends keyof LessonsStackParamList> = NativeStackScreenProps<
  LessonsStackParamList,
  T
>

export type WordsScreenProps<T extends keyof WordsStackParamList> = NativeStackScreenProps<
  WordsStackParamList,
  T
>

export type AdminScreenProps<T extends keyof AdminStackParamList> = NativeStackScreenProps<
  AdminStackParamList,
  T
>

export type GuestScreenProps<T extends keyof GuestStackParamList> = NativeStackScreenProps<
  GuestStackParamList,
  T
>

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<LearnStackParamList & WordsStackParamList & ProgressStackParamList>
>
