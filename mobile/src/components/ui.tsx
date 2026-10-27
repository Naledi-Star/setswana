import React from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fonts, layout, radius, shadows, spacing, type } from '../design/tokens'
import { Icon, type IconName } from './Icon'

const logo = require('../../assets/logo.png')

export function Screen({
  children,
  scroll = true,
  bg = colors.white,
  contentStyle,
  footer,
}: {
  children: React.ReactNode
  scroll?: boolean
  bg?: string
  contentStyle?: StyleProp<ViewStyle>
  footer?: React.ReactNode
}) {
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: bg }]} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.screenContent, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screenContent, styles.flex, contentStyle]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  )
}

export function BrandHeader({ right, compact = false }: { right?: React.ReactNode; compact?: boolean }) {
  return (
    <View style={[styles.brandRow, compact && styles.brandRowCompact]}>
      <View style={styles.brandLockup}>
        <Image source={logo} style={compact ? styles.logoSmall : styles.logo} resizeMode="contain" />
        <Text style={[styles.wordmark, compact && styles.wordmarkSmall]}>Puo</Text>
      </View>
      {right}
    </View>
  )
}

export function StatChip({
  icon,
  value,
  tone = 'blue',
}: {
  icon: IconName
  value: string | number
  tone?: 'blue' | 'streak'
}) {
  const streak = tone === 'streak'
  return (
    <View style={[styles.statChip, { backgroundColor: streak ? colors.streakTint : colors.infoTint }]}>
      <Icon name={icon} size={16} color={streak ? colors.streakText : colors.blueDark} filled />
      <Text style={[styles.statValue, { color: streak ? colors.streakText : colors.blueDark }]}>
        {typeof value === 'number' ? String(value) : value}
      </Text>
    </View>
  )
}

export function Kicker({ children, color = colors.coral }: { children: React.ReactNode; color?: string }) {
  return <Text style={[type.kicker, { color }]}>{children}</Text>
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  style,
}: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  icon?: IconName
  style?: StyleProp<ViewStyle>
}) {
  const isDisabled = disabled || loading
  const palette = {
    primary: { background: colors.blue, shadow: colors.blueDark, text: colors.white },
    secondary: { background: colors.infoTint, shadow: '#bcdbe6', text: colors.blueDark },
    ghost: { background: 'transparent', shadow: 'transparent', text: colors.blueDark },
    danger: { background: colors.coral, shadow: '#b44b39', text: colors.white },
  }[variant]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: isDisabled ? colors.disabled : palette.background,
          shadowColor: isDisabled ? colors.disabledShadow : palette.shadow,
        },
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          {icon && <Icon name={icon} size={19} color={isDisabled ? '#eaf0ed' : palette.text} />}
          <Text style={[type.button, { color: isDisabled ? '#eaf0ed' : palette.text }]}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'neutral',
  size = 20,
}: {
  icon: IconName
  onPress: () => void
  label: string
  tone?: 'neutral' | 'blue' | 'coral'
  size?: number
}) {
  const palette = {
    neutral: { background: '#edf0ec', color: '#718087' },
    blue: { background: colors.infoTint, color: colors.blueDark },
    coral: { background: colors.errorTint, color: colors.coral },
  }[tone]

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: palette.background },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Icon name={icon} size={size} color={palette.color} />
    </Pressable>
  )
}

export function ProgressBar({ value, tone = colors.green }: { value: number; tone?: string }) {
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: tone }]} />
    </View>
  )
}

export function Hearts({ hearts, max }: { hearts: number; max: number }) {
  return (
    <View style={styles.heartsRow} accessibilityLabel={`${hearts} of ${max} hearts`}>
      {Array.from({ length: max }).map((_, index) => (
        <Icon
          key={index}
          name="heart"
          size={17}
          color={index < hearts ? colors.coral : '#d9dfdc'}
          filled={index < hearts}
        />
      ))}
    </View>
  )
}

export function OptionCard({
  label,
  status,
  onPress,
  disabled,
  prefix,
}: {
  label: string
  status?: 'correct' | 'wrong' | 'selected' | null
  onPress: () => void
  disabled?: boolean
  prefix?: string
}) {
  const tone =
    status === 'correct'
      ? { border: colors.green, background: colors.successTint, text: colors.successText }
      : status === 'wrong'
        ? { border: colors.coral, background: colors.errorTint, text: colors.errorText }
        : status === 'selected'
          ? { border: colors.blue, background: '#eaf7fc', text: colors.ink }
          : { border: colors.softLine, background: colors.white, text: colors.ink }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionCard,
        { borderColor: tone.border, backgroundColor: tone.background },
        pressed && !disabled && { opacity: 0.85 },
      ]}
    >
      {prefix ? <Text style={[styles.optionPrefix, { color: tone.text }]}>{prefix}</Text> : null}
      <Text style={[styles.optionLabel, { color: tone.text }]}>{label}</Text>
      {status === 'correct' && <Icon name="check" size={18} color={colors.white} />}
      {status === 'wrong' && <Icon name="close" size={18} color={colors.white} />}
    </Pressable>
  )
}

