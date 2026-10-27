import React, { useState } from 'react'
import { Alert, Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { Icon } from '../../components/Icon'
import { BrandHeader, Button, Screen, TextField } from '../../components/ui'
import { Pitsi } from '../../components/Pitsi'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import { useConfig } from '../../lib/useConfig'
import { googleConfigured, GoogleButton } from './GoogleButton'

const logo = require('../../../assets/logo.png')

/**
 * Server validation errors that no visible input can be attached to (for example a
 * transport-only field) are listed here, so a rejected request never renders as
 * "Check the highlighted fields." with nothing highlighted.
 */
function unmappedFieldDetail(
  fields: Record<string, string> | undefined,
  rendered: string[],
): string {
  if (!fields) return ''
  return Object.entries(fields)
    .filter(([key]) => !rendered.includes(key))
    .map(([key, value]) => (key === 'body' ? value : `${key}: ${value}`))
    .join('\n')
}

export function WelcomeScreen({ navigation }: { navigation: { navigate: (screen: 'SignIn' | 'SignUp' | 'ForgotPassword') => void } }) {
  const { continueAsGuest } = useAuth()
  const { data: config } = useConfig()
  const queryClient = useQueryClient()
  const [guestBusy, setGuestBusy] = useState(false)
  // Show unless the server has explicitly turned guest play off — a slow or failed
  // config request must not make the button disappear.
  const guestPlayAllowed = config?.features.guestPlay !== false

  const startGuest = async () => {
    setGuestBusy(true)
    try {
      await continueAsGuest()
      await queryClient.invalidateQueries()
    } catch (error) {
      Alert.alert('Could not start', error instanceof ApiError ? error.message : 'Try again in a moment.')
    } finally {
      setGuestBusy(false)
    }
  }

  return (
    <Screen scroll bg={colors.appBg} contentStyle={styles.welcomeContent}>
      <View style={styles.orbit} pointerEvents="none">
        <View style={styles.orbitRing} />
        <OrbitLeaf color="#deb97c" style={{ top: 50 }} />
        <OrbitLeaf color="#77a8ae" style={{ top: 83, left: 23 }} />
        <OrbitLeaf color="#315e6c" style={{ top: 115, left: 43 }} />
      </View>

      <View style={styles.brand}>
        <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.wordmark}>Puo</Text>
      </View>
      <Text style={styles.eyebrow}>Setswana, one conversation at a time.</Text>

      <Text style={styles.introTitle}>
        <Text style={styles.introStrong}>A small lesson{`\n`}every day.</Text>
        {`\n`}A language for life.
      </Text>
      <Text style={styles.introBody}>
        Learn Setswana with Pitsi — short, playful lessons built around real conversation.
      </Text>

      <View style={styles.guide}>
        <View style={styles.sandBlob} pointerEvents="none" />
        <View style={styles.artWrap}>
          <View style={styles.leaves} pointerEvents="none">
            <Leaves />
          </View>
          <Pitsi size={170} />
        </View>
        <View style={styles.hello}>
          <View style={styles.helloTitleWrap}>
            <Text style={styles.helloTitle}>Dumela!</Text>
            <View style={styles.helloUnderline} />
          </View>
          <Text style={styles.helloBody}>
            I’m Pitsi. I’ll be here to guide you as you learn Setswana.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignUp')}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryLabel}>Get started</Text>
          <Icon name="arrow" size={22} color={colors.white} style={styles.buttonArrow} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('SignIn')}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryLabel}>I already have an account</Text>
        </Pressable>

        {guestPlayAllowed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: guestBusy }}
            disabled={guestBusy}
            onPress={() => void startGuest()}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
          >
            <Text style={styles.textButtonLabel}>
              {guestBusy ? 'Starting…' : 'Try a lesson first'}
            </Text>
            <Icon name="arrow" size={18} color={colors.blue} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.bottomPattern} pointerEvents="none" />
    </Screen>
  )
}

/** Leaves behind Pitsi, from the reference welcome screen. */
function Leaves() {
  return (
    <Svg width={150} height={136} viewBox="0 0 210 190" accessibilityElementsHidden>
      <Path
        d="M37 174C34 117 28 74 15 38M47 175c7-56 17-105 44-150M59 176c20-48 42-80 79-110M74 177c35-34 69-54 118-64"
        fill="none"
        stroke="#6b9090"
        strokeWidth={8}
        strokeLinecap="round"
      />
      <Path
        d="M21 85C3 68 1 46 6 21c18 24 23 43 15 64ZM49 100c-5-31 4-56 25-78 1 30-7 56-25 78ZM76 120c10-29 29-47 58-58-13 29-32 48-58 58Z"
        fill="#6b9090"
      />
    </Svg>
  )
}

