import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import Svg, { Circle } from 'react-native-svg'
import { api, ApiError } from '../../api/client'
import { Icon } from '../../components/Icon'
import { ErrorState, Kicker, LoadingView, Screen } from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function weekday(dateString: string): string {
  const date = new Date(`${dateString}T00:00:00.000Z`)
  return WEEKDAYS[date.getUTCDay()] ?? ''
}

function Ring({ progress, label, sublabel }: { progress: number; label: string; sublabel: string }) {
  const size = 118
  const stroke = 10
  const radiusValue = (size - stroke) / 2
  const circumference = 2 * Math.PI * radiusValue
  const clamped = Math.min(1, Math.max(0, progress))

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke={colors.gold}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{label}</Text>
        <Text style={styles.ringLabel}>{sublabel}</Text>
      </View>
    </View>
  )
}

export function ProgressScreen() {
  const query = useQuery({ queryKey: ['progress'], queryFn: api.progress })

  return (
    <Screen>
      <Kicker>This week</Kicker>
      <Text style={[type.displayXL, { marginTop: 4 }]}>Your progress</Text>

      {query.isPending ? <LoadingView label="Counting your lessons…" /> : null}
      {query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Could not load your progress.'}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.data ? (
        <>
          <View style={styles.hero}>
            <Ring
              progress={query.data.lessonsThisWeek / 15}
              label={String(query.data.lessonsThisWeek)}
              sublabel="lessons"
            />
            <View style={styles.heroCopy}>
              <Text style={styles.heroKicker}>
                {query.data.currentStreak > 0 ? 'Great rhythm' : 'A fresh start'}
              </Text>
              <Text style={styles.heroTitle}>
                {query.data.currentStreak > 0
                  ? 'You’re building a strong habit.'
                  : 'One lesson is all it takes to begin.'}
              </Text>
              <Text style={styles.heroBody}>
                {query.data.currentStreak > 0
                  ? `${query.data.currentStreak}-day streak · longest ${query.data.longestStreak}`
                  : 'Finish a lesson today to start your streak.'}
              </Text>
            </View>
          </View>

          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <Text style={[type.subtitle, { color: colors.ink }]}>Daily XP</Text>
              <Text style={[type.caption, { color: colors.muted }]}>Last 7 days</Text>
            </View>
            <View style={styles.chart}>
              {query.data.week.map((day) => {
                const maxXp = Math.max(...query.data!.week.map((entry) => entry.xp), 10)
                const height = Math.max(6, Math.round((day.xp / maxXp) * 100))
                return (
                  <View key={day.localDate} style={styles.barColumn}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${height}%`,
                            backgroundColor: day.lessons > 0 ? colors.blue : '#e0e5e2',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{weekday(day.localDate)}</Text>
                  </View>
                )
              })}
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat icon="bolt" tint={colors.infoTint} ink={colors.blueDark} value={`${query.data.totalXp}`} label="Total XP" />
            <Stat icon="trophy" tint={colors.errorTint} ink={colors.coral} value={`${query.data.accuracy}%`} label="Accuracy" />
            <Stat icon="flame" tint={colors.streakTint} ink={colors.streakText} value={`${query.data.currentStreak}`} label="Streak" />
          </View>

          <View style={styles.wordsCard}>
            <Text style={[type.subtitle, { color: colors.ink }]}>Words</Text>
            <View style={styles.wordStats}>
              <WordCount value={query.data.wordsKnown} label="known" tint={colors.successText} />
              <WordCount value={query.data.wordsLearning} label="learning" tint={colors.blueDark} />
              <WordCount value={query.data.wordsNew} label="new" tint={colors.muted} />
            </View>
            <Text style={[type.caption, { color: colors.muted }]}>
              {query.data.lessonsCompleted} lesson{query.data.lessonsCompleted === 1 ? '' : 's'} completed so far.
            </Text>
          </View>
        </>
      ) : null}
    </Screen>
  )
}

function Stat({
  icon,
  tint,
  ink,
  value,
  label,
}: {
  icon: 'bolt' | 'trophy' | 'flame'
  tint: string
  ink: string
  value: string
  label: string
}) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={20} color={ink} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function WordCount({ value, label, tint }: { value: number; label: string; tint: string }) {
  return (
    <View style={styles.wordCount}>
      <Text style={[styles.wordCountValue, { color: tint }]}>{value}</Text>
      <Text style={styles.wordCountLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.navy,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  ringWrap: { width: 118, height: 118, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringValue: { fontFamily: fonts.displayBlack, fontSize: 26, color: colors.white },
  ringLabel: { fontFamily: fonts.body, fontSize: 9, color: '#9eb5c0', textTransform: 'uppercase', letterSpacing: 0.8 },
  heroCopy: { flex: 1, gap: 4 },
  heroKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.gold,
  },
  heroTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.white, lineHeight: 21 },
  heroBody: { fontFamily: fonts.body, fontSize: 11, color: '#9eb5c0' },
  chartCard: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chart: {
    flexDirection: 'row',
    height: 130,
    gap: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'flex-end',
  },
  barColumn: { flex: 1, alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 14, borderRadius: 7, minHeight: 6 },
  barLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 3,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  statLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  wordsCard: {
    marginTop: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  wordStats: { flexDirection: 'row', gap: spacing.xl, marginVertical: spacing.xs },
  wordCount: { gap: 1 },
  wordCountValue: { fontFamily: fonts.displayBlack, fontSize: 22 },
  wordCountLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
})
