import { Platform, TextStyle, ViewStyle } from 'react-native';
import type { A11ySettings } from './types';

const STYLE_ID = 'maaser-a11y-styles';

/** מכפיל גודל טקסט — עובד גם על fontSize בפיקסלים של RN */
export function fontScale(s: A11ySettings): number {
  return 1 + s.fontSize * 0.16;
}

export function zoomScale(s: A11ySettings): number {
  return 1 + s.zoomLevel * 0.1;
}

/** זום מאוחד לתצוגה (טקסט × הגדלת תצוגה) */
export function contentZoom(s: A11ySettings): number {
  return fontScale(s) * zoomScale(s);
}

export function lineHeightScale(s: A11ySettings): number {
  return 1 + s.lineHeight * 0.2;
}

export function speechRateValue(s: A11ySettings): number {
  if (s.speechRate === 1) return 0.75;
  if (s.speechRate === 2) return 0.55;
  return 0.95;
}

/**
 * סלקטורים ל־React Native Web — אין <button>/<a>/<h1> אמיתיים;
 * Pressable/Text מקבלים role / accessibilityrole.
 */
const RN_BTN = `#root [role="button"], #root [accessibilityrole="button"]`;
const RN_LINK = `#root [role="link"], #root [accessibilityrole="link"]`;
const RN_TAB = `#root [role="tab"], #root [accessibilityrole="tab"]`;
const RN_HEADING = `#root [role="heading"], #root [role="header"], #root [accessibilityrole="header"], #root [aria-level]`;
const RN_TEXTISH = `#root [dir], #root [role="text"], #root [accessibilityrole="text"], #root [role="summary"]`;
const RN_INPUT = `#root input, #root textarea, #root [role="textbox"], #root [accessibilityrole="text"]`;
const RN_CTRL = `${RN_BTN}, ${RN_LINK}, ${RN_TAB}, #root input, #root textarea, #root select`;

