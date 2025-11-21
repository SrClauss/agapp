export const fonts = {
  // Font families
  regular: 'System',
  medium: 'System',
  bold: 'System',

  // Font sizes
  size: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },

  // Line heights
  lineHeight: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32,
    xxl: 36,
    xxxl: 48,
  },

  // Font weights
  weight: {
    normal: '400' as const,
    medium: '500' as const,
    bold: '700' as const,
  },
} as const;

export type FontScheme = typeof fonts;