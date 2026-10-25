import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioRecorder,
} from 'expo-audio'
import type { ExerciseDto } from '../../api/types'
import { AudioButton } from '../../components/AudioButton'
import { Icon } from '../../components/Icon'
import { Button, OptionCard } from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'

export type ExerciseProps = {
  exercise: ExerciseDto
  disabled: boolean
  onAnswer: (answer: unknown) => void
}

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {}
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function options(prompt: JsonRecord): { id: string; text: string }[] {
  const raw = Array.isArray(prompt.options) ? prompt.options : []
  return raw.flatMap((option) => {
    const entry = record(option)
    return typeof entry.id === 'string' && typeof entry.text === 'string'
      ? [{ id: entry.id, text: entry.text }]
      : []
  })
}

function PromptRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.promptRow}>{children}</View>
}

export function TranslateExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const choices = options(prompt)
  const [selected, setSelected] = useState<string | null>(null)
  const direction = text(prompt.direction, 'tn-en')

  return (
    <View style={styles.exercise}>
      <PromptRow>
        {exercise.audioUrl ? <AudioButton audioUrl={exercise.audioUrl} /> : null}
        <View style={styles.promptText}>
          <Text style={styles.phrase}>{text(prompt.phrase)}</Text>
          <Text style={styles.hint}>
            {direction === 'en-tn' ? 'Choose the Setswana translation' : 'Choose the English meaning'}
          </Text>
        </View>
      </PromptRow>

      <View style={styles.optionsList}>
        {choices.map((choice) => (
          <OptionCard
            key={choice.id}
            label={choice.text}
            status={selected === choice.id ? 'selected' : null}
            disabled={disabled}
            onPress={() => {
              setSelected(choice.id)
              onAnswer({ optionId: choice.id })
            }}
          />
        ))}
      </View>
    </View>
  )
}

export function ListenExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const choices = options(prompt)
  const [selected, setSelected] = useState<string | null>(null)

  if (!exercise.audioUrl) {
    return (
      <View style={styles.exercise}>
        <View style={styles.notice}>
          <Icon name="speaker" size={20} color={colors.coral} />
          <Text style={[type.bodySmall, { color: colors.errorText }]}>
            This clip hasn’t been recorded yet, so the listening question is skipped — no heart lost.
          </Text>
        </View>
        <Button label="Skip for now" variant="secondary" onPress={() => onAnswer({ skipped: true })} disabled={disabled} />
      </View>
    )
  }

  return (
    <View style={styles.exercise}>
      <View style={styles.listenRow}>
        <AudioButton audioUrl={exercise.audioUrl} variant="large" label="Play the phrase" />
      </View>
      <View style={styles.optionsList}>
        {choices.map((choice) => (
          <OptionCard
            key={choice.id}
            label={choice.text}
            status={selected === choice.id ? 'selected' : null}
            disabled={disabled}
            onPress={() => {
              setSelected(choice.id)
              onAnswer({ optionId: choice.id })
            }}
          />
        ))}
      </View>
    </View>
  )
}

