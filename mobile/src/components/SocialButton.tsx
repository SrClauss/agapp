import React from 'react';
import { View, TextStyle } from 'react-native';
import { Button } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type Props = {
  label: string;
  onPress: () => void;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor?: string;
  loading?: boolean;
  disabled?: boolean;
  mode?: 'contained' | 'outlined' | 'text';
  style?: any;
  labelStyle?: TextStyle;
};

export default function SocialButton({
  label,
  onPress,
  iconName,
  iconColor,
  loading,
  disabled,
  mode = 'outlined',
  style,
  labelStyle,
}: Props) {
  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
      uppercase={false}
      style={style}
      textColor='#000'
      icon={
        iconName
          ? () => <MaterialCommunityIcons name={iconName} size={20} color={iconColor} />
          : undefined
      }
      labelStyle={labelStyle}
    >
      {label}
    </Button>
  );
}
