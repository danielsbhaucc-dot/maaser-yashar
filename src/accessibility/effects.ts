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

function buildWebCss(s: A11ySettings): string {
  const parts: string[] = [
    `/* מעשר ישר — שכבת נגישות WCAG */`,
    `#root, body { transition: filter 0.2s ease; }`,
  ];

  const z = contentZoom(s);
  if (z > 1.001) {
    // zoom משנה גם font-size בפיקסלים של React Native Web — בניגוד ל-html font-size
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

  const filters: string[] = [];
  if (s.contrast === 'invert') filters.push('invert(1) hue-rotate(180deg)');
  if (s.contrast === 'high') filters.push('contrast(1.45) brightness(1.05)');
  if (s.saturation === 'low') filters.push('saturate(0.35)');
  if (s.saturation === 'high') filters.push('saturate(1.8)');
  if (s.saturation === 'mono' || s.saturation === 'grayscale') filters.push('grayscale(1)');
  if (s.contrast === 'sepia') filters.push('sepia(0.55)');
  if (filters.length) {
    parts.push(`#root { filter: ${filters.join(' ')} !important; }`);
    parts.push(`#maaser-a11y-root, #maaser-a11y-root * { filter: none !important; }`);
  }

  if (s.contrast === 'dark') {
    parts.push(`
      #root { background: #0a0a0a !important; }
      #root, #root * { color: #f5f5f5 !important; border-color: #444 !important; }
    `);
  }
  if (s.contrast === 'light') {
    parts.push(`
      #root { background: #ffffff !important; }
      #root, #root * { color: #111 !important; border-color: #ccc !important; }
    `);
  }
  if (s.contrast === 'blackYellow') {
    parts.push(`
      #root { background: #000 !important; }
      #root, #root * { color: #FFE600 !important; border-color: #FFE600 !important; }
      #root a { color: #FFF200 !important; text-decoration: underline !important; }
    `);
  }
  if (s.contrast === 'high') {
    parts.push(`
      #root { background: #000 !important; }
      #root [data-a11y-ignore] { filter: none; }
    `);
  }

  if (s.colorBg) parts.push(`#root { background-color: ${s.colorBg} !important; }`);
  if (s.colorText) {
    parts.push(
      `#root, #root p, #root span, #root div, #root input, #root textarea { color: ${s.colorText} !important; }`
    );
  }
  if (s.colorHeadings) {
    parts.push(`
      #root h1, #root h2, #root h3, #root h4, #root h5, #root h6,
      #root [accessibilityrole="header"], #root [role="header"], #root [aria-level] {
        color: ${s.colorHeadings} !important;
      }
    `);
  }

  if (s.lineHeight > 0) {
    const lh = 1.35 + s.lineHeight * 0.28;
    parts.push(`#root div, #root span, #root p, #root li, #root button, #root a { line-height: ${lh} !important; }`);
  }
  if (s.letterSpacing > 0) {
    const ls = s.letterSpacing * 0.07;
    parts.push(`#root div, #root span, #root p, #root li, #root button, #root a, #root input { letter-spacing: ${ls}em !important; }`);
  }
  if (s.wordSpacing > 0) {
    const ws = s.wordSpacing * 0.22;
    parts.push(`#root div, #root span, #root p, #root li { word-spacing: ${ws}em !important; }`);
  }

  if (s.textAlign === 1) {
    parts.push(`#root div, #root p, #root span, #root li { text-align: start !important; }`);
  } else if (s.textAlign === 2) {
    parts.push(`#root div, #root p, #root span, #root li { text-align: center !important; }`);
  }

  if (s.readableFont || s.dyslexiaFont) {
    const family = s.dyslexiaFont
      ? `"Comic Sans MS", "Arial Rounded MT Bold", "Arial", sans-serif`
      : `"Arial", "Helvetica Neue", "Heebo", sans-serif`;
    parts.push(`#root, #root * { font-family: ${family} !important; }`);
  }

  if (s.boldText) {
    parts.push(`
      #root div, #root span, #root p, #root li, #root button, #root a, #root label {
        font-weight: 700 !important;
      }
    `);
  }

  if (s.underlineLinks || s.highlightLinks) {
    parts.push(`
      #root a, #root [role="link"], #root [href] {
        text-decoration: underline !important;
        text-underline-offset: 3px !important;
      }
    `);
  }

  if (s.highlightLinks) {
    parts.push(`
      #root a, #root [role="link"], #root [href] {
        outline: 3px solid #2563EB !important;
        outline-offset: 2px !important;
        background: rgba(37, 99, 235, 0.12) !important;
      }
    `);
  }
  if (s.highlightHeadings) {
    parts.push(`
      #root h1, #root h2, #root h3, #root h4,
      #root [accessibilityrole="header"],
      #root [role="header"],
      #root [aria-level] {
        outline: 2px dashed #D97706 !important;
        outline-offset: 3px !important;
        background: rgba(217, 119, 6, 0.1) !important;
      }
    `);
  }
  if (s.highlightFocus || s.keyboardNav) {
    parts.push(`
      #root *:focus, #root *:focus-visible {
        outline: 4px solid #8B9BFF !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 6px rgba(139, 155, 255, 0.35) !important;
      }
    `);
  }
  if (s.highlightElements) {
    parts.push(`
      #root button, #root [role="button"], #root input, #root select, #root textarea {
        outline: 2px solid #7C3AED !important;
        outline-offset: 1px !important;
      }
    `);
  }
  if (s.highlightHover) {
    parts.push(`
      #root button:hover, #root [role="button"]:hover, #root a:hover, #root [role="link"]:hover {
        outline: 3px solid #F0C674 !important;
        outline-offset: 2px !important;
        background-color: rgba(240, 198, 116, 0.18) !important;
      }
    `);
  }

  if (s.hideImages) {
    parts.push(`
      #root img, #root svg, #root [role="img"], #root picture {
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
      #root button, #root [role="button"], #root a, #root [role="tab"] {
        min-height: 48px !important;
        min-width: 48px !important;
        padding: 12px 16px !important;
      }
    `);
  }

  if (s.contentSpacing > 0) {
    const pad = 4 + s.contentSpacing * 6;
    parts.push(`
      #root [role="button"], #root button, #root a, #root input, #root [role="tab"] {
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
      #root [style*="opacity"] {
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
    parts.push(`
      #root {
        max-width: 720px !important;
        margin: 0 auto !important;
      }
    `);
  }

  if (s.clickToSpeak || s.textToSpeech) {
    parts.push(`#root { -webkit-user-select: text; user-select: text; }`);
  }

  /* הווידג'ט עצמו תמיד מעל ובלי פילטרים / זום */
  parts.push(`
    #maaser-a11y-root {
      filter: none !important;
      zoom: 1 !important;
      transform: none !important;
      font-size: 16px !important;
      font-family: Heebo, Assistant, Arial, sans-serif !important;
    }
    #maaser-a11y-root * {
      filter: none !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      line-height: normal !important;
      font-weight: normal !important;
      text-align: start !important;
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
      // פיצוי רוחב כדי שלא ייחתך
      style.width = `${100 / z}%` as unknown as number;
      style.height = `${100 / z}%` as unknown as number;
      style.alignSelf = 'center';
    }
  }
  if (s.contrast === 'blackYellow') {
    style.backgroundColor = '#000';
  } else if (s.contrast === 'light') {
    style.backgroundColor = '#fff';
  } else if (s.contrast === 'sepia') {
    style.backgroundColor = '#F4ECD8';
  } else if (s.contrast === 'dark' || s.contrast === 'high') {
    style.backgroundColor = '#0a0a0a';
  }
  if (s.colorBg) style.backgroundColor = s.colorBg;
  return style;
}

/** סגנון טקסט לשימוש אופציונלי ברכיבים */
export function textA11yStyle(s: A11ySettings): TextStyle {
  const style: TextStyle = {};
  const scale = fontScale(s);
  if (s.fontSize > 0) {
    // לא קובעים fontSize מוחלט — רק letterSpacing וכו'
  }
  if (s.letterSpacing > 0) style.letterSpacing = s.letterSpacing * 0.8;
  if (s.lineHeight > 0) style.lineHeight = undefined;
  if (s.readableFont || s.dyslexiaFont) {
    style.fontFamily = 'Heebo_400Regular';
  }
  if (s.boldText) style.fontWeight = '700';
  if (s.colorText) style.color = s.colorText;
  if (s.contrast === 'blackYellow') style.color = '#FFE600';
  if (s.textAlign === 1) style.textAlign = 'left';
  if (s.textAlign === 2) style.textAlign = 'center';
  // scale שמור לשימוש חיצוני
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
  if (s.keyboardNav) chips.push({ id: 'kb', label: 'ניווט מקלדת', clear: { keyboardNav: false } });
  if (s.muteMedia) chips.push({ id: 'mute', label: 'השתקת מדיה', clear: { muteMedia: false } });
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
  if (s.contrast === 'invert' && (s.contrast as string) === 'dark') {
    /* unreachable guard */
  }
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
    tips.push('הפעילו «לחיצה להקראה» כדי לקרוא כל טקסט במסך בלחיצה.');
  }
  if (s.bigCursor !== 'off' && Platform.OS !== 'web') {
    tips.push('סמן מוגדל זמין בעיקר בדפדפן / מחשב.');
  }
  if (s.dyslexiaFont && s.letterSpacing < 1) {
    tips.push('לדיסלקציה מומלץ גם ריווח אותיות מוגדל.');
  }
  if (s.largeButtons && s.contentSpacing === 0) {
    tips.push('אפשר להוסיף «ריווח ממשק» ליעדי מגע נוחים יותר.');
  }
  return tips.slice(0, 2);
}
