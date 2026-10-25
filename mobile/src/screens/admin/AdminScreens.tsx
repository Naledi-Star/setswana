import React, { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '../../api/client'
import type { AdminExercise, AdminLessonDetail, AdminUnit, AdminWord } from '../../api/types'
import { useAuth } from '../../auth/AuthProvider'
import { Icon } from '../../components/Icon'
import {
  Button,
  Card,
  ErrorState,
  IconButton,
  Kicker,
  LoadingView,
  Screen,
  TextField,
} from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import type { AdminScreenProps } from '../../navigation/types'

const EXERCISE_TYPES = [
  'TRANSLATE_MC',
  'MATCH_PAIRS',
  'FILL_BLANK',
  'LISTEN_CHOOSE',
  'TYPE_ANSWER',
  'BUILD_SENTENCE',
  'SPEAK',
  'REVIEW_CARD',
] as const

const COLOURS = ['blue', 'coral', 'gold', 'green'] as const

const EXAMPLES: Record<string, { prompt: unknown; answerKey: unknown }> = {
  TRANSLATE_MC: {
    prompt: {
      direction: 'tn-en',
      phrase: 'Dumela',
      options: [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'Thank you' },
      ],
    },
    answerKey: { correctOptionId: 'a' },
  },
  MATCH_PAIRS: {
    prompt: {
      pairs: [
        { id: 'p1', setswana: 'Dumela', english: 'Hello' },
        { id: 'p2', setswana: 'Leina', english: 'Name' },
        { id: 'p3', setswana: 'Tsweetswee', english: 'Please' },
      ],
    },
    answerKey: {
      pairs: [
        { id: 'p1', setswana: 'Dumela', english: 'Hello' },
        { id: 'p2', setswana: 'Leina', english: 'Name' },
        { id: 'p3', setswana: 'Tsweetswee', english: 'Please' },
      ],
    },
  },
  FILL_BLANK: {
    prompt: { sentence: 'Ke ___ Naledi', translationHint: 'I am Naledi' },
    answerKey: { answers: ['nna'], allowTypo: false },
  },
  LISTEN_CHOOSE: {
    prompt: {
      audioUrl: '/media/dumela.mp3',
      options: [
        { id: 'a', text: 'Hello' },
        { id: 'b', text: 'Goodbye' },
      ],
    },
    answerKey: { correctOptionId: 'a' },
  },
  TYPE_ANSWER: {
    prompt: { direction: 'en-tn', sourceText: 'Thank you' },
    answerKey: { answers: ['Ke a leboga'], allowTypo: true },
  },
  BUILD_SENTENCE: {
    prompt: {
      tokens: [
        { id: 't1', text: 'Ke' },
        { id: 't2', text: 'nna' },
        { id: 't3', text: 'Naledi' },
      ],
      translationHint: 'I am Naledi.',
    },
    answerKey: { order: ['t1', 't2', 't3'] },
  },
  SPEAK: { prompt: { phrase: 'Dumela', english: 'Hello' }, answerKey: {} },
  REVIEW_CARD: {
    prompt: { setswana: 'Leina', english: 'Name', notes: 'A word to remember.' },
    answerKey: {},
  },
}

function showError(error: unknown) {
  if (error instanceof ApiError) {
    const detail = error.fields ? Object.values(error.fields).join(' ') : ''
    Alert.alert(error.message, detail || undefined)
  } else {
    Alert.alert('Something went wrong', 'Please try again.')
  }
}

function AdminHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <View style={styles.adminHeader}>
      {onBack ? <IconButton icon="chevronLeft" label="Back" onPress={onBack} /> : <View style={{ width: 40 }} />}
      <Kicker color={colors.blueDark}>{title}</Kicker>
      <View style={{ width: 40 }} />
    </View>
  )
}

