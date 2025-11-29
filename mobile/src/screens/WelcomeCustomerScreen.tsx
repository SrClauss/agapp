import React, { useEffect, useState } from 'react';
import { StyleSheet, View, FlatList, Text, TouchableOpacity } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { getSubcategoriesWithParent, SubcategoryWithParent } from '../api/categories';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import LocationAvatar from '../components/LocationAvatar';

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
  const [filteredSubcategories, setFilteredSubcategories] = useState<SubcategoryWithParent[]>([]);
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
      setFilteredSubcategories(subcategories);
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

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoadingSubcategories(true);
      try {
        const subs = await getSubcategoriesWithParent();
        if (!mounted) return;
        setSubcategories(subs);
        setFilteredSubcategories(subs);
      } catch (err) {
        console.warn('Erro buscando subcategorias', err);
      } finally {
        setLoadingSubcategories(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);


  return (
    <View style={styles.containerWelcome}>
      <LocationAvatar />

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
      
      <Button mode="outlined" onPress={handleLogout} loading={loading} style={{ marginTop: 12 }}>
        Sair
      </Button>
      
      {filteredSubcategories.length > 0 && (
        <View style={{ marginTop: 24 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Subcategorias</Text>
          <FlatList
            data={filteredSubcategories}
            keyExtractor={(item) => `${item.parent.id}-${item.name}`}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.subcategoryItem} onPress={() => { /* TODO: navegar para tela de resultados */ }}>
                <Text style={styles.subcategoryName}>{item.name}</Text>
                <Text style={styles.subcategoryParent}>{item.parent.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  containerWelcome: {

    paddingTop: 40,
    paddingHorizontal: 20,
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
});
