import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { AudioButton } from '../../components/AudioButton'
import { Icon } from '../../components/Icon'
import { Pitsi } from '../../components/Pitsi'
import {
  Button,
  EmptyState,
  ErrorState,
  IconButton,
  Kicker,
  LoadingView,
  ProgressBar,
  Screen,
} from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import { haptics } from '../../lib/haptics'
import type { WordsScreenProps } from '../../navigation/types'

export function ReviewScreen({ navigation }: WordsScreenProps<'Review'>) {
  const { refreshMe } = useAuth()
  const queryClient = useQueryClient()
  const queueQuery = useQuery({ queryKey: ['review'], queryFn: api.reviewQueue })
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [xp, setXp] = useState(0)
  const [practised, setPractised] = useState(0)
  const [finished, setFinished] = useState(false)

  const items = queueQuery.data?.items ?? []
  const item = items[index]

  const mark = async (selfMark: 'again' | 'good' | 'easy') => {
    if (!item || busy) return
    setBusy(true)
    try {
      const result = await api.reviewAnswer(item.wordId, selfMark)
      setXp((current) => current + result.xpAwarded)
      setPractised((current) => current + 1)
      if (selfMark === 'again') haptics.warning()
      else haptics.success()
      if (index + 1 < items.length) {
        setIndex(index + 1)
        setRevealed(false)
      } else {
        setFinished(true)
      }
      void refreshMe()
      await queryClient.invalidateQueries({ queryKey: ['words'] })
      await queryClient.invalidateQueries({ queryKey: ['review'] })
      await queryClient.invalidateQueries({ queryKey: ['progress'] })
    } catch {
      haptics.warning()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen scroll={false} contentStyle={styles.content}>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" label="Back to words" onPress={() => navigation.goBack()} />
        <Text style={[type.label, { color: colors.muted }]}>
          {finished ? 'Session complete' : `${Math.min(index + 1, items.length)} of ${items.length}`}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {queueQuery.isPending ? <LoadingView label="Finding words to review…" /> : null}
      {queueQuery.isError ? (
        <ErrorState
          message={queueQuery.error instanceof ApiError ? queueQuery.error.message : 'Could not load your review.'}
          onRetry={() => void queueQuery.refetch()}
        />
      ) : null}

      {queueQuery.data && items.length === 0 ? (
        <EmptyState
          icon="cards"
          title="Nothing due just yet"
          body="Finish another lesson and the words you meet will show up here."
          action={<Button label="Back to words" variant="secondary" onPress={() => navigation.goBack()} />}
        />
      ) : null}

      {finished ? (
        <View style={styles.done}>
          <Pitsi state="celebrate" size={170} />
          <Kicker>Practice complete</Kicker>
          <Text style={[type.display, styles.center]}>O dirile sentle!</Text>
          <Text style={[type.bodySmall, styles.center, { color: colors.muted }]}>
            {practised} word{practised === 1 ? '' : 's'} reviewed · +{xp} XP
          </Text>
          <Button label="Back to words" onPress={() => navigation.goBack()} style={styles.fullWidth} />
        </View>
      ) : item ? (
        <View style={styles.session}>
          <ProgressBar value={(index + (revealed ? 0.5 : 0)) / Math.max(1, items.length)} />

          <Pressable onPress={() => setRevealed(true)} style={styles.card} accessibilityRole="button">
            <View style={styles.cardTop}>
              <Text style={styles.kicker}>SETSWANA</Text>
              <AudioButton audioUrl={item.audioUrl} />
            </View>
            <Text style={styles.word}>{item.setswana}</Text>

            {revealed ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.meaning}>{item.english}</Text>
                {item.phonetic ? <Text style={styles.phonetic}>{item.phonetic}</Text> : null}
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </>
            ) : (
              <View style={styles.revealHint}>
                <Icon name="eye" size={18} color={colors.muted} />
                <Text style={[type.caption, { color: colors.muted }]}>Tap to reveal the meaning</Text>
              </View>
            )}
          </Pressable>

          {revealed ? (
            <View style={styles.marks}>
              <Text style={[type.caption, { color: colors.muted, textAlign: 'center' }]}>
                How well did you remember?
              </Text>
              <View style={styles.markRow}>
                <MarkButton label="Again" tint={colors.errorTint} ink={colors.errorText} onPress={() => void mark('again')} disabled={busy} />
                <MarkButton label="Good" tint={colors.infoTint} ink={colors.blueDark} onPress={() => void mark('good')} disabled={busy} />
                <MarkButton label="Easy" tint={colors.successTint} ink={colors.successText} onPress={() => void mark('easy')} disabled={busy} />
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </Screen>
  )
}

function MarkButton({
  label,
  tint,
  ink,
  onPress,
  disabled,
}: {
  label: string
  tint: string
  ink: string
  onPress: () => void
  disabled: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.mark, { backgroundColor: tint }, pressed && { opacity: 0.8 }]}
    >
      <Text style={[type.button, { color: ink }]}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  session: { flex: 1, gap: spacing.xl, paddingTop: spacing.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    padding: spacing.xxl,
    gap: spacing.sm,
    minHeight: 300,
    justifyContent: 'center',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kicker: { fontFamily: fonts.bodyBold, fontSize: 9, letterSpacing: 1.2, color: colors.muted },
  word: { fontFamily: fonts.displayBlack, fontSize: 36, letterSpacing: -1, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.md },
  meaning: { fontFamily: fonts.display, fontSize: 22, color: colors.blueDark },
  phonetic: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  notes: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: spacing.sm, lineHeight: 18 },
  revealHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl },
  marks: { gap: spacing.md },
  markRow: { flexDirection: 'row', gap: spacing.sm },
  mark: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  center: { textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch', marginTop: spacing.lg },
})