export function MatchExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const pairs = useMemo(() => {
    const raw = Array.isArray(prompt.pairs) ? prompt.pairs : []
    return raw.map((pair) => {
      const entry = record(pair)
      return {
        id: text(entry.id),
        setswana: text(entry.setswana),
        english: text(entry.english),
      }
    })
  }, [prompt.pairs])

  const terms = useMemo(() => [...pairs].sort(() => Math.random() - 0.5), [pairs])
  const meanings = useMemo(() => [...pairs].sort(() => Math.random() - 0.5), [pairs])

  const [selectedTerm, setSelectedTerm] = useState<string | null>(null)
  const [matched, setMatched] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const isMatched = (id: string) => Boolean(matched[id])

  const pickTerm = (id: string) => {
    if (disabled || isMatched(id)) return
    setSelectedTerm(id)
    setNotice(null)
  }

  const pickMeaning = (id: string) => {
    if (disabled || !selectedTerm || isMatched(id)) return
    if (id === selectedTerm) {
      const next = { ...matched, [id]: id }
      setMatched(next)
      setSelectedTerm(null)
      setNotice(null)
      if (Object.keys(next).length === pairs.length && !submitted) {
        setSubmitted(true)
        onAnswer({ matches: Object.entries(next).map(([left, right]) => [`tn:${left}`, `en:${right}`]) })
      }
      return
    }
    setNotice('Not quite — try another pair.')
    setSelectedTerm(null)
  }

  return (
    <View style={styles.exercise}>
      <Text style={styles.hint}>Pair each Setswana word with its English meaning.</Text>
      <View style={styles.matchGrid}>
        <View style={styles.matchColumn}>
          {terms.map((pair) => {
            const done = isMatched(pair.id)
            const selected = selectedTerm === pair.id
            return (
              <Pressable
                key={`tn-${pair.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Setswana: ${pair.setswana}`}
                disabled={done || disabled}
                onPress={() => pickTerm(pair.id)}
                style={[
                  styles.matchCard,
                  selected && styles.matchCardSelected,
                  done && styles.matchCardDone,
                ]}
              >
                <Text style={styles.matchKicker}>SETSWANA</Text>
                <Text style={styles.matchText}>{pair.setswana}</Text>
                {done ? <Icon name="check" size={15} color={colors.green} style={styles.matchCheck} /> : null}
              </Pressable>
            )
          })}
        </View>
        <View style={styles.matchColumn}>
          {meanings.map((pair) => {
            const done = isMatched(pair.id)
            return (
              <Pressable
                key={`en-${pair.id}`}
                accessibilityRole="button"
                accessibilityLabel={`English: ${pair.english}`}
                disabled={done || disabled}
                onPress={() => pickMeaning(pair.id)}
                style={[styles.matchCard, done && styles.matchCardDone]}
              >
                <Text style={styles.matchKicker}>ENGLISH</Text>
                <Text style={styles.matchText}>{pair.english}</Text>
                {done ? <Icon name="check" size={15} color={colors.green} style={styles.matchCheck} /> : null}
              </Pressable>
            )
          })}
        </View>
      </View>
      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
    </View>
  )
}

