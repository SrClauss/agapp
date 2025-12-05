import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { getCategories, CategoryAPI } from '../api/categories';
import { useNavigation } from '@react-navigation/native';

const ICON_MAP: { [key: string]: string } = {
  'eletricista': 'hammer-wrench',
  'encanador': 'pipe',
  'pintura': 'format-paint',
  'jardinagem': 'flower-outline',
  'limpeza': 'broom',
  'programacao': 'code-braces',
  'instalacao tv': 'television-classic',
  'conserto tv': 'television-classic-off',
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

  // Cleanup: use inline renderItem in FlatList and ensure stable unique keys

  return (
    <View style={styles.container}>
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => (item.id ? item.id : `${item.name}-${index}`)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('SearchResults' as never, { category: item.name } as never)}
          >
            <View style={styles.iconContainer}>
              {ICON_MAP[normalizeName(item.name)] ? (
                <MaterialCommunityIcons name={ICON_MAP[normalizeName(item.name)]} size={28} color="#333" />
              ) : (
                <Text style={styles.iconText}>{item.name.charAt(0)}</Text>
              )}
            </View>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          </TouchableOpacity>
        )}
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
  iconText: { fontWeight: '700', color: '#333' },
  name: { fontSize: 12, textAlign: 'center' },
});
