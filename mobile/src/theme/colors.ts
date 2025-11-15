/**
 * Paleta de cores do aplicativo
 * Centralize todas as cores aqui para fácil manutenção
 */

export const colors = {
  // Cores primárias
  primary: '#3471b9',
  primaryDark: '#2a5a96',
  primaryLight: '#5a8fd9',

  // Cores secundárias
  secondary: '#ff9800',
  secondaryDark: '#c66900',
  secondaryLight: '#ffc947',

  // Cores de status
  success: '#4caf50',
  successLight: '#81c784',
  successDark: '#2e7d32',

  error: '#f44336',
  errorLight: '#e57373',
  errorDark: '#d32f2f',

  warning: '#ff9800',
  warningLight: '#ffb74d',
  warningDark: '#f57c00',

  info: '#2196f3',
  infoLight: '#64b5f6',
  infoDark: '#1976d2',

  // Cores neutras
  black: '#000000',
  white: '#ffffff',

  gray50: '#fafafa',
  gray100: '#f5f5f5',
  gray200: '#eeeeee',
  gray300: '#e0e0e0',
  gray400: '#bdbdbd',
  gray500: '#9e9e9e',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',

  // Cores de texto
  textPrimary: '#333333',
  textSecondary: '#666666',
  textDisabled: '#999999',
  textHint: '#bbbbbb',

  // Cores de fundo
  background: '#ffffff',
  backgroundDark: '#f5f5f5',
  surface: '#ffffff',

  // Cores específicas
  professional: '#ff9800',
  professionalBg: '#fff3e0',

  client: '#3471b9',
  clientBg: '#e3f2fd',

  // Cores de componentes
  badge: '#f44336',
  chip: '#f5f5f5',
  chipSelected: '#3471b9',

  card: '#ffffff',
  cardBorder: '#e0e0e0',

  divider: '#e0e0e0',

  overlay: 'rgba(0, 0, 0, 0.5)',
} as const;

export type ColorKey = keyof typeof colors;
