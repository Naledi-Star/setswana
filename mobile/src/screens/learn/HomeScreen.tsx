import React, { useCallback } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import type { PathLesson, PathUnit } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { Pitsi } from '../../components/Pitsi'
import { BrandHeader, Button, Card, IconButton, Kicker, LoadingView, Screen, StatChip, styles as ui } from '../../components/ui'
import { colors, radius, spacing, type } from '../../design/tokens'
import { useConfig } from '../../lib/useConfig'
import type { LearnStackParamList } from '../../navigation/types'
import { Icon } from '../../components/Icon'

type Nav = NativeStackNavigationProp<LearnStackParamList>

const unitTint: Record<string, string> = {
  blue: colors.blue,
  coral: colors.coral,
  gold: colors.gold,
  green: colors.green,
}

export function HomeScreen() {
  const { user, stats, dateLabel, status, refreshMe } = useAuth()
  const navigation = useNavigation<Nav>()
  const queryClient = useQueryClient()
  const { data: config } = useConfig()
  const isGuest = status === 'guest'

  const pathQuery = useQuery({
    queryKey: ['path'],
    queryFn: api.path,
    enabled: !isGuest,
  })

  const guestLessonQuery = useQuery({
    queryKey: ['guest-next'],
    queryFn: api.guestNextLesson,
    enabled: isGuest,
  })

  const guestNavigation = useNavigation<any>()

  useFocusEffect(
    useCallback(() => {
      void refreshMe()
      if (!isGuest) void pathQuery.refetch()
      else void guestLessonQuery.refetch()
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  )

  const openLesson = (lessonId: string) => navigation.navigate('Lesson', { lessonId })

  const startGuestLesson = async () => {
    try {
      const lesson = guestLessonQuery.data ?? (await guestLessonQuery.refetch()).data
      if (lesson) openLesson(lesson.id)
    } catch (error) {
      Alert.alert('Not ready', error instanceof ApiError ? error.message : 'Try again shortly.')
    }
  }

  const dailyGoal = stats?.dailyGoal ?? config?.defaultDailyGoal ?? 5
  const doneToday = stats?.lessonsToday ?? 0

  return (
    <Screen
      contentStyle={styles.content}
      footer={undefined}
    >
      <BrandHeader
        right={
          <View style={styles.headerRight}>
            {!isGuest ? (
              <>
                <StatChip icon="flame" value={stats?.currentStreak ?? 0} tone="streak" />
                <StatChip icon="bolt" value={stats?.totalXp ?? 0} />
              </>
            ) : null}
            {!isGuest ? (
              <IconButton
                icon="settings"
                label="Settings"
                tone="blue"
                onPress={() => navigation.navigate('Settings')}
              />
            ) : null}
          </View>
        }
      />

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroDate}>{dateLabel ?? 'Dumela'}</Text>
          <Text style={styles.heroTitle}>
            {isGuest ? 'Dumela, learner!' : `Dumela, ${user?.displayName?.split(' ')[0] ?? 'learner'}!`}
          </Text>
          <Text style={styles.heroBody}>
            {isGuest
              ? 'Your first Setswana lesson is on the house. Progress carries over when you sign up.'
              : 'Pitsi is ready for today’s lesson.'}
          </Text>
        </View>
        <View style={styles.heroMascot}>
          <Pitsi size={130} />
        </View>
      </View>

      {isGuest ? (
        <Card style={styles.guestCard}>
          <View style={styles.guestRow}>
            <View style={styles.guestIcon}>
              <Icon name="lock" size={20} color={colors.blueDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.subtitle, { color: colors.ink }]}>One free lesson</Text>
              <Text style={[type.caption, { color: colors.muted }]}>
                {config?.guestLessons ?? 1} lesson before you need an account.
              </Text>
            </View>
          </View>
          <Button
            label={guestLessonQuery.isPending ? 'Finding your lesson…' : 'Start my free lesson'}
            onPress={() => void startGuestLesson()}
            disabled={guestLessonQuery.isPending || !guestLessonQuery.data}
            style={{ marginTop: spacing.md }}
          />
          <Button
            label="Create an account"
            variant="ghost"
            onPress={() => guestNavigation.navigate('GuestSignUp')}
          />
        </Card>
      ) : (
        <Card style={styles.goalCard}>
          <View style={styles.goalTop}>
            <View style={styles.goalIcon}>
              <Icon name="bolt" size={20} color={colors.goldText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: colors.ink }]}>Daily goal</Text>
              <Text style={[type.caption, { color: colors.muted }]}>
                {doneToday} of {dailyGoal} lessons
              </Text>
            </View>
            <View style={styles.goalDots} accessibilityLabel={`${doneToday} of ${dailyGoal} lessons complete`}>
              {Array.from({ length: dailyGoal }).map((_, index) => (
                <View key={index} style={[styles.goalDot, index < doneToday && styles.goalDotDone]} />
              ))}
            </View>
          </View>
        </Card>
      )}

      {!isGuest ? (
        <View style={styles.pathHeading}>
          <View>
            <Kicker>Your learning path</Kicker>
            <Text style={[type.title, { marginTop: 2 }]}>
              {pathQuery.data?.units[0]?.titleEn ?? 'Basics of conversation'}
            </Text>
          </View>
          <IconButton
            icon="book"
            label="Refresh path"
            tone="blue"
            onPress={() => void pathQuery.refetch()}
          />
        </View>
      ) : null}

      {!isGuest && pathQuery.isPending ? <LoadingView label="Loading your path…" /> : null}
      {!isGuest && pathQuery.isError ? (
        <Card>
          <Text style={[type.bodySmall, { color: colors.errorText }]}>
            {pathQuery.error instanceof ApiError ? pathQuery.error.message : 'Could not load your path.'}
          </Text>
          <Button
            label="Try again"
            variant="secondary"
            onPress={() => void pathQuery.refetch()}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : null}

      {!isGuest && pathQuery.data ? (
        <View style={styles.pathList}>
          {pathQuery.data.units.map((unit, unitIndex) => (
            <UnitSection
              key={unit.id}
              unit={unit}
              onOpen={openLesson}
              isLast={unitIndex === pathQuery.data!.units.length - 1}
            />
          ))}
        </View>
      ) : null}

      {isGuest ? (
        <Text style={[type.caption, styles.guestFoot]}>
          Puo needs a connection. Lessons and progress live on the server.
        </Text>
      ) : null}
    </Screen>
  )
}

