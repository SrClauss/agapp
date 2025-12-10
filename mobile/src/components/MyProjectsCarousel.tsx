import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Image,
} from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getMyProjects, Project } from '../api/projects';
import { colors } from '../theme/colors';

export default function MyProjectsCarousel() {
  const navigation = useNavigation();
  const { width: windowWidth } = useWindowDimensions();
  const [openProjects, setOpenProjects] = useState<Project[]>([]);
  const [closedProjects, setClosedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosedProjects, setShowClosedProjects] = useState(false);

  const loadProjects = async () => {
    try {
      const [open, closed] = await Promise.all([
        getMyProjects('open'),
        getMyProjects('closed'),
      ]);
      setOpenProjects(open);
      setClosedProjects(closed);
    } catch (error) {
      console.warn('Erro ao carregar projetos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reload projects when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProjects();
    }, [])
  );

  const handleProjectPress = (project: Project) => {
    // Navega para a nova tela de resumo passando o objeto do projeto
    navigation.navigate('ProjectSummary' as never, { project } as never);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getCategoryDisplay = (category: Project['category']) => {
    if (typeof category === 'string') {
      return category;
    }
    return category.sub || category.main;
  };

  const cardWidth = Math.max(windowWidth - 32, 260); // 16px side padding on parent ScrollView

  const getProjectKey = (project: Project, index: number) => {
    return project.id ?? `${project.client_id ?? 'no-client'}-${index}-${project.created_at}`;
  };

  const renderProjectCard = (project: Project, index: number, isClosed: boolean = false) => (
    <TouchableOpacity
      key={getProjectKey(project, index)}
      style={[styles.projectCard, { width: cardWidth }]}
      onPress={() => handleProjectPress(project)}
      activeOpacity={0.7}
    >
      <View style={[styles.statusIndicator, { backgroundColor: isClosed ? colors.textSecondary : colors.success }]} />
      <View style={styles.cardContent}>
        <Text style={styles.projectTitle} numberOfLines={2}>
          {project.title}
        </Text>
        <Text style={styles.projectCategory} numberOfLines={1}>
          {getCategoryDisplay(project.category)}
        </Text>
        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <MaterialIcons name="event" size={14} color={colors.textSecondary} />
            <Text style={styles.dateText}>{formatDate(project.created_at)}</Text>
          </View>
          {project.liberado_por_profiles && project.liberado_por_profiles.length > 0 && (
            <View style={styles.contactsContainer}>
              <View style={styles.avatarStack}>
                {project.liberado_por_profiles.slice(0, 3).map((p: any, idx: number) => (
                  <View key={p.id || idx} style={[styles.avatarWrapper, { left: idx * -8 }]}> 
                    <Image source={{ uri: p.avatar_url }} style={styles.smallAvatar} />
                  </View>
                ))}
                {project.liberado_por_profiles.length > 3 && (
                  <View style={[styles.avatarMore, { left: 3 * -8 }]}> 
                    <Text style={styles.avatarMoreText}>+{project.liberado_por_profiles.length - 3}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Open Projects Section (always rendered so 'Ver todos' is visible) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <MaterialIcons name="assignment" size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>Meus Projetos Ativos</Text>
          </View>
          <Text style={styles.projectCount}>{openProjects.length}</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          snapToInterval={cardWidth + 12}
          snapToAlignment="start"
          decelerationRate="fast"
        >
          {openProjects.length === 0 ? (
            <View style={[styles.projectCard, { width: cardWidth, justifyContent: 'center', alignItems: 'center' }]}> 
              <Text style={{ color: colors.textSecondary }}>Nenhum projeto ativo</Text>
            </View>
          ) : (
            openProjects.map((project, index) => renderProjectCard(project, index, false))
          )}
          {/* Ver todos button */}
          <TouchableOpacity
            style={[styles.projectCard, { width: cardWidth, justifyContent: 'center', alignItems: 'center' }]}
            onPress={() => navigation.navigate('AllProjects' as never)}
          >
            <MaterialIcons name="format-list-bulleted" size={40} color={colors.primary} />
            <Text style={[styles.projectTitle, { marginTop: 8, textAlign: 'center' }]}>Ver todos</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Closed Projects Toggle */}
      {closedProjects.length > 0 && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.closedHeader}
            onPress={() => setShowClosedProjects(!showClosedProjects)}
          >
            <View style={styles.sectionTitleContainer}>
              <MaterialIcons
                name={showClosedProjects ? 'folder-open' : 'folder'}
                size={20}
                color={colors.textSecondary}
              />
              <Text style={styles.closedTitle}>Projetos Fechados</Text>
            </View>
            <View style={styles.closedRight}>
              <Text style={styles.closedCount}>{closedProjects.length}</Text>
              <MaterialIcons
                name={showClosedProjects ? 'expand-less' : 'expand-more'}
                size={24}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>

          {showClosedProjects && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              snapToInterval={cardWidth + 12}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              {closedProjects.map((project, index) => renderProjectCard(project, index, true))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    marginHorizontal: -16,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingRight: 4,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 8,
  },
  projectCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  // Removed header 'Ver todos' button to keep carousel clean (card keeps 'Ver todos')
  scrollContent: {
    paddingHorizontal: 16,
  },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    width: 260,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
    minHeight: 60,
  },
  cardContent: {
    flex: 1,
  },
  projectTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  projectCategory: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  contactsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  contactsText: {
    fontSize: 11,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '600',
  },
  avatarStack: {
    width: 64,
    height: 26,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    zIndex: 2,
  },
  smallAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  avatarMore: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: `${colors.primary}30`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 1,
  },
  avatarMoreText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  closedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 8,
  },
  closedTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  closedRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closedCount: {
    fontSize: 13,
    color: colors.textSecondary,
    marginRight: 4,
  },
});