export function AdminHomeScreen({ navigation }: AdminScreenProps<'AdminHome'>) {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const unitsQuery = useQuery({ queryKey: ['admin-units'], queryFn: api.admin.units })
  const healthQuery = useQuery({ queryKey: ['admin-health'], queryFn: api.admin.health })
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [busy, setBusy] = useState(false)
  const [validation, setValidation] = useState<null | {
    files: number
    errors: { path: string; message: string }[]
    warnings: { path: string; message: string }[]
  }>(null)

  if (!isAdmin) {
    return (
      <Screen>
        <ErrorState message="Admin access only." />
      </Screen>
    )
  }

  const refreshAll = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-units'] })
    await queryClient.invalidateQueries({ queryKey: ['admin-health'] })
  }

  const createUnit = async () => {
    setBusy(true)
    try {
      await api.admin.createUnit({ title: title.trim(), titleEn: titleEn.trim() })
      setTitle('')
      setTitleEn('')
      setShowCreate(false)
      await refreshAll()
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  const togglePublish = async (unit: AdminUnit) => {
    try {
      await api.admin.updateUnit(unit.id, { isPublished: !unit.isPublished })
      await refreshAll()
    } catch (error) {
      showError(error)
    }
  }

  const validate = async () => {
    try {
      setValidation(await api.admin.validateContent())
    } catch (error) {
      showError(error)
    }
  }

  return (
    <Screen>
      <AdminHeader title="Content admin" />
      <Text style={[type.display, { marginTop: spacing.sm }]}>Manage Puo</Text>
      <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4 }]}>
        Everything here is served to learners from the API.
      </Text>

      {healthQuery.data ? (
        <View style={styles.healthRow}>
          {Object.entries(healthQuery.data).map(([key, value]) => (
            <View key={key} style={styles.healthCell}>
              <Text style={styles.healthValue}>{value}</Text>
              <Text style={styles.healthLabel}>{key}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.toolRow}>
        <Button label="New unit" icon="plus" onPress={() => setShowCreate((current) => !current)} />
      </View>

      {showCreate ? (
        <Card style={{ gap: spacing.sm }}>
          <TextField label="Setswana title" value={title} onChangeText={setTitle} placeholder="Dumediso" />
          <TextField label="English title" value={titleEn} onChangeText={setTitleEn} placeholder="Greetings" />
          <Button
            label={busy ? 'Creating…' : 'Create unit'}
            onPress={() => void createUnit()}
            disabled={!title.trim() || !titleEn.trim() || busy}
          />
        </Card>
      ) : null}

      {unitsQuery.isPending ? <LoadingView /> : null}
      {unitsQuery.isError ? (
        <ErrorState message="Could not load units." onRetry={() => void unitsQuery.refetch()} />
      ) : null}

      <View style={styles.list}>
        {unitsQuery.data?.units.map((unit) => (
          <Card key={unit.id} style={styles.unitCard}>
            <View style={styles.unitHead}>
              <View style={{ flex: 1 }}>
                <Text style={[type.caption, { color: colors.muted }]}>
                  {unit.slug} · {unit.lessons.length} lessons · {unit.wordCount} words
                </Text>
                <Text style={[type.subtitle, { color: colors.ink }]}>{unit.title}</Text>
                <Text style={[type.caption, { color: colors.muted }]}>{unit.titleEn}</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: unit.isPublished }}
                onPress={() => void togglePublish(unit)}
                style={[styles.badge, unit.isPublished ? styles.badgeLive : styles.badgeDraft]}
              >
                <Text style={[styles.badgeText, { color: unit.isPublished ? colors.successText : colors.muted }]}>
                  {unit.isPublished ? 'Published' : 'Draft'}
                </Text>
              </Pressable>
            </View>
            <Button
              label="Open unit"
              variant="secondary"
              onPress={() => navigation.navigate('UnitEditor', { unitId: unit.id })}
            />
          </Card>
        ))}
      </View>

      <View style={styles.toolGrid}>
        <Button label="Words" variant="secondary" onPress={() => navigation.navigate('WordsAdmin')} />
        <Button label="Game settings" variant="secondary" onPress={() => navigation.navigate('ConfigAdmin')} />
      </View>
      <Button label="Validate content" variant="ghost" onPress={() => void validate()} />

      {validation ? (
        <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Text style={[type.label, { color: colors.ink }]}>
            {validation.files} file(s) · {validation.errors.length} error(s) · {validation.warnings.length} warning(s)
          </Text>
          {validation.errors.map((issue) => (
            <Text key={`${issue.path}-${issue.message}`} style={[type.caption, { color: colors.errorText }]}>
              {issue.path}: {issue.message}
            </Text>
          ))}
          {validation.warnings.map((issue) => (
            <Text key={`${issue.path}-${issue.message}`} style={[type.caption, { color: colors.muted }]}>
              {issue.path}: {issue.message}
            </Text>
          ))}
          {validation.errors.length === 0 ? (
            <Text style={[type.caption, { color: colors.successText }]}>No blocking errors.</Text>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  )
}

export function UnitEditorScreen({ route, navigation }: AdminScreenProps<'UnitEditor'>) {
  const queryClient = useQueryClient()
  const unitsQuery = useQuery({ queryKey: ['admin-units'], queryFn: api.admin.units })
  const unit = unitsQuery.data?.units.find((entry) => entry.id === route.params.unitId)

  const [title, setTitle] = useState('')
  const [titleEn, setTitleEn] = useState('')
  const [description, setDescription] = useState('')
  const [colour, setColour] = useState<string>('blue')
  const [lessonTitle, setLessonTitle] = useState('')
  const [initialised, setInitialised] = useState(false)
  const [busy, setBusy] = useState(false)

  React.useEffect(() => {
    if (unit && !initialised) {
      setTitle(unit.title)
      setTitleEn(unit.titleEn)
      setDescription(unit.description ?? '')
      setColour(unit.colour)
      setInitialised(true)
    }
  }, [unit, initialised])

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-units'] })

  const save = async () => {
    if (!unit) return
    setBusy(true)
    try {
      await api.admin.updateUnit(unit.id, { title, titleEn, description, colour })
      await refresh()
      Alert.alert('Saved', 'Unit updated.')
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  const addLesson = async () => {
    if (!unit || !lessonTitle.trim()) return
    setBusy(true)
    try {
      await api.admin.createLesson({ unitId: unit.id, title: lessonTitle.trim() })
      setLessonTitle('')
      await refresh()
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  const remove = () => {
    if (!unit) return
    Alert.alert('Delete unit?', 'Lessons and exercises inside it are removed too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await api.admin.deleteUnit(unit.id)
              await refresh()
              navigation.goBack()
            } catch (error) {
              showError(error)
            }
          })()
        },
      },
    ])
  }

  return (
    <Screen>
      <AdminHeader title="Unit" onBack={() => navigation.goBack()} />
      {unitsQuery.isPending ? <LoadingView /> : null}
      {!unit && !unitsQuery.isPending ? <ErrorState message="Unit not found." /> : null}

      {unit ? (
        <>
          <TextField label="Setswana title" value={title} onChangeText={setTitle} />
          <TextField label="English title" value={titleEn} onChangeText={setTitleEn} />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Shown to learners under the unit name"
          />
          <Text style={[type.label, { color: colors.ink, marginBottom: spacing.sm }]}>Colour</Text>
          <View style={styles.chipRow}>
            {COLOURS.map((entry) => (
              <Pressable
                key={entry}
                onPress={() => setColour(entry)}
                style={[styles.colourChip, { backgroundColor: colors[entry] }, colour === entry && styles.colourActive]}
              />
            ))}
          </View>
          <Button label={busy ? 'Saving…' : 'Save unit'} onPress={() => void save()} loading={busy} />

          <View style={styles.section}>
            <Text style={[type.subtitle, { color: colors.ink }]}>Lessons</Text>
            {unit.lessons.length === 0 ? (
              <Text style={[type.caption, { color: colors.muted }]}>No lessons yet.</Text>
            ) : null}
            {unit.lessons.map((lesson) => (
              <Pressable
                key={lesson.id}
                onPress={() =>
                  navigation.navigate('LessonEditor', { lessonId: lesson.id, title: lesson.title })
                }
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.label, { color: colors.ink }]}>{lesson.title}</Text>
                  <Text style={[type.caption, { color: colors.muted }]}>
                    {lesson.exerciseCount} exercises · {lesson.isPublished ? 'published' : 'draft'}
                  </Text>
                </View>
                <Icon name="arrow" size={18} color={colors.muted} />
              </Pressable>
            ))}

            <TextField
              label="New lesson title"
              value={lessonTitle}
              onChangeText={setLessonTitle}
              placeholder="Dumela"
            />
            <Button
              label="Add lesson"
              variant="secondary"
              onPress={() => void addLesson()}
              disabled={!lessonTitle.trim() || busy}
            />
          </View>

          <Button label="Delete unit" variant="danger" onPress={remove} style={{ marginTop: spacing.xl }} />
        </>
      ) : null}
    </Screen>
  )
}

