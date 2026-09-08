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

export type TextMetric =
  | 'fontSize'
  | 'lineHeight'
  | 'letterSpacing'
  | 'wordSpacing'
  | 'contentSpacing'
  | 'zoomLevel';

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
  highlightHover: boolean;

  colorBg: string | null;
  colorText: string | null;
  colorHeadings: string | null;

  /** רמות 0=רגיל … 4 */
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  contentSpacing: number;
  readableFont: boolean;
  dyslexiaFont: boolean;
  boldText: boolean;
  underlineLinks: boolean;
  /** 0=ברירת מחדל, 1=ימין/התחלה, 2=מרכז */
  textAlign: 0 | 1 | 2;

  stopAnimations: boolean;
  reduceMotion: boolean;
  largeButtons: boolean;
  hideImages: boolean;
  lowTransparency: boolean;
  readingGuide: boolean;
  readingMask: boolean;
  readingMode: boolean;
  pageStructure: boolean;
  bigCursor: CursorMode;
  keyboardNav: boolean;

  textToSpeech: boolean;
  /** לחיצה על טקסט מקריאה אותו */
  clickToSpeak: boolean;
  /** קצב דיבור: 0=רגיל, 1=איטי, 2=איטי מאוד */
  speechRate: 0 | 1 | 2;
  screenReaderHints: boolean;
  muteMedia: boolean;

  zoomLevel: number;
};

export const A11Y_STORAGE_KEY = '@maaser/a11y-v2';

export const DEFAULT_A11Y: A11ySettings = {
  widgetHidden: true,
  panelOpen: false,
  profile: 'none',

  contrast: 'off',
  saturation: 'off',
  highlightLinks: false,
  highlightHeadings: false,
  highlightFocus: false,
  highlightElements: false,
  highlightHover: false,

  colorBg: null,
  colorText: null,
  colorHeadings: null,

  fontSize: 0,
  lineHeight: 0,
  letterSpacing: 0,
  wordSpacing: 0,
  contentSpacing: 0,
  readableFont: false,
  dyslexiaFont: false,
  boldText: false,
  underlineLinks: false,
  textAlign: 0,

  stopAnimations: false,
  reduceMotion: false,
  largeButtons: false,
  hideImages: false,
  lowTransparency: false,
  readingGuide: false,
  readingMask: false,
  readingMode: false,
  pageStructure: false,
  bigCursor: 'off',
  keyboardNav: false,

  textToSpeech: false,
  clickToSpeak: false,
  speechRate: 0,
  screenReaderHints: false,
  muteMedia: false,

  zoomLevel: 0,
};
