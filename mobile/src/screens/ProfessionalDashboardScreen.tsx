import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Avatar,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, UserResponse, Project } from '../services/api';
import * as Location from 'expo-location';
import { useNotifications } from '../contexts/NotificationContext';
import { Badge } from 'react-native-paper';

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
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const { totalUnread, initializeNotifications } = useNotifications();

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
            radiusKm
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

  const handleChangeRadius = (newRadius: number): void => {
    setRadiusKm(newRadius);
    // Reload projects with new radius
    if (currentLocation) {
      loadProjectsWithRadius(newRadius);
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
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return '#4caf50';
      case 'in_progress': return '#ff9800';
      case 'completed': return '#2196f3';
      case 'cancelled': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      default: return status;
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
          <ActivityIndicator size="large" color="#3471b9" />
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
            </View>
          </View>
          <View style={styles.headerButtons}>
            <Button
              mode="text"
              onPress={() => navigation.navigate('ProfileSettings')}
              textColor="#3471b9"
              icon="cog"
              compact
            >
              Config
            </Button>
            {user?.roles && user.roles.length > 1 && (
              <Button
                mode="text"
                onPress={handleSwitchRole}
                textColor="#3471b9"
                icon="swap-horizontal"
                compact
              >
                Trocar
              </Button>
            )}
            <Button
              mode="text"
              onPress={handleLogout}
              textColor="#3471b9"
              icon="logout"
              compact
            >
              Sair
            </Button>
          </View>
        </View>

        {/* Location Status */}
        {locationError && (
          <Card style={styles.errorCard}>
            <Card.Content>
              <View style={styles.errorContent}>
                <Avatar.Icon size={40} icon="map-marker-off" color="#f44336" style={styles.errorIcon} />
                <Text style={styles.errorText}>{locationError}</Text>
                <Button
                  mode="contained"
                  onPress={loadData}
                  style={styles.retryButton}
                  compact
                >
                  Tentar Novamente
                </Button>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Radius Selection */}
        {currentLocation && (
          <Card style={styles.radiusCard}>
            <Card.Content>
              <Text style={styles.radiusTitle}>Raio de busca:</Text>
              <View style={styles.radiusButtons}>
                {[5, 10, 25, 50].map((radius) => (
                  <Chip
                    key={radius}
                    selected={radiusKm === radius}
                    onPress={() => handleChangeRadius(radius)}
                    style={[
                      styles.radiusChip,
                      radiusKm === radius && styles.radiusChipSelected,
                    ]}
                  >
                    {radius}km
                  </Chip>
                ))}
              </View>
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
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Avatar.Icon
                size={80}
                icon="map-search"
                style={styles.emptyIcon}
                color="#999"
              />
              <Text style={styles.emptyTitle}>
                {locationError ? 'Ative sua localização' : 'Nenhum projeto próximo'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {locationError
                  ? 'Para ver projetos na sua região, permita o acesso à localização.'
                  : `Não há projetos disponíveis num raio de ${radiusKm}km. Tente aumentar o raio de busca.`}
              </Text>
              {locationError && (
                <Button
                  mode="contained"
                  onPress={loadData}
                  style={styles.createButton}
                >
                  Ativar Localização
                </Button>
              )}
            </Card.Content>
          </Card>
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
                    <Chip
                      style={[styles.statusChip, { backgroundColor: getStatusColor(project.status) + '20' }]}
                      textStyle={{ color: getStatusColor(project.status) }}
                      compact
                    >
                      {getStatusLabel(project.status)}
                    </Chip>
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
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    backgroundColor: '#3471b9',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#f44336',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  roleChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: '#fff3e0',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  errorCard: {
    backgroundColor: '#ffebee',
    marginBottom: 16,
    elevation: 2,
  },
  errorContent: {
    alignItems: 'center',
  },
  errorIcon: {
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#d32f2f',
  },
  radiusCard: {
    backgroundColor: '#fff',
    marginBottom: 16,
    elevation: 2,
  },
  radiusTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  radiusButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  radiusChip: {
    backgroundColor: '#f5f5f5',
  },
  radiusChipSelected: {
    backgroundColor: '#3471b9',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3471b9',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  locationChip: {
    backgroundColor: '#e3f2fd',
  },
  emptyCard: {
    backgroundColor: '#fff',
    elevation: 2,
    padding: 24,
  },
  emptyIcon: {
    backgroundColor: 'transparent',
    alignSelf: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    marginTop: 8,
  },
  projectCard: {
    marginBottom: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  projectHeader: {
    marginBottom: 8,
  },
  projectTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 8,
  },
  statusChip: {
    height: 28,
  },
  projectDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  clientAvatar: {
    backgroundColor: '#e3f2fd',
    marginRight: 8,
  },
  clientName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  budgetIcon: {
    backgroundColor: '#e8f5e9',
    marginRight: 8,
  },
  budgetText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  projectMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  metaChip: {
    backgroundColor: '#f5f5f5',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationIcon: {
    backgroundColor: 'transparent',
    marginRight: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  distanceChip: {
    backgroundColor: '#e3f2fd',
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
    fontSize: 12,
    color: '#999',
  },
});
