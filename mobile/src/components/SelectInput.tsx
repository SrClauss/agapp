import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Menu, HelperText } from 'react-native-paper';
import { colors } from '../theme';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectInputProps {
  label: string;
  value: string;
  options: SelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
}

const SelectInput: React.FC<SelectInputProps> = ({
  label,
  value,
  options,
  onValueChange,
  placeholder = 'Selecione...',
  error = false,
  helperText,
  disabled = false,
  required = false,
}) => {
  const [visible, setVisible] = useState(false);

  const openMenu = () => !disabled && setVisible(true);
  const closeMenu = () => setVisible(false);

  const handleSelect = (selectedValue: string) => {
    onValueChange(selectedValue);
    closeMenu();
  };

  const selectedLabel =
    options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <View style={styles.container}>
      <Menu
        visible={visible}
        onDismiss={closeMenu}
        anchor={
          <TextInput
            label={required ? `${label} *` : label}
            value={selectedLabel}
            mode="outlined"
            editable={false}
            onPressIn={openMenu}
            right={<TextInput.Icon icon="chevron-down" onPress={openMenu} />}
            error={error}
            disabled={disabled}
            style={styles.input}
            outlineColor={colors.border}
            activeOutlineColor={error ? colors.error : colors.primary}
          />
        }
        style={styles.menu}
      >
        {options.map((option) => (
          <Menu.Item
            key={option.value}
            onPress={() => handleSelect(option.value)}
            title={option.label}
            style={
              option.value === value ? styles.selectedItem : styles.menuItem
            }
          />
        ))}
      </Menu>
      {helperText && (
        <HelperText type={error ? 'error' : 'info'} visible={!!helperText}>
          {helperText}
        </HelperText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
  },
  menu: {
    maxWidth: '90%',
  },
  menuItem: {
    maxWidth: 400,
  },
  selectedItem: {
    maxWidth: 400,
    backgroundColor: colors.primaryLight,
  },
});

export default SelectInput;