function buildWebCss(s: A11ySettings): string {
  const parts: string[] = [
    `/* מעשר ישר — שכבת נגישות מותאמת ל־RN Web + עיצוב כהה */`,
    `#root, body { transition: filter 0.2s ease; }`,
  ];

  const z = contentZoom(s);
  if (z > 1.001) {
    // zoom משנה גם font-size בפיקסלים של React Native Web
    parts.push(`
      #root {
        zoom: ${z};
      }
      @supports not (zoom: 1) {
        #root {
          transform: scale(${z});
          transform-origin: top center;
          width: ${(100 / z).toFixed(3)}%;
          min-height: ${(100 / z).toFixed(3)}%;
        }
      }
    `);
  }

  /* —— ניגודיות / רוויה: פילטרים שלא הורסים את שפת העיצוב הכהה —— */
  const filters: string[] = [];
  if (s.contrast === 'invert' || s.contrast === 'light') {
    // light = היפוך עדין ששומר יחסי צבע (זהב/ספיר) על רקע כהה→בהיר
    filters.push('invert(1) hue-rotate(180deg)');
  }
  if (s.contrast === 'high') filters.push('contrast(1.42) brightness(1.06)');
  if (s.contrast === 'dark') filters.push('contrast(1.22) brightness(0.92)');
  if (s.contrast === 'sepia') filters.push('sepia(0.5) contrast(1.08)');
  if (s.saturation === 'low') filters.push('saturate(0.4)');
  if (s.saturation === 'high') filters.push('saturate(1.65)');
  if (s.saturation === 'mono' || s.saturation === 'grayscale') filters.push('grayscale(1)');

  if (filters.length) {
    parts.push(`#root { filter: ${filters.join(' ')} !important; }`);
    parts.push(`#maaser-a11y-root, #maaser-a11y-root * { filter: none !important; }`);
  }

  if (s.contrast === 'blackYellow') {
    // ניגודיות קיצונית בלי לצבוע borders/SVG של כל העץ
    parts.push(`
      #root {
        background: #000 !important;
      }
      ${RN_TEXTISH}, ${RN_HEADING}, ${RN_BTN}, ${RN_LINK}, ${RN_INPUT} {
        color: #FFE600 !important;
      }
      ${RN_LINK} {
        text-decoration: underline !important;
      }
    `);
  }

  if (s.colorBg) {
    parts.push(`#root { background-color: ${s.colorBg} !important; }`);
  }
  if (s.colorText) {
    parts.push(`
      ${RN_TEXTISH}, ${RN_BTN}, ${RN_LINK}, ${RN_INPUT} {
        color: ${s.colorText} !important;
      }
    `);
  }
  if (s.colorHeadings) {
    parts.push(`
      ${RN_HEADING} {
        color: ${s.colorHeadings} !important;
      }
    `);
  }

  if (s.lineHeight > 0) {
    const lh = 1.35 + s.lineHeight * 0.28;
    parts.push(`
      ${RN_TEXTISH}, ${RN_BTN}, ${RN_LINK}, ${RN_HEADING} {
        line-height: ${lh} !important;
      }
    `);
  }
  if (s.letterSpacing > 0) {
    const ls = s.letterSpacing * 0.07;
    parts.push(`
      ${RN_TEXTISH}, ${RN_BTN}, ${RN_LINK}, ${RN_HEADING}, ${RN_INPUT} {
        letter-spacing: ${ls}em !important;
      }
    `);
  }
  if (s.wordSpacing > 0) {
    const ws = s.wordSpacing * 0.22;
    parts.push(`
      ${RN_TEXTISH}, ${RN_HEADING} {
        word-spacing: ${ws}em !important;
      }
    `);
  }

  if (s.textAlign === 1) {
    parts.push(`
      ${RN_TEXTISH}, ${RN_HEADING} {
        text-align: start !important;
      }
    `);
  } else if (s.textAlign === 2) {
    parts.push(`
      ${RN_TEXTISH}, ${RN_HEADING} {
        text-align: center !important;
      }
    `);
  }

  if (s.readableFont || s.dyslexiaFont) {
    const family = s.dyslexiaFont
      ? `"Comic Sans MS", "Arial Rounded MT Bold", "Arial", sans-serif`
      : `"Arial", "Helvetica Neue", "Heebo", "Assistant", sans-serif`;
    parts.push(`
      #root, #root * {
        font-family: ${family} !important;
      }
    `);
  }

  if (s.boldText) {
    parts.push(`
      ${RN_TEXTISH}, ${RN_BTN}, ${RN_LINK}, ${RN_HEADING} {
        font-weight: 700 !important;
      }
    `);
  }

  if (s.underlineLinks || s.highlightLinks) {
    parts.push(`
      ${RN_LINK} {
        text-decoration: underline !important;
        text-underline-offset: 3px !important;
      }
    `);
  }

  if (s.highlightLinks) {
    parts.push(`
      ${RN_LINK} {
        outline: 3px solid #8B9BFF !important;
        outline-offset: 2px !important;
        background: rgba(139, 155, 255, 0.18) !important;
        border-radius: 6px;
      }
    `);
  }
  if (s.highlightHeadings) {
    parts.push(`
      ${RN_HEADING} {
        outline: 2px dashed #F0C674 !important;
        outline-offset: 3px !important;
        background: rgba(240, 198, 116, 0.12) !important;
        border-radius: 6px;
      }
    `);
  }
  if (s.highlightFocus || s.keyboardNav) {
    parts.push(`
      #root *:focus, #root *:focus-visible {
        outline: 3px solid #8B9BFF !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 5px rgba(139, 155, 255, 0.35) !important;
      }
      /* סדר Tab הגיוני ב־RTL — הדפדפן שומר DOM order; מסמנים כיוון */
      #root {
        caret-color: #F0C674;
      }
    `);
  }
  if (s.highlightElements) {
    parts.push(`
      ${RN_CTRL} {
        outline: 2px solid rgba(167, 139, 250, 0.85) !important;
        outline-offset: 1px !important;
      }
    `);
  }
  if (s.highlightHover) {
    parts.push(`
      ${RN_BTN}:hover, ${RN_LINK}:hover, ${RN_TAB}:hover {
        outline: 3px solid #F0C674 !important;
        outline-offset: 2px !important;
        background-color: rgba(240, 198, 116, 0.16) !important;
      }
    `);
  }

  if (s.hideImages) {
    // רק תמונות רסטר / role=img — לא SVG אייקונים בכפתורים
    parts.push(`
      #root img, #root picture, #root [role="img"]:not([role="button"]):not([accessibilityrole="button"]) {
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `);
  }

  if (s.stopAnimations || s.reduceMotion) {
    parts.push(`
      #root *, #root *::before, #root *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    `);
  }

  if (s.largeButtons) {
    parts.push(`
      ${RN_BTN}, ${RN_LINK}, ${RN_TAB} {
        min-height: 48px !important;
        min-width: 48px !important;
      }
    `);
  }

  if (s.contentSpacing > 0) {
    const pad = 4 + s.contentSpacing * 6;
    parts.push(`
      ${RN_BTN}, ${RN_LINK}, ${RN_TAB}, #root input {
        padding: ${pad}px ${pad + 4}px !important;
        margin: ${Math.round(pad / 3)}px !important;
      }
    `);
  }

  if (s.lowTransparency) {
    parts.push(`
      #root * {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      /* זכוכית כהה → רקע אטום יותר תואם עיצוב */
      #root [style*="backdrop"], #root [class*="glass"] {
        opacity: 1 !important;
      }
    `);
  }

  if (s.bigCursor !== 'off') {
    const cursors: Record<string, string> = {
      large:
        'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'1\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 4 4, auto',
      largeDark:
        'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'1.5\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 4 4, auto',
      largeLight:
        'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23fff\' stroke=\'%23000\' stroke-width=\'1.5\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 4 4, auto',
      black:
        'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 2 2, auto',
      white:
        'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23fff\' stroke=\'%23000\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 2 2, auto',
    };
    const c = cursors[s.bigCursor];
    if (c) parts.push(`#root, #root * { cursor: ${c} !important; }`);
  }

  if (s.muteMedia) {
    parts.push(`#root video, #root audio { display: none !important; }`);
  }

  if (s.readingMode) {
    // לא max-width על #root (שובר טאבים/FAB) — ריווח קריאה רך
    parts.push(`
      #root {
        letter-spacing: 0.02em;
      }
      ${RN_TEXTISH}, ${RN_HEADING} {
        max-width: 42rem;
        margin-inline: auto;
      }
    `);
  }

  if (s.clickToSpeak || s.textToSpeech) {
    parts.push(`#root { -webkit-user-select: text; user-select: text; }`);
  }

  /* וידג'ט נגישות מעל הכול, בלי פילטר/זום של האפליקציה */
  const inv = z > 1.001 ? 1 / z : 1;
  parts.push(`
    #maaser-a11y-root {
      filter: none !important;
      zoom: ${inv} !important;
      transform: none !important;
      font-size: 16px !important;
      font-family: Heebo, Assistant, Arial, sans-serif !important;
    }
    #maaser-a11y-root * {
      filter: none !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      cursor: auto !important;
    }
  `);

  return parts.join('\n');
}

