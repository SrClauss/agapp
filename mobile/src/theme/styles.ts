import { StyleSheet } from 'react-native';
import { colors } from './colors';
import { fonts } from './fonts';

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
} as const;

export const commonStyles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },

  // Surface/Card styles
  surface: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    elevation: 2,
    shadowColor: colors.overlay,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    elevation: 2,
    shadowColor: colors.overlay,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },

  // Text styles
  title: {
    fontSize: fonts.size.xxl,
    fontWeight: fonts.weight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fonts.size.lg,
    fontWeight: fonts.weight.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: fonts.size.md,
    fontWeight: fonts.weight.normal,
    color: colors.text,
    lineHeight: fonts.lineHeight.md,
  },
  caption: {
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.normal,
    color: colors.textSecondary,
    lineHeight: fonts.lineHeight.sm,
  },
  error: {
    fontSize: fonts.size.sm,
    fontWeight: fonts.weight.normal,
    color: colors.error,
    lineHeight: fonts.lineHeight.sm,
  },

  // Input styles
  input: {
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },

  // Button styles
  button: {
    marginVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  outlinedButton: {
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },

  // Layout styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  column: {
    flexDirection: 'column',
  },
  spaceBetween: {
    justifyContent: 'space-between',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Spacing utilities
  marginXs: { margin: spacing.xs },
  marginSm: { margin: spacing.sm },
  marginMd: { margin: spacing.md },
  marginLg: { margin: spacing.lg },
  marginXl: { margin: spacing.xl },

  paddingXs: { padding: spacing.xs },
  paddingSm: { padding: spacing.sm },
  paddingMd: { padding: spacing.md },
  paddingLg: { padding: spacing.lg },
  paddingXl: { padding: spacing.xl },

  // Border styles
  border: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});