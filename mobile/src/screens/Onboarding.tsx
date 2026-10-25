import React, { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { Pitsi } from '../components/Pitsi'
import { Button, Kicker, Screen, TextField } from '../components/ui'
import { colors, fonts, radius, spacing, type } from '../design/tokens'
import { enablePushNotifications } from '../lib/notifications'

const GOALS: { value: number; title: string; body: string }[] = [
  { value: 3, title: 'Casual', body: '3 lessons · a few minutes' },
  { value: 5, title: 'Regular', body: '5 lessons · 10 minutes' },
  { value: 8, title: 'Serious', body: '8 lessons · 15 minutes' },
]

const TIMES = ['17:00', '18:30', '20:00']

export function OnboardingScreen() {
  const { user, updateProfile, finishOnboarding, refreshMe } = useAuth()
  const [step, setStep] = useState(0)
  const [name, setName] = useState(user?.displayName ?? '')
  const [goal, setGoal] = useState(user?.dailyGoalLessons ?? 5)
  const [reminders, setReminders] = useState(false)
  const [time, setTime] = useState('18:30')
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    setBusy(true)
    try {
      let pushRegistered = false
      if (reminders) pushRegistered = await enablePushNotifications()
      await updateProfile({
        displayName: name.trim() || user?.displayName,
        dailyGoalLessons: goal,
        notificationPrefs: {
          reminderEnabled: reminders,
          reminderLocalTime: time,
          streakReminderEnabled: reminders,
        },
      })
      if (reminders && !pushRegistered) {
        Alert.alert(
          'Reminder saved',
          'Push notifications are not configured on this build yet, so the reminder is stored for later.',
        )
      }
      await refreshMe()
      await finishOnboarding()
    } catch (error) {
      Alert.alert('Could not save', error instanceof ApiError ? error.message : 'Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.dots}>
        {[0, 1, 2].map((index) => (
          <View key={index} style={[styles.dot, index <= step && styles.dotActive]} />
        ))}
      </View>

      {step === 0 ? (
        <View style={styles.step}>
          <View style={styles.mascot}>
            <Pitsi size={128} />
          </View>
          <Kicker>Welcome to Puo</Kicker>
          <Text style={[type.display, { marginTop: 6 }]}>Dumela! What should we call you?</Text>
          <TextField
            label="Your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder="Naledi"
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.step}>
          <Kicker>Daily goal</Kicker>
          <Text style={[type.display, { marginTop: 6 }]}>How much time feels right?</Text>
          <Text style={[type.bodySmall, { color: colors.muted, marginBottom: spacing.lg }]}>
            You can change this whenever you like.
          </Text>
          {GOALS.map((option) => {
            const active = goal === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setGoal(option.value)}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={styles.optionCopy}>
                  <Text style={[type.subtitle, { color: active ? colors.blueDark : colors.ink }]}>
                    {option.title}
                  </Text>
                  <Text style={[type.caption, { color: colors.muted }]}>{option.body}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.step}>
          <Kicker>Reminders</Kicker>
          <Text style={[type.display, { marginTop: 6 }]}>A nudge from Pitsi?</Text>
          <Text style={[type.bodySmall, { color: colors.muted, marginBottom: spacing.lg }]}>
            One reminder a day, in your local time. No noise, no streak guilt.
          </Text>

          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: reminders }}
            onPress={() => setReminders((current) => !current)}
            style={[styles.option, reminders && styles.optionActive]}
          >
            <View style={styles.optionCopy}>
              <Text style={[type.subtitle, { color: reminders ? colors.blueDark : colors.ink }]}>
                Daily reminder
              </Text>
              <Text style={[type.caption, { color: colors.muted }]}>
                {reminders ? 'On — pick a time below' : 'Off'}
              </Text>
            </View>
            <View style={[styles.switch, reminders && styles.switchOn]}>
              <View style={[styles.switchKnob, reminders && styles.switchKnobOn]} />
            </View>
          </Pressable>

          {reminders ? (
            <View style={styles.timeRow}>
              {TIMES.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: time === value }}
                  onPress={() => setTime(value)}
                  style={[styles.timeChip, time === value && styles.timeChipActive]}
                >
                  <Text style={[type.label, { color: time === value ? colors.white : colors.ink }]}>
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={step === 2 ? (busy ? 'Saving…' : 'Start learning') : 'Continue'}
          loading={busy}
          onPress={() => {
            if (step < 2) setStep(step + 1)
            else void finish()
          }}
        />
        {step > 0 ? (
          <Button label="Back" variant="ghost" onPress={() => setStep(step - 1)} />
        ) : null}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { justifyContent: 'space-between', paddingBottom: spacing.xxl },
  dots: { flexDirection: 'row', gap: 6, marginTop: spacing.lg },
  dot: { width: 26, height: 5, borderRadius: 4, backgroundColor: colors.line },
  dotActive: { backgroundColor: colors.blue },
  step: { marginTop: spacing.xxxl, gap: spacing.sm },
  mascot: { alignItems: 'center', marginBottom: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    borderRadius: radius.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  optionActive: { borderColor: colors.blue, backgroundColor: '#eaf7fc' },
  optionCopy: { flex: 1, gap: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.softLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: colors.blue },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.blue },
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
  timeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  timeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.softLine,
  },
  timeChipActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  actions: { gap: spacing.sm, marginTop: spacing.xxxl },
})
