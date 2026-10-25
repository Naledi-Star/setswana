import React, { useEffect, useState } from 'react'
import * as Google from 'expo-auth-session/providers/google'
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors, fonts, radius, spacing } from '../../design/tokens'

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID

export const googleConfigured = Boolean(webClientId || iosClientId || androidClientId)

export function GoogleButton({ onIdToken }: { onIdToken: (idToken: string) => Promise<void> }) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...(webClientId ? { clientId: webClientId } : {}),
    ...(iosClientId ? { iosClientId } : {}),
    ...(androidClientId ? { androidClientId } : {}),
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (response?.type !== 'success') return
    const idToken = response.params.id_token
    if (!idToken) return

    setBusy(true)
    onIdToken(idToken).finally(() => setBusy(false))
  }, [response, onIdToken])

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Continue with Google"
      disabled={!request || busy}
      onPress={() => {
        void promptAsync()
      }}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
    >
      {busy ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Text style={styles.label}>Continue with Google</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.softLine,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
})