function UnitSection({
  unit,
  onOpen,
  isLast,
}: {
  unit: PathUnit
  onOpen: (lessonId: string) => void
  isLast: boolean
}) {
  const tint = unitTint[unit.colour] ?? colors.blue

  return (
    <View style={styles.unit}>
      <View style={styles.unitHeader}>
        <View style={[styles.unitBadge, { backgroundColor: tint }]}>
          <Icon name={unit.state === 'locked' ? 'lock' : 'book'} size={18} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: colors.muted }]}>{unit.titleEn}</Text>
          <Text style={[type.title, { color: unit.state === 'locked' ? colors.muted : colors.ink }]}>
            {unit.title}
          </Text>
        </View>
        {unit.state === 'done' ? <Icon name="check" size={20} color={colors.green} /> : null}
      </View>

      <View style={styles.lessons}>
        {unit.lessons.map((lesson, index) => (
          <LessonRow
            key={lesson.id}
            lesson={lesson}
            tint={tint}
            last={index === unit.lessons.length - 1}
            onOpen={onOpen}
          />
        ))}
      </View>
      {!isLast ? <View style={styles.unitDivider} /> : null}
    </View>
  )
}

function LessonRow({
  lesson,
  tint,
  last,
  onOpen,
}: {
  lesson: PathLesson
  tint: string
  last: boolean
  onOpen: (lessonId: string) => void
}) {
  const locked = lesson.state === 'locked'
  const done = lesson.state === 'done'
  const active = lesson.state === 'active'

  return (
    <View style={styles.lessonRow}>
      <View style={styles.nodeColumn}>
        <View
          style={[
            styles.node,
            { backgroundColor: done ? colors.green : locked ? '#d9dfdc' : tint },
            active && styles.nodeActive,
          ]}
        >
          <Icon
            name={done ? 'check' : locked ? 'lock' : 'arrow'}
            size={18}
            color={locked ? '#94a09b' : colors.white}
          />
        </View>
        {!last ? <View style={styles.connector} /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${lesson.title}${locked ? ', locked' : done ? ', complete' : ''}`}
        disabled={locked}
        onPress={() => onOpen(lesson.id)}
        style={({ pressed }) => [
          ui.card,
          styles.lessonCard,
          locked && styles.lessonCardLocked,
          pressed && !locked && { transform: [{ translateY: -2 }] },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: colors.muted }]}>
            {done ? 'Completed' : `${lesson.exerciseCount} exercises`}
          </Text>
          <Text style={[type.subtitle, { color: locked ? colors.muted : colors.ink, marginTop: 2 }]}>
            {lesson.title}
          </Text>
          {lesson.subtitle ? (
            <Text style={[type.caption, { color: colors.muted }]}>{lesson.subtitle}</Text>
          ) : null}
        </View>
        {active ? (
          <View style={styles.startPill}>
            <Text style={styles.startLabel}>Start</Text>
          </View>
        ) : (
          <Icon name="arrow" size={18} color={locked ? '#b9c2bf' : colors.blueDark} />
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  heroCopy: { flex: 1, gap: 6, paddingRight: spacing.sm },
  heroDate: {
    color: '#91bed0',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'DMSans_700Bold',
  },
  heroTitle: {
    fontFamily: 'Nunito_900Black',
    fontSize: 24,
    color: colors.white,
    letterSpacing: -0.6,
  },
  heroBody: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 17, color: '#b9c9cf' },
  heroMascot: { width: 118, height: 130, alignSelf: 'flex-end', marginBottom: -26, marginRight: -10 },
  goalCard: { marginTop: spacing.md, paddingVertical: spacing.md },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.goldTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalDots: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', maxWidth: 90, justifyContent: 'flex-end' },
  goalDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#dde3df' },
  goalDotDone: { backgroundColor: colors.green },
  guestCard: { marginTop: spacing.md, gap: spacing.xs },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  guestIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.infoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  pathList: { gap: spacing.md },
  unit: { gap: spacing.md },
  unitHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  unitBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessons: { gap: 0 },
  lessonRow: { flexDirection: 'row', gap: spacing.md },
  nodeColumn: { alignItems: 'center', width: 42 },
  node: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  nodeActive: {
    shadowColor: colors.coral,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  connector: { flex: 1, width: 3, backgroundColor: '#dce2de', marginVertical: 4 },
  lessonCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },
  lessonCardLocked: { opacity: 0.55 },
  startPill: {
    backgroundColor: colors.errorTint,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  startLabel: { fontFamily: 'Nunito_800ExtraBold', fontSize: 11, color: colors.coral, textTransform: 'uppercase' },
  unitDivider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  guestFoot: { color: colors.muted, textAlign: 'center', marginTop: spacing.xxl },
})
