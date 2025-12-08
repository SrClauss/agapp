import React from 'react';
import { Text, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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
  // If we have a name, try to render using specified library
  if (name) {
    try {
      const lib = (library || 'MaterialIcons').toLowerCase();
      switch (lib) {
        case 'materialicons':
        case 'material-icons':
          return <MaterialIcons name={name as React.ComponentProps<typeof MaterialIcons>['name']} size={size} color={color} />;
        case 'materialcommunityicons':
        case 'material-community-icons':
        case 'materialcommunity':
          return <MaterialCommunityIcons name={name as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={size} color={color} />;
        case 'ionicons':
          return <Ionicons name={name as React.ComponentProps<typeof Ionicons>['name']} size={size} color={color} />;
        case 'fontawesome':
        case 'fontawesome5':
        case 'fa':
          return <FontAwesome name={name as React.ComponentProps<typeof FontAwesome>['name']} size={size} color={color} />;
        default:
          // Default to MaterialIcons
          return <MaterialIcons name={name as React.ComponentProps<typeof MaterialIcons>['name']} size={size} color={color} />;
      }
    } catch (error) {
      // If icon rendering fails, fall through to fallback
      console.warn(`Failed to render icon '${name}' from library '${library}':`, error);
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
