import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text } from 'react-native';
import { getCategories, CategoryAPI } from '../api/categories';
import { useNavigation } from '@react-navigation/native';
import DynamicIcon from './DynamicIcon';

// Legacy ICON_MAP for backward compatibility when categories don't have icon_name/icon_library
const LEGACY_ICON_MAP: { [key: string]: { name: string; library: string } } = {
  'eletricista': { name: 'hammer-wrench', library: 'MaterialCommunityIcons' },
  'encanador': { name: 'pipe', library: 'MaterialCommunityIcons' },
  'pintura': { name: 'format-paint', library: 'MaterialCommunityIcons' },
  'jardinagem': { name: 'flower-outline', library: 'MaterialCommunityIcons' },
  'limpeza': { name: 'broom', library: 'MaterialCommunityIcons' },
  'programacao': { name: 'code-braces', library: 'MaterialCommunityIcons' },
  'instalacao tv': { name: 'television-classic', library: 'MaterialCommunityIcons' },
  'conserto tv': { name: 'television-classic-off', library: 'MaterialCommunityIcons' },
};

function normalizeName(name: string) {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ') // remove punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

export default function CategoryGrid() {
  const [categories, setCategories] = useState<CategoryAPI[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    let mounted = true;
    getCategories()
      .then((cats) => { if (mounted) setCategories(cats); })
      .catch(() => { if (mounted) setCategories([]); });
    return () => { mounted = false; };
  }, []);

  const getIconProps = (item: CategoryAPI) => {
    // First, check if the category has icon data from the API
    if (item.icon_name && item.icon_library) {
      return { name: item.icon_name, library: item.icon_library };
    }
    // Fallback to legacy ICON_MAP for backward compatibility
    const normalizedName = normalizeName(item.name);
    const legacyIcon = LEGACY_ICON_MAP[normalizedName];
    if (legacyIcon) {
      return legacyIcon;
    }
    // No icon found
    return { name: null, library: null };
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => (item.id ? item.id : `${item.name}-${index}`)}
        renderItem={({ item }) => {
          const iconProps = getIconProps(item);
          return (
            <TouchableOpacity
              style={styles.item}
              onPress={() => navigation.navigate('SearchResults' as never, { category: item.name } as never)}
            >
              <View style={styles.iconContainer}>
                <DynamicIcon
                  library={iconProps.library}
                  name={iconProps.name}
                  size={28}
                  color="#333"
                  fallbackText={item.name}
                />
              </View>
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  listContent: { paddingBottom: 8 },
  item: { flex: 1, margin: 8, alignItems: 'center' },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f2f6f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: { fontSize: 12, textAlign: 'center' },
});
