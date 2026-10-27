import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import type { LessonGuide } from '../../api/types'
import {
  Button,
  Card,
  ErrorState,
  IconButton,
  Kicker,
  LoadingView,
  Screen,
} from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import type { LessonsScreenProps } from '../../navigation/types'

export function LessonGuideScreen({ route, navigation }: LessonsScreenProps<'LessonGuide'>) {
  const { lessonId } = route.params
  const insets = useSafeAreaInsets()
  const lessonQuery = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api.lesson(lessonId) })
  const lesson = lessonQuery.data
  const guide: LessonGuide | null = lesson?.guide ?? null

  const practise = () => navigation.navigate('Lesson', { lessonId })

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Button
            label={lesson ? `Practise · ${lesson.exercises.length} exercises` : 'Practise'}
            onPress={practise}
            disabled={!lesson}
          />
        </View>
      }
    >
      <View style={styles.topBar}>
        <IconButton icon="chevronLeft" label="Back to lessons" onPress={() => navigation.goBack()} />
      </View>

      <Kicker>{lesson?.unit.title ?? 'Lesson'}</Kicker>
      <Text style={[type.display, styles.title]}>{lesson?.title ?? 'Lesson'}</Text>
      {lesson?.subtitle ? (
        <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4 }]}>{lesson.subtitle}</Text>
      ) : null}

      {lessonQuery.isPending ? <LoadingView label="Opening the lesson…" /> : null}

      {lessonQuery.isError ? (
        <ErrorState
          message={
            lessonQuery.error instanceof ApiError
              ? lessonQuery.error.message
              : 'Could not open this lesson.'
          }
          onRetry={() => void lessonQuery.refetch()}
        />
      ) : null}

      {guide
        ? guide.sections.map((section) => (
            <Card key={section.heading} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              {section.rows.map((row, index) => (
                <View key={`${row.setswana}-${index}`} style={[styles.row, index > 0 && styles.rowDivider]}>
                  <View style={styles.rowTop}>
                    <Text style={styles.setswana}>{row.setswana}</Text>
                    {row.pronunciation ? (
                      <Text style={styles.pronunciation}>{row.pronunciation}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.english}>{row.english}</Text>
                  {row.sample ? <Text style={styles.sample}>Say it: {row.sample}</Text> : null}
                </View>
              ))}
            </Card>
          ))
        : null}

      {guide?.tips ? (
        <Card style={styles.section}>
          <Text style={styles.sectionHeading}>{guide.tips.heading}</Text>
          {guide.tips.items.map((tip) => (
            <View key={tip} style={styles.tipRow}>
              <View style={styles.tipDot} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      {lesson && !guide ? (
        <Text style={[type.bodySmall, { color: colors.muted, marginTop: spacing.lg }]}>
          This lesson has no reference notes yet — practise it below.
        </Text>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.md },
  title: { marginTop: 2 },
  section: { marginTop: spacing.lg, gap: spacing.sm },
  sectionHeading: {
    fontFamily: fonts.display,
    fontSize: 17,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  row: { paddingVertical: spacing.sm },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  setswana: {
    fontFamily: fonts.displayBlack,
    fontSize: 19,
    color: colors.navy,
    letterSpacing: -0.3,
  },
  pronunciation: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  english: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink, marginTop: 2 },
  sample: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.blueDark,
    marginTop: 4,
    backgroundColor: colors.infoTint,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  tipRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.orange,
    marginTop: 7,
  },
  tipText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
})
