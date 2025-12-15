import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Chip, Card, Avatar, Divider, Button } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { getProject, Project, GeocodedAddress } from '../api/projects';
// formatted address is available on project.location.address as `.formatted` (if geocoded)
import { createContactForProject } from '../api/contacts';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

interface RouteParams {
  projectId: string;
}

export default function ProjectDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const params = route.params as RouteParams;
  const { user } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contacting, setContacting] = useState(false);

  const loadProject = async () => {
    try {
      const data = await getProject(params.projectId);
      setProject(data);
    } catch (error) {
      console.error('Erro ao carregar projeto:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [params.projectId]);

  const onRefresh = () => {
    setRefreshing(true);
    loadProject();
  };

  const handleAcceptAndContact = async () => {
    if (!user) {
      Alert.alert('Erro', 'Você precisa estar logado');
      return;
    }

    if (!user.roles.includes('professional')) {
      Alert.alert('Erro', 'Apenas profissionais podem aceitar projetos');
      return;
    }

    Alert.alert(
      'Aceitar Projeto',
      'Ao aceitar, você gastará 1 crédito e poderá conversar com o cliente. Deseja continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceitar',
          onPress: async () => {
            try {
              setContacting(true);
              const contact = await createContactForProject(params.projectId, {
                contact_type: 'proposal',
                contact_details: {
                  message: 'Tenho interesse neste projeto!',
                },
              });

              Alert.alert(
                'Sucesso!',
                'Contato criado com sucesso! Você já pode conversar com o cliente.',
                [
                  {
                    text: 'Ver Chat',
                    onPress: () => (navigation as any).navigate('Chat', { contactId: contact.id }),
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error creating contact:', error);
              const errorMsg = error.response?.data?.detail || 'Falha ao criar contato';
              Alert.alert('Erro', errorMsg);
            } finally {
              setContacting(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return colors.success;
      case 'closed':
        return colors.textSecondary;
      case 'in_progress':
        return colors.info;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Aberto';
      case 'closed':
        return 'Fechado';
      case 'in_progress':
        return 'Em Andamento';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '-';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const getCategoryDisplay = (category: Project['category']) => {
    if (typeof category === 'string') {
      return category;
    }
    return `${category.main} › ${category.sub}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={colors.error} />
          <Text style={styles.errorText}>Projeto não encontrado</Text>
          <Button mode="contained" onPress={() => navigation.goBack()}>
            Voltar
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {project.title}
          </Text>
          <Chip
            style={[styles.statusChip, { backgroundColor: getStatusColor(project.status) }]}
            textStyle={styles.statusChipText}
          >
            {getStatusLabel(project.status)}
          </Chip>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Project Info Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Detalhes do Projeto</Text>
            
            <View style={styles.infoRow}>
              <MaterialIcons name="category" size={20} color={colors.textSecondary} />
              <Text style={styles.infoText}>{getCategoryDisplay(project.category)}</Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="event" size={20} color={colors.textSecondary} />
              <Text style={styles.infoText}>Criado em {formatDate(project.created_at)}</Text>
            </View>

            {project.location?.address && (
              <View style={styles.infoRow}>
                <MaterialIcons name="location-on" size={20} color={colors.textSecondary} />
                <Text style={styles.infoText}>{(project.location.address as GeocodedAddress)?.formatted || (project.location.address as GeocodedAddress)?.name || (project.location.address as GeocodedAddress)?.display_name || String(project.location.address || '')}</Text>
              </View>
            )}

            {project.remote_execution && (
              <View style={styles.infoRow}>
                <MaterialIcons name="wifi" size={20} color={colors.info} />
                <Text style={[styles.infoText, { color: colors.info }]}>
                  Aceita execução remota
                </Text>
              </View>
            )}

            <Divider style={styles.divider} />

            <Text style={styles.descriptionTitle}>Descrição</Text>
            <Text style={styles.description}>{project.description}</Text>

            {(project.budget_min || project.budget_max) && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.budgetContainer}>
                  <Text style={styles.budgetTitle}>Orçamento</Text>
                  <Text style={styles.budgetText}>
                    {project.budget_min && project.budget_max
                      ? `${formatCurrency(project.budget_min)} - ${formatCurrency(project.budget_max)}`
                      : project.budget_min
                      ? `A partir de ${formatCurrency(project.budget_min)}`
                      : `Até ${formatCurrency(project.budget_max)}`}
                  </Text>
                </View>
              </>
            )}

            {project.final_budget && (
              <>
                <Divider style={styles.divider} />
                <View style={styles.budgetContainer}>
                  <Text style={styles.budgetTitle}>Valor Final</Text>
                  <Text style={[styles.budgetText, { color: colors.success }]}>
                    {formatCurrency(project.final_budget)}
                  </Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Professionals who contacted */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>
              Profissionais que entraram em contato
            </Text>
            
            {project.liberado_por_profiles && project.liberado_por_profiles.length > 0 ? (
              <View style={styles.professionalsContainer}>
                {project.liberado_por_profiles.map((p) => (
                  <View key={p.id} style={styles.professionalItem}>
                    {p.avatar_url ? (
                      <Avatar.Image
                        size={48}
                        source={{ uri: p.avatar_url }}
                        style={styles.professionalAvatar}
                      />
                    ) : (
                      <Avatar.Icon
                        size={48}
                        icon="account"
                        style={styles.professionalAvatar}
                      />
                    )}
                    <View style={styles.professionalInfo}>
                      <Text style={styles.professionalName}>
                        {p.full_name || 'Profissional'}
                      </Text>
                      <Text style={styles.professionalId}>
                        ID: {p.id.substring(0, 8)}...
                      </Text>
                    </View>
                    <View style={styles.contactButtonPlaceholder}>
                      <MaterialIcons name="chat" size={20} color={colors.textDisabled} />
                    </View>
                  </View>
                ))}
                <Text style={styles.futureFeatureText}>
                  Em breve: possibilidade de contatar profissionais diretamente
                </Text>
              </View>
            ) : project.liberado_por && project.liberado_por.length > 0 ? (
              <View style={styles.professionalsContainer}>
                {project.liberado_por.map((professionalId, index) => (
                  <View key={professionalId} style={styles.professionalItem}>
                    <Avatar.Icon
                      size={48}
                      icon="account"
                      style={styles.professionalAvatar}
                    />
                    <View style={styles.professionalInfo}>
                      <Text style={styles.professionalName}>
                        Profissional #{index + 1}
                      </Text>
                      <Text style={styles.professionalId}>
                        ID: {professionalId.substring(0, 8)}...
                      </Text>
                    </View>
                    <View style={styles.contactButtonPlaceholder}>
                      <MaterialIcons name="chat" size={20} color={colors.textDisabled} />
                    </View>
                  </View>
                ))}
                <Text style={styles.futureFeatureText}>
                  Em breve: possibilidade de contatar profissionais diretamente
                </Text>
              </View>
            ) : (
              <View style={styles.emptyProfessionals}>
                <MaterialIcons name="person-search" size={48} color={colors.textDisabled} />
                <Text style={styles.emptyProfessionalsText}>
                  Nenhum profissional entrou em contato ainda
                </Text>
                {project.status === 'open' && (
                  <Text style={styles.emptyProfessionalsHint}>
                    Aguarde, profissionais da região serão notificados
                  </Text>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Closed by info */}
        {project.closed_by && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Projeto Fechado</Text>
              <View style={styles.closedByContainer}>
                <Avatar.Icon size={48} icon="check-circle" style={styles.closedAvatar} />
                <View style={styles.closedInfo}>
                  <Text style={styles.closedByName}>
                    {project.closed_by_name || 'Profissional'}
                  </Text>
                  {project.closed_at && (
                    <Text style={styles.closedDate}>
                      Fechado em {formatDate(project.closed_at)}
                    </Text>
                  )}
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Accept & Contact Button for Professionals */}
        {user && user.roles.includes('professional') && project.status === 'open' && (
          <View style={styles.actionButtonContainer}>
            <Button
              mode="contained"
              onPress={handleAcceptAndContact}
              loading={contacting}
              disabled={contacting}
              style={styles.acceptButton}
              icon="handshake"
            >
              Aceitar & Contatar Cliente
            </Button>
            <Text style={styles.actionButtonHint}>
              * Gastará 1 crédito para iniciar conversa
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  statusChip: {
    height: 28,
  },
  statusChipText: {
    color: '#fff',
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    flex: 1,
  },
  divider: {
    marginVertical: 16,
  },
  descriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  budgetContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  budgetText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  professionalsContainer: {
    gap: 12,
  },
  professionalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  professionalAvatar: {
    backgroundColor: colors.primary,
  },
  professionalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  professionalName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  professionalId: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactButtonPlaceholder: {
    padding: 8,
    opacity: 0.5,
  },
  futureFeatureText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyProfessionals: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyProfessionalsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
  },
  emptyProfessionalsHint: {
    fontSize: 12,
    color: colors.textDisabled,
    marginTop: 4,
    textAlign: 'center',
  },
  closedByContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closedAvatar: {
    backgroundColor: colors.success,
  },
  closedInfo: {
    marginLeft: 12,
  },
  closedByName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  closedDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButtonContainer: {
    padding: 16,
  },
  acceptButton: {
    paddingVertical: 8,
  },
  actionButtonHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