export function applyWebAccessibility(settings: A11ySettings) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildWebCss(settings);

  const root = document.getElementById('root');
  const setData = (node: HTMLElement | null, key: string, value: string | null) => {
    if (!node) return;
    if (value == null || value === '' || value === 'off' || value === '0' || value === 'false') {
      node.removeAttribute(key);
    } else {
      node.setAttribute(key, value);
    }
  };

  for (const node of [document.documentElement, document.body, root]) {
    setData(node as HTMLElement | null, 'data-a11y-contrast', settings.contrast === 'off' ? null : settings.contrast);
    setData(node as HTMLElement | null, 'data-a11y-sat', settings.saturation === 'off' ? null : settings.saturation);
    setData(
      node as HTMLElement | null,
      'data-a11y-keyboard',
      settings.keyboardNav || settings.highlightFocus ? '1' : null
    );
    setData(
      node as HTMLElement | null,
      'data-a11y-motion',
      settings.stopAnimations || settings.reduceMotion ? 'reduce' : null
    );
    setData(node as HTMLElement | null, 'data-a11y-reading', settings.readingMode ? '1' : null);
    setData(node as HTMLElement | null, 'data-a11y-font', String(settings.fontSize || 0));
  }

  if (settings.keyboardNav) {
    document.body.setAttribute('data-a11y-keyboard', '1');
  } else {
    document.body.removeAttribute('data-a11y-keyboard');
  }

  document.body.setAttribute(
    'data-a11y-motion',
    settings.stopAnimations || settings.reduceMotion ? 'reduce' : 'ok'
  );
}

/** סגנונות לשורש האפליקציה (native + web) */
export function rootA11yStyle(s: A11ySettings): ViewStyle {
  const style: ViewStyle = { flex: 1 };
  // ב־native: scale אמיתי כי אין CSS zoom על px של Text
  if (Platform.OS !== 'web') {
    const z = contentZoom(s);
    if (z > 1.001) {
      style.transform = [{ scale: z }];
      style.width = `${100 / z}%` as unknown as number;
      style.height = `${100 / z}%` as unknown as number;
      style.alignSelf = 'center';
    }
  }
  if (s.contrast === 'blackYellow') {
    style.backgroundColor = '#000';
  } else if (s.contrast === 'light') {
    style.backgroundColor = '#F4F6FF';
  } else if (s.contrast === 'sepia') {
    style.backgroundColor = '#F4ECD8';
  } else if (s.contrast === 'dark' || s.contrast === 'high') {
    style.backgroundColor = '#070A14';
  }
  if (s.colorBg) style.backgroundColor = s.colorBg;
  if (s.contentSpacing > 0 && Platform.OS !== 'web') {
    style.paddingHorizontal = 2 + s.contentSpacing * 4;
  }
  return style;
}

