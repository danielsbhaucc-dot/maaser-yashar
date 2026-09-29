import { TextStyle } from 'react-native';

/**
 * טיפוגרפיה עברית — שתי משפחות בלבד
 * UI/Display → Heebo (400 / 600 / 700)
 * Numbers → Rubik 700
 * שמות fontFamily נשארים תואמים ל-@font-face / useFonts
 */
export const fonts = {
  display: 'Heebo_700Bold',
  displaySemi: 'Heebo_600SemiBold',
  displayExtra: 'Heebo_700Bold',

  regular: 'Heebo_400Regular',
  medium: 'Heebo_600SemiBold',
  semi: 'Heebo_600SemiBold',
  bold: 'Heebo_700Bold',
  extra: 'Heebo_700Bold',

  num: 'Rubik_700Bold',
  numBold: 'Rubik_700Bold',
  numRegular: 'Rubik_700Bold',
};

/** עם dir=rtl / I18nManager RTL — start = ימין בעברית (עובד בווב ובנייד) */
const rtl: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'start',
};

export const type = {
  brand: {
    fontFamily: fonts.displayExtra,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.4,
    ...rtl,
  } satisfies TextStyle,

  h1: {
    fontFamily: fonts.displayExtra,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
    ...rtl,
  } satisfies TextStyle,

  h2: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    ...rtl,
  } satisfies TextStyle,

  h3: {
    fontFamily: fonts.extra,
    fontSize: 17,
    lineHeight: 24,
    ...rtl,
  } satisfies TextStyle,

  /** שם / הדגשה זהובה */
  highlight: {
    fontFamily: fonts.displayExtra,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.5,
    ...rtl,
  } satisfies TextStyle,

  emphasis: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 24,
    ...rtl,
  } satisfies TextStyle,

  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 25,
    ...rtl,
  } satisfies TextStyle,

  bodySm: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 22,
    ...rtl,
  } satisfies TextStyle,

  caption: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
    ...rtl,
  } satisfies TextStyle,

  eyebrow: {
    fontFamily: fonts.extra,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.7,
    ...rtl,
  } satisfies TextStyle,

  moneyHero: {
    fontFamily: fonts.numBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.8,
    writingDirection: 'rtl',
    textAlign: 'start',
  } satisfies TextStyle,

  money: {
    fontFamily: fonts.num,
    fontSize: 15,
    lineHeight: 20,
    writingDirection: 'rtl',
    textAlign: 'start',
  } satisfies TextStyle,

  button: {
    fontFamily: fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    ...rtl,
  } satisfies TextStyle,

  chat: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 25,
    ...rtl,
  } satisfies TextStyle,

  chatMe: {
    fontFamily: fonts.semi,
    fontSize: 15,
    lineHeight: 25,
    ...rtl,
  } satisfies TextStyle,
};

export const rtlText = rtl;
