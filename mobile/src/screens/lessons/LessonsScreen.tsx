import React, { useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import type { PathLesson, PathUnit } from '../../api/types'
import { Icon } from '../../components/Icon'
import { BrandHeader, Button, Card, Kicker, LoadingView, Screen, styles as ui } from '../../components/ui'
import { colors, radius, spacing, type } from '../../design/tokens'
import type { LessonsStackParamList } from '../../navigation/types'

type Nav = NativeStackNavigationProp<LessonsStackParamList>

const unitTint: Record<string, string> = {
  blue: colors.blue,
  coral: colors.coral,
  gold: colors.gold,
  green: colors.green,
}

export function LessonsScreen() {
  const navigation = useNavigation<Nav>()
  const pathQuery = useQuery({ queryKey: ['path'], queryFn: api.path })

  const numbering = useMemo(() => {
    const numbers = new Map<string, number>()
    let index = 0
    for (const unit of pathQuery.data?.units ?? []) {
      for (const lesson of unit.lessons) {
        index += 1
        numbers.set(lesson.id, index)
      }
    }
    return numbers
  }, [pathQuery.data])

  return (
    <Screen contentStyle={styles.content}>
      <BrandHeader />

      <View style={styles.heading}>
        <Kicker>Lessons</Kicker>
        <Text style={[type.display, { marginTop: 2 }]}>Read it, then practise it</Text>
        <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4 }]}>
          Open a lesson to see its words and how to use them, then run the exercises.
        </Text>
      </View>

      {pathQuery.isPending ? <LoadingView label="Loading lessons…" /> : null}

      {pathQuery.isError ? (
        <Card>
          <Text style={[type.bodySmall, { color: colors.errorText }]}>
            {pathQuery.error instanceof ApiError ? pathQuery.error.message : 'Could not load the lessons.'}
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void pathQuery.refetch()}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      {pathQuery.data ? (
        <View style={styles.list}>
          {pathQuery.data.units.map((unit) => (
            <UnitBlock
              key={unit.id}
              unit={unit}
              numbering={numbering}
              onOpen={(lessonId) => navigation.navigate('LessonGuide', { lessonId })}
            />
          ))}
        </View>
      ) : null}

      <Text style={[type.caption, styles.foot]}>
        Progress is saved on the server, so you can come back any time.
      </Text>
    </Screen>
  )
}

function UnitBlock({
  unit,
  numbering,
  onOpen,
}: {
  unit: PathUnit
  numbering: Map<string, number>
  onOpen: (lessonId: string) => void
}) {
  const tint = unitTint[unit.colour] ?? colors.blue
  const locked = unit.state === 'locked'

  return (
    <View style={styles.unit}>
      <View style={styles.unitHeader}>
        <View style={[styles.unitBadge, { backgroundColor: tint }]}>
          <Icon name={locked ? 'lock' : 'book'} size={18} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: colors.muted }]}>{unit.titleEn}</Text>
          <Text style={[type.title, { color: locked ? colors.muted : colors.ink }]}>{unit.title}</Text>
        </View>
        {unit.state === 'done' ? <Icon name="check" size={20} color={colors.green} /> : null}
      </View>

      <View style={styles.lessons}>
        {unit.lessons.map((lesson) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            number={numbering.get(lesson.id) ?? 0}
            tint={tint}
            onOpen={onOpen}
          />
        ))}
      </View>
    </View>
  )
}

function LessonCard({
  lesson,
  number,
  tint,
  onOpen,
}: {
  lesson: PathLesson
  number: number
  tint: string
  onOpen: (lessonId: string) => void
}) {
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Lesson ${number}: ${lesson.title}${locked ? ', locked' : done ? ', complete' : ''}`}
      disabled={locked}
      onPress={() => onOpen(lesson.id)}
      style={({ pressed }) => [
        ui.card,
        styles.lessonCard,
        locked && styles.lessonCardLocked,
        pressed && !locked && { transform: [{ translateY: -2 }] },
      ]}
    >
      <View style={[styles.node, { backgroundColor: done ? colors.green : locked ? '#d9dfdc' : tint }]}>
        <Icon
          name={done ? 'check' : locked ? 'lock' : 'arrow'}
          size={16}
          color={locked ? '#94a09b' : colors.white}
        />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[type.caption, { color: colors.muted }]}>Lesson {number}</Text>
        <Text style={[type.subtitle, { color: locked ? colors.muted : colors.ink, marginTop: 2 }]}>
          {lesson.title}
        </Text>
        {lesson.subtitle ? (
          <Text style={[type.caption, { color: colors.muted }]}>{lesson.subtitle}</Text>
        ) : null}
        <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
          {done ? 'Completed' : `${lesson.exerciseCount} exercises`}
        </Text>
      </View>

      <Icon name="arrow" size={18} color={locked ? '#b9c2bf' : colors.blueDark} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge },
  heading: { marginTop: spacing.xxl, marginBottom: spacing.lg },
  list: { gap: spacing.xl },
  unit: { gap: spacing.md },
  unitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  unitBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessons: { gap: spacing.md },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  lessonCardLocked: { opacity: 0.55 },
  node: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foot: { color: colors.muted, textAlign: 'center', marginTop: spacing.xxl },
})
