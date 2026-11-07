import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../../auth/AuthProvider'
import { Icon, type IconName } from '../../components/Icon'
import { Card, Screen } from '../../components/ui'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import type { SettingsStackParamList } from '../../navigation/types'

type Nav = NativeStackNavigationProp<SettingsStackParamList>

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return `${first}${last}`.toUpperCase()
}

function memberSince(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function ProfileScreen() {
  const navigation = useNavigation<Nav>()
  const { user, stats } = useAuth()

  const reminderValue = user?.notificationPrefs.reminderEnabled
    ? user.notificationPrefs.reminderLocalTime
    : 'Off'

  return (
    <Screen contentStyle={styles.content}>
      <Text style={[type.displayXL, { marginTop: spacing.lg }]}>Profile</Text>

      <Card style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(user?.displayName ?? '')}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.name}>{user?.displayName ?? 'Learner'}</Text>
          <Text style={styles.email}>{user?.email ?? 'No email on this account'}</Text>
          <Text style={styles.meta}>Member since {memberSince(user?.createdAt)}</Text>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <Stat value={String(stats?.totalXp ?? 0)} label="Total XP" tint={colors.infoTint} ink={colors.blueDark} />
        <Stat value={String(stats?.currentStreak ?? 0)} label="Day streak" tint={colors.streakTint} ink={colors.streakText} />
        <Stat
          value={`${stats?.lessonsToday ?? 0}/${stats?.dailyGoal ?? user?.dailyGoalLessons ?? 5}`}
          label="Today"
          tint={colors.successTint}
          ink={colors.successText}
        />
      </View>

      <Text style={[type.kicker, styles.sectionKicker]}>Account</Text>
      <View style={styles.menu}>
        <MenuRow
          icon="edit"
          title="Account details"
          value={user?.displayName ?? 'Your name'}
          onPress={() => navigation.navigate('ProfileDetails')}
        />
        <MenuRow
          icon="bolt"
          title="Daily goal"
          value={`${user?.dailyGoalLessons ?? 5} lessons a day`}
          onPress={() => navigation.navigate('DailyGoal')}
        />
        <MenuRow
          icon="heart"
          title="Daily reminder"
          value={reminderValue}
          onPress={() => navigation.navigate('Reminder')}
        />
      </View>

      <Text style={[type.kicker, styles.sectionKicker]}>Session</Text>
      <View style={styles.menu}>
        <MenuRow icon="lock" title="Sign out" onPress={() => navigation.navigate('SignOut')} />
        <MenuRow
          icon="trash"
          title="Delete account"
          danger
          onPress={() => navigation.navigate('DeleteAccount')}
        />
      </View>

      <View style={styles.footer}>
        <Icon name="book" size={16} color={colors.muted} />
        <Text style={[type.caption, { color: colors.muted }]}>Learn Setswana · 1.0.0</Text>
      </View>
    </Screen>
  )
}

function Stat({ value, label, tint, ink }: { value: string; label: string; tint: string; ink: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: ink }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function MenuRow({
  icon,
  title,
  value,
  danger = false,
  onPress,
}: {
  icon: IconName
  title: string
  value?: string
  danger?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}: ${value}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
    >
      <View style={[styles.menuIcon, danger && { backgroundColor: colors.errorTint }]}>
        <Icon name={icon} size={18} color={danger ? colors.errorText : colors.blueDark} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={[type.subtitle, { color: danger ? colors.errorText : colors.ink }]}>{title}</Text>
        {value ? <Text style={[type.caption, { color: colors.muted }]}>{value}</Text> : null}
      </View>
      <Icon name="arrow" size={18} color={colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.infoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.displayBlack, fontSize: 22, color: colors.blueDark },
  heroCopy: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: spacing.md,
    gap: 2,
  },
  statValue: { fontFamily: fonts.display, fontSize: 16 },
  statLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  sectionKicker: { marginTop: spacing.xxl, marginBottom: spacing.sm, color: colors.muted },
  menu: { gap: spacing.sm },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  pressed: { opacity: 0.85 },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.infoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1, gap: 1 },
  footer: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
})
