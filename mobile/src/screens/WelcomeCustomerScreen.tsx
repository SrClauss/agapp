import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native-paper';
import type { ListRenderItemInfo } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { getSubcategoriesWithParent, SubcategoryWithParent } from '../api/categories';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import LocationAvatar from '../components/LocationAvatar';
import { BannerAd } from '../components/BannerAd';
import { colors } from '../theme/colors';

// Interface for Category endpoint: GET /categories
interface Subcategory {
  name: string;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
  tags: string[];
  subcategories: Subcategory[];
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  is_active: boolean;
  default_remote_execution: boolean;
}

export default function WelcomeCustomerScreen() {
  const navigation = useNavigation();
  const logout = useAuthStore((s: AuthState) => s.logout);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [subcategories, setSubcategories] = useState<SubcategoryWithParent[]>([]);
  // null === not searched yet; [] === searched but no results
  const [filteredSubcategories, setFilteredSubcategories] = useState<SubcategoryWithParent[] | null>(null);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await logout();
      navigation.navigate('Login' as never);
    } catch (err) {
      console.warn('Logout falhou', err);
    } finally {
      setLoading(false);
    }
  };
  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') {
      // Keep the list hidden until user searches explicitly
      setFilteredSubcategories(null);
      return;
    }
    const results = subcategories.filter(s => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.parent.name.toLowerCase().includes(q) ||
        (s.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    });
    // Search debug logs removed to reduce console noise
    setFilteredSubcategories(results);
  };
  const handlerClearSearch = () => {
    setSearchQuery('');
    setFilteredSubcategories(null);
  };


  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingSubcategories(true);
      try {
        const subs = await getSubcategoriesWithParent();
        if (!mounted) return;
        setSubcategories(subs);
        // Do not pre-populate filtered list: wait for user search
        setFilteredSubcategories(null);
      } catch (err) {
        console.warn('Erro buscando subcategorias', err);
      } finally {
        setLoadingSubcategories(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Memoized renderItem — avoids recreating function on every render
  const handleItemPress = useCallback((item: SubcategoryWithParent) => {
    // TODO: navegação – passar para a tela de resultados filtrando por subcategoria
    // navigation.navigate('SearchResults' as never, { subcategory: item.name } as never);
  }, [navigation]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<SubcategoryWithParent>) => (
    <TouchableOpacity style={styles.subcategoryItem} onPress={() => handleItemPress(item)}>
      <Text style={styles.subcategoryName}>{item.name}</Text>
      <Text style={styles.subcategoryParent}>{item.parent.name}</Text>
    </TouchableOpacity>
  ), [handleItemPress]);

  const keyExtractor = useCallback((item: SubcategoryWithParent) => `${item.parent.id}-${item.name}`, []);


  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.containerWelcome}>
        <LocationAvatar />

        <BannerAd adType="banner_client" minHeight={90} maxHeight={200} />

        {/* Botão de limpar cache removido (debug retirado). */}

        <TextInput
          style={styles.textInput}
          label="O que você está procurando hoje?"
          mode='outlined'
          value={searchQuery}
          onChangeText={text => setSearchQuery(text)}
          onSubmitEditing={handleSearch}
          left={<TextInput.Icon icon="magnify" />}

        />
        <Button onPress={handleSearch} mode="contained" style={{ marginTop: 20 }}>
          Buscar
        </Button>
    {Array.isArray(filteredSubcategories) && filteredSubcategories.length > 0 && (
          <>
            <View style={styles.listWrapper}>
              <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Subcategorias</Text>
              <FlatList
                data={filteredSubcategories}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                initialNumToRender={8}
                maxToRenderPerBatch={12}
                windowSize={21}
                style={styles.flatList}
                contentContainerStyle={styles.flatListContent}
              />
            </View>

            <Button
              mode="contained"
              labelStyle={{ color: 'white' }}
              onPress={handlerClearSearch}
              disabled={searchQuery === ''}
              style={styles.clearButton}
            >
              Limpar Busca
            </Button>
          </>
        )}

        <Button mode="outlined" onPress={handleLogout} loading={loading} style={{ marginTop: 12 }}>
          Sair
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clearButton: {

    marginTop: 12,
    backgroundColor: colors.error,


  },
  safeArea: {
    flex: 1,
  },
  containerWelcome: {

    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  textInput: {
    marginTop: 20,
  }
  ,
  subcategoryItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  subcategoryName: {
    fontSize: 16,
  },
  subcategoryParent: {
    fontSize: 12,
    color: '#666',
  }
  ,
  listWrapper: {
    marginTop: 24,
    flex: 1,
    minHeight: 0, // Required on Android with flex children to prevent overflow
  },
  flatList: {
    flex: 1,
  },
  flatListContent: {
    paddingBottom: 24,
  }
});