/** סגנון טקסט לשימוש אופציונלי ברכיבים */
export function textA11yStyle(s: A11ySettings): TextStyle {
  const style: TextStyle = {};
  const scale = fontScale(s);
  if (s.letterSpacing > 0) style.letterSpacing = s.letterSpacing * 0.8;
  if (s.readableFont || s.dyslexiaFont) {
    style.fontFamily = 'Heebo_400Regular';
  }
  if (s.boldText) style.fontWeight = '700';
  if (s.colorText) style.color = s.colorText;
  if (s.contrast === 'blackYellow') style.color = '#FFE600';
  if (s.textAlign === 1) style.textAlign = 'left';
  if (s.textAlign === 2) style.textAlign = 'center';
  void scale;
  return style;
}

export function hasActiveAdjustments(s: A11ySettings): boolean {
  const d = s;
  return (
    d.profile !== 'none' ||
    d.contrast !== 'off' ||
    d.saturation !== 'off' ||
    d.highlightLinks ||
    d.highlightHeadings ||
    d.highlightFocus ||
    d.highlightElements ||
    d.highlightHover ||
    !!d.colorBg ||
    !!d.colorText ||
    !!d.colorHeadings ||
    d.fontSize > 0 ||
    d.lineHeight > 0 ||
    d.letterSpacing > 0 ||
    d.wordSpacing > 0 ||
    d.contentSpacing > 0 ||
    d.readableFont ||
    d.dyslexiaFont ||
    d.boldText ||
    d.underlineLinks ||
    d.textAlign > 0 ||
    d.stopAnimations ||
    d.reduceMotion ||
    d.largeButtons ||
    d.hideImages ||
    d.lowTransparency ||
    d.readingGuide ||
    d.readingMask ||
    d.readingMode ||
    d.pageStructure ||
    d.bigCursor !== 'off' ||
    d.keyboardNav ||
    d.textToSpeech ||
    d.clickToSpeak ||
    d.speechRate > 0 ||
    d.screenReaderHints ||
    d.muteMedia ||
    d.zoomLevel > 0
  );
}

/** רשימת התאמות פעילות לתצוגה חכמה בתפריט */
export type ActiveChip = {
  id: string;
  label: string;
  clear: Partial<A11ySettings>;
};

