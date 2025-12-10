import React from 'react';
import { StyleSheet, View, Text, Image } from 'react-native';
import { Card, Chip } from 'react-native-paper';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { Project } from '../api/projects';
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
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const getCategoryDisplay = (category: Project['category']) => {
    if (typeof category === 'string') return category;
    return category.sub || category.main;
  };

  const getProjectKey = (project: Project, index: number) => {
    return project.id ?? `${project.client_id ?? 'no-client'}-${index}-${project.created_at}`;
  };

  const handlePress = () => {
    navigation.navigate('ProjectSummary' as never, { project } as never);
  };

  const compactStyles = compact ? {
    projectCard: styles.projectCardCompact,
    projectTitle: styles.projectTitleCompact,
    categoryChip: styles.categoryChipCompact,
    chipText: styles.chipTextCompact,
    dateText: styles.dateTextCompact,
    smallAvatar: styles.smallAvatarCompact,
    avatarMore: styles.avatarMoreCompact,
    avatarMoreText: styles.avatarMoreTextCompact,
  } : {} as any;

  return (
    <Card
      key={getProjectKey(project, index)}
      style={[styles.projectCard, compactStyles.projectCard, cardWidth ? { width: cardWidth } : undefined]}
      mode="elevated"
      onPress={handlePress}
    >
      <Card.Content style={styles.cardContentRow}>
        {showStatus && (
          <View style={[styles.statusIndicator, { backgroundColor: project.status === 'open' ? colors.success : colors.textSecondary }]} />
        )}
        <View style={styles.cardContent}>
          <Text style={[styles.projectTitle, compactStyles.projectTitle]} numberOfLines={2}>{project.title}</Text>
          <View style={styles.metaRow}>
            <Chip compact mode="outlined" style={[styles.categoryChip, compactStyles.categoryChip]} textStyle={[styles.chipText, compactStyles.chipText]}>
              {getCategoryDisplay(project.category)}
            </Chip>
            <View style={styles.dateContainer}>
              <MaterialIcons name="event" size={12} color={colors.textSecondary} />
              <Text style={[styles.dateText, compactStyles.dateText]}>{formatDate(project.created_at)}</Text>
            </View>
          </View>
          {project.liberado_por_profiles && project.liberado_por_profiles.length > 0 && (
            <View style={styles.contactsContainer}>
              <View style={styles.avatarStack}>
                {project.liberado_por_profiles.slice(0, 3).map((p: any, idx: number) => (
                  <View key={p.id || idx} style={[styles.avatarWrapper, { left: idx * -8 }]}>
                    <Image source={{ uri: p.avatar_url }} style={[styles.smallAvatar, compactStyles.smallAvatar]} />
                  </View>
                ))}
                {project.liberado_por_profiles.length > 3 && (
                  <View style={[styles.avatarMore, { left: 3 * -8 }, compactStyles.avatarMore]}>
                    <Text style={[styles.avatarMoreText, compactStyles.avatarMoreText]}>+{project.liberado_por_profiles.length - 3}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryChip: {
    height: 26,
  },
  chipText: {
    fontSize: 12,
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
  projectCardCompact: {
    padding: 8,
    borderRadius: 10,
  },
  projectTitleCompact: {
    fontSize: 13,
  },
  categoryChipCompact: {
    height: 22,
  },
  chipTextCompact: {
    fontSize: 11,
  },
  dateTextCompact: {
    fontSize: 10,
  },
  smallAvatarCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarMoreCompact: {
    width: 20,
    height: 20,
  },
  avatarMoreTextCompact: {
    fontSize: 10,
  },
});
