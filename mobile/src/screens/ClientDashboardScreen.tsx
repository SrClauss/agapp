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
  FAB,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, UserResponse, Project } from '../services/api';

type ClientDashboardScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ClientDashboard'>;

interface ClientDashboardScreenProps {
  navigation: ClientDashboardScreenNavigationProp;
}

export default function ClientDashboardScreen({ navigation }: ClientDashboardScreenProps): React.JSX.Element {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      const [userData, projectsData] = await Promise.all([
        apiService.getCurrentUser(token),
        apiService.getMyProjects(token),
      ]);

      setUser(userData);
      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading data:', error);
      await handleLogout();
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
            <Avatar.Icon
              size={60}
              icon="account-circle"
              style={styles.avatar}
            />
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
            textColor="#3471b9"
            icon="plus"
            compact
          >
            Novo
          </Button>
        </View>

        {projects.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Avatar.Icon
                size={80}
                icon="folder-open"
                style={styles.emptyIcon}
                color="#999"
              />
              <Text style={styles.emptyTitle}>Nenhum projeto ainda</Text>
              <Text style={styles.emptySubtitle}>
                Crie seu primeiro projeto e conecte-se com profissionais qualificados!
              </Text>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('CreateProject')}
                style={styles.createButton}
              >
                Criar Primeiro Projeto
              </Button>
            </Card.Content>
          </Card>
        ) : (
          projects.map((project) => (
            <Card key={project._id} style={styles.projectCard}>
              <Card.Content>
                <View style={styles.projectHeader}>
                  <Text style={styles.projectTitle}>{project.title}</Text>
                  <Chip
                    style={[styles.statusChip, { backgroundColor: getStatusColor(project.status) + '20' }]}
                    textStyle={{ color: getStatusColor(project.status) }}
                  >
                    {getStatusLabel(project.status)}
                  </Chip>
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

      {/* FAB */}
      <FAB
        style={styles.fab}
        icon="plus"
        label="Novo Projeto"
        onPress={() => navigation.navigate('CreateProject')}
      />
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
    paddingBottom: 100,
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
    backgroundColor: '#e3f2fd',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
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
    marginBottom: 12,
    backgroundColor: '#fff',
    elevation: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  projectTitle: {
    fontSize: 16,
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
  projectMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaChip: {
    backgroundColor: '#f5f5f5',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#3471b9',
  },
});
