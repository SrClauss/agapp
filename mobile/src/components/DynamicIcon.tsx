import React from 'react';
import { Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Feather from '@expo/vector-icons/Feather';
import AntDesign from '@expo/vector-icons/AntDesign';
import Entypo from '@expo/vector-icons/Entypo';
import EvilIcons from '@expo/vector-icons/EvilIcons';
import Foundation from '@expo/vector-icons/Foundation';
import Octicons from '@expo/vector-icons/Octicons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import Zocial from '@expo/vector-icons/Zocial';

// Define a common interface for icon component props
interface IconComponentProps {
  name: string;
  size: number;
  color: string;
}

// Map library names to icon components
// Note: Using a generic type here because each icon library has its own specific
// name types, but we need to support dynamic icon names from the API
const ICON_LIBRARIES: Record<string, React.ComponentType<IconComponentProps>> = {
  MaterialCommunityIcons: MaterialCommunityIcons as React.ComponentType<IconComponentProps>,
  FontAwesome: FontAwesome as React.ComponentType<IconComponentProps>,
  FontAwesome5: FontAwesome5 as React.ComponentType<IconComponentProps>,
  Ionicons: Ionicons as React.ComponentType<IconComponentProps>,
  MaterialIcons: MaterialIcons as React.ComponentType<IconComponentProps>,
  Feather: Feather as React.ComponentType<IconComponentProps>,
  AntDesign: AntDesign as React.ComponentType<IconComponentProps>,
  Entypo: Entypo as React.ComponentType<IconComponentProps>,
  EvilIcons: EvilIcons as React.ComponentType<IconComponentProps>,
  Foundation: Foundation as React.ComponentType<IconComponentProps>,
  Octicons: Octicons as React.ComponentType<IconComponentProps>,
  SimpleLineIcons: SimpleLineIcons as React.ComponentType<IconComponentProps>,
  Zocial: Zocial as React.ComponentType<IconComponentProps>,
};

interface DynamicIconProps {
  library?: string | null;
  name?: string | null;
  size?: number;
  color?: string;
  fallbackText?: string;
}

/**
 * DynamicIcon component renders icons from various react-native-vector-icons libraries.
 * If the library or name is not provided, it displays a fallback text (first letter of fallbackText).
 */
export default function DynamicIcon({
  library,
  name,
  size = 28,
  color = '#333',
  fallbackText = '?',
}: DynamicIconProps) {
  // If we have both library and name, try to render the icon
  if (library && name) {
    const IconComponent = ICON_LIBRARIES[library];
    if (IconComponent) {
      try {
        return <IconComponent name={name} size={size} color={color} />;
      } catch (error) {
        // If icon rendering fails, fall through to fallback
        console.warn(`Failed to render icon: ${library}/${name}`, error);
      }
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
