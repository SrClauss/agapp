
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text } from 'react-native';
import { getCategories, CategoryAPI } from '../api/categories';
import { useNavigation } from '@react-navigation/native';
import DynamicIcon from './DynamicIcon';
import { colors } from '../theme/colors';

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
    if (item.icon_name && item.icon_library) {
      return { name: item.icon_name, library: item.icon_library };
    }
    return { name: undefined, library: undefined };
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
                  name={iconProps.name?.replaceAll('_', '-') || ''}
                  size={32}
                  color={colors.primaryDark}
                  fallbackText={item.name}
                />
              </View>
                <Text style={[styles.name, { maxWidth: 130 }]} numberOfLines={2} ellipsizeMode="tail">{item.name.toUpperCase()}</Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[styles.listContent, { paddingHorizontal: 12 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 16 },
  listContent: { paddingBottom: 8 },
  item: { width: 92, margin: 8, alignItems: 'center' },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0F0F0'
  },
    name: {
      fontSize: 11, textAlign: 'center', flexWrap: 'wrap', color: colors.textSecondary, fontWeight: '700'
    },
});
