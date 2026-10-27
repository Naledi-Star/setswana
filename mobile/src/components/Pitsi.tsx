import React from 'react'
import { Image } from 'react-native'

const pitsi = require('../../assets/pitsi.png')

export type PitsiState = 'happy' | 'celebrate' | 'listen'

type Props = {
  /** Kept so screens can express intent; the supplied artwork is a single pose. */
  state?: PitsiState
  size?: number
}

/**
 * Pitsi, the zebra guide. This is the owner's illustration
 * (`assets/brand/pitsi.png`), used everywhere the mascot appears.
 */
export function Pitsi({ state = 'happy', size = 110 }: Props) {
  void state

  return (
    <Image
      source={pitsi}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Pitsi the zebra guide"
    />
  )
}
