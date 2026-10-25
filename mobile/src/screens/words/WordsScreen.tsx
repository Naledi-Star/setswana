import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../../api/client'
import type { WordDto } from '../../api/types'
import { AudioButton } from '../../components/AudioButton'
import { Icon } from '../../components/Icon'
import { Button, EmptyState, ErrorState, Kicker, LoadingView, Screen } from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import type { WordsStackParamList } from '../../navigation/types'

type Nav = NativeStackNavigationProp<WordsStackParamList>
type Filter = 'all' | 'new' | 'learning' | 'known'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'learning', label: 'Learning' },
  { key: 'known', label: 'Known' },
]

const borderColour: Record<string, string> = {
  blue: colors.blue,
  coral: colors.coral,
  gold: colors.gold,
  green: colors.green,
}

export function WordsScreen() {
  const navigation = useNavigation<Nav>()
  const [filter, setFilter] = useState<Filter>('all')
  const query = useQuery({ queryKey: ['words'], queryFn: () => api.words() })

  const words = (query.data?.words ?? []).filter((word) => filter === 'all' || word.status === filter)

  return (
    <Screen>
      <Kicker>Your collection</Kicker>
      <Text style={[type.displayXL, { marginTop: 4 }]}>Words you know</Text>
      <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4 }]}>
        Tap a card to hear it spoken.
      </Text>

      <View style={styles.filters}>
        {FILTERS.map((entry) => {
          const active = filter === entry.key
          const count = query.data?.counts?.[entry.key] ?? 0
          return (
            <Pressable
              key={entry.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(entry.key)}
              style={[styles.filter, active && styles.filterActive]}
            >
              <Text style={[type.label, { color: active ? colors.white : colors.ink }]}>
                {entry.label}
                {entry.key !== 'all' && count > 0 ? ` ${count}` : ''}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {query.isPending ? <LoadingView label="Opening your word list…" /> : null}
      {query.isError ? (
        <ErrorState
          message={query.error instanceof ApiError ? query.error.message : 'Could not load your words.'}
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {query.data && words.length === 0 ? (
        <EmptyState
          icon="cards"
          title={filter === 'all' ? 'No words yet' : `No ${filter} words`}
          body={
            filter === 'all'
              ? 'Finish a lesson and the words you meet will appear here.'
              : 'Try another filter, or meet new words in your next lesson.'
          }
        />
      ) : null}

      <View style={styles.list}>
        {words.map((word) => (
          <WordRow
            key={word.id}
            word={word}
            onOpen={() => navigation.navigate('WordDetail', { wordId: word.id })}
          />
        ))}
      </View>

      {query.data && query.data.words.length > 0 ? (
        <Button
          label="Quick practice"
          icon="shuffle"
          onPress={() => navigation.navigate('Review')}
          style={{ marginTop: spacing.xxl }}
        />
      ) : null}
    </Screen>
  )
}

function WordRow({ word, onOpen }: { word: WordDto; onOpen: () => void }) {
  const tint = borderColour[word.unit?.colour ?? 'blue'] ?? colors.blue

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${word.setswana}, ${word.english}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.wordRow, { borderLeftColor: tint }, pressed && { opacity: 0.9 }]}
    >
      <AudioButton audioUrl={word.audioUrl} />
      <View style={styles.wordCopy}>
        <Text style={styles.word}>{word.setswana}</Text>
        <Text style={styles.meaning}>{word.english}</Text>
      </View>
      <View style={[styles.statusPill, word.status === 'known' && styles.statusKnown]}>
        <Text style={[styles.statusLabel, word.status === 'known' && { color: colors.successText }]}>
          {word.status}
        </Text>
      </View>
      <Icon name="arrow" size={18} color={colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, flexWrap: 'wrap' },
  filter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  list: { gap: spacing.md, marginTop: spacing.xl },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  wordCopy: { flex: 1 },
  word: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  meaning: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.infoTint,
  },
  statusKnown: { backgroundColor: colors.successTint },
  statusLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.blueDark,
  },
})