export function LessonEditorScreen({ route, navigation }: AdminScreenProps<'LessonEditor'>) {
  const queryClient = useQueryClient()
  const lessonQuery = useQuery({
    queryKey: ['admin-lesson', route.params.lessonId],
    queryFn: () => api.admin.lesson(route.params.lessonId),
  })
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [xpBonus, setXpBonus] = useState('10')
  const [initialised, setInitialised] = useState(false)
  const [busy, setBusy] = useState(false)

  React.useEffect(() => {
    if (lessonQuery.data && !initialised) {
      setTitle(lessonQuery.data.title)
      setSubtitle(lessonQuery.data.subtitle ?? '')
      setXpBonus(String(lessonQuery.data.xpBonus))
      setInitialised(true)
    }
  }, [lessonQuery.data, initialised])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-lesson', route.params.lessonId] })
    await queryClient.invalidateQueries({ queryKey: ['admin-units'] })
  }

  const save = async () => {
    setBusy(true)
    try {
      await api.admin.updateLesson(route.params.lessonId, {
        title,
        subtitle,
        xpBonus: Number(xpBonus) || 0,
      })
      await refresh()
      Alert.alert('Saved', 'Lesson updated.')
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  const togglePublish = async () => {
    if (!lessonQuery.data) return
    try {
      await api.admin.updateLesson(route.params.lessonId, {
        isPublished: !lessonQuery.data.isPublished,
      })
      await refresh()
    } catch (error) {
      showError(error)
    }
  }

  const removeExercise = (exercise: AdminExercise) => {
    Alert.alert('Delete exercise?', exercise.slug, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await api.admin.deleteExercise(exercise.id)
              await refresh()
            } catch (error) {
              showError(error)
            }
          })()
        },
      },
    ])
  }

  const lesson = lessonQuery.data

  return (
    <Screen>
      <AdminHeader title="Lesson" onBack={() => navigation.goBack()} />
      {lessonQuery.isPending ? <LoadingView /> : null}
      {lessonQuery.isError ? <ErrorState message="Could not load lesson." /> : null}

      {lesson ? (
        <>
          <TextField label="Title" value={title} onChangeText={setTitle} />
          <TextField label="Subtitle" value={subtitle} onChangeText={setSubtitle} />
          <TextField label="Completion XP bonus" value={xpBonus} onChangeText={setXpBonus} keyboardType="number-pad" />
          <Button label={busy ? 'Saving…' : 'Save lesson'} onPress={() => void save()} loading={busy} />
          <Button
            label={lesson.isPublished ? 'Unpublish' : 'Publish'}
            variant="secondary"
            onPress={() => void togglePublish()}
            style={{ marginTop: spacing.sm }}
          />

          <View style={styles.section}>
            <Text style={[type.subtitle, { color: colors.ink }]}>Exercises</Text>
            {lesson.exercises.length === 0 ? (
              <Text style={[type.caption, { color: colors.muted }]}>
                No exercises yet. Add at least three before publishing.
              </Text>
            ) : null}
            {lesson.exercises.map((exercise) => (
              <Pressable
                key={exercise.id}
                onLongPress={() => removeExercise(exercise)}
                onPress={() =>
                  navigation.navigate('ExerciseEditor', {
                    lessonId: lesson.id,
                    exerciseId: exercise.id,
                  })
                }
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[type.label, { color: colors.ink }]}>
                    {exercise.position + 1}. {exercise.type.replaceAll('_', ' ').toLowerCase()}
                  </Text>
                  <Text style={[type.caption, { color: colors.muted }]} numberOfLines={1}>
                    {exercise.slug} · {exercise.xp} XP
                  </Text>
                </View>
                <Icon name="edit" size={17} color={colors.muted} />
              </Pressable>
            ))}
            <Button
              label="Add exercise"
              icon="plus"
              variant="secondary"
              onPress={() => navigation.navigate('ExerciseEditor', { lessonId: lesson.id })}
            />
          </View>

          <Button
            label="Delete lesson"
            variant="danger"
            onPress={() => {
              Alert.alert('Delete lesson?', 'This removes its exercises too.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    void (async () => {
                      try {
                        await api.admin.deleteLesson(lesson.id)
                        await queryClient.invalidateQueries({ queryKey: ['admin-units'] })
                        navigation.goBack()
                      } catch (error) {
                        showError(error)
                      }
                    })()
                  },
                },
              ])
            }}
            style={{ marginTop: spacing.xl }}
          />
        </>
      ) : null}
    </Screen>
  )
}

