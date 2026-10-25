import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import { AudioButton } from '../../components/AudioButton'
import { ErrorState, IconButton, LoadingView, Screen } from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import type { WordsScreenProps } from '../../navigation/types'

type WordDetail = {
  id: string
  setswana: string
  english: string
  phonetic: string | null
  audioUrl: string | null
  notes: string | null
  pluralForm: string | null
  formalForm: string | null
  partOfSpeech: string | null
  status: string
  unit?: { title: string; titleEn: string } | null
}

export function WordDetailScreen({ route, navigation }: WordsScreenProps<'WordDetail'>) {
  const query = useQuery({
    queryKey: ['word', route.params.wordId],
    queryFn: () => api.word(route.params.wordId) as Promise<WordDetail>,
  })

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => navigation.goBack()} />
      </View>

      {query.isPending ? <LoadingView /> : null}
      {query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Could not load this word.'}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.data ? (
        <>
          <Text style={[type.kicker, { color: colors.coral, marginTop: spacing.lg }]}>
            {query.data.unit?.titleEn ?? 'Word'}
          </Text>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.word}>{query.data.setswana}</Text>
              <Text style={styles.meaning}>{query.data.english}</Text>
              {query.data.phonetic ? <Text style={styles.phonetic}>{query.data.phonetic}</Text> : null}
            </View>
            <AudioButton audioUrl={query.data.audioUrl} variant="large" label="Hear it" />
          </View>

          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{query.data.status}</Text>
            </View>
            {query.data.partOfSpeech ? (
              <View style={[styles.badge, { backgroundColor: colors.errorTint }]}>
                <Text style={[styles.badgeLabel, { color: colors.errorText }]}>{query.data.partOfSpeech}</Text>
              </View>
            ) : null}
          </View>

          {query.data.pluralForm || query.data.formalForm ? (
            <View style={styles.section}>
              <Text style={[type.subtitle, { color: colors.ink }]}>Forms</Text>
              {query.data.pluralForm ? (
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>To a group</Text>
                  <Text style={styles.formValue}>{query.data.pluralForm}</Text>
                </View>
              ) : null}
              {query.data.formalForm ? (
                <View style={styles.formRow}>
                  <Text style={styles.formLabel}>Formal</Text>
                  <Text style={styles.formValue}>{query.data.formalForm}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {query.data.notes ? (
            <View style={styles.section}>
              <Text style={[type.subtitle, { color: colors.ink }]}>Note</Text>
              <Text style={[type.bodySmall, { color: colors.muted, lineHeight: 20 }]}>{query.data.notes}</Text>
            </View>
          ) : null}

          {!query.data.audioUrl ? (
            <Text style={[type.caption, styles.audioNote]}>
              A recording for this word hasn’t been added yet, so the listen button stays hidden.
            </Text>
          ) : null}
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  word: { fontFamily: fonts.displayBlack, fontSize: 34, color: colors.ink, letterSpacing: -1 },
  meaning: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink, marginTop: 2 },
  phonetic: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.infoTint,
  },
  badgeLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: colors.blueDark,
  },
  section: {
    marginTop: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  formLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  formValue: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  audioNote: { color: colors.muted, marginTop: spacing.xl },
})
