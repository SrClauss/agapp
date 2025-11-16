import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Avatar,
  ActivityIndicator,
  Chip,
  SegmentedButtons,
  Banner,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, UserResponse, Project } from '../services/api';
import * as Location from 'expo-location';
import useNotificationStore from '../stores/notificationStore';
import { Badge } from 'react-native-paper';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import AppHeader from '../components/AppHeader';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';
import { useSnackbar } from '../hooks/useSnackbar';

type ProfessionalDashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProfessionalDashboard'>;

interface ProfessionalDashboardScreenProps {
  navigation: ProfessionalDashboardScreenNavigationProp;
}

export default function ProfessionalDashboardScreen({ navigation }: ProfessionalDashboardScreenProps): React.JSX.Element {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<string>('10');
  const { totalUnread, initializeNotifications } = useNotificationStore((s) => ({
    totalUnread: s.totalUnread,
    initializeNotifications: s.initializeNotifications,
  }));
  const { showSnackbar } = useSnackbar();

  useEffect(() => {
    loadData();
    initializeNotifications();
  }, []);

  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        setLocationError('Permissão de localização negada. Permita o acesso para ver projetos próximos.');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationError('Erro ao solicitar permissão de localização');
      return false;
    }
  };

  const getCurrentLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setCurrentLocation(coords);
      setLocationError(null);

      // Save location for notification filtering
      await AsyncStorage.setItem('user_location', JSON.stringify(coords));

      return coords;
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Erro ao obter localização. Verifique se o GPS está ativado.');
      return null;
    }
  };

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

      // Get current location and load nearby projects
      const location = await getCurrentLocation();
      if (location) {
        try {
          const nearbyProjects = await apiService.getNearbyProjects(
            token,
            location.latitude,
            location.longitude,
            parseInt(radiusKm)
          );
          setProjects(nearbyProjects || []);
        } catch (projectError) {
          console.log('No projects found nearby or error loading projects:', projectError);
          setProjects([]);
        }
      } else {
        // If location fails, still try to load all projects
        setProjects([]);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
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
  }, [radiusKm]);

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

  const handleChangeRadius = (newRadius: string): void => {
    setRadiusKm(newRadius);
    // Reload projects with new radius
    if (currentLocation) {
      loadProjectsWithRadius(parseInt(newRadius));
    }
  };

  const loadProjectsWithRadius = async (radius: number): Promise<void> => {
    if (!currentLocation) return;

    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const nearbyProjects = await apiService.getNearbyProjects(
        token,
        currentLocation.latitude,
        currentLocation.longitude,
        radius
      );
      setProjects(nearbyProjects || []);
    } catch (error) {
      console.error('Error loading projects with new radius:', error);
      showSnackbar('Erro ao carregar projetos', 'error');
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return colors.success;
      case 'in_progress': return colors.secondary;
      case 'completed': return colors.info;
      case 'cancelled': return colors.error;
      default: return colors.textDisabled;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDistance = (projectLocation: { coordinates: [number, number] }): string => {
    if (!currentLocation || !projectLocation.coordinates) return '';

    const lat1 = currentLocation.latitude;
    const lon1 = currentLocation.longitude;
    const lat2 = projectLocation.coordinates[1];
    const lon2 = projectLocation.coordinates[0];

    // Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const formatBudget = (min?: number, max?: number): string => {
    if (!min && !max) return 'A combinar';
    if (min && max) return `R$ ${min.toFixed(0)} - R$ ${max.toFixed(0)}`;
    if (min) return `A partir de R$ ${min.toFixed(0)}`;
    if (max) return `Até R$ ${max.toFixed(0)}`;
    return 'A combinar';
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
                icon="account-hard-hat"
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
              <Chip icon="briefcase" style={styles.roleChip}>Profissional</Chip>
              <Chip icon="wallet" style={styles.creditsChip}>{user?.credits || 0} créditos</Chip>
            </View>
          </View>
          <View style={styles.headerButtons}>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('BuyCredits')}
              textColor={colors.white}
              icon="credit-card-plus"
              compact
              style={styles.buyCreditsButton}
            >
              Comprar
            </Button>
            <Button
              mode="text"
              onPress={() => navigation.navigate('ProfileSettings')}
              textColor={colors.primary}
              icon="cog"
              compact
            >
              Config
            </Button>
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

        {/* Location Status */}
        {locationError && (
          <Banner
            visible={!!locationError}
            actions={[
              {
                label: 'Tentar Novamente',
                onPress: loadData,
              },
            ]}
            icon="map-marker-off"
            style={styles.errorBanner}
          >
            {locationError}
          </Banner>
        )}

        {/* Radius Selection */}
        {currentLocation && (
          <Card style={styles.radiusCard}>
            <Card.Content>
              <Text style={styles.radiusTitle}>Raio de busca:</Text>
              <SegmentedButtons
                value={radiusKm}
                onValueChange={handleChangeRadius}
                buttons={[
                  { value: '5', label: '5km' },
                  { value: '10', label: '10km' },
                  { value: '25', label: '25km' },
                  { value: '50', label: '50km' },
                ]}
                style={styles.segmentedButtons}
              />
            </Card.Content>
          </Card>
        )}

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Card.Content>
              <Text style={styles.statNumber}>{projects.length}</Text>
              <Text style={styles.statLabel}>Projetos Próximos</Text>
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
              <Text style={styles.statNumber}>
                {projects.filter(p => p.status === 'open').length}
              </Text>
              <Text style={styles.statLabel}>Disponíveis</Text>
            </Card.Content>
          </Card>
        </View>

        {/* Projects Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Projetos Próximos</Text>
          {currentLocation && (
            <Chip icon="map-marker" compact style={styles.locationChip}>
              {radiusKm}km
            </Chip>
          )}
        </View>

        {projects.length === 0 ? (
          <EmptyState
            icon={locationError ? "map-marker-off" : "map-search"}
            title={locationError ? 'Ative sua localização' : 'Nenhum projeto próximo'}
            message={
              locationError
                ? 'Para ver projetos na sua região, permita o acesso à localização.'
                : `Não há projetos disponíveis num raio de ${radiusKm}km. Tente aumentar o raio de busca.`
            }
            action={locationError ? {
              label: 'Ativar Localização',
              onPress: loadData,
            } : undefined}
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
                  <View style={styles.projectTitleRow}>
                    <Text style={styles.projectTitle}>{project.title}</Text>
                    <StatusBadge status={project.status} type="status" />
                  </View>
                </View>

                <Text style={styles.projectDescription} numberOfLines={3}>
                  {project.description}
                </Text>

                {/* Client Info */}
                {project.client_name && (
                  <View style={styles.clientInfo}>
                    <Avatar.Icon size={24} icon="account" style={styles.clientAvatar} />
                    <Text style={styles.clientName}>{project.client_name}</Text>
                  </View>
                )}

                {/* Budget */}
                <View style={styles.budgetRow}>
                  <Avatar.Icon size={24} icon="currency-usd" style={styles.budgetIcon} />
                  <Text style={styles.budgetText}>{formatBudget(project.budget_min, project.budget_max)}</Text>
                </View>

                {/* Project Meta */}
                <View style={styles.projectMeta}>
                  <Chip icon="tag" style={styles.metaChip} compact>
                    {project.category.main}
                  </Chip>
                  {project.category.sub && (
                    <Chip icon="tag-outline" style={styles.metaChip} compact>
                      {project.category.sub}
                    </Chip>
                  )}
                  {project.remote_execution && (
                    <Chip icon="laptop" style={styles.metaChip} compact>
                      Remoto
                    </Chip>
                  )}
                </View>

                {/* Location Info */}
                <View style={styles.locationRow}>
                  <Avatar.Icon size={20} icon="map-marker" style={styles.locationIcon} />
                  <Text style={styles.locationText} numberOfLines={1}>
                    {project.location.address}
                  </Text>
                  {currentLocation && (
                    <Chip style={styles.distanceChip} compact textStyle={styles.distanceText}>
                      {formatDistance(project.location)}
                    </Chip>
                  )}
                </View>

                {/* Date */}
                <View style={styles.dateRow}>
                  <Avatar.Icon size={20} icon="calendar" style={styles.dateIcon} />
                  <Text style={styles.dateText}>
                    Publicado em {formatDate(project.created_at)}
                  </Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
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
    backgroundColor: colors.warningLight,
  },
  creditsChip: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    backgroundColor: colors.infoLight,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  buyCreditsButton: {
    backgroundColor: colors.success,
  },
  errorBanner: {
    marginBottom: spacing.base,
  },
  segmentedButtons: {
    marginTop: spacing.sm,
  },
  radiusCard: {
    backgroundColor: colors.white,
    marginBottom: spacing.base,
    ...shadows.base,
  },
  radiusTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
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
  locationChip: {
    backgroundColor: colors.infoLight,
  },
  projectCard: {
    marginBottom: spacing.base,
    backgroundColor: colors.white,
    ...shadows.base,
  },
  projectHeader: {
    marginBottom: spacing.sm,
  },
  projectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectTitle: {
    fontSize: typography.fontSize.lg,
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
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clientAvatar: {
    backgroundColor: colors.infoLight,
    marginRight: 8,
  },
  clientName: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  budgetIcon: {
    backgroundColor: colors.successLight,
    marginRight: 8,
  },
  budgetText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  projectMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  metaChip: {
    backgroundColor: colors.backgroundDark,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  locationIcon: {
    backgroundColor: 'transparent',
    marginRight: 4,
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  distanceChip: {
    backgroundColor: colors.infoLight,
    height: 24,
  },
  distanceText: {
    fontSize: 11,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateIcon: {
    backgroundColor: 'transparent',
    marginRight: 4,
  },
  dateText: {
    fontSize: typography.fontSize.sm,
    color: colors.textDisabled,
  },
});
