import React, { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native-paper';
import type { ListRenderItemInfo } from 'react-native';
import { Button, TextInput, Divider } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import useLocationStore from '../stores/locationStore';
import LocationAvatar from '../components/LocationAvatar';
import { getSubcategoriesWithParent, SubcategoryWithParent, getSearchSuggestions, SearchSuggestion } from '../api/categories';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import LocationAvatar from '../components/LocationAvatar';
import { BannerAd } from '../components/BannerAd';
import CategoryGrid from '../components/CategoryGrid';
import MyProjectsCarousel from '../components/MyProjectsCarousel';
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
  const user = useAuthStore((s: AuthState) => s.user);
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
    // Navigate to project creation with category and subcategory info
    navigation.navigate('CreateProject' as never, {
      categoryName: item.parent.name,
      subcategoryName: item.name,
    } as never);
  }, [navigation]);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<SubcategoryWithParent>) => (
    <View style={styles.subcategoryItem}>
      <View style={styles.subcategoryInfo}>
        <Text style={styles.subcategoryName}>{item.name}</Text>
        <Text style={styles.subcategoryParent}>{item.parent.name}</Text>
      </View>
      <TouchableOpacity 
        style={styles.createProjectButton}
        onPress={() => handleItemPress(item)}
      >
        <Text style={styles.createProjectButtonText}>Criar Projeto</Text>
      </TouchableOpacity>
    </View>
  ), [handleItemPress]);

  const keyExtractor = useCallback((item: SubcategoryWithParent, index: number) => `${item.parent.id || item.parent.name}-${item.name}-${index}`, []);


  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.containerWelcome}>
        {/* Header - rebrand component */}
        <LocationAvatar value={searchQuery} onChangeText={handleSearchTextChange} onSubmit={handleSearch} loading={loadingSuggestions} />

        <View style={{ height: 16 }} />

        {/* Categorias em carrossel (reutiliza CategoryGrid) */}
        {/* Banner: usar componente BannerAd (ads) - moved above categories */}
        <View style={styles.bannerContainer}>
          <BannerAd adType="banner_client" minHeight={140} maxHeight={220} />
        </View>

        <View style={{ height: 12 }} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Categorias</Text>
        </View>
        <CategoryGrid />

        <View style={styles.sectionSpacer} />

        {/* Meus Projetos (usar componente existente) */}
        <Text style={styles.sectionHeading}>Meus Projetos</Text>
        <View style={styles.projectsCardWrapper}>
          <MyProjectsCarousel />
        </View>

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

        <Button
        onPress={handleSearch}
        mode="contained"
        style={{ marginTop: 20 }}
        icon={'magnify'}
        >
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
                scrollEnabled={false}
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

     
        {/* User's Projects Carousel */}
        <MyProjectsCarousel />

        <Button 
        mode="outlined" 
        onPress={handleLogout} 
        loading={loading} 
        style={{ marginTop: 12, marginBottom: 24 }}
        icon={'logout'}
        
        >
          Sair
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  clearButton: {
    marginTop: 12,
    backgroundColor: colors.error,
  },
  /* Header styles for new branding */
  header: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  locationLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '600' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  locationText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
  headerIcons: { flexDirection: 'row', gap: 8 },
  iconBtn: { marginLeft: 8, padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  greeting: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 12, marginBottom: 12 },
  searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 20, marginBottom: 8, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, color: '#fff' },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 0, marginTop: 6 },
  sectionHeading: { fontSize: 16, fontWeight: '700', color: colors.text, marginLeft: 8 },
  seeAllText: { color: colors.primaryDark, fontWeight: '700', marginRight: 8 },
  sectionSpacer: { height: 8 },
  bannerContainer: { paddingHorizontal: 16 },
  bannerInner: { backgroundColor: colors.primaryDark, borderRadius: 24, padding: 18, overflow: 'hidden' },
  bannerTag: { color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', fontSize: 11, fontWeight: '800' },
  bannerTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8 },
  bannerCta: { marginTop: 12, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start' },
  bannerCtaText: { color: colors.primaryDark, fontWeight: '800' },
  projectsCardWrapper: { marginTop: 8 },
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  containerWelcome: {
    flexGrow: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 24,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  subcategoryInfo: {
    flex: 1,
  },
  subcategoryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  subcategoryParent: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
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
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
    paddingLeft: 28,
  },
  divider: {
    marginVertical: 16,
  }
});
