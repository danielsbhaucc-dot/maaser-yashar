import { describe, expect, it } from 'vitest';
import { shellModeForWidth } from '../shellLayout';

describe('shellModeForWidth', () => {
  it('native always compact', () => {
    expect(shellModeForWidth(1920, false)).toBe('compact');
  });

  it('web breakpoints', () => {
    expect(shellModeForWidth(390, true)).toBe('compact');
    expect(shellModeForWidth(767, true)).toBe('compact');
    expect(shellModeForWidth(768, true)).toBe('medium');
    expect(shellModeForWidth(1199, true)).toBe('medium');
    expect(shellModeForWidth(1200, true)).toBe('wide');
  });
});
