import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { CompletionSummary } from '../../api/types'
import { Pitsi } from '../../components/Pitsi'
import { Icon } from '../../components/Icon'
import { Button, Kicker, Screen } from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'

type Props = {
  summary: CompletionSummary
  lessonTitle: string
  nextLessonId: string | null
  onBack: () => void
  onNext: () => void
  onSignUp?: () => void
}

export function CompleteScreen({ summary, lessonTitle, nextLessonId, onBack, onNext, onSignUp }: Props) {
  const guest = summary.needsAccount

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.confettiRow} pointerEvents="none">
        <View style={[styles.confetti, { backgroundColor: colors.coral, transform: [{ rotate: '28deg' }] }]} />
        <View style={[styles.confetti, { backgroundColor: colors.gold, transform: [{ rotate: '-18deg' }] }]} />
        <View style={[styles.confetti, { backgroundColor: colors.blue, transform: [{ rotate: '65deg' }] }]} />
      </View>

      <View style={styles.main}>
        <Kicker>Lesson complete</Kicker>
        <View style={styles.mascot}>
          <Pitsi state="celebrate" size={190} />
        </View>
        <Text style={[type.displayXL, styles.title]}>O dirile sentle!</Text>
        <Text style={[type.bodySmall, styles.body]}>
          You completed <Text style={{ fontFamily: fonts.bodyBold }}>{lessonTitle}</Text>
          {summary.newWords > 0 ? ` and met ${summary.newWords} new words.` : '.'}
        </Text>

        <View style={styles.rewards}>
          <View style={styles.reward}>
            <View style={[styles.rewardIcon, { backgroundColor: colors.infoTint }]}>
              <Icon name="bolt" size={20} color={colors.blueDark} />
            </View>
            <View>
              <Text style={styles.rewardValue}>+{summary.xpAwarded}</Text>
              <Text style={styles.rewardLabel}>XP earned</Text>
            </View>
          </View>
          {summary.streak !== null ? (
            <View style={styles.reward}>
              <View style={[styles.rewardIcon, { backgroundColor: colors.streakTint }]}>
                <Icon name="flame" size={20} color={colors.streakText} />
              </View>
              <View>
                <Text style={styles.rewardValue}>{summary.streak} day{summary.streak === 1 ? '' : 's'}</Text>
                <Text style={styles.rewardLabel}>Current streak</Text>
              </View>
            </View>
          ) : null}
        </View>

        {guest ? (
          <View style={styles.guestNote}>
            <Text style={[type.label, { color: colors.blueDark }]}>Keep what you learned</Text>
            <Text style={[type.caption, { color: colors.muted }]}>
              Create an account and this lesson, your XP and your streak move with you.
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {guest && onSignUp ? <Button label="Save my progress" onPress={onSignUp} /> : null}
        {!guest && nextLessonId ? (
          <Button label="Next lesson" onPress={onNext} />
        ) : null}
        <Button
          label="Back to my path"
          variant={guest || nextLessonId ? 'secondary' : 'primary'}
          onPress={onBack}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between', paddingBottom: spacing.xxl, paddingTop: spacing.xl },
  confettiRow: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confetti: { width: 9, height: 18, borderRadius: 5 },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  mascot: { marginVertical: spacing.sm },
  title: { textAlign: 'center', color: colors.ink },
  body: { textAlign: 'center', color: colors.muted, maxWidth: 300 },
  rewards: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, alignSelf: 'stretch' },
  reward: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  rewardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardValue: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  rewardLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted },
  guestNote: {
    marginTop: spacing.lg,
    backgroundColor: colors.infoTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
    alignSelf: 'stretch',
  },
  actions: { gap: spacing.sm, alignSelf: 'stretch' },
})
