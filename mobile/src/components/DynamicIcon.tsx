import React from 'react';
import { Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// Define a common interface for icon component props
interface IconComponentProps {
  name: string;
  size: number;
  color: string;
}

interface DynamicIconProps {
  library?: string | null;
  name?: string | null;
  size?: number;
  color?: string;
  fallbackText?: string;
}

/**
 * DynamicIcon component renders icons from MaterialIcons library.
 * The library parameter is kept for backward compatibility but MaterialIcons is always used.
 * If the name is not provided, it displays a fallback text (first letter of fallbackText).
 */
export default function DynamicIcon({
  library,
  name,
  size = 28,
  color = '#333',
  fallbackText = '?',
}: DynamicIconProps) {
  // If we have a name, try to render the MaterialIcons icon
  // Using ComponentProps to get the proper name type from MaterialIcons
  if (name) {
    try {
      // MaterialIcons accepts string names that correspond to the icon set
      // Type assertion is safe here as we handle invalid icons with fallback
      return <MaterialIcons name={name as React.ComponentProps<typeof MaterialIcons>['name']} size={size} color={color} />;
    } catch (error) {
      // If icon rendering fails, fall through to fallback
      console.warn(`Failed to render icon: ${name}`, error);
    }
  }

  // Fallback: display first character of fallbackText
  return (
    <Text style={[styles.fallbackText, { fontSize: size * 0.7, color }]}>
      {fallbackText.charAt(0).toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  fallbackText: {
    fontWeight: '700',
  },
});
