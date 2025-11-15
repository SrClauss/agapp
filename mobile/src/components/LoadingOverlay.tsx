import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator, Text, Portal } from 'react-native-paper';
import { colors, spacing, typography } from '../theme';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = 'Carregando...',
}) => {
  if (!visible) return null;

  return (
    <Portal>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Portal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderRadius: spacing.md,
    alignItems: 'center',
    minWidth: 150,
  },
  message: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
});

export default LoadingOverlay;
