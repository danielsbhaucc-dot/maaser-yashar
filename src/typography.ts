import { TextStyle } from 'react-native';

/**
 * טיפוגרפיה עברית מלאה
 * Display → Assistant (כותרות חזקות בעברית)
 * UI/Body → Heebo (קריאות מעולה)
 * Numbers → Rubik (סכומים)
 */
export const fonts = {
  display: 'Assistant_700Bold',
  displaySemi: 'Assistant_600SemiBold',
  displayExtra: 'Assistant_800ExtraBold',

  regular: 'Heebo_400Regular',
  medium: 'Heebo_500Medium',
  semi: 'Heebo_600SemiBold',
  bold: 'Heebo_700Bold',
  extra: 'Heebo_800ExtraBold',

  num: 'Rubik_600SemiBold',
  numBold: 'Rubik_700Bold',
  numRegular: 'Rubik_400Regular',
};

const rtl: TextStyle = {
  writingDirection: 'rtl',
  textAlign: 'right',
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
    fontSize: 13,
    lineHeight: 21,
    ...rtl,
  } satisfies TextStyle,

  caption: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    ...rtl,
  } satisfies TextStyle,

  eyebrow: {
    fontFamily: fonts.extra,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.7,
    ...rtl,
  } satisfies TextStyle,

  moneyHero: {
    fontFamily: fonts.numBold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.8,
    writingDirection: 'rtl',
    textAlign: 'right',
  } satisfies TextStyle,

  money: {
    fontFamily: fonts.num,
    fontSize: 15,
    lineHeight: 20,
    writingDirection: 'rtl',
    textAlign: 'right',
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
