/**
 * מעשר ישר — iOS זכוכית כהה
 * צבעי צדקה וחסד: כחול־ספיר, סגול רך, זהב חם (בלי ירוק)
 */
export const colors = {
  bg: '#0B1020',
  bgSoft: '#151C32',
  bgElevated: 'rgba(255,255,255,0.09)',
  surface: 'rgba(255,255,255,0.12)',
  surfaceMuted: 'rgba(255,255,255,0.07)',
  surfaceSolid: '#12182C',
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(255,255,255,0.14)',
  glassStrong: 'rgba(255,255,255,0.07)',
  glassGoldBorder: 'rgba(232, 192, 122, 0.32)',
  /** זכוכית עדינה — גוון סגול־שקוף שנמסג ברקע */
  glassDark: 'rgba(196, 181, 253, 0.06)',
  glassDarkBorder: 'rgba(255,255,255,0.12)',
  /**
   * פאנל מעוגל — קרוב לגרדיאנט (בלי קופסה אפורה)
   */
  sheet: '#161338',
  sheetCard: 'rgba(255,255,255,0.05)',
  sheetInk: 'rgba(255,255,255,0.96)',
  sheetMuted: 'rgba(255,255,255,0.62)',
  sheetBorder: 'rgba(255,255,255,0.10)',
  ink: 'rgba(255,255,255,0.96)',
  inkDark: '#0F172A',
  inkMuted: 'rgba(255,255,255,0.86)',
  inkSoft: 'rgba(255,255,255,0.62)',
  primary: '#8B9BFF',
  primaryDark: '#6677F0',
  primarySoft: 'rgba(139, 155, 255, 0.24)',
  primaryOn: '#0B1024',
  primaryGradient: ['#8B9BFF', '#A78BFA'] as const,
  accent: '#C4B5FD',
  accent2: '#A78BFA',
  accent3: '#F0A8B8',
  accentSoft: 'rgba(196, 181, 253, 0.20)',
  gold: '#F0C674',
  goldDeep: '#E8B86D',
  goldSoft: 'rgba(240, 198, 116, 0.24)',
  goldGradient: ['#F5D78E', '#E8B86D'] as const,
  badgePink: '#F472B6',
  danger: '#F0A8B8',
  dangerSoft: 'rgba(240, 168, 184, 0.18)',
  success: '#7EC8E3',
  successSoft: 'rgba(126, 200, 227, 0.18)',
  income: '#7EC8E3',
  expense: '#F0A8B8',
  tzedaka: '#F0C674',
  border: 'rgba(255,255,255,0.16)',
  separator: 'rgba(255,255,255,0.10)',
  overlay: 'rgba(6, 8, 18, 0.62)',
  tabBar: 'rgba(14, 18, 34, 0.78)',
  chatBot: 'rgba(255,255,255,0.12)',
  chatMe: '#6677F0',
  chatMeText: '#F4F6FF',
  gradient: ['#0B1020', '#1B1648', '#2C1A52'] as const,
  orbA: '#7C6BF0',
  orbB: '#4F86D8',
  orbC: '#D4A84B',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 40,
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 36,
  sheet: 40,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  float: {
    shadowColor: '#6677F0',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
  fab: {
    shadowColor: '#8B9BFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 10,
  },
};

export { fonts, type, rtlText } from './typography';
