import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'web', select: (o: Record<string, unknown>) => o.web ?? o.default } }));

import { DEFAULT_A11Y } from '../types';
import {
  HIGH_CONTRAST_PALETTES,
  highContrastPalette,
  nativeSaturationFilter,
  panelZoom,
  textA11yStyle,
} from '../effects';

function lum(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const l = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

describe('a11y effects', () => {
  it('panel zoom grows with text size but is capped (no shrink, no overflow)', () => {
    expect(panelZoom({ ...DEFAULT_A11Y, fontSize: 0 })).toBe(1);
    expect(panelZoom({ ...DEFAULT_A11Y, fontSize: 1 })).toBeCloseTo(1.16);
    expect(panelZoom({ ...DEFAULT_A11Y, fontSize: 4 })).toBe(1.25);
  });

  it('light is a distinct high-contrast palette, not invert', () => {
    expect(highContrastPalette('invert')).toBeNull();
    const l = highContrastPalette('light')!;
    expect(l).not.toEqual(HIGH_CONTRAST_PALETTES.blackYellow);
    for (const p of Object.values(HIGH_CONTRAST_PALETTES)) {
      expect(ratio(p.fg, p.bg)).toBeGreaterThanOrEqual(7);
      expect(ratio(p.link, p.bg)).toBeGreaterThanOrEqual(7);
    }
  });

  it('text align "start" (RTL-safe) and light text colour', () => {
    expect(textA11yStyle({ ...DEFAULT_A11Y, textAlign: 1 }).textAlign).toBe('start');
    expect(textA11yStyle({ ...DEFAULT_A11Y, contrast: 'light' }).color).toBe('#000000');
  });

  it('native saturation uses real filters', () => {
    expect(nativeSaturationFilter('grayscale')).toEqual([{ grayscale: 1 }]);
    expect(nativeSaturationFilter('low')).toEqual([{ saturate: 0.5 }]);
  });
});

import { isAltShortcut } from '../shortcuts';
describe('Alt shortcuts by physical key', () => {
  const ev = (o: Partial<KeyboardEvent>) => ({ altKey: true, ctrlKey: false, metaKey: false, code: '', key: '', ...o });
  it('Mac Option+A (key=å) still matches via e.code', () => {
    expect(isAltShortcut(ev({ code: 'KeyA', key: 'å' }), 'a')).toBe(true);
    expect(isAltShortcut(ev({ code: 'KeyA', key: 'ש' }), 'a')).toBe(true);
    expect(isAltShortcut(ev({ code: 'KeyR', key: 'ר' }), 'a')).toBe(false);
    expect(isAltShortcut(ev({ code: 'KeyA', ctrlKey: true }), 'a')).toBe(false);
    expect(isAltShortcut(ev({ key: 'H' }), 'h')).toBe(true);
  });
});