export function FillBlankExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const sentence = text(prompt.sentence)
  const [value, setValue] = useState('')
  const [parts] = sentence.split('___')

  const submit = () => {
    if (!value.trim()) return
    onAnswer({ answer: value })
  }

  return (
    <View style={styles.exercise}>
      <View style={styles.sentenceCard}>
        <Text style={styles.sentence}>
          {parts[0]}
          <Text style={styles.blank}>{value || '_____'}</Text>
          {parts[1] ?? ''}
        </Text>
        {prompt.translationHint ? (
          <Text style={[type.caption, { color: colors.muted }]}>{text(prompt.translationHint)}</Text>
        ) : null}
      </View>

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Type the missing word"
        placeholderTextColor={colors.muted}
        editable={!disabled}
        style={styles.input}
        autoCapitalize="none"
        onSubmitEditing={submit}
        returnKeyType="done"
      />

      {Array.isArray(prompt.wordBank) ? (
        <View style={styles.wordBank}>
          {prompt.wordBank.map((word) => (
            <Pressable
              key={String(word)}
              disabled={disabled}
              onPress={() => setValue(String(word))}
              style={styles.wordChip}
            >
              <Text style={[type.label, { color: colors.ink }]}>{String(word)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Button label="Check" onPress={submit} disabled={disabled || !value.trim()} />
    </View>
  )
}

export function TypeAnswerExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const [value, setValue] = useState('')
  const direction = text(prompt.direction, 'en-tn')

  const submit = () => {
    if (!value.trim()) return
    onAnswer({ answer: value })
  }

  return (
    <View style={styles.exercise}>
      <View style={styles.promptText}>
        <Text style={styles.phrase}>{text(prompt.sourceText)}</Text>
        <Text style={styles.hint}>
          {direction === 'en-tn' ? 'Write it in Setswana' : 'Write it in English'}
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder={direction === 'en-tn' ? 'Setswana answer' : 'English answer'}
        placeholderTextColor={colors.muted}
        editable={!disabled}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <Button label="Check" onPress={submit} disabled={disabled || !value.trim()} />
    </View>
  )
}

export function BuildSentenceExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const tokens = useMemo(() => {
    const raw = Array.isArray(prompt.tokens) ? prompt.tokens : []
    return raw.map((token) => {
      const entry = record(token)
      return { id: text(entry.id), text: text(entry.text) }
    })
  }, [prompt.tokens])

  const [selected, setSelected] = useState<string[]>([])

  const append = (id: string) => {
    if (disabled || selected.includes(id)) return
    setSelected((current) => [...current, id])
  }

  const remove = (id: string) => {
    if (disabled) return
    setSelected((current) => current.filter((entry) => entry !== id))
  }

  return (
    <View style={styles.exercise}>
      {prompt.translationHint ? (
        <Text style={[type.bodySmall, { color: colors.muted }]}>{text(prompt.translationHint)}</Text>
      ) : null}

      <View style={styles.buildArea}>
        {selected.length === 0 ? (
          <Text style={[type.bodySmall, { color: colors.muted }]}>Tap the words in the right order</Text>
        ) : (
          selected.map((id) => {
            const token = tokens.find((entry) => entry.id === id)
            return (
              <Pressable key={id} onPress={() => remove(id)} style={[styles.token, styles.tokenSelected]}>
                <Text style={[styles.tokenText, { color: colors.blueDark }]}>{token?.text}</Text>
              </Pressable>
            )
          })
        )}
      </View>

      <View style={styles.tokenPool}>
        {tokens.map((token) => {
          const used = selected.includes(token.id)
          return (
            <Pressable
              key={token.id}
              disabled={used || disabled}
              onPress={() => append(token.id)}
              style={[styles.token, used && styles.tokenUsed]}
            >
              <Text style={[styles.tokenText, used && { color: colors.muted }]}>{token.text}</Text>
            </Pressable>
          )
        })}
      </View>

      <Button
        label="Check"
        onPress={() => onAnswer({ order: selected })}
        disabled={disabled || selected.length !== tokens.length}
      />
    </View>
  )
}

export function SpeakExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const phrase = text(prompt.phrase)
  const [recording, setRecording] = useState(false)
  const [clip, setClip] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState(false)

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const playback = useAudioPlayer(clip ? { uri: clip } : null)

  useEffect(() => {
    if (clip) playback.replace({ uri: clip })
  }, [clip, playback])

  const startRecording = async () => {
    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        setPermissionDenied(true)
        return
      }
      await recorder.prepareToRecordAsync()
      recorder.record()
      setRecording(true)
      setClip(null)
    } catch {
      Alert.alert('Microphone unavailable', 'You can still check yourself without recording.')
    }
  }

  const stopRecording = async () => {
    try {
      await recorder.stop()
      setRecording(false)
      setClip(recorder.uri ?? null)
    } catch {
      setRecording(false)
    }
  }

  return (
    <View style={styles.exercise}>
      <View style={styles.speakCard}>
        <Text style={styles.phrase}>{phrase}</Text>
        {prompt.english ? (
          <Text style={[type.caption, { color: colors.muted }]}>{text(prompt.english)}</Text>
        ) : null}
        {exercise.audioUrl ? (
          <AudioButton audioUrl={exercise.audioUrl} variant="inline" label="Hear the reference" />
        ) : null}
      </View>

      <Text style={[type.bodySmall, { color: colors.muted }]}>
        Say it out loud, then listen back. Puo can’t grade pronunciation yet — this check is yours.
      </Text>

      <View style={styles.recordRow}>
        <Pressable
          onPress={() => void (recording ? stopRecording() : startRecording())}
          style={[styles.recordButton, recording && styles.recordButtonActive]}
        >
          <Icon name="mic" size={22} color={recording ? colors.white : colors.blueDark} />
          <Text style={[type.label, { color: recording ? colors.white : colors.blueDark }]}>
            {recording ? 'Stop' : clip ? 'Record again' : 'Record'}
          </Text>
        </Pressable>

        {clip ? (
          <Pressable
            onPress={() => {
              try {
                playback.seekTo(0)
                playback.play()
              } catch {
                // ignore
              }
            }}
            style={styles.playbackButton}
          >
            <Icon name="speaker" size={20} color={colors.blueDark} />
            <Text style={[type.label, { color: colors.blueDark }]}>Play back</Text>
          </Pressable>
        ) : null}
      </View>

      {permissionDenied ? (
        <Text style={[type.caption, { color: colors.muted }]}>
          Microphone permission is off — you can still mark this one yourself.
        </Text>
      ) : null}

      <View style={styles.speakActions}>
        <Button label="Got it" onPress={() => onAnswer({ acknowledged: true })} disabled={disabled} />
        <Button
          label="Not yet"
          variant="secondary"
          onPress={() => onAnswer({ acknowledged: false })}
          disabled={disabled}
        />
      </View>
    </View>
  )
}

