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

/** פלטות ניגודיות גבוהה (משטח מלא, לא פילטר) — ערכים עומדים ב־WCAG AAA (≥7:1) */
export const HIGH_CONTRAST_PALETTES = {
  blackYellow: { bg: '#000000', fg: '#FFE600', link: '#7FDBFF', focus: '#FFFFFF' },
  light: { bg: '#FFFFFF', fg: '#000000', link: '#0033CC', focus: '#B00020' },
} as const;

export function highContrastPalette(mode: A11ySettings['contrast']) {
  return mode === 'blackYellow' || mode === 'light' ? HIGH_CONTRAST_PALETTES[mode] : null;
}

/** זום לפאנל עצמו (מחוץ ל־#root) — מתון ומוגבל כדי שלא יגלוש במסך צר */
export function panelZoom(s: A11ySettings): number {
  const z = fontScale(s);
  return Math.round(Math.min(Math.max(z, 1), 1.25) * 1000) / 1000;
}

/** גופן קריאוּת/דיסלקציה מקומי: Alef (SIL OFL 1.1, Hagilda) — public/fonts/OFL-Alef.txt */
const DYSLEXIA_FONT_FACE = ['hebrew', 'latin']
  .flatMap((sub) =>
    [400, 700].map(
      (w) => `@font-face { font-family: "MaaserA11yAlef"; font-style: normal; font-weight: ${w}; font-display: swap;
        src: url("/fonts/alef-${sub}-${w}-normal.woff2") format("woff2");
        unicode-range: ${sub === 'hebrew' ? 'U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F' : 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD'}; }`
    )
  )
  .join('\n');

/** משטח האפליקציה שאליו מערבבים רקעים שקופים במצב "פחות שקיפות" */
export const LOW_TRANSPARENCY_BASE = { r: 0x0b, g: 0x10, b: 0x20 };

function systemPrefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const RGBA_RE = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/;

/** מעבר DOM: השתקת מדיה אמיתית + אטימת משטחים שקופים לפי טוקן */
function runDomPasses(s: A11ySettings) {
  const root = document.getElementById('root');
  if (!root) return;
  root.querySelectorAll<HTMLMediaElement>('video, audio').forEach((m) => {
    if (s.muteMedia) {
      if (!m.hasAttribute('data-a11y-muted')) {
        m.setAttribute('data-a11y-muted', m.muted ? 'was' : '1');
        m.muted = true;
        if (m.autoplay || !m.paused) {
          try {
            m.pause();
          } catch {
            /* noop */
          }
        }
      }
    } else if (m.hasAttribute('data-a11y-muted')) {
      if (m.getAttribute('data-a11y-muted') === '1') m.muted = false;
      m.removeAttribute('data-a11y-muted');
    }
  });

  const solidified = root.querySelectorAll<HTMLElement>('[data-a11y-solid]');
  if (!s.lowTransparency) {
    solidified.forEach((el) => {
      el.style.removeProperty('background-color');
      el.removeAttribute('data-a11y-solid');
    });
    return;
  }
  const B = LOW_TRANSPARENCY_BASE;
  root.querySelectorAll<HTMLElement>('div:not([data-a11y-solid])').forEach((el) => {
    const m = RGBA_RE.exec(getComputedStyle(el).backgroundColor);
    if (!m) return;
    const a = Number(m[4]);
    if (a <= 0 || a >= 0.9) return;
    // מערבבים את הצבע השקוף עם משטח הבסיס — אותו גוון בדיוק, רק אטום
    const blend = (c: number, base: number) => Math.round(base + (c - base) * a);
    el.setAttribute('data-a11y-solid', '1');
    el.style.setProperty(
      'background-color',
      `rgb(${blend(Number(m[1]), B.r)}, ${blend(Number(m[2]), B.g)}, ${blend(Number(m[3]), B.b)})`,
      'important'
    );
  });
}

let domObserver: MutationObserver | null = null;
let domTimer: ReturnType<typeof setTimeout> | null = null;
let lastSettings: A11ySettings | null = null;

