import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { Card } from 'react-native-paper';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../stores/authStore';
import { Project } from '../api/projects';
import { MAX_PROJECT_TITLE_LENGTH } from '../constants';
import { colors } from '../theme/colors';

interface ProjectCardProps {
  project: Project;
  index?: number;
  showStatus?: boolean;
  cardWidth?: number;
  compact?: boolean;
}

export default function ProjectCard({ project, index = 0, showStatus = false, cardWidth, compact = false }: ProjectCardProps) {
  const navigation = useNavigation();

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getCategoryDisplay = (category: Project['category']) => {
    if (!category) return 'Sem categoria';
    if (typeof category === 'string') return category;
    return category.sub || category.main;
  };

  const user = useAuthStore((s) => s.user);

  const handlePress = () => {
    // Owner clients should see full info
    const isOwner = Boolean(user && (String(user.id) === String(project.client_id)));
    // Navigate to ProjectDetail by id and pass showFullInfo when owner
    navigation.navigate('ProjectDetail' as never, { projectId: project.id || (project as any)._id, showFullInfo: isOwner } as never);
  };

  const titleToShow = project.title
    ? project.title.length > MAX_PROJECT_TITLE_LENGTH
      ? project.title.slice(0, MAX_PROJECT_TITLE_LENGTH).trim() + '...'
      : project.title
    : (project.description ? project.description.slice(0, MAX_PROJECT_TITLE_LENGTH) : 'Projeto sem título');
  const shortDescription = project.description ? project.description.slice(0, 100) + (project.description.length > 100 ? '...' : '') : '';

  const getInitials = (name: string) => {
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
  };

  const isOpen = project.status === 'open';

  return (
    <Card
      mode="elevated"
      elevation={compact ? 1 : 2}
      onPress={handlePress}
      style={[
        styles.card,
        compact && styles.cardCompact,
        cardWidth ? { width: cardWidth } : undefined,
      ]}
    >
      {/* Header com status e data */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: isOpen ? colors.success : colors.textSecondary }]} />
          <Text style={[styles.statusText, { color: isOpen ? colors.success : colors.textSecondary }]}>
            {isOpen ? 'Aberto' : 'Fechado'}
          </Text>
        </View>
        <View style={styles.dateContainer}>
          <MaterialIcons name="schedule" size={14} color={colors.textSecondary} />
          <Text style={styles.dateText}>{formatDate(project.created_at)}</Text>
        </View>
      </View>

      {/* Conteúdo principal */}
      <View style={styles.cardContent}>
        <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={2}>
          {titleToShow}
        </Text>

        {!compact && shortDescription ? (
          <Text style={styles.description} numberOfLines={2}>
            {shortDescription}
          </Text>
        ) : null}

        {/* Categoria como tag */}
        <View style={styles.categoryTag}>
          <MaterialIcons name="label" size={14} color={colors.primary} />
          <Text style={styles.categoryText}>{getCategoryDisplay(project.category)}</Text>
        </View>
      </View>

      {/* Footer com liberadores e seta */}
      <View style={styles.cardFooter}>
        <View style={styles.liberadoresSection}>
          <MaterialIcons name="people-outline" size={18} color={colors.textSecondary} />
          {project.liberado_por_profiles && project.liberado_por_profiles.length > 0 ? (
            <View style={styles.avatarsRow}>
              {project.liberado_por_profiles.slice(0, 3).map((p: any, idx: number) => (
                <View key={p.id || idx} style={[styles.avatarContainer, { marginLeft: idx === 0 ? 8 : -8, zIndex: 10 - idx }]}>
                  {p.avatar_url ? (
                    <Image source={{ uri: p.avatar_url }} style={[styles.avatar, compact && styles.avatarCompact]} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, compact && styles.avatarPlaceholderCompact]}>
                      <Text style={styles.avatarInitials}>{getInitials(p.full_name || p.fullName || '')}</Text>
                    </View>
                  )}
                </View>
              ))}
              {project.liberado_por_profiles.length > 3 && (
                <View style={[styles.avatarContainer, { marginLeft: -8, zIndex: 1 }]}>
                  <View style={[styles.avatarMore, compact && styles.avatarMoreCompact]}>
                    <Text style={styles.avatarMoreText}>+{project.liberado_por_profiles.length - 3}</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.noLiberadores}>Nenhum profissional</Text>
          )}
        </View>

        <View style={styles.arrowButton}>
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardCompact: {
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  titleCompact: {
    fontSize: 15,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: `${colors.primary}12`,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  liberadoresSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    borderRadius: 16,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarPlaceholderCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarInitials: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  avatarMore: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: `${colors.primary}30`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarMoreCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarMoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  noLiberadores: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});