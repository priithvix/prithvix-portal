import { palette, COLORS } from '@/constants/theme';

/**
 * Legacy default export — maps to light dealer UI tokens.
 * Prefer importing `COLORS` / `palette` from `@/constants/theme` in new code.
 */
const Colors = {
  primary: palette.green700,
  primaryDark: palette.green900,
  primaryLight: palette.primarySoft,
  accent: palette.amber600,
  accentLight: palette.amber100,
  accentDark: palette.amber600,
  background: palette.slate50,
  surface: palette.white,
  surfaceAlt: palette.slate100,
  text: palette.slate900,
  textSecondary: palette.slate700,
  textTertiary: palette.slate500,
  border: palette.slate200,
  borderLight: palette.slate100,
  success: palette.success600,
  successSoft: palette.successSoft,
  warning: palette.amber600,
  danger: palette.red600,
  dangerLight: palette.red100,
  info: palette.blue600,
  overlay: 'rgba(0,0,0,0.5)',
  white: palette.white,
  black: palette.slate900,
  tabBar: palette.slate50,
  scannerGreen: palette.green700,
};

export default Colors;
