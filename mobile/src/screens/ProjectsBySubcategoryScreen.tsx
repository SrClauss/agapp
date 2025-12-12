import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text, Card } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getProfessionalProjectCounts, CategoryProjectCounts } from '../api/users';
import { useAuthStore } from '../stores/authStore';

export default function ProjectsBySubcategoryScreen() {
  const navigation = useNavigation();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<CategoryProjectCounts[]>([]);

  useEffect(() => {
    loadProjectCounts();
  }, []);

  const loadProjectCounts = async () => {
    try {
      setLoading(true);
      const counts = await getProfessionalProjectCounts(token!);
      setCategoryCounts(counts);
    } catch (error) {
      console.error('Erro ao carregar contagens:', error);
      Alert.alert('Erro', 'Falha ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryPress = () => {
    // Navigate to filtered projects list
    (navigation as any).navigate('FilteredProjectsList');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando projetos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (categoryCounts.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhuma subcategoria cadastrada.
          </Text>
          <Text style={styles.emptySubtext}>
            Configure suas subcategorias para ver projetos disponíveis.
          </Text>
          <TouchableOpacity
            style={styles.configButton}
            onPress={() => (navigation as any).navigate('SubcategorySelection')}
          >
            <Text style={styles.configButtonText}>Configurar Subcategorias</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const totalProjects = categoryCounts.reduce((sum, cat) => sum + cat.total_count, 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Projetos Disponíveis</Text>
          <Text style={styles.totalText}>
            {totalProjects} projeto(s) disponível(is)
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {categoryCounts.map((categoryCount) => (
            <Card key={categoryCount.category} style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text style={styles.categoryName}>{categoryCount.category}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{categoryCount.total_count}</Text>
                  </View>
                </View>

                <View style={styles.subcategoriesContainer}>
                  {categoryCount.subcategory_counts.map((subCount) => (
                    <View key={subCount.subcategory} style={styles.subcategoryRow}>
                      <Text style={styles.subcategoryName}>{subCount.subcategory}</Text>
                      <Text style={styles.subcategoryCount}>{subCount.count}</Text>
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          ))}

          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={handleCategoryPress}
          >
            <Text style={styles.viewAllButtonText}>Ver Todos os Projetos</Text>
          </TouchableOpacity>
        </ScrollView>
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  configButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  configButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  totalText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  subcategoriesContainer: {
    marginTop: 8,
  },
  subcategoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subcategoryName: {
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  subcategoryCount: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  viewAllButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 24,
  },
  viewAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
