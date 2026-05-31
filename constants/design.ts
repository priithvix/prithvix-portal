import { palette, COLORS } from '@/constants/theme';

/**
 * Shared "premium" tokens for More, Support, Legal — aligned with light dealer UI.
 */
export const DESIGN = {
  bg: COLORS.pageBg,
  cardBg: palette.white,
  heroStart: palette.green900,
  heroMid: palette.green700,
  heroEnd: palette.green600,
  accent: palette.green700,
  accentLight: palette.green50,
  accentBorder: palette.green100,
  gold: palette.amber600,
  goldLight: palette.amber50,
  blue: palette.blue600,
  blueLight: palette.blue100,
  textPrimary: palette.slate900,
  textSecondary: palette.slate700,
  textLight: palette.slate500,
  inputBorder: palette.slate200,
  inputFocus: palette.green600,
  error: palette.red600,
  separator: palette.slate100,
  success: palette.green700,
} as const;
