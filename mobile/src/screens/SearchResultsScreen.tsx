import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getSubcategoriesWithParent } from '../api/categories';

export default function SearchResultsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const subs = await getSubcategoriesWithParent();
        if (!mounted) return;
        const params = (route as any).params;
        if (params?.category) {
          setItems(subs.filter(s => s.parent.name === params.category));
        } else if (params?.subcategory) {
          setItems(subs.filter(s => s.name === params.subcategory));
        } else {
          setItems(subs);
        }
      } catch (err) {
        console.warn('Erro ao carregar resultados', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [route]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resultados</Text>
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.parent.id || item.parent.name}-${item.name}-${index}`}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => { /* TODO: navigate to list of services */ }}>
            <Text style={styles.itemTitle}>{item.name}</Text>
            <Text style={styles.itemSubtitle}>{item.parent.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  item: { paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
  itemTitle: { fontSize: 16 },
  itemSubtitle: { fontSize: 12, color: '#666' }
});