function scheduleDomPasses(s: A11ySettings) {
  lastSettings = s;
  runDomPasses(s);
  const needs = s.muteMedia || s.lowTransparency;
  if (needs && !domObserver && typeof MutationObserver !== 'undefined') {
    const root = document.getElementById('root');
    if (!root) return;
    domObserver = new MutationObserver(() => {
      if (domTimer) return;
      domTimer = setTimeout(() => {
        domTimer = null;
        if (lastSettings) runDomPasses(lastSettings);
      }, 250);
    });
    domObserver.observe(root, { childList: true, subtree: true });
  } else if (!needs && domObserver) {
    domObserver.disconnect();
    domObserver = null;
  }
}

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
  if (s.contrast === 'invert') {
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

  const hc = highContrastPalette(s.contrast);
  if (hc) {
    // ניגודיות גבוהה אמיתית: משטחים אחידים, טקסט/גבולות בצבע אחד, מצב נבחר הפוך
    parts.push(`
      html, body, #root { background: ${hc.bg} !important; }
      #root *:not(svg):not(svg *) {
        background-color: transparent !important;
        background-image: none !important;
        color: ${hc.fg} !important;
        border-color: ${hc.fg} !important;
        box-shadow: none !important;
        text-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
      }
      #root svg [fill]:not([fill="none"]) { fill: ${hc.fg} !important; }
      #root svg [stroke]:not([stroke="none"]) { stroke: ${hc.fg} !important; }
      ${RN_BTN}, ${RN_TAB}, ${RN_INPUT} {
        background-color: ${hc.bg} !important;
        outline: 2px solid ${hc.fg} !important;
        outline-offset: -2px !important;
      }
      ${RN_LINK} { color: ${hc.link} !important; text-decoration: underline !important; }
      #root [aria-selected="true"], #root [aria-checked="true"], #root [aria-pressed="true"] {
        background-color: ${hc.fg} !important;
      }
      #root [aria-selected="true"] *, #root [aria-checked="true"] *, #root [aria-pressed="true"] *,
      #root [aria-selected="true"], #root [aria-checked="true"], #root [aria-pressed="true"] {
        color: ${hc.bg} !important;
      }
      #root *:focus-visible { outline: 3px solid ${hc.focus} !important; outline-offset: 2px !important; }
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
      ? `"MaaserA11yAlef", "Arial", sans-serif`
      : `"Arial", "Helvetica Neue", "Heebo", sans-serif`;
    if (s.dyslexiaFont) parts.push(DYSLEXIA_FONT_FACE);
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

  const motionCss = `
      #root *, #root *::before, #root *::after, #maaser-a11y-root * {
        animation-duration: 0.001ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.001ms !important;
        scroll-behavior: auto !important;
      }`;
  // מכבדים תמיד את בקשת מערכת ההפעלה
  parts.push(`@media (prefers-reduced-motion: reduce) {${motionCss}}`);
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
    // backdrop מבוטל ב־CSS; האטימה עצמה לפי טוקן ב־runDomPasses
    parts.push(`
      #root *, #root *::before, #root *::after {
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
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
    // השתקה אמיתית מתבצעת ב־applyMediaMute (muted + pause על autoplay); המדיה נשארת גלויה
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
  // הפאנל יושב ב־Modal מחוץ ל־#root: לא יורש zoom. מגדילים אותו מתון כדי שמי שהגדיל טקסט יקרא גם את התפריט
  const pz = panelZoom(s);
  parts.push(`
    #maaser-a11y-root {
      filter: none !important;
      zoom: ${pz} !important;
      max-width: min(380px, calc(100vw / ${pz})) !important;
      height: calc(100dvh / ${pz}) !important;
      transform: none !important;
      font-size: 16px !important;
      font-family: Heebo, Arial, sans-serif !important;
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
      settings.stopAnimations || settings.reduceMotion || systemPrefersReducedMotion() ? 'reduce' : null
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
    settings.stopAnimations || settings.reduceMotion || systemPrefersReducedMotion() ? 'reduce' : 'ok'
  );

  scheduleDomPasses(settings);
}

/** האם יש ב־native התאמת רוויה אמיתית (filter נתמך רק ב־Android) */
export const NATIVE_SATURATION_SUPPORTED = Platform.OS !== 'ios';

export function nativeSaturationFilter(sat: A11ySettings['saturation']) {
  if (sat === 'low') return [{ saturate: 0.5 }];
  if (sat === 'high') return [{ saturate: 1.8 }];
  if (sat === 'mono') return [{ grayscale: 1 }, { contrast: 1.25 }];
  return [{ grayscale: 1 }];
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
    style.backgroundColor = '#FFFFFF';
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
  if (s.contrast === 'light') style.color = '#000000';
  // 'start' = ימין ב־RTL; ב־native עם forceRTL גם 'left' היה מתהפך, אבל start מפורש וברור
  if (s.textAlign === 1) style.textAlign = 'start' as TextStyle['textAlign'];
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
