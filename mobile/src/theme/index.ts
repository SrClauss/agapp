/**
 * Tema principal do aplicativo
 * Exporta todos os tokens de design em um único lugar
 */

import { colors } from './colors';
import { typography, textStyles } from './typography';
import { spacing, borderRadius, shadows } from './spacing';

export const theme = {
  colors,
  typography,
  textStyles,
  spacing,
  borderRadius,
  shadows,
} as const;

export type Theme = typeof theme;

// Exportações individuais para facilitar imports
export { colors } from './colors';
export { typography, textStyles } from './typography';
export { spacing, borderRadius, shadows } from './spacing';

// Re-exportar tipos
export type { ColorKey } from './colors';