export function ReviewCardExercise({ exercise, disabled, onAnswer }: ExerciseProps) {
  const prompt = record(exercise.prompt)
  const [revealed, setRevealed] = useState(false)

  return (
    <View style={styles.exercise}>
      <Pressable onPress={() => setRevealed(true)} style={styles.reviewCard}>
        <Text style={styles.matchKicker}>SETSWANA</Text>
        <Text style={styles.reviewWord}>{text(prompt.setswana)}</Text>
        {revealed ? (
          <>
            <View style={styles.reviewDivider} />
            <Text style={[type.title, { color: colors.blueDark }]}>{text(prompt.english)}</Text>
            {prompt.notes ? (
              <Text style={[type.caption, { color: colors.muted, textAlign: 'center', marginTop: 6 }]}>
                {text(prompt.notes)}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[type.bodySmall, { color: colors.muted }]}>Tap the card to check</Text>
        )}
      </Pressable>

      {revealed ? (
        <View style={styles.reviewActions}>
          <Button label="Again" variant="secondary" onPress={() => onAnswer({ selfMark: 'again' })} disabled={disabled} />
          <Button label="Good" onPress={() => onAnswer({ selfMark: 'good' })} disabled={disabled} />
        </View>
      ) : null}
    </View>
  )
}

export function ExerciseRenderer(props: ExerciseProps) {
  switch (props.exercise.type) {
    case 'TRANSLATE_MC':
      return <TranslateExercise {...props} />
    case 'LISTEN_CHOOSE':
      return <ListenExercise {...props} />
    case 'MATCH_PAIRS':
      return <MatchExercise {...props} />
    case 'FILL_BLANK':
      return <FillBlankExercise {...props} />
    case 'TYPE_ANSWER':
      return <TypeAnswerExercise {...props} />
    case 'BUILD_SENTENCE':
      return <BuildSentenceExercise {...props} />
    case 'SPEAK':
      return <SpeakExercise {...props} />
    case 'REVIEW_CARD':
      return <ReviewCardExercise {...props} />
    default:
      return (
        <View style={styles.exercise}>
          <Text style={[type.bodySmall, { color: colors.muted }]}>
            This exercise type isn’t supported by this version of the app yet.
          </Text>
        </View>
      )
  }
}

const styles = StyleSheet.create({
  exercise: { gap: spacing.lg },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  promptText: { flex: 1, gap: 4 },
  phrase: { fontFamily: fonts.displayBlack, fontSize: 24, color: colors.ink, letterSpacing: -0.4 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 19 },
  optionsList: { gap: spacing.md },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorTint,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  listenRow: { alignItems: 'flex-start' },
  matchGrid: { flexDirection: 'row', gap: spacing.md },
  matchColumn: { flex: 1, gap: spacing.md },
  matchCard: {
    minHeight: 86,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: spacing.md,
    justifyContent: 'center',
  },
  matchCardSelected: { borderColor: colors.blue, backgroundColor: '#eaf7fc' },
  matchCardDone: { borderColor: colors.green, backgroundColor: colors.successTint, opacity: 0.75 },
  matchKicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.muted,
  },
  matchText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, marginTop: 3 },
  matchCheck: { position: 'absolute', top: 8, right: 8 },
  noticeText: { fontFamily: fonts.body, fontSize: 12, color: colors.coral },
  sentenceCard: {
    backgroundColor: colors.successTint,
    padding: spacing.lg,
    borderRadius: radius.md,
    gap: 4,
  },
  sentence: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, lineHeight: 30 },
  blank: { color: colors.blueDark },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ink,
  },
  wordBank: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  wordChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  buildArea: {
    minHeight: 86,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.softLine,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  tokenPool: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  token: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    backgroundColor: colors.white,
  },
  tokenSelected: { borderColor: colors.blue, backgroundColor: colors.infoTint },
  tokenUsed: { backgroundColor: '#f1f2ed', borderColor: colors.line },
  tokenText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  speakCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  recordRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.infoTint,
  },
  recordButtonActive: { backgroundColor: colors.coral },
  playbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    backgroundColor: colors.white,
  },
  speakActions: { gap: spacing.sm },
  reviewCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  reviewWord: { fontFamily: fonts.displayBlack, fontSize: 30, color: colors.ink, letterSpacing: -0.6 },
  reviewDivider: { height: 1, backgroundColor: colors.line, alignSelf: 'stretch', marginVertical: spacing.sm },
  reviewActions: { flexDirection: 'row', gap: spacing.sm },
})
