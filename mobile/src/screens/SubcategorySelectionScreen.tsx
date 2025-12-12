import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, Checkbox, Button, Searchbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getSubcategoriesWithParent, SubcategoryWithParent } from '../api/categories';
import {
  getProfessionalSettings,
  updateProfessionalSettings,
  ProfessionalSettings,
} from '../api/users';
import { useAuthStore } from '../stores/authStore';

export default function SubcategorySelectionScreen() {
  const navigation = useNavigation();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allSubcategories, setAllSubcategories] = useState<SubcategoryWithParent[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subcategories, settings] = await Promise.all([
        getSubcategoriesWithParent(),
        getProfessionalSettings(token!),
      ]);
      
      setAllSubcategories(subcategories);
      setSelectedSubcategories(settings.subcategories || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert('Erro', 'Falha ao carregar subcategorias');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubcategory = (subcategoryName: string) => {
    setSelectedSubcategories((prev) => {
      if (prev.includes(subcategoryName)) {
        return prev.filter((s) => s !== subcategoryName);
      } else {
        return [...prev, subcategoryName];
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateProfessionalSettings(token!, {
        subcategories: selectedSubcategories,
      });
      Alert.alert('Sucesso', 'Subcategorias salvas com sucesso!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      Alert.alert('Erro', 'Falha ao salvar subcategorias');
    } finally {
      setSaving(false);
    }
  };

  const filteredSubcategories = allSubcategories.filter((sub) =>
    sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.parent.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by parent category
  const groupedSubcategories = filteredSubcategories.reduce((acc, sub) => {
    const parentName = sub.parent.name;
    if (!acc[parentName]) {
      acc[parentName] = [];
    }
    acc[parentName].push(sub);
    return acc;
  }, {} as Record<string, SubcategoryWithParent[]>);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando subcategorias...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.title}>Minhas Subcategorias</Text>
        <Text style={styles.subtitle}>
          Selecione as subcategorias em que você trabalha
        </Text>

        <Searchbar
          placeholder="Buscar subcategorias..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {Object.entries(groupedSubcategories).map(([parentName, subs]) => (
            <View key={parentName} style={styles.categoryGroup}>
              <Text style={styles.categoryTitle}>{parentName}</Text>
              {subs.map((sub) => (
                <TouchableOpacity
                  key={sub.name}
                  style={styles.subcategoryItem}
                  onPress={() => toggleSubcategory(sub.name)}
                >
                  <Checkbox
                    status={selectedSubcategories.includes(sub.name) ? 'checked' : 'unchecked'}
                    onPress={() => toggleSubcategory(sub.name)}
                  />
                  <Text style={styles.subcategoryText}>{sub.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Text style={styles.selectedCount}>
            {selectedSubcategories.length} subcategoria(s) selecionada(s)
          </Text>
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
          >
            Salvar
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  categoryGroup: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 8,
  },
  subcategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  subcategoryText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 8,
  },
  footer: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  selectedCount: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 12,
  },
  saveButton: {
    marginHorizontal: 0,
  },
});
