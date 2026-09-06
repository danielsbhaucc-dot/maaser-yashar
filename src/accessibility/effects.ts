import { Platform, TextStyle, ViewStyle } from 'react-native';
import type { A11ySettings } from './types';

const STYLE_ID = 'maaser-a11y-styles';

function fontSizeCss(level: number): string {
  const scale = 1 + level * 0.18;
  return `html { font-size: ${Math.round(scale * 100)}% !important; }`;
}

function buildWebCss(s: A11ySettings): string {
  const parts: string[] = [
    `/* מעשר ישר — שכבת נגישות WCAG */`,
    `#root, body { transition: filter 0.2s ease; }`,
  ];

  if (s.fontSize > 0) parts.push(fontSizeCss(s.fontSize));
  if (s.zoomLevel > 0) {
    const z = 1 + s.zoomLevel * 0.12;
    parts.push(`#root { zoom: ${z}; }`);
  }

  const filters: string[] = [];
  if (s.contrast === 'invert') filters.push('invert(1) hue-rotate(180deg)');
  if (s.contrast === 'high') filters.push('contrast(1.45)');
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
  if (s.contrast === 'high' && Platform.OS === 'web') {
    parts.push(`
      #root { background: #000 !important; }
      #root [data-a11y-ignore] { filter: none; }
    `);
  }

  if (s.colorBg) parts.push(`#root { background-color: ${s.colorBg} !important; }`);
  if (s.colorText) parts.push(`#root, #root p, #root span, #root div { color: ${s.colorText} !important; }`);
  if (s.colorHeadings) {
    parts.push(`#root h1, #root h2, #root h3, #root h4, #root h5, #root h6 { color: ${s.colorHeadings} !important; }`);
  }

  if (s.lineHeight > 0) {
    const lh = 1.4 + s.lineHeight * 0.25;
    parts.push(`#root * { line-height: ${lh} !important; }`);
  }
  if (s.letterSpacing > 0) {
    const ls = s.letterSpacing * 0.06;
    parts.push(`#root * { letter-spacing: ${ls}em !important; }`);
  }
  if (s.wordSpacing > 0) {
    const ws = s.wordSpacing * 0.2;
    parts.push(`#root * { word-spacing: ${ws}em !important; }`);
  }

  if (s.readableFont || s.dyslexiaFont) {
    const family = s.dyslexiaFont
      ? `"Comic Sans MS", "Arial", sans-serif`
      : `"Arial", "Helvetica Neue", sans-serif`;
    parts.push(`#root, #root * { font-family: ${family} !important; }`);
  }

  if (s.highlightLinks) {
    parts.push(`
      #root a, #root [role="link"], #root [href] {
        outline: 3px solid #2563EB !important;
        outline-offset: 2px !important;
        text-decoration: underline !important;
        text-underline-offset: 3px !important;
        background: rgba(37, 99, 235, 0.12) !important;
      }
    `);
  }
  if (s.highlightHeadings) {
    parts.push(`
      #root h1, #root h2, #root h3, #root h4,
      #root [accessibilityrole="header"],
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
      #root button, #root [role="button"], #root a {
        min-height: 48px !important;
        min-width: 48px !important;
        padding: 12px 16px !important;
      }
    `);
  }

  if (s.bigCursor !== 'off') {
    const cursors: Record<string, string> = {
      large: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'48\' height=\'48\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'1\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 4 4, auto',
      largeDark: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' stroke=\'%23fff\' stroke-width=\'1.5\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 4 4, auto',
      largeLight: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'56\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23fff\' stroke=\'%23000\' stroke-width=\'1.5\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 4 4, auto',
      black: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23000\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 2 2, auto',
      white: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23fff\' stroke=\'%23000\' d=\'M4 1l12 11h-5l4 9-3 1-4-9-4 4z\'/%3E%3C/svg%3E") 2 2, auto',
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

  /* הווידג'ט עצמו תמיד מעל ובלי פילטרים */
  parts.push(`
    #maaser-a11y-root {
      filter: none !important;
      zoom: 1 !important;
      font-size: 16px !important;
      font-family: Heebo, Assistant, Arial, sans-serif !important;
    }
    #maaser-a11y-root * {
      filter: none !important;
      letter-spacing: normal !important;
      word-spacing: normal !important;
      line-height: normal !important;
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
}

/** סגנונות לשורש האפליקציה (native + web) */
export function rootA11yStyle(s: A11ySettings): ViewStyle {
  const style: ViewStyle = { flex: 1 };
  if (s.zoomLevel > 0) {
    const scale = 1 + s.zoomLevel * 0.08;
    style.transform = [{ scale }];
  }
  if (s.contrast === 'blackYellow') {
    style.backgroundColor = '#000';
  } else if (s.contrast === 'light') {
    style.backgroundColor = '#fff';
  } else if (s.contrast === 'sepia') {
    style.backgroundColor = '#F4ECD8';
  }
  if (s.colorBg) style.backgroundColor = s.colorBg;
  return style;
}

/** מכפיל גודל טקסט לרכיבים שיבחרו להשתמש */
export function textA11yStyle(s: A11ySettings): TextStyle {
  const style: TextStyle = {};
  if (s.fontSize > 0) style.fontSize = undefined; // נשלט בנפרד
  if (s.lineHeight > 0) style.lineHeight = undefined;
  if (s.letterSpacing > 0) style.letterSpacing = s.letterSpacing * 0.8;
  if (s.readableFont || s.dyslexiaFont) {
    style.fontFamily = 'Heebo_400Regular';
  }
  if (s.colorText) style.color = s.colorText;
  if (s.contrast === 'blackYellow') style.color = '#FFE600';
  return style;
}

export function fontScale(s: A11ySettings): number {
  return 1 + s.fontSize * 0.15;
}

export function lineHeightScale(s: A11ySettings): number {
  return 1 + s.lineHeight * 0.2;
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
    !!d.colorBg ||
    !!d.colorText ||
    !!d.colorHeadings ||
    d.fontSize > 0 ||
    d.lineHeight > 0 ||
    d.letterSpacing > 0 ||
    d.wordSpacing > 0 ||
    d.readableFont ||
    d.dyslexiaFont ||
    d.textAlign > 0 ||
    d.stopAnimations ||
    d.reduceMotion ||
    d.largeButtons ||
    d.hideImages ||
    d.readingGuide ||
    d.readingMask ||
    d.readingMode ||
    d.pageStructure ||
    d.bigCursor !== 'off' ||
    d.keyboardNav ||
    d.textToSpeech ||
    d.screenReaderHints ||
    d.muteMedia ||
    d.zoomLevel > 0
  );
}