function OrbitLeaf({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.orbitLeaf, style]} pointerEvents="none">
      <Svg width={25} height={24} viewBox="0 0 25 24" accessibilityElementsHidden>
        <Path d="M0 0 25 12 0 24Z" fill={color} />
      </Svg>
    </View>
  )
}

export function SignInScreen({
  navigation,
}: {
  navigation: { navigate: (screen: 'SignUp' | 'ForgotPassword') => void }
}) {
  const { signIn, signInWithGoogleToken } = useAuth()
  const { data: config } = useConfig()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    setFieldErrors({})
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFieldErrors(caught.fields ?? {})
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const google = async (idToken: string) => {
    try {
      await signInWithGoogleToken(idToken)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Google sign-in failed.')
    }
  }

  const unmappedDetail = unmappedFieldDetail(fieldErrors, ['email', 'password'])

  return (
    <Screen>
      <BrandHeader compact />
      <Text style={[type.display, { marginTop: spacing.lg }]}>Welcome back</Text>
      <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4, marginBottom: spacing.xxl }]}>
        Dumela gape — pick up where you left off.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={[type.bodySmall, { color: colors.errorText }]}>{error}</Text>
          {unmappedDetail ? (
            <Text style={[type.caption, { color: colors.errorText, marginTop: 4 }]}>
              {unmappedDetail}
            </Text>
          ) : null}
        </View>
      ) : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={fieldErrors.email}
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        error={fieldErrors.password}
        placeholder="Your password"
      />

      <Button label="Sign in" onPress={() => void submit()} loading={busy} style={styles.submit} />

      {googleConfigured && config?.features.googleSignIn ? (
        <>
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={[type.caption, { color: colors.muted }]}>or</Text>
            <View style={styles.orLine} />
          </View>
          <GoogleButton onIdToken={google} />
        </>
      ) : null}

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.linkRow}>
        <Text style={[type.bodySmall, styles.link]}>Forgot password?</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('SignUp')} style={styles.footerLink}>
        <Text style={[type.bodySmall, { color: colors.muted }]}>New to Puo? </Text>
        <Text style={[type.bodySmall, styles.link]}>Create an account</Text>
      </Pressable>
    </Screen>
  )
}

export function SignUpScreen({
  navigation,
  guestMode = false,
}: {
  navigation: { navigate: (screen: 'SignIn') => void; goBack: () => void }
  guestMode?: boolean
}) {
  const { signUp, signInWithGoogleToken } = useAuth()
  const { data: config } = useConfig()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError(null)
    setFields({})
    setBusy(true)
    try {
      await signUp({ email, password, displayName })
      await queryClient.invalidateQueries()
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message)
        setFields(caught.fields ?? {})
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  const google = async (idToken: string) => {
    try {
      await signInWithGoogleToken(idToken)
      await queryClient.invalidateQueries()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Google sign-in failed.')
    }
  }

  const unmappedDetail = unmappedFieldDetail(fields, ['displayName', 'email', 'password'])

  return (
    <Screen>
      {guestMode ? (
        <View style={styles.guestBanner}>
          <Text style={[type.label, { color: colors.blueDark }]}>Keep your progress</Text>
          <Text style={[type.bodySmall, { color: colors.muted }]}>
            Your free lesson and XP move into your new account.
          </Text>
        </View>
      ) : (
        <BrandHeader compact />
      )}

      <Text style={[type.display, { marginTop: spacing.lg }]}>Create your account</Text>
      <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4, marginBottom: spacing.xxl }]}>
        One short lesson a day is enough to keep going.
      </Text>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={[type.bodySmall, { color: colors.errorText }]}>{error}</Text>
          {unmappedDetail ? (
            <Text style={[type.caption, { color: colors.errorText, marginTop: 4 }]}>
              {unmappedDetail}
            </Text>
          ) : null}
        </View>
      ) : null}

      <TextField
        label="What should we call you?"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        error={fields.displayName}
        placeholder="Naledi"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        error={fields.email}
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        error={fields.password}
        hint="At least 10 characters, with a number."
        placeholder="Choose a password"
      />

      <Button label="Create account" onPress={() => void submit()} loading={busy} style={styles.submit} />

      {!guestMode && googleConfigured && config?.features.googleSignIn ? (
        <>
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={[type.caption, { color: colors.muted }]}>or</Text>
            <View style={styles.orLine} />
          </View>
          <GoogleButton onIdToken={google} />
        </>
      ) : null}

      <Pressable
        onPress={() => (guestMode ? navigation.goBack() : navigation.navigate('SignIn'))}
        style={styles.footerLink}
      >
        <Text style={[type.bodySmall, { color: colors.muted }]}>
          {guestMode ? 'Not yet? ' : 'Already have an account? '}
        </Text>
        <Text style={[type.bodySmall, styles.link]}>{guestMode ? 'Keep practising' : 'Sign in'}</Text>
      </Pressable>
    </Screen>
  )
}

