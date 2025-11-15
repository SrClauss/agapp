import React from 'react';
import { Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  actions?: Array<{
    icon: string;
    onPress: () => void;
    accessibilityLabel?: string;
  }>;
  onBackPress?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  subtitle,
  showBack = true,
  actions = [],
  onBackPress,
}) => {
  const navigation = useNavigation<StackNavigationProp<any>>();

  const handleBackPress = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <Appbar.Header>
      {showBack && <Appbar.BackAction onPress={handleBackPress} />}
      <Appbar.Content title={title} subtitle={subtitle} />
      {actions.map((action, index) => (
        <Appbar.Action
          key={index}
          icon={action.icon}
          onPress={action.onPress}
          accessibilityLabel={action.accessibilityLabel}
        />
      ))}
    </Appbar.Header>
  );
};

export default AppHeader;
