export const colors = {
  // Primary colors
  primary: '#3bb273', // Blue
  primaryDark: '#5f43ee',
  primaryLight: '#42A5F5',

  // Secondary colors
  secondary: '#DC004E', // Pink
  secondaryDark: '#C2185B',
  secondaryLight: '#FF5983',

  // Accent colors
  accent: '#FF9800', // Orange
  accentDark: '#F57C00',
  accentLight: '#FFB74D',

  // Background colors
  background: '#FFFFFF',
  surface: '#F5F5F5',
  card: '#FFFFFF',

  // Text colors
  text: '#212121',
  textSecondary: '#757575',
  textDisabled: '#BDBDBD',

  // Status colors
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',

  // Border colors
  border: '#E0E0E0',
  borderLight: '#F0F0F0',

  // Transparent colors
  overlay: 'rgba(0, 0, 0, 0.5)',
  backdrop: 'rgba(0, 0, 0, 0.3)',
} as const;

export type ColorScheme = typeof colors;