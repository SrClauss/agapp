import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Avatar,
  ActivityIndicator,
  Chip,
  Badge,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, UserResponse, Project } from '../services/api';
import useNotificationStore from '../stores/notificationStore';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { useSnackbar } from '../hooks/useSnackbar';

type ClientDashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ClientDashboard'>;

interface ClientDashboardScreenProps {
  navigation: ClientDashboardScreenNavigationProp;
}

export default function ClientDashboardScreen({ navigation }: ClientDashboardScreenProps): React.JSX.Element {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const { totalUnread, initializeNotifications } = useNotificationStore((s) => ({
    totalUnread: s.totalUnread,
    initializeNotifications: s.initializeNotifications,
  }));
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    loadData();
    initializeNotifications();
  }, []);

  const loadData = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      // Load user data
      const userData = await apiService.getCurrentUser(token);
      setUser(userData);

      // Try to load projects, but don't fail if there are none
      try {
        const projectsData = await apiService.getMyProjects(token);
        setProjects(projectsData || []);
      } catch (projectError) {
        console.log('No projects found or error loading projects:', projectError);
        setProjects([]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      // Only logout if it's an authentication error
      const errorMessage = (error as Error).message || '';
      if (errorMessage.includes('credentials') || errorMessage.includes('unauthorized')) {
        await handleLogout();
      } else {
        showSnackbar('Erro ao carregar dados', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const handleLogout = async (): Promise<void> => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'active_role', 'user_roles']);
    navigation.replace('Login');
  };

  const handleSwitchRole = async (): Promise<void> => {
    const rolesStr = await AsyncStorage.getItem('user_roles');
    if (rolesStr) {
      const roles = JSON.parse(rolesStr);
      if (roles.length > 1) {
        navigation.navigate('RoleChoice');
      }
    }
  };


  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Avatar.Icon
                size={60}
                icon="account-circle"
                style={styles.avatar}
              />
              {totalUnread > 0 && (
                <Badge size={24} style={styles.notificationBadge}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </Badge>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Olá,</Text>
              <Text style={styles.userName}>{user?.full_name}</Text>
              <Chip icon="account" style={styles.roleChip}>Cliente</Chip>
            </View>
          </View>
          <View style={styles.headerButtons}>
            {user?.roles && user.roles.length > 1 && (
              <Button
                mode="text"
                onPress={handleSwitchRole}
                textColor={colors.primary}
                icon="swap-horizontal"
                compact
              >
                Trocar
              </Button>
            )}
            <Button
              mode="text"
              onPress={handleLogout}
              textColor={colors.primary}
              icon="logout"
              compact
            >
              Sair
            </Button>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statNumber}>{projects.length}</Text>
              <Text style={styles.statLabel}>Projetos</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statNumber}>{user?.credits || 0}</Text>
              <Text style={styles.statLabel}>Créditos</Text>
            </Card.Content>
          </Card>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statNumber}>{projects.filter(p => p.status === 'open').length}</Text>
              <Text style={styles.statLabel}>Abertos</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Projects Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Meus Projetos</Text>
          <Button
            mode="text"
            onPress={() => navigation.navigate('CreateProject')}
            textColor={colors.primary}
            icon="plus"
            compact
          >
            Novo
          </Button>
        </View>

        {projects.length === 0 ? (
          <EmptyState
            icon="folder-open"
            title="Nenhum projeto ainda"
            message="Crie seu primeiro projeto e conecte-se com profissionais qualificados!"
            action={{
              label: 'Criar Primeiro Projeto',
              onPress: () => navigation.navigate('CreateProject'),
            }}
          />
        ) : (
          projects.map((project) => (
            <Card
              key={project._id}
              style={styles.projectCard}
              onPress={() => navigation.navigate('ProjectDetails', { projectId: project._id })}
            >
              <Card.Content>
                <View style={styles.projectHeader}>
                  <Text style={styles.projectTitle}>{project.title}</Text>
                  <StatusBadge status={project.status} type="status" />
                </View>
                <Text style={styles.projectDescription} numberOfLines={2}>
                  {project.description}
                </Text>
                <View style={styles.projectMeta}>
                  <Chip icon="tag" style={styles.metaChip} compact>
                    {project.category.main}
                  </Chip>
                  <Chip icon="calendar" style={styles.metaChip} compact>
                    {formatDate(project.created_at)}
                  </Chip>
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.base,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: spacing.base,
  },
  header: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    ...shadows.base,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    backgroundColor: colors.primary,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  roleChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: colors.infoLight,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    ...shadows.base,
  },
  statNumber: {
    fontSize: typography.fontSize["4xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  projectCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    ...shadows.base,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  projectTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  projectDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  projectMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    backgroundColor: colors.backgroundDark,
  },
});
