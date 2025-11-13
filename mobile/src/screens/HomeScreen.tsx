import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Avatar,
  ActivityIndicator,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, UserResponse } from '../services/api';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps): React.JSX.Element {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeRole, setActiveRole] = useState<string>('client');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        navigation.replace('Login');
        return;
      }

      // Load active role
      const role = await AsyncStorage.getItem('active_role');
      if (role) {
        setActiveRole(role);
      }

      const userData = await apiService.getCurrentUser(token);
      setUser(userData);
    } catch (error) {
      console.error('Error loading user data:', error);
      // Token might be invalid, redirect to login
      await handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    // Remove session data (roles will be fetched from backend on next login)
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

  const getRoleLabel = (role: string): string => {
    if (role === 'client') return 'Cliente';
    if (role === 'professional') return 'Profissional';
    if (role === 'admin') return 'Administrador';
    return role;
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Avatar.Icon
              size={60}
              icon="account-circle"
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Bem-vindo!</Text>
              <Text style={styles.userName}>{user?.full_name}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <Text style={styles.rolebadge}>
                {activeRole === 'client' ? '👤' : '🔧'} {getRoleLabel(activeRole)}
              </Text>
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

        {/* Success Card */}
        <Card style={styles.successCard}>
          <Card.Content>
            <View style={styles.successContent}>
              <Avatar.Icon
                size={80}
                icon="check-circle"
                style={styles.successIcon}
                color="#fff"
              />
              <Text style={styles.successTitle}>Login realizado com sucesso!</Text>
              <Text style={styles.successSubtitle}>
                Você está autenticado e pronto para usar o Agilizapp.
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* User Details Card */}
        <Card style={styles.card}>
          <Card.Title title="Informações do Usuário" />
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nome:</Text>
              <Text style={styles.infoValue}>{user?.full_name}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>CPF:</Text>
              <Text style={styles.infoValue}>{user?.cpf}</Text>
            </View>
            {user?.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Telefone:</Text>
                <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
            )}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Créditos:</Text>
              <Text style={styles.infoValue}>{user?.credits || 0}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Perfil:</Text>
              <Text style={styles.infoValue}>
                {user?.roles.map(role => {
                  if (role === 'client') return 'Cliente';
                  if (role === 'professional') return 'Profissional';
                  if (role === 'admin') return 'Administrador';
                  return role;
                }).join(', ')}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* Info Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.infoText}>
              Esta é uma tela de demonstração. A integração com o backend está funcionando corretamente!
            </Text>
            <Text style={styles.infoText} style={{ marginTop: 12 }}>
              Recursos disponíveis:
            </Text>
            <Text style={styles.bulletPoint}>• Autenticação com JWT</Text>
            <Text style={styles.bulletPoint}>• Armazenamento seguro de tokens</Text>
            <Text style={styles.bulletPoint}>• Dados do usuário carregados da API</Text>
            <Text style={styles.bulletPoint}>• Logout funcional</Text>
          </Card.Content>
        </Card>
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
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  rolebadge: {
    fontSize: 12,
    color: '#3471b9',
    marginTop: 4,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  successCard: {
    marginBottom: 16,
    backgroundColor: '#3471b9',
    elevation: 3,
  },
  successContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIcon: {
    backgroundColor: '#5a8fd9',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 16,
    color: '#e8f0ff',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    width: 100,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    marginTop: 4,
  },
});
