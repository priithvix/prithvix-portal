/**
 * PrithviX — dealer-first light UI tokens (rural shop, bright sunlight).
 * Inter loaded via next/font; use FONT.* from this module in screens.
 */

// =============================================================================
// COLORS (spec — Apr 2026 design system)
// =============================================================================

export const palette = {
  /** Primary brand */
  green900: '#084424',
  green700: '#0F7A3E',
  green600: '#0d6b36',
  green100: '#dcfce7',
  green50: '#f0fdf4',
  /** Primary-soft — tinted surfaces */
  primarySoft: '#E8F5EE',

  amber600: '#D97706',
  amber100: '#FEF3C7',
  amber50: '#fffbeb',

  red600: '#DC2626',
  red500: '#ef4444',
  red100: '#FEE2E2',
  red50: '#fef2f2',

  /** Success (distinct from primary green) */
  success600: '#059669',
  successSoft: '#D1FAE5',

  slate900: '#0F172A',
  slate700: '#475569',
  slate600: '#64748b',
  slate500: '#64748b',
  slate400: '#94A3B8',
  slate300: '#cbd5e1',
  slate200: '#E2E8F0',
  slate100: '#f1f5f9',
  slate50: '#F8FAFC',

  white: '#ffffff',

  blue100: '#dbeafe',
  blue600: '#2563eb',
} as const;

/** Semantic aliases used across the app */
export const COLORS = {
  pageBg: palette.slate50,
  card: palette.white,
  textPrimary: palette.slate900,
  textSecondary: palette.slate700,
  textCaption: palette.slate500,
  textMuted: palette.slate400,
  /** Label / secondary — #475569 scale */
  textLabel: palette.slate600,
  textDisabled: palette.slate400,
  border: palette.slate200,
  borderStrong: palette.slate300,
  divider: palette.slate100,
  inputBg: palette.slate100,
  primary: palette.green700,
  primaryPressed: palette.green600,
  primaryDark: palette.green900,
  primaryTint: palette.primarySoft,
  /** @deprecated alias — use primaryTint */
  primaryLight: palette.primarySoft,
  primaryMuted: palette.green100,
  accent: palette.amber600,
  accentTint: palette.amber50,
  accentBg: palette.amber100,
  danger: palette.red600,
  dangerTint: palette.red50,
  dangerBg: palette.red100,
  success: palette.success600,
  successSoft: palette.successSoft,
  warning: palette.amber600,
  warningSoft: palette.amber100,
  info: palette.blue600,
  infoBg: palette.blue100,
  overlay: 'rgba(0,0,0,0.5)',
  /** @deprecated use pageBg */
  background: palette.slate50,
  /** @deprecated use textCaption */
  textLight: palette.slate400,
  /** @deprecated use danger */
  error: palette.red500,
  /** @deprecated use card */
  secondary: palette.green700,
} as const;

export type ThemeColors = typeof COLORS;

// =============================================================================
// TYPOGRAPHY — design system (Inter via FONT.*)
// =============================================================================

/** Inter font weights - web uses CSS font-weight values */
export const FONT = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const TYPOGRAPHY = {
  fontRegular: '400' as const,
  fontMedium: '500' as const,
  fontSemibold: '600' as const,
  fontBold: '700' as const,

  /** Display — big numbers / hero */
  sizeDisplay: 32,
  sizeXs: 11,
  sizeSm: 13,
  sizeBase: 15,
  sizeLg: 17,
  sizeXl: 20,
  size2xl: 24,
  size3xl: 30,

  /** Label uppercase */
  sizeLabel: 11,
  sizeCaption: 12,

  /** Legacy names — map to new scale */
  sizeHeading: 20,
  sizeSubheading: 20,
  sizeBody: 15,
  lineHeight: 1.5,
} as const;

/** Uppercase label at 11px — 0.08em → web letterSpacing (px) */
export const LABEL_LETTER_SPACING = 0.88;

// =============================================================================
// SPACING (px)
// =============================================================================

export const SPACING = {
  micro: 4,
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  /** legacy */
  section: 24,
  major: 32,
} as const;

// =============================================================================
// RADII
// =============================================================================

export const BORDERS = {
  radiusXs: 4,
  radiusSm: 8,
  radius: 10,
  radiusMd: 12,
  radiusLg: 16,
  radiusSheet: 20,
  radiusPill: 20,
  /** legacy */
  radiusSmall: 10,
  radiusLarge: 16,
} as const;

// =============================================================================
// SHADOWS — card: elevation 1 Android, low shadow iOS (convert to CSS box-shadow)
// =============================================================================

export const SHADOWS = {
  card: 'box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06)',
  small: 'box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06)',
  medium: 'box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08)',
  hero: 'box-shadow: 0 4px 16px rgba(15, 122, 62, 0.08)',
} as const;

/** Primary button inner glow on focus (subtle green) */
export const focusGlowGreen = 'box-shadow: 0 0 0 4px rgba(13, 107, 54, 0.2)';

// =============================================================================
// PRESS / MOTION
// =============================================================================

export const PRESS_SPRING = { damping: 15, stiffness: 300 } as const;

// =============================================================================
// BADGE (pill)
// =============================================================================

export const BADGE_TONES = {
  success: { bg: palette.successSoft, text: palette.success600 },
  warning: { bg: palette.amber100, text: palette.amber600 },
  danger: { bg: palette.red100, text: palette.red600 },
  neutral: { bg: palette.slate100, text: palette.slate600 },
  info: { bg: palette.blue100, text: palette.blue600 },
} as const;

// =============================================================================
// AVATAR TIER / ROLE
// =============================================================================

export const AVATAR_TONES = {
  bronze: { bg: '#f59e0b', text: palette.white },
  silver: { bg: palette.slate400, text: palette.white },
  gold: { bg: palette.green600, text: palette.white },
  staff: { bg: '#3b82f6', text: palette.white },
  default: { bg: palette.slate200, text: palette.slate600 },
} as const;

// =============================================================================
// HELPERS — presentation only
// =============================================================================

export function formatINR(amount: number, fractionDigits = 0): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateDDMMMYYYY(d: Date | string | number): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const mon = MONTHS[date.getMonth()] ?? '';
  const y = date.getFullYear();
  return `${day} ${mon} ${y}`;
}

// =============================================================================
// UNIFIED THEME
// =============================================================================

export const theme = {
  colors: COLORS,
  palette,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  borders: BORDERS,
  shadows: SHADOWS,
} as const;

export type Theme = typeof theme;

export default theme;
