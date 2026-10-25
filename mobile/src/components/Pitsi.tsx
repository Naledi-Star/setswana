import React from 'react'
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg'
import { colors } from '../design/tokens'

export type PitsiState = 'happy' | 'celebrate' | 'listen'

type Props = {
  state?: PitsiState
  size?: number
}

export function Pitsi({ state = 'happy', size = 110 }: Props) {
  const celebrating = state === 'celebrate'

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 180 180"
      accessibilityRole="image"
      accessibilityLabel="Pitsi the zebra guide"
    >
      <G>
        <Path d="M48 42 33 14c21 2 31 12 34 29" fill={colors.navy} />
        <Path d="m132 42 15-28c-21 2-31 12-34 29" fill={colors.navy} />
        <Path d="M55 41 44 22c11 3 17 10 20 22" fill={colors.paper} />
        <Path d="m125 41 11-19c-11 3-17 10-20 22" fill={colors.paper} />
        <Path d="M75 27c3-9 11-14 20-14" stroke={colors.navy} strokeWidth="6" strokeLinecap="round" fill="none" />

        <Path
          d="M90 28c40 0 63 24 58 64-4 35-27 61-58 61S36 127 32 92C27 52 50 28 90 28Z"
          fill={colors.paper}
          stroke={colors.navy}
          strokeWidth="7"
        />

        <Path
          d="M87 32c-10 17-11 35-4 52M62 37c1 17 9 30 23 41M119 38c-2 16-11 29-25 40"
          fill="none"
          stroke={colors.navy}
          strokeLinecap="round"
          strokeWidth="9"
        />
        <Path
          d="M44 64c13 2 22 8 28 20M136 64c-13 2-22 8-28 20"
          fill="none"
          stroke={colors.navy}
          strokeLinecap="round"
          strokeWidth="8"
        />

        <Ellipse cx="64" cy="91" rx="11" ry="14" fill={colors.navy} />
        <Ellipse cx="116" cy="91" rx="11" ry="14" fill={colors.navy} />
        <Circle cx="68" cy="86" r="4" fill={colors.white} />
        <Circle cx="120" cy="86" r="4" fill={colors.white} />

        <Path
          d="M59 112c8-13 21-20 31-20s23 7 31 20c9 17-2 33-31 33s-40-16-31-33Z"
          fill="#e7ecea"
          stroke={colors.navy}
          strokeWidth="5"
        />
        <Ellipse cx="76" cy="120" rx="4.5" ry="6" fill={colors.navy} />
        <Ellipse cx="104" cy="120" rx="4.5" ry="6" fill={colors.navy} />
        <Path
          d={celebrating ? 'M74 131c10 12 22 12 32 0' : 'M77 131c9 7 17 7 26 0'}
          fill="none"
          stroke={colors.navy}
          strokeLinecap="round"
          strokeWidth="5"
        />

        <Path d="M50 145c20 16 60 16 80 0l-7 21H57l-7-21Z" fill={colors.blue} />
        <Path d="m90 152 9 17-9 7-9-7 9-17Z" fill={colors.gold} />

        {state === 'listen' && (
          <G fill="none" stroke={colors.blue} strokeLinecap="round" strokeWidth="4">
            <Path d="M148 84c6 4 6 12 0 16M156 78c10 7 10 21 0 28" />
          </G>
        )}

        {celebrating && (
          <G fill="none" strokeLinecap="round" strokeWidth="5">
            <Path d="m21 47-9-9M158 46l10-10" stroke={colors.coral} />
            <Path d="M17 75H5M163 74h12" stroke={colors.gold} />
            <Path d="m28 25-3-12M152 25l4-12" stroke={colors.blue} />
          </G>
        )}
      </G>
    </Svg>
  )
}
