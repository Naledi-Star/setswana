import React, { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { mediaUrl } from '../api/client'
import { colors, fonts, radius, spacing } from '../design/tokens'
import { Icon } from './Icon'

export function AudioButton({
  audioUrl,
  label = 'Listen',
  variant = 'tile',
}: {
  audioUrl: string | null
  label?: string
  variant?: 'tile' | 'inline' | 'large'
}) {
  const source = mediaUrl(audioUrl)
  const player = useAudioPlayer(source ? { uri: source } : null)
  const status = useAudioPlayerStatus(player)

  useEffect(() => {
    return () => {
      try {
        player.pause()
      } catch {
        // player may already be released
      }
    }
  }, [player])

  if (!source) return null

  const play = () => {
    try {
      player.seekTo(0)
      player.play()
    } catch {
      // ignore playback errors; the button remains usable
    }
  }

  if (variant === 'inline') {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={play} style={styles.inline}>
        <Icon name="speaker" size={18} color={colors.blueDark} />
        <Text style={styles.inlineLabel}>{status.playing ? 'Playing…' : label}</Text>
      </Pressable>
    )
  }

  if (variant === 'large') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={play}
        style={({ pressed }) => [styles.large, pressed && { opacity: 0.85 }]}
      >
        <Icon name="speaker" size={22} color={colors.white} />
        <View>
          <Text style={styles.largeLabel}>{status.playing ? 'Playing…' : label}</Text>
          <Text style={styles.largeHint}>Owner recording</Text>
        </View>
      </Pressable>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={play}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
    >
      <Icon name="speaker" size={20} color={colors.white} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.infoTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  inlineLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.blueDark },
  large: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.blue,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: colors.blueDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  largeLabel: { fontFamily: fonts.display, fontSize: 15, color: colors.white },
  largeHint: { fontFamily: fonts.body, fontSize: 10, color: '#d9f0fa' },
})
