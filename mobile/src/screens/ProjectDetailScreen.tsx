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
import { ActivityIndicator, Chip, Card, Avatar, Divider, Button, Switch, Portal, Dialog, Paragraph } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground } from 'react-native';
import client from '../api/axiosClient';
import { updateProject } from '../api/projects';
import { getProject, Project, GeocodedAddress } from '../api/projects';
// formatted address is available on project.location.address as `.formatted` (if geocoded)
import { createContactForProject } from '../api/contacts';
import { getUserPublic } from '../api/users';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

interface RouteParams {
  projectId?: string;
  project?: Project;
  showFullInfo?: boolean;
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
  const [showFullInfo, setShowFullInfo] = useState<boolean>(Boolean(params?.showFullInfo)); // true = show all details (owner), false = limited view (professional)
  const [clientPhonePublic, setClientPhonePublic] = useState<string | null>(null);
  const [acceptDialogVisible, setAcceptDialogVisible] = useState(false);

  const loadProject = async () => {
    try {
      console.log('[ProjectDetail] params:', { projectParam: params?.project ? !!params.project : false, projectIdParam: params?.projectId });
      // Accept either full project passed in params (compatibility) or fetch by id
      let proj: Project | null = null;
      if (params?.project) {
        proj = params.project;
        // keep full client_name in project; masking handled by view mode
        setProject(proj);
      } else if (params?.projectId) {
        const data = await getProject(params.projectId);
        proj = data;
        setProject(data);
      } else {
        Alert.alert('Erro', 'ID do projeto não recebido. Voltando.');
        navigation.goBack();
        return;
      }

      // If public client info available, fetch public user info (name, phone) to fill missing fields
      if (proj && (proj.client_id || (proj as any).client)) {
        let clientId = proj.client_id || (proj as any).client || '';
        try {
          if (clientId) {
            console.log('[ProjectDetail] fetching public user for clientId=', clientId);
            const userPublic = await getUserPublic(clientId);
            if (userPublic) {
              if (!proj.client_name && userPublic.full_name) {
                setProject(prev => prev ? { ...prev, client_name: userPublic.full_name } : prev);
              }
              if (userPublic.phone) {
                setClientPhonePublic(userPublic.phone);
              }
            }
          }
        } catch (err: any) {
          // If the public user endpoint returned 404, mark client as unavailable
          if (err?.response?.status === 404) {
            console.warn(`[ProjectDetail] public user ${clientId} not found (404)`);
            setProject(prev => prev ? { ...prev, client_name: 'Cliente indisponível' } : prev);
            setClientPhonePublic(null);
          } else {
            console.warn('Failed to fetch public user info for project client:', err);
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar projeto:', error);
      // If 404, inform user and go back
      const msg = error?.response?.status === 404 ? 'Projeto não encontrado.' : 'Erro ao carregar projeto.';
      Alert.alert('Erro', msg);
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [params.projectId, params.project]);

  // Set view mode when project or user changes. If param showFullInfo is provided, it takes precedence.
  useEffect(() => {
    if (!project) return;
    try {
      if (typeof params?.showFullInfo !== 'undefined') {
        setShowFullInfo(Boolean(params.showFullInfo));
        return;
      }
      const currentUser = useAuthStore.getState().user;
      const isOwner = Boolean(currentUser && project && (String(currentUser.id) === String(project.client_id)));
      setShowFullInfo(isOwner);
    } catch (e) {
      // ignore
    }
  }, [project, user, params?.showFullInfo]);

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
              const pid = project?.id || params.projectId;
              if (!pid) {
                Alert.alert('Erro', 'ID do projeto ausente.');
                return;
              }
              const contact = await createContactForProject(pid, {
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

  function maskPhone(phone?: string) {
    if (!phone) return '—';
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length <= 4) return digits;
    const firstTwo = digits.slice(0,2);
    const lastTwo = digits.slice(-2);
    return `${firstTwo}...${lastTwo}`;
  }

  function shortLocation(proj?: Project | null) {
    const addr = proj?.location?.address as any;
    if (!addr) return '—';
    const city = addr.city || addr.town || addr.village || addr.subregion || '';
    const region = addr.region || addr.state || '';
    const postal = addr.postalCode || addr.postal_code || '';
    const parts = [] as string[];
    if (city) parts.push(city);
    if (region) parts.push(region);
    const main = parts.join(' - ');
    return `${main}${postal ? `, CEP: ${postal}` : ''}` || '—';
  }

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
          <ImageBackground source={require('../../assets/background.jpg')} style={styles.headerGradient} imageStyle={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
        {/* Top bar: back and actions */}
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <MaterialIcons name="arrow-back" size={20} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.headerActionsRight}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                // Edit: navigate to edit screen with project
                if (project) navigation.navigate('EditProject' as never, { project } as any);
              }}
            >
              
              <MaterialIcons name="edit" size={18} color={colors.primary} />
            </TouchableOpacity>


            
            <TouchableOpacity
              style={[styles.iconButton, { marginLeft: 8 }]}
              onPress={() => {
                if (!project) return Alert.alert('Erro', 'Projeto não carregado');
                Alert.alert('Confirmar exclusão', 'Deseja excluir (fechar) este projeto?', [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        setLoading(true);
                        const pid = project.id || (project as any)._id;
                        const token = useAuthStore.getState().token;
                        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
                        // Use update via client to set status closed (soft-delete)
                        await client.put(`/projects/${pid}`, { status: 'closed' }, config);
                        Alert.alert('Sucesso', 'Projeto fechado/excluído.');
                        navigation.goBack();
                      } catch (err: any) {
                        console.error('Erro ao excluir projeto:', err);
                        Alert.alert('Erro', err?.response?.data?.detail || 'Falha ao excluir');
                      } finally {
                        setLoading(false);
                      }
                    }
                  }
                ]);
              }}
            >
              <MaterialIcons name="delete" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Centered status / date / title */}
        <View style={styles.headerContent}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <View style={styles.statusRow}>
              <View style={[styles.statusPill, { backgroundColor: getStatusColor(project.status) }]}> 
                <Text style={styles.statusPillText}>{getStatusLabel(project.status)}</Text>
              </View>
              <View style={[styles.datePill, { marginLeft: 8 }] }>
                <MaterialIcons name="schedule" size={12} color="rgba(255,255,255,0.95)" />
                <Text style={[styles.dateText, { color: 'rgba(255,255,255,0.95)' }]}>  Publicado em {formatDate(project.created_at)}</Text>
              </View>
            </View>

            <Text style={[styles.headerTitleLarge, { textAlign: 'center' }]} numberOfLines={2}>{project.title}</Text>
            {project.client_name ? <Text style={[styles.headerSubtitle, { textAlign: 'center' }]}>{project.client_name}</Text> : null}

            {/* View mode toggle (only visible to owner) */}
            {user && project && String(user.id) === String(project.client_id) ? (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', marginRight: 6 }}>{showFullInfo ? 'Mostrar tudo' : 'Mostrar menos'}</Text>
                <Switch value={showFullInfo} onValueChange={v => setShowFullInfo(v)} color="#fff" />
              </View>
            ) : null}
          </View>
        </View>
      </ImageBackground>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Budget Card (top) */}
       
        <View style={styles.budgetCard}>
          <View style={styles.budgetLeft}>
            <View style={styles.budgetIcon}><MaterialIcons name="attach-money" size={22} color={colors.primary} /></View>
            <View>
              <Text style={styles.budgetLabel}>Orçamento Estimado</Text>
              <Text style={styles.budgetValue}>
                {project.budget_min && project.budget_max
                  ? `${formatCurrency(project.budget_min)} - ${formatCurrency(project.budget_max)}`
                  : project.budget_min
                  ? `A partir de ${formatCurrency(project.budget_min)}`
                  : project.budget_max
                  ? `Até ${formatCurrency(project.budget_max)}`
                  : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.cardRounded}>
          <View style={styles.cardContentPadded}>
            <Text style={styles.sectionTitle}>Detalhes técnicos</Text>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><MaterialIcons name="construction" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Serviço</Text>
                <Text style={styles.detailTitle}>{getCategoryDisplay(project.category)}</Text>
                {typeof project.category !== 'string' && project.category.sub ? (
                  <Text style={styles.detailSub}>{project.category.sub}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><MaterialIcons name="person" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Cliente Responsável</Text>
                <Text style={styles.detailTitle}>{showFullInfo ? (project.client_name || '—') : (project.client_name ? String(project.client_name).split(' ')[0] : '—')}</Text>
                {(!showFullInfo && (clientPhonePublic || (project as any).client_phone)) ? (
                  <Text style={styles.detailSub}>{maskPhone(clientPhonePublic || (project as any).client_phone || '')}</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}><MaterialIcons name="location-on" size={20} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Local da Obra</Text>
              {showFullInfo ? (
                <>
                  <Text style={styles.detailTitle}>{(project.location?.address as GeocodedAddress)?.formatted || ''}</Text>
                  {(project.location?.address as any)?.postalCode ? <Text style={styles.detailSub}>CEP: {(project.location?.address as any).postalCode}</Text> : null}
                </>
              ) : (
                <>
                  <Text style={styles.detailTitle}>{shortLocation(project)}</Text>
                </>
              )}
              </View>
            </View>
          </View>
        </View>

        {/* Description */}
        <View style={styles.cardRounded}>
          <View style={styles.cardContentPadded}>
            <Text style={styles.sectionTitle}>Sobre o pedido</Text>
            <Text style={styles.description}>{project.description}</Text>
          </View>
        </View>

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

        {/* Footer Status Banner */}
        <View style={styles.footerBanner}>
          <View style={styles.footerBadge}><MaterialIcons name="check-circle" size={24} color="rgba(59,130,246,0.15)" /></View>
          <Text style={styles.footerTitle}>{getStatusLabel(project.status)}</Text>
          <Text style={styles.footerSubtitle}>As informações acima representam o estado atual deste pedido de serviço.</Text>
        </View>

        {/* Accept & Contact Button for Professionals */}
        {user && user.roles.includes('professional') && project.status === 'open' && !showFullInfo && (
          <View style={styles.actionButtonContainer}>
            <Button
              mode="contained"
              onPress={() => setAcceptDialogVisible(true)}
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

        {/* Accept confirmation dialog (modal) */}
        <Portal>
          <Dialog visible={acceptDialogVisible} onDismiss={() => setAcceptDialogVisible(false)}>
            <Dialog.Title>Confirmar Aceitação</Dialog.Title>
            <Dialog.Content>
              <Paragraph>Você confirma que deseja aceitar este projeto e iniciar contato com o cliente?</Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setAcceptDialogVisible(false)}>Não</Button>
              <Button onPress={() => {
                setAcceptDialogVisible(false);
                // TODO: Implementar lógica de aceitação (cobrar crédito, criar contato, etc.)
                // Por enquanto simulamos aceitação alterando o modo de exibição para full
                setShowFullInfo(true);
                Alert.alert('Aceitação confirmada', 'A lógica de aceite será implementada em breve.');
              }}>Sim</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
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
  headerGradient: {
    height: 180,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    marginLeft: 20,
    marginRight: 20,
    overflow: 'hidden',
  },
  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  iconButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
  },
  headerActionsRight: { flexDirection: 'row', alignItems: 'center' },
  headerContent: { paddingHorizontal: 16, paddingTop: 14, alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, justifyContent: 'center' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, marginRight: 8 },
  statusPillText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  datePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12 },
  dateText: { color: 'rgba(255,255,255,0.9)', fontSize: 12 },
  headerTitleLarge: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 6 },
  headerSubtitle: { color: 'rgba(255,255,255,0.9)', marginTop: 4 },
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
  /* New card style with rounded 3xl look */
  cardRounded: {
    marginBottom: 16,
    borderRadius: 24,
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 30,
    elevation: 3,
    overflow: 'hidden',
  },
  cardContentPadded: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  /* Budget card */
  budgetCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  budgetLeft: { flexDirection: 'row', alignItems: 'center' },
  budgetIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#FAFAFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  budgetLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', fontWeight: '800' },
  budgetValue: { fontSize: 18, fontWeight: '900', color: colors.text },

  divider: {
    marginVertical: 16,
  },
  descriptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  detailIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FAFAFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  detailLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' },
  detailTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  detailSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },

  professionalsContainer: {
    gap: 12,
  },
  footerBanner: { backgroundColor: 'rgba(99,102,241,0.08)', borderRadius: 24, padding: 20, alignItems: 'center', marginBottom: 16 },
  footerBadge: { padding: 12, backgroundColor: '#fff', borderRadius: 16, marginBottom: 8 },
  footerTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  footerSubtitle: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
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