export function listActiveChips(s: A11ySettings): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (s.profile !== 'none') {
    chips.push({ id: 'profile', label: 'פרופיל פעיל', clear: { profile: 'none' } });
  }
  if (s.fontSize > 0) chips.push({ id: 'fontSize', label: `טקסט ×${fontScale(s).toFixed(2)}`, clear: { fontSize: 0 } });
  if (s.zoomLevel > 0) chips.push({ id: 'zoom', label: 'הגדלת תצוגה', clear: { zoomLevel: 0 } });
  if (s.lineHeight > 0) chips.push({ id: 'lh', label: 'ריווח שורות', clear: { lineHeight: 0 } });
  if (s.letterSpacing > 0) chips.push({ id: 'ls', label: 'ריווח אותיות', clear: { letterSpacing: 0 } });
  if (s.wordSpacing > 0) chips.push({ id: 'ws', label: 'ריווח מילים', clear: { wordSpacing: 0 } });
  if (s.contentSpacing > 0) chips.push({ id: 'cs', label: 'ריווח ממשק', clear: { contentSpacing: 0 } });
  if (s.contrast !== 'off') chips.push({ id: 'contrast', label: 'ניגודיות', clear: { contrast: 'off' } });
  if (s.saturation !== 'off') chips.push({ id: 'sat', label: 'רוויה', clear: { saturation: 'off' } });
  if (s.readableFont) chips.push({ id: 'rf', label: 'גופן קריא', clear: { readableFont: false } });
  if (s.dyslexiaFont) chips.push({ id: 'df', label: 'פונט דיסלקציה', clear: { dyslexiaFont: false } });
  if (s.boldText) chips.push({ id: 'bold', label: 'טקסט מודגש', clear: { boldText: false } });
  if (s.underlineLinks) chips.push({ id: 'ul', label: 'קו תחתון לקישורים', clear: { underlineLinks: false } });
  if (s.textAlign > 0) chips.push({ id: 'ta', label: 'יישור טקסט', clear: { textAlign: 0 } });
  if (s.readingGuide) chips.push({ id: 'rg', label: 'מדריך קריאה', clear: { readingGuide: false } });
  if (s.readingMask) chips.push({ id: 'rm', label: 'מיקוד קריאה', clear: { readingMask: false } });
  if (s.readingMode) chips.push({ id: 'rmode', label: 'מצב קריאה', clear: { readingMode: false } });
  if (s.stopAnimations) chips.push({ id: 'anim', label: 'בלי אנימציות', clear: { stopAnimations: false } });
  if (s.reduceMotion) chips.push({ id: 'motion', label: 'תנועה מופחתת', clear: { reduceMotion: false } });
  if (s.largeButtons) chips.push({ id: 'btn', label: 'כפתורים גדולים', clear: { largeButtons: false } });
  if (s.hideImages) chips.push({ id: 'img', label: 'הסתרת תמונות', clear: { hideImages: false } });
  if (s.lowTransparency) chips.push({ id: 'glass', label: 'פחות שקיפות', clear: { lowTransparency: false } });
  if (s.bigCursor !== 'off') chips.push({ id: 'cur', label: 'סמן מוגדל', clear: { bigCursor: 'off' } });
  if (s.textToSpeech) chips.push({ id: 'tts', label: 'קורא טקסט', clear: { textToSpeech: false, clickToSpeak: false } });
  if (s.clickToSpeak) chips.push({ id: 'cts', label: 'לחיצה=הקראה', clear: { clickToSpeak: false } });
  if (s.screenReaderHints) chips.push({ id: 'sr', label: 'רמזי מסך', clear: { screenReaderHints: false } });
  if (s.highlightLinks) chips.push({ id: 'hl', label: 'הדגשת קישורים', clear: { highlightLinks: false } });
  if (s.highlightHeadings) chips.push({ id: 'hh', label: 'הדגשת כותרות', clear: { highlightHeadings: false } });
  if (s.highlightFocus) chips.push({ id: 'hf', label: 'הדגשת פוקוס', clear: { highlightFocus: false } });
  if (s.highlightHover) chips.push({ id: 'hhov', label: 'הדגשת מעבר', clear: { highlightHover: false } });
  if (s.highlightElements) chips.push({ id: 'he', label: 'הדגשת אלמנטים', clear: { highlightElements: false } });
  if (s.keyboardNav) chips.push({ id: 'kb', label: 'ניווט מקלדת', clear: { keyboardNav: false } });
  if (s.muteMedia) chips.push({ id: 'mute', label: 'השתקת מדיה', clear: { muteMedia: false } });
  if (s.pageStructure) chips.push({ id: 'ps', label: 'מבנה עמוד', clear: { pageStructure: false } });
  if (s.colorBg || s.colorText || s.colorHeadings) {
    chips.push({
      id: 'colors',
      label: 'צבעים מותאמים',
      clear: { colorBg: null, colorText: null, colorHeadings: null },
    });
  }
  return chips;
}

/** טיפים חכמים לפי מצב נוכחי */
export function smartTips(s: A11ySettings): string[] {
  const tips: string[] = [];
  if (s.fontSize === 0 && s.zoomLevel === 0 && s.profile === 'none') {
    tips.push('טיפ: הגדילו גודל טקסט אם קשה לקרוא — השינוי חל מיד על כל המסך.');
  }
  if (s.contrast === 'invert' && s.saturation !== 'off') {
    tips.push('היפוך צבעים + שינוי רוויה עלולים ליצור מראה מבלבל — נסו אחד מהם.');
  }
  if (s.readingMask && s.readingGuide) {
    tips.push('מדריך קריאה ומסכת מיקוד פעילים יחד — אפשר להשאיר רק אחד לנוחות.');
  }
  if (s.textToSpeech && !s.clickToSpeak) {
    tips.push('הפעילו לחיצה להקראה כדי לקרוא כל טקסט במסך בלחיצה.');
  }
  if (s.bigCursor !== 'off' && Platform.OS !== 'web') {
    tips.push('סמן מוגדל זמין בעיקר בדפדפן / מחשב.');
  }
  if (s.dyslexiaFont && s.letterSpacing < 1) {
    tips.push('לדיסלקציה מומלץ גם ריווח אותיות מוגדל.');
  }
  if (s.largeButtons && s.contentSpacing === 0) {
    tips.push('אפשר להוסיף ריווח ממשק ליעדי מגע נוחים יותר.');
  }
  return tips.slice(0, 2);
}
