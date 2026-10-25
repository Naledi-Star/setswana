import React, { useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import type { AnswerFeedback, CompletionSummary, StartAttemptResponse } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { Pitsi } from '../../components/Pitsi'
import { Icon } from '../../components/Icon'
import {
  Button,
  ErrorState,
  FeedbackFooter,
  Hearts,
  IconButton,
  Kicker,
  LoadingView,
  ProgressBar,
  Screen,
} from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import { haptics } from '../../lib/haptics'
import { ExerciseRenderer } from './Exercises'

type Props = {
  lessonId: string
  onExit: () => void
  onComplete: (summary: CompletionSummary, lessonTitle: string, nextLessonId: string | null) => void
  onReviewWords?: () => void
}

function correctAnswerText(answer: Record<string, unknown>): string {
  if (typeof answer.text === 'string' && answer.text) return answer.text
  if (Array.isArray(answer.pairs)) {
    return answer.pairs
      .map((pair) => {
        const entry = pair as Record<string, unknown>
        return `${String(entry.setswana ?? '')} — ${String(entry.english ?? '')}`
      })
      .join('\n')
  }
  if (typeof answer.setswana === 'string' && typeof answer.english === 'string') {
    return `${answer.setswana} — ${answer.english}`
  }
  return ''
}

export function LessonScreen({ lessonId, onExit, onComplete, onReviewWords }: Props) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { applyStats } = useAuth()

  const lessonQuery = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api.lesson(lessonId) })

  const [attempt, setAttempt] = useState<StartAttemptResponse | null>(null)
  const [startError, setStartError] = useState<ApiError | null>(null)
  const [index, setIndex] = useState(0)
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [hearts, setHearts] = useState(3)
  const [heartsMax, setHeartsMax] = useState(5)
  const [finishing, setFinishing] = useState(false)
  const [outOfHearts, setOutOfHearts] = useState(false)

  useEffect(() => {
    let cancelled = false
    setStartError(null)

    api
      .startLesson(lessonId)
      .then((started) => {
        if (cancelled) return
        setAttempt(started)
        setHearts(started.hearts.remaining)
        setHeartsMax(started.hearts.max)
        if (started.hearts.remaining <= 0) setOutOfHearts(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError) {
          setStartError(error)
          if (error.code === 'HEARTS_EMPTY') setOutOfHearts(true)
        } else {
          setStartError(new ApiError(0, 'INTERNAL', 'Could not start this lesson.'))
        }
      })

    return () => {
      cancelled = true
    }
  }, [lessonId])

  const exercises = lessonQuery.data?.exercises ?? []
  const exercise = exercises[index]
  const total = exercises.length

  const progress = useMemo(() => {
    if (feedback) return feedback.progress.answered / Math.max(1, feedback.progress.total)
    return index / Math.max(1, total)
  }, [feedback, index, total])

  const leave = () => {
    Alert.alert('Leave lesson?', 'Your answers so far are saved, but the lesson stays unfinished.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          if (attempt) void api.abandonAttempt(attempt.attemptId).catch(() => undefined)
          onExit()
        },
      },
    ])
  }

  const submit = async (answer: unknown) => {
    if (!attempt || !exercise || feedback || submitting) return
    setSubmitting(true)
    try {
      const result = await api.answer(
        attempt.attemptId,
        { exerciseId: exercise.id, answer },
        `ans-${attempt.attemptId}-${exercise.id}-${retryKey}-${Date.now()}`,
      )
      setFeedback(result)
      setHearts(result.hearts.remaining)
      setHeartsMax(result.hearts.max)
      if (result.isCorrect) haptics.success()
      else if (!result.skipped) haptics.warning()
      if (result.hearts.remaining <= 0) setOutOfHearts(true)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'HEARTS_EMPTY') {
        setOutOfHearts(true)
      } else {
        Alert.alert('Answer not saved', error instanceof ApiError ? error.message : 'Try again in a moment.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const finish = async () => {
    if (!attempt) return
    setFinishing(true)
    try {
      const summary = await api.completeAttempt(attempt.attemptId)
      applyStats({
        totalXp: summary.totalXp,
        ...(summary.streak !== null ? { currentStreak: summary.streak } : {}),
        ...(summary.hearts ? { hearts: summary.hearts.remaining, heartsMax: summary.hearts.max } : {}),
      })
      await queryClient.invalidateQueries({ queryKey: ['path'] })
      await queryClient.invalidateQueries({ queryKey: ['progress'] })
      await queryClient.invalidateQueries({ queryKey: ['words'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      await queryClient.invalidateQueries({ queryKey: ['guest-next'] })
      onComplete(summary, lessonQuery.data?.title ?? 'this lesson', summary.nextLessonId)
    } catch (error) {
      Alert.alert('Could not finish', error instanceof ApiError ? error.message : 'Try again in a moment.')
    } finally {
      setFinishing(false)
    }
  }

  const advance = () => {
    if (!feedback) return
    if (!feedback.isCorrect && !feedback.skipped) {
      setFeedback(null)
      setRetryKey((current) => current + 1)
      return
    }
    if (index + 1 < total) {
      setIndex(index + 1)
      setFeedback(null)
      setRetryKey(0)
      return
    }
    void finish()
  }

  if (outOfHearts) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <View style={styles.heartsEmpty}>
          <Pitsi size={160} />
          <Kicker>Hearts refill over time</Kicker>
          <Text style={[type.display, styles.center]}>Out of hearts</Text>
          <Text style={[type.bodySmall, styles.center, { color: colors.muted }]}>
            Take a breath. Your hearts come back on their own, and reviewing words is free.
          </Text>
          {onReviewWords ? (
            <Button
              label="Review words instead"
              onPress={() => {
                if (attempt) void api.abandonAttempt(attempt.attemptId).catch(() => undefined)
                onReviewWords()
              }}
              style={styles.fullWidth}
            />
          ) : null}
          <Button
            label="Back to my path"
            variant="secondary"
            onPress={() => {
              if (attempt) void api.abandonAttempt(attempt.attemptId).catch(() => undefined)
              onExit()
            }}
            style={styles.fullWidth}
          />
        </View>
      </Screen>
    )
  }

  if (lessonQuery.isPending || (!attempt && !startError)) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <LoadingView label="Setting up your lesson…" />
      </Screen>
    )
  }

  if (startError && !attempt) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <ErrorState message={startError.message} onRetry={onExit} />
      </Screen>
    )
  }

  if (!exercise) {
    return (
      <Screen scroll={false} contentStyle={styles.centered}>
        <ErrorState message="This lesson has no exercises yet." onRetry={onExit} />
      </Screen>
    )
  }

  const feedbackState: 'correct' | 'wrong' | 'neutral' = !feedback
    ? 'neutral'
    : feedback.isCorrect
      ? 'correct'
      : feedback.skipped
        ? 'neutral'
        : 'wrong'

  const feedbackTitle = !feedback
    ? 'Answer to continue'
    : feedback.skipped
      ? 'Skipped'
      : feedback.isCorrect
        ? 'Go siame!'
        : 'Almost!'

  const feedbackBody = !feedback
    ? 'Tap an answer, type it, or check yourself.'
    : feedback.skipped
      ? 'No heart lost. This one will come back later.'
      : feedback.isCorrect
        ? feedback.explanation ?? 'That’s correct.'
        : `${correctAnswerText(feedback.correctAnswer)}${
            feedback.explanation ? `\n${feedback.explanation}` : ''
          }`

  const isLast = index + 1 >= total
  const wrongRetry = Boolean(feedback && !feedback.isCorrect && !feedback.skipped)

  return (
    <Screen
      scroll={false}
      contentStyle={styles.content}
      footer={
        <View style={{ paddingBottom: Math.max(insets.bottom, spacing.md) }}>
          <FeedbackFooter
            state={feedbackState}
            title={feedbackTitle}
            body={feedbackBody}
            actionLabel={
              !feedback
                ? 'Continue'
                : wrongRetry
                  ? 'Try again'
                  : isLast
                    ? 'Finish'
                    : 'Continue'
            }
            onAction={feedback ? advance : () => undefined}
            disabled={!feedback || finishing || submitting}
          />
        </View>
      }
    >
      <View style={styles.header}>
        <IconButton icon="close" label="Exit lesson" onPress={leave} />
        <ProgressBar value={progress} />
        <View style={styles.hearts}>
          <Icon name="heart" size={18} color={colors.coral} filled />
          <Text style={styles.heartsText}>{hearts}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.counter}>
          Question {index + 1} of {total}
        </Text>
        <Text style={styles.title}>{exerciseTitle(exercise.type)}</Text>

        <View key={`${exercise.id}-${retryKey}`}>
          <ExerciseRenderer exercise={exercise} disabled={Boolean(feedback) || submitting} onAnswer={submit} />
        </View>
      </View>
    </Screen>
  )
}

function exerciseTitle(exerciseType: string): string {
  switch (exerciseType) {
    case 'TRANSLATE_MC':
      return 'Translate this phrase'
    case 'MATCH_PAIRS':
      return 'Match the pairs'
    case 'FILL_BLANK':
      return 'Fill in the blank'
    case 'LISTEN_CHOOSE':
      return 'Listen and choose'
    case 'TYPE_ANSWER':
      return 'Type the answer'
    case 'BUILD_SENTENCE':
      return 'Build the sentence'
    case 'SPEAK':
      return 'Say it out loud'
    case 'REVIEW_CARD':
      return 'Do you remember?'
    default:
      return 'Practise'
  }
}

const styles = StyleSheet.create({
  content: { paddingBottom: 0 },
  centered: { justifyContent: 'center', alignItems: 'stretch' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  hearts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heartsText: { fontFamily: fonts.displayBlack, fontSize: 14, color: colors.coral },
  body: { paddingTop: spacing.lg, gap: spacing.md, flex: 1 },
  counter: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.blueDark,
  },
  title: {
    fontFamily: fonts.displayBlack,
    fontSize: 26,
    letterSpacing: -0.8,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  heartsEmpty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  center: { textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch', marginTop: spacing.sm },
})
