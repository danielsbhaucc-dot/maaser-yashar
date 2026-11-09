/**
 * מודול הנגישות המשותף (@core/a11y-kit מ־platform-core, תג core-v2026.11.09.2) כמודול שמותקן מהלוח.
 * בהתקנה: עולה הווידג'ט המשותף, והכפתור המובנה של מעשר ישר מוסתר (App.tsx). בהסרה: destroy() מפרק את כל
 * מה שהווידג'ט הוסיף (DOM, סגנונות, משתני CSS, השתקת מדיה) והכפתור המובנה חוזר. העדפות הווידג'ט נשמרות במפתח
 * נפרד (core-a11y:v1:maaser-yashar) ולא נוגעים בהגדרות או בנתונים של מעשר ישר.
 */
import { defineA11yTheme, mountA11yWidget } from '../../../packages/@core/a11y-kit/src/index.ts';
import type { InstalledModule } from '../modules';

const MAASER_A11Y_THEME = defineA11yTheme({
  id: 'maaser-yashar',
  colors: {
    bg: '#0B1020', surface: '#151C32', fg: '#F4F6FF', fgMuted: '#B9C0DE',
    primary: '#8B9BFF', onPrimary: '#0B1024', focus: '#FFD88A', link: '#C4B5FD', danger: '#F0A8B8',
  },
  fonts: { body: '"Heebo", system-ui, sans-serif', heading: '"Rubik", "Heebo", system-ui, sans-serif' },
  panel: { side: 'start', maxWidth: 380, maxZoom: 1.25 },
});

export async function install(): Promise<InstalledModule | null> {
  if (typeof document === 'undefined') return null;
  const w = mountA11yWidget({ theme: MAASER_A11Y_THEME, fontBase: '/a11y-fonts', statementHref: '/about' });
  return { remove: () => w.destroy() };
}
