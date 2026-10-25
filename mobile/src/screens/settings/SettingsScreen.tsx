import React, { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { Icon } from '../../components/Icon'
import { Button, IconButton, Kicker, Screen, TextField } from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import { enablePushNotifications } from '../../lib/notifications'
import type { LearnScreenProps } from '../../navigation/types'

const TIMES = ['07:30', '12:30', '17:00', '18:30', '20:00']

export function SettingsScreen({ navigation }: LearnScreenProps<'Settings'>) {
  const { user, stats, updateProfile, signOut, deleteAccount } = useAuth()
  const [name, setName] = useState(user?.displayName ?? '')
  const [goal, setGoal] = useState(user?.dailyGoalLessons ?? 5)
  const [reminder, setReminder] = useState(user?.notificationPrefs.reminderEnabled ?? false)
  const [reminderTime, setReminderTime] = useState(user?.notificationPrefs.reminderLocalTime ?? '18:30')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [password, setPassword] = useState('')
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    setSaved(false)
    try {
      let pushOk = true
      if (reminder && !user?.notificationPrefs.reminderEnabled) {
        pushOk = await enablePushNotifications()
      }
      await updateProfile({
        displayName: name.trim() || user?.displayName,
        dailyGoalLessons: goal,
        notificationPrefs: {
          reminderEnabled: reminder,
          reminderLocalTime: reminderTime,
          streakReminderEnabled: reminder,
        },
      })
      setSaved(true)
      if (reminder && !pushOk) {
        Alert.alert(
          'Reminder saved',
          'Push notifications are not configured on this build, so the reminder is stored for a later build.',
        )
      }
    } catch (error) {
      Alert.alert('Could not save', error instanceof ApiError ? error.message : 'Try again in a moment.')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = () => {
    Alert.alert(
      'Delete account?',
      'This hides your account immediately and permanently removes it after 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setDeleting(true)
              try {
                await deleteAccount(password)
              } catch (error) {
                Alert.alert(
                  'Could not delete',
                  error instanceof ApiError ? error.message : 'Check your password and try again.',
                )
              } finally {
                setDeleting(false)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" label="Back" onPress={() => navigation.goBack()} />
        <Kicker>Settings</Kicker>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[type.display, { marginTop: spacing.md }]}>Your account</Text>
      <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4 }]}>
        {user?.email} · {stats?.totalXp ?? 0} XP · {stats?.currentStreak ?? 0}-day streak
      </Text>

      <View style={styles.section}>
        <TextField label="Display name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Text style={[type.label, { color: colors.ink, marginBottom: spacing.sm }]}>Daily goal</Text>
        <View style={styles.chipRow}>
          {[3, 5, 8].map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: goal === option }}
              onPress={() => setGoal(option)}
              style={[styles.chip, goal === option && styles.chipActive]}
            >
              <Text style={[type.label, { color: goal === option ? colors.white : colors.ink }]}>
                {option} lessons
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: reminder }}
          onPress={() => setReminder((current) => !current)}
          style={styles.switchRow}
        >
          <View style={styles.switchCopy}>
            <Text style={[type.subtitle, { color: colors.ink }]}>Daily reminder</Text>
            <Text style={[type.caption, { color: colors.muted }]}>
              One nudge a day at a time that suits you.
            </Text>
          </View>
          <View style={[styles.switch, reminder && styles.switchOn]}>
            <View style={[styles.switchKnob, reminder && styles.switchKnobOn]} />
          </View>
        </Pressable>

        {reminder ? (
          <View style={styles.chipRow}>
            {TIMES.map((time) => (
              <Pressable
                key={time}
                accessibilityRole="button"
                accessibilityState={{ selected: reminderTime === time }}
                onPress={() => setReminderTime(time)}
                style={[styles.chip, reminderTime === time && styles.chipActive]}
              >
                <Text style={[type.label, { color: reminderTime === time ? colors.white : colors.ink }]}>
                  {time}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <Button label={saving ? 'Saving…' : 'Save changes'} onPress={() => void save()} loading={saving} />
      {saved ? <Text style={[type.caption, { color: colors.successText, textAlign: 'center' }]}>Saved</Text> : null}

      <View style={styles.section}>
        <Text style={[type.subtitle, { color: colors.ink }]}>Account</Text>
        <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />

        <View style={styles.deleteCard}>
          <Text style={[type.label, { color: colors.errorText }]}>Delete account</Text>
          <Text style={[type.caption, { color: colors.muted }]}>
            Enter your password to confirm. This cannot be undone after 30 days.
          </Text>
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Your password"
          />
          <Button
            label={deleting ? 'Deleting…' : 'Delete my account'}
            variant="danger"
            onPress={confirmDelete}
            disabled={!password || deleting}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Icon name="book" size={16} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted }]}>
          Puo · Setswana lessons with Pitsi · v1.0.0
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  section: {
    marginTop: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.md,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchCopy: { flex: 1, gap: 2 },
  switch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dfe4e1',
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.blue },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
  },
  switchKnobOn: { alignSelf: 'flex-end' },
  deleteCard: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  footer: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
})
