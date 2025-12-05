import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native-paper';
import type { ListRenderItemInfo } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { getSubcategoriesWithParent, SubcategoryWithParent, getSearchSuggestions, SearchSuggestion } from '../api/categories';
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

  // States para sugestões em tempo real
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Função para buscar sugestões com debounce
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setLoadingSuggestions(true);
      const results = await getSearchSuggestions(query, 10);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (err) {
      console.warn('Erro ao buscar sugestões', err);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Handler para mudança de texto com debounce
  const handleSearchTextChange = useCallback((text: string) => {
    setSearchQuery(text);

    // Limpar timer anterior
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Se o texto estiver vazio, limpar sugestões imediatamente
    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Criar novo timer para buscar sugestões após 300ms
    debounceTimer.current = setTimeout(() => {
      fetchSuggestions(text);
    }, 300);
  }, [fetchSuggestions]);

  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase();
    if (q === '') {
      // Keep the list hidden until user searches explicitly
      setFilteredSubcategories(null);
      setShowSuggestions(false);
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
    setShowSuggestions(false); // Esconder sugestões ao fazer busca completa
  };

  const handlerClearSearch = () => {
    setSearchQuery('');
    setFilteredSubcategories(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Handler para selecionar uma sugestão
  const handleSelectSuggestion = useCallback((suggestion: SearchSuggestion) => {
    setSearchQuery(suggestion.name);
    setShowSuggestions(false);
    // Fazer busca imediatamente com o termo selecionado
    const results = subcategories.filter(s => {
      const q = suggestion.name.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.parent.name.toLowerCase().includes(q) ||
        (s.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    });
    setFilteredSubcategories(results);
  }, [subcategories]);


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
          onChangeText={handleSearchTextChange}
          onSubmitEditing={handleSearch}
          left={<TextInput.Icon icon="magnify" />}
          right={loadingSuggestions ? <TextInput.Icon icon="loading" /> : undefined}
        />

        {/* Lista suspensa de sugestões */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={suggestions}
              keyExtractor={(item, index) => `${item.type}-${item.id}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    {item.parent_category && (
                      <Text style={styles.suggestionParent}>
                        {item.parent_category}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.suggestionType}>
                    {item.type === 'category' ? 'Categoria' : 'Subcategoria'}
                  </Text>
                </TouchableOpacity>
              )}
              scrollEnabled={false}
              style={styles.suggestionsList}
            />
          </View>
        )}

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
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    maxHeight: 300,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionsList: {
    flexGrow: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  suggestionParent: {
    fontSize: 13,
    color: '#666',
  },
  suggestionType: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 8,
  },
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
  },
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
