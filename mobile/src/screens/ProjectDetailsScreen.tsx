import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  Avatar,
  ActivityIndicator,
  Chip,
  Portal,
  Dialog,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, Project, UserResponse } from '../services/api';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

type ProjectDetailsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ProjectDetails'>;
type ProjectDetailsScreenRouteProp = RouteProp<RootStackParamList, 'ProjectDetails'>;

interface ProjectDetailsScreenProps {
  navigation: ProjectDetailsScreenNavigationProp;
  route: ProjectDetailsScreenRouteProp;
}

export default function ProjectDetailsScreen({ navigation, route }: ProjectDetailsScreenProps): React.JSX.Element {
  const { projectId } = route.params;
  const [project, setProject] = useState<Project | null>(null);
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isLiberating, setIsLiberating] = useState<boolean>(false);
  const [showLiberateDialog, setShowLiberateDialog] = useState<boolean>(false);
  const [proposalMessage, setProposalMessage] = useState<string>('');
  const [proposalPrice, setProposalPrice] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async (): Promise<void> => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const activeRole = await AsyncStorage.getItem('active_role');

      if (!token) {
        navigation.replace('Login');
        return;
      }

      setUserRole(activeRole || '');

      const [userData, projectData] = await Promise.all([
        apiService.getCurrentUser(token),
        apiService.getProjectById(token, projectId),
      ]);

      setUser(userData);
      setProject(projectData);
    } catch (error) {
      console.error('Error loading project:', error);
      Alert.alert('Erro', 'Não foi possível carregar o projeto');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [projectId]);

  const handleLiberate = async (): Promise<void> => {
    if (!proposalMessage.trim()) {
      Alert.alert('Erro', 'Por favor, escreva uma mensagem de apresentação');
      return;
    }

    setIsLiberating(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      await apiService.createContact(token, projectId, {
        contact_type: 'proposal',
        contact_details: {
          message: proposalMessage,
          proposal_price: proposalPrice ? parseFloat(proposalPrice) : undefined,
        },
      });

      setShowLiberateDialog(false);
      setProposalMessage('');
      setProposalPrice('');

      Alert.alert('Sucesso', 'Projeto liberado com sucesso! Aguarde a resposta do cliente.');
      await loadData(); // Reload to update liberation status
    } catch (error) {
      const errorMessage = (error as Error).message || 'Erro ao liberar projeto';
      Alert.alert('Erro', errorMessage);
    } finally {
      setIsLiberating(false);
    }
  };

  const isProjectLiberated = (): boolean => {
    if (!project || !user) return false;
    return project.liberado_por?.includes(user._id) || false;
  };

  const canLiberate = (): boolean => {
    return userRole === 'professional' && !isProjectLiberated() && project?.status === 'open';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'open': return colors.success;
      case 'in_progress': return colors.secondary;
      case 'completed': return colors.info;
      case 'cancelled': return colors.error;
      case 'closed': return '#9c27b0';
      default: return '#9e9e9e';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluído';
      case 'cancelled': return 'Cancelado';
      case 'closed': return 'Fechado';
      default: return status;
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatBudget = (min?: number, max?: number): string => {
    if (!min && !max) return 'A combinar';
    if (min && max) return `R$ ${min.toFixed(2)} - R$ ${max.toFixed(2)}`;
    if (min) return `A partir de R$ ${min.toFixed(2)}`;
    if (max) return `Até R$ ${max.toFixed(2)}`;
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

  if (!project) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Projeto não encontrado</Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Voltar
          </Button>
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
          <Button
            mode="text"
            onPress={() => navigation.goBack()}
            icon="arrow-left"
            textColor={colors.primary}
          >
            Voltar
          </Button>
        </View>

        {/* Title and Status */}
        <Card style={styles.titleCard}>
          <Card.Content>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{project.title}</Text>
              <Chip
                style={[styles.statusChip, { backgroundColor: getStatusColor(project.status) + '20' }]}
                textStyle={{ color: getStatusColor(project.status) }}
              >
                {getStatusLabel(project.status)}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* Client Info */}
        {project.client_name && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Cliente</Text>
              <View style={styles.clientRow}>
                <Avatar.Icon size={40} icon="account" style={styles.clientAvatar} />
                <Text style={styles.clientName}>{project.client_name}</Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Description */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Descrição</Text>
            <Text style={styles.description}>{project.description}</Text>
          </Card.Content>
        </Card>

        {/* Budget */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Orçamento</Text>
            <View style={styles.budgetRow}>
              <Avatar.Icon size={32} icon="currency-usd" style={styles.budgetIcon} />
              <Text style={styles.budgetText}>{formatBudget(project.budget_min, project.budget_max)}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Category */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Categoria</Text>
            <View style={styles.chipsRow}>
              <Chip icon="tag" style={styles.chip}>
                {project.category.main}
              </Chip>
              {project.category.sub && (
                <Chip icon="tag-outline" style={styles.chip}>
                  {project.category.sub}
                </Chip>
              )}
              {project.remote_execution && (
                <Chip icon="laptop" style={styles.chip}>
                  Remoto
                </Chip>
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Skills */}
        {project.skills_required && project.skills_required.length > 0 && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.cardTitle}>Habilidades Necessárias</Text>
              <View style={styles.chipsRow}>
                {project.skills_required.map((skill, index) => (
                  <Chip key={index} icon="check-circle" style={styles.chip}>
                    {skill}
                  </Chip>
                ))}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Location */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Localização</Text>
            <View style={styles.locationRow}>
              <Avatar.Icon size={24} icon="map-marker" style={styles.locationIcon} />
              <Text style={styles.locationText}>{project.location.address}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Dates */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Informações</Text>
            <View style={styles.infoRow}>
              <Avatar.Icon size={24} icon="calendar-plus" style={styles.infoIcon} />
              <Text style={styles.infoText}>Publicado em {formatDate(project.created_at)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Avatar.Icon size={24} icon="calendar-edit" style={styles.infoIcon} />
              <Text style={styles.infoText}>Atualizado em {formatDate(project.updated_at)}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Liberation Status */}
        {isProjectLiberated() && (
          <Card style={styles.successCard}>
            <Card.Content>
              <View style={styles.successContent}>
                <Avatar.Icon size={48} icon="check-circle" color={colors.success} style={styles.successIcon} />
                <Text style={styles.successTitle}>Projeto Liberado</Text>
                <Text style={styles.successText}>
                  Você já liberou este projeto. O cliente poderá entrar em contato com você.
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Contract Management - Show for project participants */}
        {(project?.client_id === user?._id || isProjectLiberated()) && (
          <Button
            mode="outlined"
            onPress={() => navigation.navigate('ContractManagement', {
              projectId: project._id,
              professionalId: isProjectLiberated() ? user._id : (project.liberado_por?.[0] || ''),
            })}
            style={styles.contractButton}
            icon="file-document"
          >
            Gerenciar Contratos
          </Button>
        )}

        {/* Actions */}
        {canLiberate() && (
          <Button
            mode="contained"
            onPress={() => setShowLiberateDialog(true)}
            style={styles.liberateButton}
            icon="hand-wave"
          >
            Liberar Projeto
          </Button>
        )}
      </ScrollView>

      {/* Liberate Dialog */}
      <Portal>
        <Dialog visible={showLiberateDialog} onDismiss={() => setShowLiberateDialog(false)}>
          <Dialog.Title>Liberar Projeto</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogDescription}>
              Ao liberar este projeto, você gastará 1 crédito e poderá conversar com o cliente.
            </Text>
            <TextInput
              label="Mensagem de Apresentação *"
              value={proposalMessage}
              onChangeText={setProposalMessage}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.textInput}
              placeholder="Conte sobre sua experiência e interesse no projeto..."
            />
            <TextInput
              label="Valor da Proposta (opcional)"
              value={proposalPrice}
              onChangeText={setProposalPrice}
              mode="outlined"
              keyboardType="numeric"
              style={styles.textInput}
              placeholder="R$ 0.00"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowLiberateDialog(false)}>Cancelar</Button>
            <Button
              onPress={handleLiberate}
              loading={isLiberating}
              disabled={isLiberating}
            >
              Confirmar
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.base,
    fontSize: typography.fontSize.md,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  scrollContent: {
    padding: spacing.base,
  },
  header: {
    marginBottom: spacing.sm,
  },
  titleCard: {
    backgroundColor: colors.white,
    marginBottom: spacing.base,
    ...shadows.base,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  statusChip: {
    height: 32,
  },
  card: {
    backgroundColor: colors.white,
    marginBottom: spacing.base,
    ...shadows.base,
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientAvatar: {
    backgroundColor: '#e3f2fd',
    marginRight: 12,
  },
  clientName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  description: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  budgetIcon: {
    backgroundColor: '#e8f5e9',
    marginRight: 12,
  },
  budgetText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: colors.backgroundDark,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  locationText: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  infoIcon: {
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  infoText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  successCard: {
    backgroundColor: '#e8f5e9',
    marginBottom: spacing.base,
    ...shadows.base,
  },
  successContent: {
    alignItems: 'center',
  },
  successIcon: {
    backgroundColor: 'transparent',
    marginBottom: spacing.md,
  },
  successTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#2e7d32',
    marginBottom: spacing.sm,
  },
  successText: {
    fontSize: typography.fontSize.base,
    color: '#2e7d32',
    textAlign: 'center',
  },
  contractButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  liberateButton: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  dialogDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.base,
  },
  textInput: {
    marginBottom: spacing.md,
  },
});
