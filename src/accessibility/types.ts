/** מצבי ניגודיות / צבע */
export type ContrastMode =
  | 'off'
  | 'high'
  | 'invert'
  | 'dark'
  | 'light'
  | 'blackYellow'
  | 'sepia';

export type SaturationMode = 'off' | 'low' | 'high' | 'mono' | 'grayscale';

export type CursorMode = 'off' | 'large' | 'largeDark' | 'largeLight' | 'black' | 'white';

export type TextMetric = 'fontSize' | 'lineHeight' | 'letterSpacing' | 'wordSpacing';

/** פרופיל מוכן לפי צורך */
export type A11yProfileId =
  | 'none'
  | 'motor'
  | 'dyslexia'
  | 'cognitive'
  | 'adhd'
  | 'vision'
  | 'seizure';

export type A11ySettings = {
  /** הסתרת כפתור הצף לגמרי (עד שחזור) */
  widgetHidden: boolean;
  panelOpen: boolean;
  profile: A11yProfileId;

  contrast: ContrastMode;
  saturation: SaturationMode;
  highlightLinks: boolean;
  highlightHeadings: boolean;
  highlightFocus: boolean;
  highlightElements: boolean;

  colorBg: string | null;
  colorText: string | null;
  colorHeadings: string | null;

  /** רמות 0=רגיל … 4 */
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  readableFont: boolean;
  dyslexiaFont: boolean;
  textAlign: 0 | 1 | 2;

  stopAnimations: boolean;
  reduceMotion: boolean;
  largeButtons: boolean;
  hideImages: boolean;
  readingGuide: boolean;
  readingMask: boolean;
  readingMode: boolean;
  pageStructure: boolean;
  bigCursor: CursorMode;
  keyboardNav: boolean;

  textToSpeech: boolean;
  screenReaderHints: boolean;
  muteMedia: boolean;

  zoomLevel: number;
};

export const A11Y_STORAGE_KEY = '@maaser/a11y-v1';

export const DEFAULT_A11Y: A11ySettings = {
  widgetHidden: false,
  panelOpen: false,
  profile: 'none',

  contrast: 'off',
  saturation: 'off',
  highlightLinks: false,
  highlightHeadings: false,
  highlightFocus: false,
  highlightElements: false,

  colorBg: null,
  colorText: null,
  colorHeadings: null,

  fontSize: 0,
  lineHeight: 0,
  letterSpacing: 0,
  wordSpacing: 0,
  readableFont: false,
  dyslexiaFont: false,
  textAlign: 0,

  stopAnimations: false,
  reduceMotion: false,
  largeButtons: false,
  hideImages: false,
  readingGuide: false,
  readingMask: false,
  readingMode: false,
  pageStructure: false,
  bigCursor: 'off',
  keyboardNav: false,

  textToSpeech: false,
  screenReaderHints: false,
  muteMedia: false,

  zoomLevel: 0,
};