export function ExerciseEditorScreen({ route, navigation }: AdminScreenProps<'ExerciseEditor'>) {
  const queryClient = useQueryClient()
  const lessonQuery = useQuery({
    queryKey: ['admin-lesson', route.params.lessonId],
    queryFn: () => api.admin.lesson(route.params.lessonId),
  })
  const existing = lessonQuery.data?.exercises.find((entry) => entry.id === route.params.exerciseId)

  const [exerciseType, setExerciseType] = useState<string>('TRANSLATE_MC')
  const [promptText, setPromptText] = useState('')
  const [keyText, setKeyText] = useState('')
  const [explanation, setExplanation] = useState('')
  const [xp, setXp] = useState('10')
  const [audioUrl, setAudioUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [initialised, setInitialised] = useState(false)

  React.useEffect(() => {
    if (initialised) return
    if (existing) {
      setExerciseType(existing.type)
      setPromptText(JSON.stringify(existing.prompt, null, 2))
      setKeyText(JSON.stringify(existing.answerKey, null, 2))
      setExplanation(existing.explanation ?? '')
      setXp(String(existing.xp))
      setAudioUrl(existing.audioUrl ?? '')
      setInitialised(true)
    } else if (!route.params.exerciseId) {
      const example = EXAMPLES.TRANSLATE_MC
      setPromptText(JSON.stringify(example?.prompt ?? {}, null, 2))
      setKeyText(JSON.stringify(example?.answerKey ?? {}, null, 2))
      setInitialised(true)
    }
  }, [existing, initialised, route.params.exerciseId])

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin-lesson', route.params.lessonId] })
    await queryClient.invalidateQueries({ queryKey: ['admin-units'] })
  }

  const loadExample = () => {
    const example = EXAMPLES[exerciseType]
    if (example) {
      setPromptText(JSON.stringify(example.prompt, null, 2))
      setKeyText(JSON.stringify(example.answerKey, null, 2))
    }
  }

  const save = async () => {
    setBusy(true)
    try {
      const prompt = JSON.parse(promptText) as Record<string, unknown>
      const answerKey = JSON.parse(keyText) as Record<string, unknown>
      if (existing) {
        await api.admin.updateExercise(existing.id, {
          type: exerciseType,
          prompt,
          answerKey,
          explanation: explanation || null,
          xp: Number(xp) || 0,
          audioUrl: audioUrl || null,
        })
      } else {
        await api.admin.createExercise({
          lessonId: route.params.lessonId,
          type: exerciseType,
          prompt,
          answerKey,
          explanation: explanation || undefined,
          xp: Number(xp) || 10,
          audioUrl: audioUrl || undefined,
        })
      }
      await refresh()
      navigation.goBack()
    } catch (error) {
      if (error instanceof SyntaxError) Alert.alert('Invalid JSON', error.message)
      else showError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <AdminHeader title={existing ? 'Edit exercise' : 'New exercise'} onBack={() => navigation.goBack()} />
      {lessonQuery.isPending ? <LoadingView /> : null}

      <Text style={[type.label, { color: colors.ink, marginBottom: spacing.sm }]}>Type</Text>
      <View style={styles.chipRow}>
        {EXERCISE_TYPES.map((entry) => (
          <Pressable
            key={entry}
            onPress={() => {
              setExerciseType(entry)
              const example = EXAMPLES[entry]
              if (example && !existing) {
                setPromptText(JSON.stringify(example.prompt, null, 2))
                setKeyText(JSON.stringify(example.answerKey, null, 2))
              }
            }}
            style={[styles.typeChip, exerciseType === entry && styles.typeChipActive]}
          >
            <Text
              style={[
                styles.typeChipText,
                exerciseType === entry && { color: colors.white },
              ]}
            >
              {entry.replaceAll('_', ' ').toLowerCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Button label="Load example for this type" variant="ghost" onPress={loadExample} />

      <TextField
        label="Prompt (JSON)"
        value={promptText}
        onChangeText={setPromptText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TextField
        label="Answer key (JSON)"
        value={keyText}
        onChangeText={setKeyText}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        hint="Never sent to learners."
      />
      <TextField label="Explanation" value={explanation} onChangeText={setExplanation} multiline />
      <TextField label="XP" value={xp} onChangeText={setXp} keyboardType="number-pad" />
      <TextField
        label="Audio URL"
        value={audioUrl}
        onChangeText={setAudioUrl}
        autoCapitalize="none"
        placeholder="/media/dumela.mp3"
      />

      <Button label={busy ? 'Saving…' : 'Save exercise'} onPress={() => void save()} loading={busy} />

      {existing ? (
        <Button
          label="Delete exercise"
          variant="danger"
          onPress={() => {
            Alert.alert('Delete exercise?', existing.slug, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    try {
                      await api.admin.deleteExercise(existing.id)
                      await refresh()
                      navigation.goBack()
                    } catch (error) {
                      showError(error)
                    }
                  })()
                },
              },
            ])
          }}
          style={{ marginTop: spacing.xl }}
        />
      ) : null}
    </Screen>
  )
}

export function WordsAdminScreen({ navigation }: AdminScreenProps<'WordsAdmin'>) {
  const queryClient = useQueryClient()
  const wordsQuery = useQuery({ queryKey: ['admin-words'], queryFn: api.admin.words })
  const [editing, setEditing] = useState<AdminWord | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [setswana, setSetswana] = useState('')
  const [english, setEnglish] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [plural, setPlural] = useState('')
  const [formal, setFormal] = useState('')
  const [notes, setNotes] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const openForm = (word: AdminWord | null) => {
    setEditing(word)
    setSetswana(word?.setswana ?? '')
    setEnglish(word?.english ?? '')
    setPhonetic(word?.phonetic ?? '')
    setPlural(word?.pluralForm ?? '')
    setFormal(word?.formalForm ?? '')
    setNotes(word?.notes ?? '')
    setAudioUrl(word?.audioUrl ?? '')
    setShowForm(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      const payload = {
        setswana,
        english,
        phonetic: phonetic || null,
        pluralForm: plural || null,
        formalForm: formal || null,
        notes: notes || null,
        audioUrl: audioUrl || null,
      }
      if (editing) await api.admin.updateWord(editing.id, payload)
      else await api.admin.createWord(payload)
      setShowForm(false)
      await queryClient.invalidateQueries({ queryKey: ['admin-words'] })
    } catch (error) {
      showError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <AdminHeader title="Words" onBack={() => navigation.goBack()} />
      <Button label="New word" icon="plus" onPress={() => openForm(null)} />

      {showForm ? (
        <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <TextField label="Setswana" value={setswana} onChangeText={setSetswana} />
          <TextField label="English" value={english} onChangeText={setEnglish} />
          <TextField label="Phonetic spelling" value={phonetic} onChangeText={setPhonetic} />
          <TextField label="Plural / to a group" value={plural} onChangeText={setPlural} />
          <TextField label="Formal form" value={formal} onChangeText={setFormal} />
          <TextField label="Notes" value={notes} onChangeText={setNotes} multiline />
          <TextField
            label="Audio URL"
            value={audioUrl}
            onChangeText={setAudioUrl}
            autoCapitalize="none"
            placeholder="/media/dumela.mp3"
          />
          <Button
            label={busy ? 'Saving…' : 'Save word'}
            onPress={() => void save()}
            loading={busy}
            disabled={!setswana.trim() || !english.trim()}
          />
          <Button label="Cancel" variant="ghost" onPress={() => setShowForm(false)} />
        </Card>
      ) : null}

      {wordsQuery.isPending ? <LoadingView /> : null}
      {wordsQuery.isError ? <ErrorState message="Could not load words." /> : null}

      <View style={styles.list}>
        {wordsQuery.data?.words.map((word) => (
          <Pressable key={word.id} onPress={() => openForm(word)} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: colors.ink }]}>{word.setswana}</Text>
              <Text style={[type.caption, { color: colors.muted }]}>
                {word.english}
                {word.audioUrl ? ' · audio' : ''}
              </Text>
            </View>
            <Icon name="edit" size={17} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  )
}

export function ConfigAdminScreen({ navigation }: AdminScreenProps<'ConfigAdmin'>) {
  const configQuery = useQuery({ queryKey: ['admin-config'], queryFn: api.admin.config })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [initialised, setInitialised] = useState(false)

  React.useEffect(() => {
    if (configQuery.data && !initialised) {
      setText(JSON.stringify(configQuery.data, null, 2))
      setInitialised(true)
    }
  }, [configQuery.data, initialised])

  const save = async () => {
    setBusy(true)
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>
      await api.admin.updateConfig(parsed)
      await configQuery.refetch()
      Alert.alert('Saved', 'New values apply immediately.')
    } catch (error) {
      if (error instanceof SyntaxError) Alert.alert('Invalid JSON', error.message)
      else showError(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <AdminHeader title="Game settings" onBack={() => navigation.goBack()} />
      <Text style={[type.bodySmall, { color: colors.muted }]}>
        Hearts, XP, daily goals, SRS intervals and feature flags. Changes apply to every learner at once.
      </Text>

      {configQuery.isPending ? <LoadingView /> : null}
      {configQuery.isError ? <ErrorState message="Could not load settings." /> : null}

      {configQuery.data ? (
        <>
          <TextField
            label="Config (JSON)"
            value={text}
            onChangeText={setText}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button label={busy ? 'Saving…' : 'Save settings'} onPress={() => void save()} loading={busy} />
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  healthRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  healthCell: {
    flexGrow: 1,
    minWidth: 72,
    backgroundColor: colors.white,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  healthValue: { fontFamily: fonts.displayBlack, fontSize: 20, color: colors.ink },
  healthLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.muted, textTransform: 'capitalize' },
  toolRow: { marginTop: spacing.lg },
  toolGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, marginBottom: spacing.sm },
  list: { gap: spacing.md, marginTop: spacing.lg },
  unitCard: { gap: spacing.md },
  unitHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill },
  badgeLive: { backgroundColor: colors.successTint },
  badgeDraft: { backgroundColor: '#edf0ec' },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6 },
  section: {
    marginTop: spacing.xxl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg },
  colourChip: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: 'transparent' },
  colourActive: { borderColor: colors.ink },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  typeChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  typeChipText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.ink, textTransform: 'capitalize' },
})
