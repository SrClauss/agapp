
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text } from 'react-native';
import { getCategories, CategoryAPI } from '../api/categories';
import { useNavigation } from '@react-navigation/native';
import DynamicIcon from './DynamicIcon';

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
                  size={28}
                  color="#333"
                  fallbackText={item.name}
                />
              </View>
                <Text style={[styles.name, { maxWidth: 130 }]} numberOfLines={3} ellipsizeMode="tail">{item.name}</Text>
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
    name: {
      fontSize: 12, textAlign: 'center', flexWrap: 'wrap',
    },
});
