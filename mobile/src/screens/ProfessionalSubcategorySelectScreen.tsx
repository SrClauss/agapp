import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Text, Checkbox, Button, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getCategories } from '../api/categories';
import { getProfessionalSettings, updateProfessionalSettings } from '../api/users';
import { useAuthStore } from '../stores/authStore';

export default function ProfessionalSubcategorySelectScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { token } = useAuthStore();
  const { category, selected: initialSelected, onSelect } = (route as any).params;

  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState<string[]>(initialSelected || []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategorySubcategories();
  }, []);

  const loadCategorySubcategories = async () => {
    try {
      setLoading(true);
      // category contains subcategories already
      const subs = category.subcategories || [];
      setSubcategories(subs);
    } catch (err) {
      console.warn('Erro ao carregar subcategorias da categoria', err);
      Alert.alert('Erro', 'Falha ao carregar subcategorias');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubcategory = (name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name]));
  };

  const handleConfirm = () => {
    // Update professional settings on server: merge selection per category with other saved subcategories
    (async () => {
      try {
        if (!token) {
          Alert.alert('Autenticação', 'Você precisa estar autenticado para salvar.');
          return;
        }
        // Load current settings
        const settings = await getProfessionalSettings(token);
        const existing = settings.subcategories || [];
        // Remove subcategories from this category from existing, and add selected ones
        const otherSubs = existing.filter((s: string) => ! (category.subcategories || []).find((x: any) => x.name === s));
        const newSubs = [...otherSubs, ...selected];
        await updateProfessionalSettings(token, { subcategories: newSubs });
      } catch (err) {
        console.warn('Erro ao atualizar subcategorias:', err);
        Alert.alert('Erro', 'Falha ao salvar seleção');
        return;
      }
    })();
    navigation.goBack();
  };

  const filtered = subcategories.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <Text style={styles.title}>Subcategorias — {category.name}</Text>
        <Searchbar placeholder="Buscar..." value={searchQuery} onChangeText={setSearchQuery} style={styles.searchBar} />
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {filtered.map((sub) => (
            <TouchableOpacity key={sub.name} style={styles.subItem} onPress={() => toggleSubcategory(sub.name)}>
              <Checkbox status={selected.includes(sub.name) ? 'checked' : 'unchecked'} onPress={() => toggleSubcategory(sub.name)} />
              <Text style={styles.subText}>{sub.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Button mode="contained" onPress={handleConfirm} style={styles.saveBtn}>Confirmar</Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: 16 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  searchBar: { marginBottom: 12 },
  subItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  subText: { marginLeft: 8, fontSize: 16 },
  saveBtn: { marginBottom: 16 }
});
