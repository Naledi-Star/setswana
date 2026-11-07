import React, { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { IconButton, Button, Kicker, Screen, TextField } from '../../components/ui'
import { colors, radius, spacing, type } from '../../design/tokens'
import { useConfig } from '../../lib/useConfig'
import { enablePushNotifications } from '../../lib/notifications'
import type { SettingsScreenProps } from '../../navigation/types'

const TIMES = ['07:30', '12:30', '17:00', '18:30', '20:00']

function ModalShell({
  title,
  kicker,
  onClose,
  children,
}: {
  title: string
  kicker?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <Screen contentStyle={styles.sheet}>
      <View style={styles.sheetHeader}>
        <IconButton icon="close" label="Close" onPress={onClose} />
        <View style={styles.sheetTitle}>
          {kicker ? <Kicker>{kicker}</Kicker> : null}
          <Text style={[type.title, { color: colors.ink, marginTop: 2 }]}>{title}</Text>
        </View>
      </View>
      {children}
    </Screen>
  )
}

function memberSince(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function ProfileDetailsModal({ navigation }: SettingsScreenProps<'ProfileDetails'>) {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.displayName ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const displayName = name.trim()
    if (!displayName) {
      Alert.alert('Add a name', 'Your display name cannot be empty.')
      return
    }
    setSaving(true)
    try {
      await updateProfile({ displayName })
      navigation.goBack()
    } catch (error) {
      Alert.alert('Could not save', error instanceof ApiError ? error.message : 'Try again in a moment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell kicker="Account" title="Your details" onClose={() => navigation.goBack()}>
      <View style={styles.card}>
        <InfoRow label="Email" value={user?.email ?? 'Not set'} />
        <InfoRow label="Member since" value={memberSince(user?.createdAt)} />
        <InfoRow label="Time zone" value={user?.timezone ?? '—'} />
        <InfoRow label="Plan" value={user?.role === 'ADMIN' ? 'Admin' : 'Learner'} />
      </View>

      <TextField
        label="Display name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        placeholder="Your name"
      />
      <Button label={saving ? 'Saving…' : 'Save changes'} onPress={() => void save()} loading={saving} />
    </ModalShell>
  )
}

export function DailyGoalModal({ navigation }: SettingsScreenProps<'DailyGoal'>) {
  const { user, updateProfile } = useAuth()
  const { data: config } = useConfig()
  const options = config?.dailyGoalOptions?.length ? config.dailyGoalOptions : [3, 5, 8]
  const [goal, setGoal] = useState(user?.dailyGoalLessons ?? config?.defaultDailyGoal ?? 5)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile({ dailyGoalLessons: goal })
      navigation.goBack()
    } catch (error) {
      Alert.alert('Could not save', error instanceof ApiError ? error.message : 'Try again in a moment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalShell kicker="Practice" title="Daily goal" onClose={() => navigation.goBack()}>
      <Text style={[type.bodySmall, { color: colors.muted, marginBottom: spacing.lg }]}>
        Pick how many lessons you want to finish each day. You can change this any time.
      </Text>
      <View style={styles.chipRow}>
        {options.map((option) => (
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
      <Button
        label={saving ? 'Saving…' : 'Save goal'}
        onPress={() => void save()}
        loading={saving}
        style={{ marginTop: spacing.xl }}
      />
    </ModalShell>
  )
}

export function ReminderModal({ navigation }: SettingsScreenProps<'Reminder'>) {
  const { user, updateProfile } = useAuth()
  const [enabled, setEnabled] = useState(user?.notificationPrefs.reminderEnabled ?? false)
  const [time, setTime] = useState(user?.notificationPrefs.reminderLocalTime ?? '18:30')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      let pushOk = true
      if (enabled && !user?.notificationPrefs.reminderEnabled) {
        pushOk = await enablePushNotifications()
      }
      await updateProfile({
        notificationPrefs: {
          reminderEnabled: enabled,
          reminderLocalTime: time,
          streakReminderEnabled: enabled,
        },
      })
      navigation.goBack()
      if (enabled && !pushOk) {
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

  return (
    <ModalShell kicker="Notifications" title="Daily reminder" onClose={() => navigation.goBack()}>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        onPress={() => setEnabled((current) => !current)}
        style={styles.switchRow}
      >
        <View style={styles.switchCopy}>
          <Text style={[type.subtitle, { color: colors.ink }]}>Remind me to practise</Text>
          <Text style={[type.caption, { color: colors.muted }]}>One nudge a day at a time that suits you.</Text>
        </View>
        <View style={[styles.switch, enabled && styles.switchOn]}>
          <View style={[styles.switchKnob, enabled && styles.switchKnobOn]} />
        </View>
      </Pressable>

      {enabled ? (
        <View style={[styles.chipRow, { marginTop: spacing.lg }]}>
          {TIMES.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: time === option }}
              onPress={() => setTime(option)}
              style={[styles.chip, time === option && styles.chipActive]}
            >
              <Text style={[type.label, { color: time === option ? colors.white : colors.ink }]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Button
        label={saving ? 'Saving…' : 'Save reminder'}
        onPress={() => void save()}
        loading={saving}
        style={{ marginTop: spacing.xl }}
      />
    </ModalShell>
  )
}

export function SignOutModal({ navigation }: SettingsScreenProps<'SignOut'>) {
  const { signOut } = useAuth()
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await signOut()
    } catch (error) {
      Alert.alert('Could not sign out', error instanceof ApiError ? error.message : 'Try again in a moment.')
      setBusy(false)
    }
  }

  return (
    <ModalShell kicker="Session" title="Sign out?" onClose={() => navigation.goBack()}>
      <Text style={[type.bodySmall, { color: colors.muted, marginBottom: spacing.xl }]}>
        Your progress is saved on your account. Sign in again with your email and password to continue.
      </Text>
      <Button label={busy ? 'Signing out…' : 'Sign out'} onPress={() => void confirm()} loading={busy} />
      <Button
        label="Stay signed in"
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: spacing.sm }}
      />
    </ModalShell>
  )
}

export function DeleteAccountModal({ navigation }: SettingsScreenProps<'DeleteAccount'>) {
  const { deleteAccount } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const confirm = () => {
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
              setBusy(true)
              try {
                await deleteAccount(password)
              } catch (error) {
                Alert.alert(
                  'Could not delete',
                  error instanceof ApiError ? error.message : 'Check your password and try again.',
                )
              } finally {
                setBusy(false)
              }
            })()
          },
        },
      ],
    )
  }

  return (
    <ModalShell kicker="Session" title="Delete account" onClose={() => navigation.goBack()}>
      <Text style={[type.bodySmall, { color: colors.errorText, marginBottom: spacing.lg }]}>
        Enter your password to confirm. Your progress is hidden right away and cannot be recovered after 30 days.
      </Text>
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Your password"
      />
      <Button
        label={busy ? 'Deleting…' : 'Delete my account'}
        variant="danger"
        onPress={confirm}
        disabled={!password || busy}
      />
    </ModalShell>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[type.bodySmall, { color: colors.muted }]}>{label}</Text>
      <Text style={[type.bodySmall, { color: colors.ink, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  sheet: { paddingBottom: spacing.xxl },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  sheetTitle: { flex: 1 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
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
})
