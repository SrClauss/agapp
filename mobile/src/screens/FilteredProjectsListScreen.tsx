import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Text, Card, Chip } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { getProfessionalSubcategoryProjects, Project } from '../api/projects';

export default function FilteredProjectsListScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProfessionalSubcategoryProjects({
        limit: 100,
        include_remote: true,
      });
      setProjects(data);
    } catch (error) {
      console.error('Erro ao carregar projetos:', error);
      Alert.alert('Erro', 'Falha ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const handleProjectPress = (projectId: string) => {
    (navigation as any).navigate('ProjectDetail', { projectId });
  };

  const formatBudget = (min?: number, max?: number): string => {
    if (!min && !max) return 'Orçamento não especificado';
    if (min && max) return `R$ ${min.toLocaleString()} - R$ ${max.toLocaleString()}`;
    if (min) return `A partir de R$ ${min.toLocaleString()}`;
    return `Até R$ ${max!.toLocaleString()}`;
  };

  const getCategoryDisplay = (category: any): string => {
    if (typeof category === 'string') return category;
    if (category && category.main) return category.main;
    return 'Não especificado';
  };

  const getSubcategoryDisplay = (category: any): string => {
    if (category && typeof category === 'object' && category.sub) {
      return category.sub;
    }
    return '';
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

  if (projects.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Nenhum projeto disponível
          </Text>
          <Text style={styles.emptySubtext}>
            Não há projetos que correspondam às suas subcategorias no momento.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Projetos para Você</Text>
          <Text style={styles.subtitle}>
            {projects.length} projeto(s) encontrado(s)
          </Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {projects.map((project, idx) => (
            <Card
              key={project.id || (project as any)._id || `project_${idx}`}
              style={styles.card}
              onPress={() => handleProjectPress(project.id || (project as any)._id)}
            >
              <Card.Content>
                <View style={styles.cardHeader}>
                  <Text style={styles.projectTitle} numberOfLines={2}>
                    {project.title}
                  </Text>
                  {project.remote_execution && (
                    <Chip
                      style={styles.remoteChip}
                      textStyle={styles.remoteChipText}
                    >
                      Remoto
                    </Chip>
                  )}
                </View>

                <Text style={styles.projectDescription} numberOfLines={3}>
                  {project.description}
                </Text>

                <View style={styles.categoryContainer}>
                  <Text style={styles.categoryText}>
                    {getCategoryDisplay(project.category)}
                  </Text>
                  {getSubcategoryDisplay(project.category) && (
                    <>
                      <Text style={styles.categorySeparator}> › </Text>
                      <Text style={styles.subcategoryText}>
                        {getSubcategoryDisplay(project.category)}
                      </Text>
                    </>
                  )}
                </View>

                <View style={styles.budgetRow}>
                  <Text style={styles.budgetLabel}>Orçamento:</Text>
                  <Text style={styles.budgetValue}>
                    {formatBudget(project.budget_min, project.budget_max)}
                  </Text>
                </View>

                {project.location && project.location.city && (
                  <Text style={styles.locationText}>
                    📍 {project.location.city}{project.location.state ? `, ${project.location.state}` : ''}
                  </Text>
                )}
              </Card.Content>
            </Card>
          ))}
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
  subtitle: {
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: 8,
  },
  remoteChip: {
    backgroundColor: colors.primary,
    height: 24,
  },
  remoteChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginVertical: 0,
  },
  projectDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  categorySeparator: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subcategoryText: {
    fontSize: 14,
    color: colors.text,
  },
  budgetRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  budgetValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
