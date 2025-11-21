import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { colors } from './colors';
import { fonts } from './fonts';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryLight,
    tertiary: colors.accent,
    tertiaryContainer: colors.accentLight,
    surface: colors.surface,
    surfaceVariant: colors.card,
    surfaceDisabled: colors.borderLight,
    onSurface: colors.text,
    onSurfaceVariant: colors.textSecondary,
    onSurfaceDisabled: colors.textDisabled,
    background: colors.background,
    onBackground: colors.text,
    error: colors.error,
    onError: colors.background,
    errorContainer: colors.error,
    onErrorContainer: colors.background,
    outline: colors.border,
    outlineVariant: colors.borderLight,
    inverseSurface: colors.text,
    inverseOnSurface: colors.background,
    inversePrimary: colors.primaryLight,
    shadow: colors.overlay,
    scrim: colors.backdrop,
    backdrop: colors.backdrop,
  },
  fonts: {
    ...MD3LightTheme.fonts,
    regular: {
      fontFamily: fonts.regular,
      fontWeight: fonts.weight.normal,
    },
    medium: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weight.medium,
    },
    bold: {
      fontFamily: fonts.bold,
      fontWeight: fonts.weight.bold,
    },
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: colors.primaryLight,
    primaryContainer: colors.primary,
    secondary: colors.secondaryLight,
    secondaryContainer: colors.secondary,
    tertiary: colors.accentLight,
    tertiaryContainer: colors.accent,
    surface: '#1E1E1E',
    surfaceVariant: '#2D2D2D',
    surfaceDisabled: '#3D3D3D',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#CCCCCC',
    onSurfaceDisabled: '#999999',
    background: '#121212',
    onBackground: '#FFFFFF',
    error: colors.error,
    onError: '#FFFFFF',
    errorContainer: colors.error,
    onErrorContainer: '#FFFFFF',
    outline: '#555555',
    outlineVariant: '#666666',
    inverseSurface: '#FFFFFF',
    inverseOnSurface: '#000000',
    inversePrimary: colors.primary,
    shadow: colors.overlay,
    scrim: colors.backdrop,
    backdrop: colors.backdrop,
  },
  fonts: {
    ...MD3DarkTheme.fonts,
    regular: {
      fontFamily: fonts.regular,
      fontWeight: fonts.weight.normal,
    },
    medium: {
      fontFamily: fonts.medium,
      fontWeight: fonts.weight.medium,
    },
    bold: {
      fontFamily: fonts.bold,
      fontWeight: fonts.weight.bold,
    },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

export const theme = lightTheme;