export function ForgotPasswordScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<null | { emailDelivery: boolean }>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const { api } = await import('../../api/client')
      const result = await api.forgotPassword(email)
      setSent({ emailDelivery: result.emailDelivery })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send the request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <BrandHeader compact />
      <Text style={[type.display, { marginTop: spacing.lg }]}>Reset your password</Text>
      <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4, marginBottom: spacing.xxl }]}>
        We’ll send a single-use link that expires in 30 minutes.
      </Text>

      {sent ? (
        <View style={styles.infoCard}>
          <Text style={[type.subtitle, { color: colors.ink }]}>Request received</Text>
          <Text style={[type.bodySmall, { color: colors.muted, marginTop: 4 }]}>
            {sent.emailDelivery
              ? 'If that email has an account, the reset link is on its way.'
              : 'Email delivery is not switched on yet, so no message can be sent. Ask the Puo team to reset your password for now.'}
          </Text>
        </View>
      ) : (
        <>
          {error ? (
            <View style={styles.errorBanner}>
              <Text style={[type.bodySmall, { color: colors.errorText }]}>{error}</Text>
            </View>
          ) : null}
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Button label="Send reset link" onPress={() => void submit()} loading={busy} />
        </>
      )}

      <Pressable onPress={() => navigation.goBack()} style={styles.footerLink}>
        <Text style={[type.bodySmall, styles.link]}>Back to sign in</Text>
      </Pressable>
    </Screen>
  )
}

const styles = StyleSheet.create({
  link: { color: colors.blueDark, fontFamily: fonts.bodyBold },
  welcomeContent: {
    paddingHorizontal: 26,
    paddingBottom: spacing.huge,
    backgroundColor: colors.appBg,
  },
  orbit: { position: 'absolute', top: -4, right: -96, width: 180, height: 180 },
  orbitRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 15,
    borderColor: '#f1e8d8',
  },
  orbitLeaf: { position: 'absolute', left: 0, transform: [{ rotate: '13deg' }] },
  brand: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.xs },
  brandLogo: { width: 84, height: 84 },
  wordmark: {
    fontFamily: fonts.displayBlack,
    fontSize: 46,
    color: colors.navy,
    letterSpacing: -3,
  },
  eyebrow: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
    textAlign: 'center',
    color: colors.orange,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  introTitle: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.9,
    color: colors.navy,
  },
  introStrong: { fontFamily: fonts.displayBlack },
  introBody: {
    marginTop: spacing.md,
    color: colors.textLight,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
  },
  guide: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    minHeight: 190,
  },
  sandBlob: {
    position: 'absolute',
    left: -14,
    bottom: 4,
    width: 176,
    height: 132,
    backgroundColor: colors.sand,
    borderTopLeftRadius: 88,
    borderTopRightRadius: 100,
  },
  artWrap: { width: '46%', alignItems: 'center', justifyContent: 'flex-end' },
  leaves: { position: 'absolute', left: -30, bottom: -6 },
  hello: { flex: 1, paddingLeft: spacing.md, paddingBottom: spacing.lg },
  helloTitleWrap: { alignSelf: 'flex-start' },
  helloTitle: {
    fontFamily: fonts.displayCaveat,
    fontSize: 34,
    color: colors.navy,
    transform: [{ rotate: '-4deg' }],
  },
  helloUnderline: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.orange,
    marginTop: 2,
    alignSelf: 'stretch',
  },
  helloBody: {
    marginTop: spacing.sm,
    color: colors.textLight,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: { marginTop: spacing.xl, gap: spacing.md },
  primaryButton: {
    minHeight: 58,
    borderRadius: radius.lg,
    backgroundColor: colors.blue,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    shadowColor: colors.navy,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primaryLabel: { fontFamily: fonts.display, fontSize: 16, color: colors.white },
  buttonArrow: { position: 'absolute', right: 22 },
  secondaryButton: {
    minHeight: 58,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: '#36a9dc',
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.blue },
  textButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  textButtonLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.blue },
  pressed: { transform: [{ translateY: 2 }] },
  bottomPattern: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -14,
    height: 90,
    backgroundColor: colors.sand,
    opacity: 0.55,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  errorBanner: {
    backgroundColor: colors.errorTint,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  submit: { marginTop: spacing.sm },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  linkRow: { alignItems: 'center', marginTop: spacing.lg },
  footerLink: {
    marginTop: spacing.xxl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestBanner: {
    backgroundColor: colors.infoTint,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 4,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.infoTint,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
})