export function TextField({
  label,
  hint,
  error,
  ...props
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && styles.inputMultiline, error ? styles.inputError : null]}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  )
}

export function SectionHeading({ kicker, title, right }: { kicker?: string; title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.flexShrink}>
        {kicker ? <Kicker>{kicker}</Kicker> : null}
        <Text style={[type.title, { color: colors.ink, marginTop: 2 }]}>{title}</Text>
      </View>
      {right}
    </View>
  )
}

export function EmptyState({
  icon = 'book',
  title,
  body,
  action,
}: {
  icon?: IconName
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={colors.blueDark} />
      </View>
      <Text style={[type.subtitle, styles.centerText, { color: colors.ink }]}>{title}</Text>
      <Text style={[type.bodySmall, styles.centerText, { color: colors.muted }]}>{body}</Text>
      {action}
    </View>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.errorTint }]}>
        <Icon name="close" size={24} color={colors.coral} />
      </View>
      <Text style={[type.subtitle, styles.centerText]}>{message}</Text>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} style={styles.retryButton} /> : null}
    </View>
  )
}

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.blue} />
      <Text style={[type.bodySmall, { color: colors.muted }]}>{label}</Text>
    </View>
  )
}

export function FeedbackFooter({
  state,
  title,
  body,
  actionLabel,
  onAction,
  disabled,
}: {
  state: 'correct' | 'wrong' | 'neutral'
  title: string
  body?: string
  actionLabel: string
  onAction: () => void
  disabled?: boolean
}) {
  const background =
    state === 'correct' ? colors.successFooter : state === 'wrong' ? colors.errorFooter : '#f1f2ed'
  const titleColor =
    state === 'correct' ? colors.successText : state === 'wrong' ? colors.errorText : colors.ink

  return (
    <View style={[styles.feedback, { backgroundColor: background }]} accessibilityLiveRegion="polite">
      <View style={styles.feedbackCopy}>
        <Text style={[type.subtitle, { color: titleColor }]}>{title}</Text>
        {body ? <Text style={[type.caption, { color: colors.muted }]}>{body}</Text> : null}
      </View>
      <Button label={actionLabel} onPress={onAction} disabled={disabled} style={styles.feedbackButton} />
    </View>
  )
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: layout.screenGutter,
    paddingBottom: spacing.xxxl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    height: 32,
    borderRadius: 11,
  },
  statValue: { fontFamily: fonts.displayBlack, fontSize: 13 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  buttonPressed: { transform: [{ translateY: 3 }], shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: '#e2e6e3',
    overflow: 'hidden',
    flex: 1,
  },
  progressFill: { height: '100%', borderRadius: radius.pill },
  heartsRow: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  optionCard: {
    minHeight: 58,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionPrefix: { fontFamily: fonts.displayBlack, fontSize: 14, width: 20 },
  optionLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20 },
  field: { gap: 6, marginBottom: spacing.md },
  fieldLabel: { ...type.label, color: colors.ink },
  input: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  inputError: { borderColor: colors.coral },
  fieldError: { ...type.caption, color: colors.errorText },
  fieldHint: { ...type.caption, color: colors.muted },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.huge,
    paddingHorizontal: spacing.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.infoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: { textAlign: 'center' },
  retryButton: { marginTop: spacing.sm, paddingHorizontal: spacing.xxl },
  loading: { paddingVertical: spacing.huge, alignItems: 'center', gap: spacing.sm },
  feedback: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  feedbackCopy: { flex: 1, gap: 2 },
  feedbackButton: { minWidth: 128 },
  shell: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: spacing.xxxl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  brandRowCompact: {
    paddingBottom: spacing.sm,
  },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 40, height: 40 },
  logoSmall: { width: 30, height: 30 },
  wordmark: { fontFamily: fonts.displayBlack, fontSize: 26, color: colors.navy, letterSpacing: -0.8 },
  wordmarkSmall: { fontSize: 18 },
  eyebrowText: {
    color: colors.orange,
    fontFamily: fonts.displayCaveat,
    fontSize: 11,
    letterSpacing: 0.3,
  },
  headline: {
    fontFamily: fonts.displayCaveat,
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
    color: colors.ink,
    marginTop: spacing.lg,
  },
  headlineSubtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: colors.muted,
    marginTop: spacing.md,
  },
  guide: {
    width: '100%',
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.softLine,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  artWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  leftCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  greetKicker: { color: colors.orange, fontFamily: fonts.displayCaveat, fontSize: 12, letterSpacing: 0.3 },
  greetTitle: { color: colors.ink, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: spacing.md, width: '100%', marginTop: spacing.xxl },
  actionsVertical: { flexDirection: 'column', gap: spacing.sm, width: '100%' },
})
