import React, { useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/AuthProvider'
import { BrandHeader, Button, Kicker, Screen, TextField } from '../../components/ui'
import { Pitsi } from '../../components/Pitsi'
import { colors, fonts, radius, spacing, type } from '../../design/tokens'
import { useConfig } from '../../lib/useConfig'
import { googleConfigured, GoogleButton } from './GoogleButton'

const logo = require('../../../assets/logo.png')

export function WelcomeScreen({ navigation }: { navigation: { navigate: (screen: 'SignIn' | 'SignUp' | 'ForgotPassword') => void } }) {
  const { continueAsGuest } = useAuth()
  const { data: config } = useConfig()
  const queryClient = useQueryClient()
  const [guestBusy, setGuestBusy] = useState(false)

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
    <Screen scroll contentStyle={styles.welcomeContent}>
      <View style={styles.hero}>
        <Image source={logo} style={styles.heroLogo} resizeMode="contain" />
        <Text style={styles.heroWordmark}>Puo</Text>
        <Kicker>Setswana, one conversation at a time.</Kicker>
        <Text style={[type.displayXL, styles.heroTitle]}>
          A small lesson every day. A language for life.
        </Text>
        <Text style={[type.body, styles.heroBody]}>
          Learn Setswana with Pitsi — short, playful lessons built around real conversation.
        </Text>
      </View>

      <View style={styles.mascotRow}>
        <Pitsi size={132} />
        <View style={styles.speechBubble}>
          <Text style={[type.subtitle, { color: colors.ink }]}>Dumela!</Text>
          <Text style={[type.bodySmall, { color: colors.muted }]}>
            I’ll keep you company while you learn. Ready for your first words?
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Get started" onPress={() => navigation.navigate('SignUp')} />
        <Button
          label="I already have an account"
          variant="secondary"
          onPress={() => navigation.navigate('SignIn')}
        />
        {config?.features.guestPlay ? (
          <Button
            label={guestBusy ? 'Starting…' : 'Try a lesson first'}
            variant="ghost"
            loading={guestBusy}
            onPress={() => void startGuest()}
          />
        ) : null}
      </View>
    </Screen>
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
  welcomeContent: { paddingBottom: spacing.huge },
  hero: { marginTop: spacing.xxl, alignItems: 'flex-start', gap: spacing.sm },
  heroLogo: { width: 92, height: 92, alignSelf: 'center' },
  heroWordmark: {
    fontFamily: fonts.displayBlack,
    fontSize: 44,
    color: colors.navy,
    letterSpacing: -2,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: { color: colors.ink, marginTop: spacing.sm },
  heroBody: { color: colors.muted, marginTop: spacing.sm },
  mascotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  speechBubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: 4,
  },
  actions: { marginTop: spacing.xxl, gap: spacing.md },
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
