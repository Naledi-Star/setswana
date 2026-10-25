import { Platform, TextStyle, ViewStyle } from 'react-native'

export const colors = {
  ink: '#172b38',
  muted: '#75858d',
  paper: '#fffdf7',
  cream: '#f4f1e7',
  blue: '#25a8d8',
  blueDark: '#147da6',
  coral: '#f06b55',
  gold: '#f4b83f',
  green: '#42a879',
  navy: '#132b39',
  line: '#e5e7e1',
  white: '#ffffff',
  infoTint: '#e3f4fb',
  errorTint: '#fff0ed',
  errorText: '#b44b39',
  errorFooter: '#fde5df',
  successTint: '#eaf7f1',
  successText: '#257b59',
  successFooter: '#dcf2e7',
  streakTint: '#fff0dc',
  streakText: '#dc7628',
  goldTint: '#fff2cc',
  goldText: '#cf8e14',
  softLine: '#d8dedd',
  disabled: '#b8c2c0',
  disabledShadow: '#939e9c',
  navInactive: '#89959a',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const

export const fonts = {
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  display: 'Nunito_800ExtraBold',
  displayBlack: 'Nunito_900Black',
} as const

const shadowBase = Platform.select<ViewStyle>({
  ios: {
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
  },
  default: { elevation: 4 },
})

export const shadows = {
  card: shadowBase,
  soft: Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.navy,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    default: { elevation: 2 },
  }),
}

export const type = {
  displayXL: {
    fontFamily: fonts.displayBlack,
    fontSize: 32,
    letterSpacing: -1.2,
    lineHeight: 36,
  } satisfies TextStyle,
  display: {
    fontFamily: fonts.displayBlack,
    fontSize: 26,
    letterSpacing: -0.8,
    lineHeight: 30,
  } satisfies TextStyle,
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 25,
  } satisfies TextStyle,
  subtitle: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 21,
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  } satisfies TextStyle,
  bodySmall: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  } satisfies TextStyle,
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    lineHeight: 16,
  } satisfies TextStyle,
  caption: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
  } satisfies TextStyle,
  kicker: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  button: {
    fontFamily: fonts.display,
    fontSize: 15,
    letterSpacing: -0.2,
    lineHeight: 20,
  } satisfies TextStyle,
}

export const layout = {
  maxContentWidth: 620,
  tabletBreakpoint: 768,
  screenGutter: spacing.xl,
  touchTarget: 44,
}
