import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg'
import { colors } from '../design/tokens'

export type IconName =
  | 'home'
  | 'cards'
  | 'chart'
  | 'flame'
  | 'heart'
  | 'bolt'
  | 'speaker'
  | 'arrow'
  | 'close'
  | 'check'
  | 'lock'
  | 'book'
  | 'trophy'
  | 'shuffle'
  | 'settings'
  | 'mic'
  | 'plus'
  | 'trash'
  | 'chevronLeft'
  | 'eye'
  | 'edit'
  | 'admin'

type Props = {
  name: IconName
  size?: number
  color?: string
  filled?: boolean
  style?: StyleProp<ViewStyle>
}

export function Icon({ name, size = 22, color = colors.ink, filled = false, style }: Props) {
  const strokeProps = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style} accessibilityElementsHidden>
      {name === 'home' && (
        <>
          <Path d="m3 11 9-8 9 8" {...strokeProps} />
          <Path d="M5 10v10h14V10M9 20v-6h6v6" {...strokeProps} />
        </>
      )}
      {name === 'cards' && (
        <>
          <Rect x="4" y="5" width="14" height="16" rx="3" {...strokeProps} />
          <Path d="m9 5 .7-1.4A3 3 0 0 1 13.5 2l4.7 2a3 3 0 0 1 1.6 3.9L18 12" {...strokeProps} />
          <Path d="M8 10h6M8 14h4" {...strokeProps} />
        </>
      )}
      {name === 'chart' && <Path d="M4 19V9M10 19V5M16 19v-7M22 19H2" {...strokeProps} />}
      {name === 'flame' && (
        <Path
          d="M12 22c4 0 7-2.7 7-6.4 0-2.8-1.5-5.4-4.5-7.8.1 2.2-1 3.7-2.2 4.5.2-4-2-7.4-5.4-9.3.3 3.4-2 5.8-2 9.1C4.9 17.8 8.1 22 12 22Z"
          {...strokeProps}
          fill={filled ? color : 'none'}
        />
      )}
      {name === 'heart' && (
        <Path
          d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"
          {...strokeProps}
          fill={filled ? color : 'none'}
        />
      )}
      {name === 'bolt' && (
        <Path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" {...strokeProps} fill={filled ? color : 'none'} />
      )}
      {name === 'speaker' && (
        <>
          <Path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" {...strokeProps} />
          <Path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" {...strokeProps} />
        </>
      )}
      {name === 'arrow' && <Path d="m9 18 6-6-6-6" {...strokeProps} />}
      {name === 'close' && <Path d="m6 6 12 12M18 6 6 18" {...strokeProps} />}
      {name === 'check' && <Path d="m5 12 4 4L19 6" {...strokeProps} />}
      {name === 'lock' && (
        <>
          <Rect x="5" y="10" width="14" height="11" rx="3" {...strokeProps} />
          <Path d="M8 10V7a4 4 0 0 1 8 0v3" {...strokeProps} />
        </>
      )}
      {name === 'book' && (
        <>
          <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" {...strokeProps} />
          <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" {...strokeProps} />
        </>
      )}
      {name === 'trophy' && (
        <>
          <Path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" {...strokeProps} />
          <Path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4" {...strokeProps} />
        </>
      )}
      {name === 'shuffle' && (
        <Path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" {...strokeProps} />
      )}
      {name === 'settings' && (
        <>
          <Circle cx="12" cy="12" r="3.2" {...strokeProps} />
          <Path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
            {...strokeProps}
          />
        </>
      )}
      {name === 'mic' && (
        <>
          <Rect x="9" y="2" width="6" height="11" rx="3" {...strokeProps} />
          <Path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" {...strokeProps} />
        </>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...strokeProps} />}
      {name === 'trash' && (
        <>
          <Path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" {...strokeProps} />
          <Path d="M10 11v6M14 11v6" {...strokeProps} />
        </>
      )}
      {name === 'chevronLeft' && <Path d="m15 18-6-6 6-6" {...strokeProps} />}
      {name === 'eye' && (
        <>
          <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" {...strokeProps} />
          <Circle cx="12" cy="12" r="3" {...strokeProps} />
        </>
      )}
      {name === 'edit' && (
        <>
          <Path d="M12 20h9" {...strokeProps} />
          <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" {...strokeProps} />
        </>
      )}
      {name === 'admin' && (
        <>
          <Rect x="3" y="4" width="18" height="16" rx="3" {...strokeProps} />
          <Path d="M3 10h18M9 20V10" {...strokeProps} />
        </>
      )}
    </Svg>
  )
}

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden>
      <Path
        d="M8 10h12v26c0 6 4 10 10 10h4v10l10-10c6 0 10-4 10-10V10H42v24c0 2-1 3-3 3s-3-1-3-3V10H24v14c0 2-1 3-3 3s-3-1-3-3V10H8Z"
        fill={colors.navy}
      />
      <Path d="M14 14h3M14 20h3M14 26h3M47 14h3M47 20h3" stroke={colors.paper} strokeWidth="2" />
      <Path d="M12 42h40" stroke={colors.paper} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  )
}
