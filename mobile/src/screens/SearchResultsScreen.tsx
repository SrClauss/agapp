import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { getSubcategoriesWithParent } from '../api/categories';
import { colors } from '../theme/colors';
import { Divider, Button } from 'react-native-paper';
import LocationAvatar from '../components/LocationAvatar';

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

  const handleCreateProject = (item: any) => {
    navigation.navigate('CreateProject' as never, {
      categoryName: item.parent.name,
      subcategoryName: item.name,
    } as never);
  };

  const handleViewProjects = (item: any) => {
    navigation.navigate('AllProjects' as never, {
      category: item.parent.name,
      subcategories: [item.name]
    } as never);
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.outerContainer}>
      <LocationAvatar />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Resultados</Text>
        
        <Divider style={styles.divider} />
      
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.parent.id || item.parent.name}-${item.name}-${index}`}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.itemSubtitle}>{item.parent.name}</Text>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity 
                style={styles.createProjectButton}
                onPress={() => handleCreateProject(item)}
              >
                <Text style={styles.createProjectButtonText}>Criar Projeto</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.viewProjectsButton}
                onPress={() => handleViewProjects(item)}
              >
                <Text style={styles.viewProjectsButtonText}>Ver Projetos</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        scrollEnabled={false} // Disable FlatList scroll since parent ScrollView handles it
      />

      <Button
        mode="outlined"
        onPress={handleGoBack}
        style={styles.backButton}
      >
        Voltar
      </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, paddingTop: 50 },
  scrollContainer: { flex: 1 },
  container: { 
    flexGrow: 1, 
    padding: 16,
    paddingBottom: 100, // Extra padding for button
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  item: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderColor: '#eee' 
  },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 16 },
  itemSubtitle: { fontSize: 12, color: '#666' },
  createProjectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
  },
  createProjectButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  viewProjectsButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primary
  },
  viewProjectsButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600'
  },
  backButton: {
    marginTop: 24,
    marginBottom: 16,
  }
});
